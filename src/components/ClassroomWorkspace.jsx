import { useCallback, useEffect, useRef, useState } from "react";
import { deleteApi, getApi, getApiFile, postApi, prepareFormDataForUpload } from "../api/client.js";

const dateLabel = (value) => value
  ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "No due date";

function downloadFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name || "classroom-attachment";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ClassroomPost({ item, type, courseId, isInstructor, onDelete, onNotice }) {
  const fileType = type === "announcement" ? "announcements" : type === "assignment" ? "assignments" : "materials";
  const fileUrl = `/classrooms/${courseId}/files/${fileType}/${item.id}`;
  const attachmentName = item.originalFileName;
  const [videoUrl, setVideoUrl] = useState("");

  useEffect(() => {
    if (item.kind !== "video" || !item.attachmentKey) return undefined;
    let active = true;
    let objectUrl;
    getApiFile(fileUrl)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
      })
      .catch((error) => {
        if (active) onNotice({ type: "error", message: error.message });
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl, item.attachmentKey, item.kind, onNotice]);

  const downloadAttachment = async () => {
    try {
      downloadFile(await getApiFile(fileUrl), attachmentName);
    } catch (error) {
      onNotice({ type: "error", message: error.message });
    }
  };

  return (
    <article className="classroom-post">
      <div className="classroom-post__heading">
        <div>
          <span className="auth-eyebrow">{type === "announcement" ? "Announcement" : type === "assignment" ? "Assignment" : item.kind === "video" ? "Video" : item.kind === "link" ? "Link" : item.kind === "file" ? "File" : "Class note"}</span>
          <h3>{item.title}</h3>
        </div>
        {isInstructor && (
          <button className="btn btn--danger" type="button" onClick={() => onDelete(type === "announcement" ? "announcements" : `${type}s`, item)}>
            Delete
          </button>
        )}
      </div>
      {type === "announcement" ? <p>{item.body}</p> : <p>{type === "material" ? item.description : item.instructions}</p>}
      {type === "assignment" && <p className="classroom-post__meta">Due {dateLabel(item.dueAt)}</p>}
      {item.url && <a className="btn btn--ghost" href={item.url} target="_blank" rel="noopener noreferrer">{item.kind === "video" ? "Watch video" : "Open link"}</a>}
      {item.kind === "video" && videoUrl && <video className="classroom-post__video" controls preload="metadata" src={videoUrl}>Your browser cannot play this video.</video>}
      {item.attachmentKey && item.kind !== "video" && (
        <button className="btn btn--ghost" type="button" onClick={downloadAttachment}>
          Download {attachmentName || "attachment"}
        </button>
      )}
      <p className="classroom-post__meta">{item.instructorName && `${item.instructorName} · `}Posted {dateLabel(item.createdAt)}</p>
    </article>
  );
}

export default function ClassroomWorkspace({ role, onNotice }) {
  const isInstructor = role === "instructor" || role === "admin";
  const [classrooms, setClassrooms] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const loadedClassroomId = useRef("");
  const [classroom, setClassroom] = useState(null);
  const [roster, setRoster] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [classroomRevision, setClassroomRevision] = useState(0);

  const refreshClassrooms = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getApi("/classrooms");
      const items = result.classrooms || [];
      setClassrooms(items);
      setSelectedId((current) => items.some((item) => String(item.id) === String(current))
        ? current
        : String(items[0]?.id || ""));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [revision]);

  useEffect(() => { refreshClassrooms(); }, [refreshClassrooms]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setClassroomRevision((value) => value + 1);
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setClassroom(null);
      setRoster([]);
      loadedClassroomId.current = "";
      return undefined;
    }
    let active = true;
    if (loadedClassroomId.current !== selectedId) setDetailLoading(true);
    Promise.all([
      getApi(`/classrooms/${selectedId}`),
      isInstructor ? getApi(`/classrooms/${selectedId}/roster`) : Promise.resolve({ students: [] }),
    ])
      .then(([detail, rosterResult]) => {
        if (!active) return;
        setClassroom(detail.classroom);
        setRoster(rosterResult.students || []);
        loadedClassroomId.current = selectedId;
      })
      .catch((requestError) => {
        if (active) onNotice({ type: "error", message: requestError.message });
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => { active = false; };
  }, [classroomRevision, isInstructor, onNotice, selectedId]);

  const joinClass = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await postApi("/classrooms/join", { joinCode });
      setJoinCode("");
      onNotice({ type: "success", message: result.message || "Joined class." });
      setRevision((value) => value + 1);
      setClassroomRevision((value) => value + 1);
      setSelectedId(String(result.classroom.id));
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    } finally {
      setSaving(false);
    }
  };

  const postToClass = async (event, type) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSaving(true);
    try {
      let result;
      if (type === "stream") {
        const kind = formData.get("kind");
        const title = formData.get("title") || ({
          announcement: "Class announcement",
          note: "Class note",
          link: "Shared link",
          video: "Shared video",
          file: "Shared file",
        }[kind]);
        if (kind === "announcement") {
          result = await postApi(`/classrooms/${selectedId}/announcements`, {
            title,
            body: formData.get("body"),
          });
        } else {
          formData.set("title", title);
          formData.set("description", formData.get("body"));
          await prepareFormDataForUpload(formData);
          result = await postApi(`/classrooms/${selectedId}/materials`, formData);
        }
      } else {
        if (type === "assignments" && formData.get("dueAt")) {
          formData.set("dueAt", new Date(formData.get("dueAt")).toISOString());
        }
        await prepareFormDataForUpload(formData);
        result = await postApi(`/classrooms/${selectedId}/${type}`, formData);
      }
      form.reset();
      onNotice({ type: "success", message: result.message || "Posted to the class." });
      setClassroomRevision((value) => value + 1);
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    } finally {
      setSaving(false);
    }
  };

  const deletePost = async (itemType, item) => {
    if (!window.confirm(`Delete "${item.title}" from this class?`)) return;
    try {
      await deleteApi(`/classrooms/${selectedId}/${itemType}/${item.id}`);
      onNotice({ type: "success", message: "Class post deleted." });
      setClassroomRevision((value) => value + 1);
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    }
  };

  const copyJoinCode = async () => {
    try {
      await navigator.clipboard.writeText(classrooms.find((item) => String(item.id) === selectedId)?.joinCode || "");
      onNotice({ type: "success", message: "Class code copied." });
    } catch {
      onNotice({ type: "error", message: "Copy is unavailable. Select and copy the class code instead." });
    }
  };

  const streamItems = classroom
    ? [
      ...classroom.announcements.map((item) => ({ ...item, streamType: "announcement" })),
      ...classroom.materials.map((item) => ({ ...item, streamType: "material" })),
      ...classroom.assignments.map((item) => ({ ...item, streamType: "assignment" })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : [];

  return (
    <div className="classroom-workspace">
      <section className="dashboard-panel" aria-labelledby="classroom-list-title">
        <div className="dashboard-panel__heading">
          <div>
            <h2 id="classroom-list-title">{isInstructor ? "Your classrooms" : "My classes"}</h2>
            <p>{isInstructor ? "Share a class code so students can join." : "Open a class or join with a code from your instructor."}</p>
          </div>
          <button
            className="btn btn--ghost"
            type="button"
            disabled={loading}
            onClick={() => {
              setRevision((value) => value + 1);
              setClassroomRevision((value) => value + 1);
            }}
          >
            Refresh
          </button>
        </div>

        {!isInstructor && (
          <form className="dashboard-form" onSubmit={joinClass}>
            <h3>Join a class</h3>
            <div className="dashboard-form__grid">
              <label className="field">
                <span>Class code</span>
                <input required minLength={12} maxLength={12} autoCapitalize="characters" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} />
              </label>
            </div>
            <div className="dashboard-form__actions">
              <button className="btn btn--primary" type="submit" disabled={saving}>{saving ? "Joining…" : "Join class"}</button>
              <a className="btn btn--ghost" href="#courses">Browse courses</a>
            </div>
          </form>
        )}

        {loading ? <p className="collection-status" role="status">Loading classrooms…</p>
          : error ? <div className="collection-status collection-status--error" role="alert"><p>{error}</p><button className="btn btn--ghost" type="button" onClick={() => setRevision((value) => value + 1)}>Try again</button></div>
            : classrooms.length === 0 ? <p className="collection-status">{isInstructor ? "Create a course first, then manage it here as a classroom." : "You have not joined any classes yet."}</p>
              : (
                <div className="classroom-list" aria-label="Classrooms">
                  {classrooms.map((item) => (
                    <button
                      className="classroom-list__item"
                      type="button"
                      aria-pressed={selectedId === String(item.id)}
                      key={item.id}
                      onClick={() => setSelectedId(String(item.id))}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.instructor?.name || item.category}</span>
                      <span>{item._count?.enrollments ?? 0} students</span>
                    </button>
                  ))}
                </div>
              )}
      </section>

      {classroom && (
        <section className="dashboard-panel" aria-labelledby="classroom-title">
          <div className="dashboard-panel__heading">
            <div>
              <span className="auth-eyebrow">{classroom.category}</span>
              <h2 id="classroom-title">{classroom.title}</h2>
              <p>{classroom.description}</p>
            </div>
            {isInstructor && (
              <div className="classroom-code">
                <span>Class code</span>
                <code>{classroom.joinCode}</code>
                <button className="btn btn--ghost" type="button" onClick={copyJoinCode}>Copy code</button>
              </div>
            )}
          </div>

          {detailLoading ? <p className="collection-status" role="status">Loading class activity…</p> : (
            <>
              {isInstructor && (
                <>
                  <form className="dashboard-form" onSubmit={(event) => postToClass(event, "stream")}>
                    <h3>Share with your class</h3>
                    <div className="dashboard-form__grid">
                      <label className="field">
                        <span>Post type</span>
                        <select name="kind" defaultValue="note">
                          <option value="note">Note</option>
                          <option value="announcement">Announcement</option>
                          <option value="link">Link</option>
                          <option value="video">Video</option>
                          <option value="file">File</option>
                        </select>
                      </label>
                      <label className="field"><span>Title (optional)</span><input name="title" maxLength={150} /></label>
                      <label className="field dashboard-form__wide"><span>Message or notes</span><textarea name="body" maxLength={10000} /></label>
                      <label className="field dashboard-form__wide"><span>Link (for links or online videos)</span><input name="url" type="url" placeholder="https://" /></label>
                      <label className="field dashboard-form__wide"><span>Attachment (documents, images, MP4, or WebM; up to 25 MB)</span><input name="attachment" type="file" accept=".pdf,.doc,.docx,.pptx,.jpg,.jpeg,.png,.mp4,.webm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png,video/mp4,video/webm" /></label>
                    </div>
                    <button className="btn btn--primary" type="submit" disabled={saving}>Post to class</button>
                  </form>

                  <form className="dashboard-form" onSubmit={(event) => postToClass(event, "assignments")}>
                    <h3>Create an assignment</h3>
                    <div className="dashboard-form__grid">
                      <label className="field"><span>Title</span><input name="title" required maxLength={150} /></label>
                      <label className="field"><span>Due date</span><input name="dueAt" type="datetime-local" /></label>
                      <label className="field dashboard-form__wide"><span>Instructions</span><textarea name="instructions" required maxLength={10000} /></label>
                      <label className="field dashboard-form__wide"><span>Attachment (optional, up to 25 MB)</span><input name="attachment" type="file" accept=".pdf,.doc,.docx,.pptx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png" /></label>
                    </div>
                    <button className="btn btn--primary" type="submit" disabled={saving}>Post assignment</button>
                  </form>
                </>
              )}

              {isInstructor && (
                <section className="classroom-feed" aria-labelledby="classroom-roster-title">
                  <h3 id="classroom-roster-title">Class roster <span className="dashboard-badge">{roster.length}</span></h3>
                  {roster.length === 0 ? <p className="collection-status">Students who join with the class code will appear here.</p> : (
                    <ul className="classroom-roster">
                      {roster.map((student) => <li key={student.id}><strong>{student.name}</strong><span>{student.email}</span></li>)}
                    </ul>
                  )}
                </section>
              )}

              <section className="classroom-feed" aria-labelledby="classroom-stream-title">
                <h3 id="classroom-stream-title">Class stream</h3>
                {streamItems.length === 0
                  ? <p className="collection-status">Your instructor’s posts, notes, videos, links, and assignments will appear here.</p>
                  : streamItems.map((item) => (
                    <ClassroomPost
                      key={`${item.streamType}-${item.id}`}
                      item={{ ...item, instructorName: classroom.instructor?.name }}
                      type={item.streamType}
                      courseId={classroom.id}
                      isInstructor={isInstructor}
                      onDelete={deletePost}
                      onNotice={onNotice}
                    />
                  ))}
              </section>
            </>
          )}
        </section>
      )}
    </div>
  );
}
