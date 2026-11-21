import { useCallback, useEffect, useState } from "react";
import { deleteApi, getApi, getApiFile, postApi, prepareFormDataForUpload, putApi } from "../api/client.js";

const formatDate = (value) => value
  ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "No due date";

function saveDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name || "lesson-resource";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function LessonAttachment({ lesson, courseId, onNotice }) {
  const [videoUrl, setVideoUrl] = useState("");
  const isVideo = /\.(mp4|webm)$/i.test(lesson.originalFileName || "");

  useEffect(() => {
    if (!isVideo || !lesson.attachmentKey) return undefined;
    let active = true;
    let objectUrl;
    getApiFile(`/classrooms/${courseId}/files/lessons/${lesson.id}`)
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
  }, [courseId, isVideo, lesson.attachmentKey, lesson.id, onNotice]);

  const download = async () => {
    try {
      saveDownload(await getApiFile(`/classrooms/${courseId}/files/lessons/${lesson.id}`), lesson.originalFileName);
    } catch (error) {
      onNotice({ type: "error", message: error.message });
    }
  };

  if (!lesson.attachmentKey) return null;
  return isVideo
    ? videoUrl && <video className="classroom-post__video" controls preload="metadata" src={videoUrl}>Your browser cannot play this video.</video>
    : <button className="btn btn--ghost" type="button" onClick={download}>Download {lesson.originalFileName || "resource"}</button>;
}

export default function LearningWorkspace({ mode, onNotice }) {
  const isStudent = mode === "learning";
  const [classrooms, setClassrooms] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [learning, setLearning] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const refreshCourses = useCallback(async () => {
    setLoadingCourses(true);
    setError("");
    try {
      const result = await getApi("/classrooms");
      const items = result.classrooms || [];
      setClassrooms(items);
      setSelectedId((current) => items.some((course) => String(course.id) === current)
        ? current
        : String(items[0]?.id || ""));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  useEffect(() => { refreshCourses(); }, [refreshCourses]);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!selectedId) {
      setLearning(null);
      setSubmissions([]);
      return undefined;
    }
    let active = true;
    setLoading(true);
    Promise.all([
      getApi(`/classrooms/${selectedId}/learning`),
      isStudent ? Promise.resolve({ submissions: [] }) : getApi(`/classrooms/${selectedId}/submissions`),
    ])
      .then(([learningResult, submissionsResult]) => {
        if (!active) return;
        setLearning(learningResult);
        setSubmissions(submissionsResult.submissions || []);
      })
      .catch((requestError) => {
        if (active) onNotice({ type: "error", message: requestError.message });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [isStudent, onNotice, revision, selectedId]);

  useEffect(() => {
    if (!isStudent || !selectedId) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [isStudent, refresh, selectedId]);

  const runSave = async (action, successMessage) => {
    setSaving(true);
    try {
      const result = await action();
      onNotice({ type: "success", message: result?.message || successMessage });
      refresh();
      return result;
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const createModule = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    void runSave(
      () => postApi(`/classrooms/${selectedId}/modules`, {
        title: formData.get("title"),
        description: formData.get("description"),
      }),
      "Module created."
    ).then((result) => { if (result) form.reset(); });
  };

  const createLesson = async (event, moduleId) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    await prepareFormDataForUpload(formData);
    void runSave(
      () => postApi(`/classrooms/${selectedId}/modules/${moduleId}/lessons`, formData),
      "Lesson added."
    ).then((result) => { if (result) form.reset(); });
  };

  const createAssignment = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const dueAt = formData.get("dueAt");
    void runSave(
      () => postApi(`/classrooms/${selectedId}/assignments`, {
        title: formData.get("title"),
        instructions: formData.get("instructions"),
        moduleId: formData.get("moduleId") || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      }),
      "Assignment created."
    ).then((result) => { if (result) form.reset(); });
  };

  const removeLearningItem = async (type, item) => {
    if (!window.confirm(`Delete "${item.title}"? This also removes its progress or lessons.`)) return;
    await runSave(
      () => deleteApi(`/classrooms/${selectedId}/learning/${type}/${item.id}`),
      "Learning content deleted."
    );
  };

  const completeLesson = (lesson) => runSave(
    () => postApi(`/classrooms/${selectedId}/lessons/${lesson.id}/complete`, {}),
    "Lesson marked complete."
  );

  const submitAssignment = (event, assignmentId) => {
    event.preventDefault();
    const response = new FormData(event.currentTarget).get("response");
    void runSave(
      () => postApi(`/classrooms/${selectedId}/assignments/${assignmentId}/submissions`, { response }),
      "Assignment submitted."
    );
  };

  const gradeSubmission = (event, submissionId) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void runSave(
      () => putApi(`/classrooms/${selectedId}/submissions/${submissionId}/grade`, {
        grade: formData.get("grade"),
        feedback: formData.get("feedback"),
      }),
      "Submission graded."
    );
  };

  const currentCourse = classrooms.find((course) => String(course.id) === selectedId);
  const title = mode === "builder" ? "Course builder" : mode === "submissions" ? "Submissions & grading" : "My learning";

  return (
    <div className="learning-workspace">
      <section className="dashboard-panel" aria-labelledby="learning-workspace-title">
        <div className="dashboard-panel__heading">
          <div>
            <h2 id="learning-workspace-title">{title}</h2>
            <p>{isStudent ? "Continue lessons, submit assignments, and view feedback." : "Choose one of your assigned courses to manage its curriculum and student work."}</p>
          </div>
          <button className="btn btn--ghost" type="button" disabled={loadingCourses || loading} onClick={() => { refreshCourses(); refresh(); }}>Refresh</button>
        </div>

        {loadingCourses ? <p className="collection-status" role="status">Loading courses…</p>
          : error ? <div className="collection-status collection-status--error" role="alert"><p>{error}</p><button className="btn btn--ghost" type="button" onClick={refreshCourses}>Try again</button></div>
            : classrooms.length === 0 ? <p className="collection-status">{isStudent ? "Join a class to start learning." : "Create or assign a course before building its curriculum."}</p>
              : (
                <label className="field learning-course-select">
                  <span>{isStudent ? "My enrolled courses" : "Assigned course"}</span>
                  <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                    {classrooms.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                  </select>
                </label>
              )}
      </section>

      {currentCourse && loading && <p className="collection-status" role="status">Loading course learning data…</p>}
      {currentCourse && !loading && learning && (
        <>
          {isStudent ? (
            <section className="dashboard-panel" aria-labelledby="learning-progress-title">
              <div className="dashboard-panel__heading">
                <div><h2 id="learning-progress-title">{currentCourse.title}</h2><p>{learning.progress.completedLessons} of {learning.progress.totalLessons} lessons complete</p></div>
                <strong className="learning-progress__value">{learning.progress.percent}%</strong>
              </div>
              <progress className="learning-progress" max="100" value={learning.progress.percent} aria-label={`${learning.progress.percent}% course progress`} />
              {learning.certificate && (
                <div className="learning-certificate" role="status">
                  <strong>Course completed — certificate issued</strong>
                  <span>Certificate code: {learning.certificate.code}</span>
                  <span>Issued {formatDate(learning.certificate.issuedAt)}</span>
                </div>
              )}
            </section>
          ) : mode === "builder" ? (
            <>
              <section className="dashboard-panel" aria-labelledby="course-builder-modules-title">
                <div className="dashboard-panel__heading">
                  <div><h2 id="course-builder-modules-title">Modules and lessons</h2><p>Organize course materials into a structured learning path.</p></div>
                </div>
                <form className="dashboard-form" onSubmit={createModule}>
                  <h3>Add a module</h3>
                  <div className="dashboard-form__grid">
                    <label className="field"><span>Module title</span><input name="title" required maxLength={150} /></label>
                    <label className="field"><span>Description (optional)</span><input name="description" maxLength={10000} /></label>
                  </div>
                  <button className="btn btn--primary" type="submit" disabled={saving}>Add module</button>
                </form>

                {learning.modules.length ? learning.modules.map((module) => (
                  <article className="learning-module" key={module.id}>
                    <div className="classroom-post__heading">
                      <div><span className="auth-eyebrow">Module {module.sortOrder + 1}</span><h3>{module.title}</h3>{module.description && <p>{module.description}</p>}</div>
                      <button className="btn btn--danger" type="button" onClick={() => removeLearningItem("modules", module)}>Delete module</button>
                    </div>
                    {module.lessons.map((lesson) => (
                      <div className="learning-lesson" key={lesson.id}>
                        <div><strong>{lesson.title}</strong><p>{lesson.content}</p>
                          {lesson.videoUrl && <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer">Open lesson video</a>}
                          {lesson.resourceUrl && <a href={lesson.resourceUrl} target="_blank" rel="noopener noreferrer">Open lesson resource</a>}
                          <LessonAttachment lesson={lesson} courseId={selectedId} onNotice={onNotice} />
                        </div>
                        <button className="btn btn--danger" type="button" onClick={() => removeLearningItem("lessons", lesson)}>Delete</button>
                      </div>
                    ))}
                    <form className="dashboard-form" onSubmit={(event) => createLesson(event, module.id)}>
                      <h4>Add a lesson</h4>
                      <div className="dashboard-form__grid">
                        <label className="field"><span>Lesson title</span><input name="title" required maxLength={150} /></label>
                        <label className="field dashboard-form__wide"><span>Lesson content</span><textarea name="content" required maxLength={10000} /></label>
                        <label className="field"><span>Video URL (optional)</span><input name="videoUrl" type="url" placeholder="https://" /></label>
                        <label className="field"><span>Resource URL (optional)</span><input name="resourceUrl" type="url" placeholder="https://" /></label>
                        <label className="field dashboard-form__wide"><span>Or attach a video/document (25 MB max)</span><input name="attachment" type="file" accept=".pdf,.doc,.docx,.pptx,.jpg,.jpeg,.png,.mp4,.webm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png,video/mp4,video/webm" /></label>
                      </div>
                      <button className="btn btn--primary" type="submit" disabled={saving}>Add lesson</button>
                    </form>
                  </article>
                )) : <p className="collection-status">No modules yet. Add the first module to start building this course.</p>}
              </section>

              <section className="dashboard-panel" aria-labelledby="course-builder-assignments-title">
                <h2 id="course-builder-assignments-title">Course assignments</h2>
                <form className="dashboard-form" onSubmit={createAssignment}>
                  <h3>Create an assignment</h3>
                  <div className="dashboard-form__grid">
                    <label className="field"><span>Title</span><input name="title" required maxLength={150} /></label>
                    <label className="field"><span>Module (optional)</span><select name="moduleId" defaultValue=""><option value="">Course-wide</option>{learning.modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}</select></label>
                    <label className="field"><span>Due date</span><input name="dueAt" type="datetime-local" /></label>
                    <label className="field dashboard-form__wide"><span>Instructions</span><textarea name="instructions" required maxLength={10000} /></label>
                  </div>
                  <button className="btn btn--primary" type="submit" disabled={saving}>Create assignment</button>
                </form>
                <div className="learning-assignment-list">
                  {learning.assignments.map((assignment) => <article className="learning-lesson" key={assignment.id}>
                    <div><strong>{assignment.title}</strong><p>{assignment.instructions}</p><span className="classroom-post__meta">Due {formatDate(assignment.dueAt)} · {assignment._count?.submissions || 0} submissions</span></div>
                  </article>)}
                  {!learning.assignments.length && <p className="collection-status">No assignments in this course yet.</p>}
                </div>
              </section>
            </>
          ) : (
            <section className="dashboard-panel" aria-labelledby="course-submissions-title">
              <div className="dashboard-panel__heading"><div><h2 id="course-submissions-title">Student submissions</h2><p>Review work and provide a grade from 0 to 100 with feedback.</p></div></div>
              {submissions.length ? submissions.map((submission) => (
                <article className="learning-submission" key={submission.id}>
                  <div className="classroom-post__heading">
                    <div><span className="auth-eyebrow">{submission.student.name} · {submission.student.email}</span><h3>{submission.assignment.title}</h3><p className="classroom-post__meta">Submitted {formatDate(submission.submittedAt)} · Due {formatDate(submission.assignment.dueAt)}</p></div>
                    {submission.grade !== null && <span className="dashboard-badge dashboard-badge--published">Graded: {submission.grade}/100</span>}
                  </div>
                  <p className="learning-submission__response">{submission.response}</p>
                  <form className="dashboard-form" onSubmit={(event) => gradeSubmission(event, submission.id)}>
                    <h4>{submission.gradedAt ? "Update grade and feedback" : "Grade submission"}</h4>
                    <div className="dashboard-form__grid">
                      <label className="field"><span>Grade (0-100)</span><input name="grade" type="number" min="0" max="100" step="0.01" required defaultValue={submission.grade ?? ""} /></label>
                      <label className="field dashboard-form__wide"><span>Feedback</span><textarea name="feedback" maxLength={10000} defaultValue={submission.feedback || ""} /></label>
                    </div>
                    <button className="btn btn--primary" type="submit" disabled={saving}>Save grade</button>
                  </form>
                </article>
              )) : <p className="collection-status">No submissions yet for this course.</p>}
            </section>
          )}

          {isStudent && (
            <>
              {learning.modules.map((module) => (
                <section className="dashboard-panel learning-module" key={module.id} aria-labelledby={`learning-module-${module.id}`}>
                  <div className="dashboard-panel__heading"><div><span className="auth-eyebrow">Module {module.sortOrder + 1}</span><h2 id={`learning-module-${module.id}`}>{module.title}</h2>{module.description && <p>{module.description}</p>}</div></div>
                  {module.lessons.map((lesson) => (
                    <article className="learning-lesson" key={lesson.id}>
                      <div><span className={`dashboard-badge ${lesson.completed ? "dashboard-badge--published" : ""}`}>{lesson.completed ? "Completed" : "Lesson"}</span><h3>{lesson.title}</h3><p>{lesson.content}</p>
                        {lesson.videoUrl && <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer">Open lesson video</a>}
                        {lesson.resourceUrl && <a href={lesson.resourceUrl} target="_blank" rel="noopener noreferrer">Open lesson resource</a>}
                        <LessonAttachment lesson={lesson} courseId={selectedId} onNotice={onNotice} />
                      </div>
                      <button className="btn btn--ghost" type="button" disabled={lesson.completed || saving} onClick={() => completeLesson(lesson)}>{lesson.completed ? "Complete" : "Mark complete"}</button>
                    </article>
                  ))}
                  {!module.lessons.length && <p className="collection-status">This module does not have lessons yet.</p>}
                </section>
              ))}

              <section className="dashboard-panel" aria-labelledby="student-assignments-title">
                <div className="dashboard-panel__heading"><div><h2 id="student-assignments-title">Assignments</h2><p>Submit your response and review instructor feedback here.</p></div></div>
                {learning.assignments.length ? learning.assignments.map((assignment) => (
                  <article className="learning-submission" key={assignment.id}>
                    <div><h3>{assignment.title}</h3><p>{assignment.instructions}</p><p className="classroom-post__meta">Due {formatDate(assignment.dueAt)}{assignment.module?.title ? ` · ${assignment.module.title}` : ""}</p></div>
                    {assignment.submission?.grade !== null && assignment.submission?.grade !== undefined
                      ? <div className="learning-feedback"><strong>Grade: {assignment.submission.grade}/100</strong><p>{assignment.submission.feedback || "No written feedback."}</p></div>
                      : null}
                    <form className="dashboard-form" onSubmit={(event) => submitAssignment(event, assignment.id)}>
                      <label className="field"><span>{assignment.submission ? "Update your response" : "Your response"}</span><textarea name="response" required maxLength={20000} defaultValue={assignment.submission?.response || ""} disabled={assignment.submission?.grade !== null && assignment.submission?.grade !== undefined} /></label>
                      <button className="btn btn--primary" type="submit" disabled={saving || (assignment.submission?.grade !== null && assignment.submission?.grade !== undefined)}>{assignment.submission ? "Update submission" : "Submit assignment"}</button>
                      {assignment.submission && <span className="classroom-post__meta">Submitted {formatDate(assignment.submission.submittedAt)}</span>}
                    </form>
                  </article>
                )) : <p className="collection-status">No assignments have been published for this course.</p>}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
