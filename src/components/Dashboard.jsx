import { useCallback, useEffect, useRef, useState } from "react";
import { deleteApi, getApi, getApiList, postApi, putApi } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import ClassroomWorkspace from "./ClassroomWorkspace.jsx";
import LearningWorkspace from "./LearningWorkspace.jsx";
import NotificationCenter from "./NotificationCenter.jsx";

const blankCourse = {
  title: "",
  description: "",
  category: "",
  price: "0",
  isPublished: false,
};

const blankProject = {
  title: "",
  description: "",
  category: "",
  imageUrl: "",
  projectUrl: "",
  tags: "",
  isFeatured: false,
  isPublished: false,
  sortOrder: "0",
};

const blankFaq = {
  question: "",
  answer: "",
  displayOrder: "0",
  isPublished: false,
};

const blankTeamMember = {
  name: "",
  title: "",
  bio: "",
  photoUrl: "",
  displayOrder: "0",
  isPublished: false,
};

const metricSources = [
  { value: "manual", label: "Manual value" },
  { value: "users", label: "Active accounts" },
  { value: "students", label: "Active students" },
  { value: "instructors", label: "Approved instructors" },
  { value: "courses", label: "All courses" },
  { value: "publishedCourses", label: "Published courses" },
  { value: "projects", label: "All projects" },
  { value: "publishedProjects", label: "Published projects" },
  { value: "teamMembers", label: "Published team members" },
];

const blankMetric = {
  label: "",
  source: "manual",
  manualValue: "",
  prefix: "",
  suffix: "",
  displayOrder: "0",
  isPublished: false,
};

function DashboardNotice({ notice, onDismiss }) {
  if (!notice) return null;
  return (
    <div className={`dashboard-notice dashboard-notice--${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
      <p>{notice.message}</p>
      <button type="button" className="dashboard-notice__close" aria-label="Dismiss message" onClick={onDismiss}>×</button>
    </div>
  );
}

function MetricCards({ metrics }) {
  return (
    <dl className="dashboard-metrics">
      {metrics.map((metric) => (
        <div className="dashboard-metric" key={metric.label}>
          <dt>{metric.label}</dt>
          <dd>{metric.value ?? 0}</dd>
        </div>
      ))}
    </dl>
  );
}

function CourseManager({ onNotice, onDataChange }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankCourse);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { items } = await getApiList("/courses/manage?page=1&limit=100");
      setCourses(items);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh, revision]);

  const startCreate = () => {
    setEditing(null);
    setForm(blankCourse);
  };

  const startEdit = (course) => {
    setEditing(course.id);
    setForm({
      title: course.title,
      description: course.description,
      category: course.category,
      price: String(course.price),
      isPublished: course.isPublished,
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const body = new FormData();
      body.set("title", form.title.trim());
      body.set("description", form.description.trim());
      body.set("category", form.category.trim());
      body.set("price", form.price || "0");
      body.set("is_published", String(form.isPublished));
      const thumbnail = event.currentTarget.elements.thumbnail.files[0];
      if (thumbnail) body.set("thumbnail", thumbnail);

      const result = editing
        ? await putApi(`/courses/${editing}`, body)
        : await postApi("/courses", body);
      onNotice({ type: "success", message: result.message || "Course saved." });
      startCreate();
      setRevision((value) => value + 1);
      onDataChange?.();
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (course) => {
    if (!window.confirm(`Delete "${course.title}"? This cannot be undone if the course has no dependent records.`)) return;
    try {
      const result = await deleteApi(`/courses/${course.id}`);
      onNotice({ type: "success", message: result.message || "Course deleted." });
      setRevision((value) => value + 1);
      onDataChange?.();
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    }
  };

  return (
    <section className="dashboard-panel" aria-labelledby="manage-courses-title">
      <div className="dashboard-panel__heading">
        <div>
          <h2 id="manage-courses-title">Course management</h2>
          <p>Save drafts or publish courses to the public catalog.</p>
        </div>
        <button className="btn btn--primary" type="button" onClick={startCreate}>Add course</button>
      </div>

      <form className="dashboard-form" onSubmit={submit}>
        <h3>{editing ? "Edit course" : "New course"}</h3>
        <div className="dashboard-form__grid">
          <label className="field">
            <span>Course title</span>
            <input required minLength={3} maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label className="field">
            <span>Category</span>
            <input required maxLength={50} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
          </label>
          <label className="field">
            <span>Price (NPR)</span>
            <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
          </label>
          <label className="field">
            <span>Thumbnail (optional)</span>
            <input name="thumbnail" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
          </label>
          <label className="field dashboard-form__wide">
            <span>Description</span>
            <textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <label className="dashboard-checkbox">
            <input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} />
            Publish this course
          </label>
        </div>
        <div className="dashboard-form__actions">
          <button className="btn btn--primary" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create course"}</button>
          {editing && <button className="btn btn--ghost" type="button" onClick={startCreate}>Cancel edit</button>}
        </div>
      </form>

      {loading ? <p className="collection-status" role="status">Loading courses…</p>
        : error ? <div className="collection-status collection-status--error" role="alert"><p>{error}</p><button className="btn btn--ghost" type="button" onClick={refresh}>Try again</button></div>
          : courses.length === 0 ? <p className="collection-status">No courses yet. Add a course above to get started.</p>
            : (
              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead><tr><th>Course</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr key={course.id}>
                        <td><strong>{course.title}</strong><span>{course.category} · NPR {Number(course.price).toLocaleString("en-NP")}</span></td>
                        <td><span className={`dashboard-badge ${course.isPublished ? "dashboard-badge--published" : ""}`}>{course.isPublished ? "Published" : "Draft"}</span></td>
                        <td className="dashboard-table__actions">
                          <button className="btn btn--ghost" type="button" onClick={() => startEdit(course)}>Edit</button>
                          <button className="btn btn--danger" type="button" onClick={() => remove(course)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
    </section>
  );
}

function ProjectManager({ onNotice, onDataChange }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankProject);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { items } = await getApiList("/projects/admin?page=1&limit=100");
      setProjects(items);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh, revision]);

  const startCreate = () => {
    setEditing(null);
    setForm(blankProject);
  };

  const startEdit = (project) => {
    setEditing(project.id);
    setForm({
      title: project.title,
      description: project.description,
      category: project.category,
      imageUrl: project.imageUrl || "",
      projectUrl: project.projectUrl || "",
      tags: Array.isArray(project.tags) ? project.tags.join(", ") : "",
      isFeatured: project.isFeatured,
      isPublished: project.isPublished,
      sortOrder: String(project.sortOrder),
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      imageUrl: form.imageUrl.trim() || null,
      projectUrl: form.projectUrl.trim() || null,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      isFeatured: form.isFeatured,
      isPublished: form.isPublished,
      sortOrder: Number(form.sortOrder) || 0,
    };

    try {
      const result = editing
        ? await putApi(`/projects/${editing}`, body)
        : await postApi("/projects", body);
      onNotice({ type: "success", message: result.message || "Project saved." });
      startCreate();
      setRevision((value) => value + 1);
      onDataChange?.();
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (project) => {
    if (!window.confirm(`Delete project "${project.title}"?`)) return;
    try {
      const result = await deleteApi(`/projects/${project.id}`);
      onNotice({ type: "success", message: result.message || "Project deleted." });
      setRevision((value) => value + 1);
      onDataChange?.();
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    }
  };

  return (
    <section className="dashboard-panel" aria-labelledby="manage-projects-title">
      <div className="dashboard-panel__heading">
        <div>
          <h2 id="manage-projects-title">Project management</h2>
          <p>Only published projects appear on the public website.</p>
        </div>
        <button className="btn btn--primary" type="button" onClick={startCreate}>Add project</button>
      </div>

      <form className="dashboard-form" onSubmit={submit}>
        <h3>{editing ? "Edit project" : "New project"}</h3>
        <div className="dashboard-form__grid">
          <label className="field">
            <span>Project title</span>
            <input required maxLength={150} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label className="field">
            <span>Category</span>
            <input required maxLength={80} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
          </label>
          <label className="field">
            <span>Image URL</span>
            <input type="url" placeholder="https://…" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} />
          </label>
          <label className="field">
            <span>Project URL</span>
            <input type="url" placeholder="https://…" value={form.projectUrl} onChange={(event) => setForm({ ...form, projectUrl: event.target.value })} />
          </label>
          <label className="field">
            <span>Tags (comma separated)</span>
            <input placeholder="React, Node.js" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
          </label>
          <label className="field">
            <span>Display order</span>
            <input type="number" min="0" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
          </label>
          <label className="field dashboard-form__wide">
            <span>Description</span>
            <textarea required maxLength={5000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <label className="dashboard-checkbox">
            <input type="checkbox" checked={form.isFeatured} onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })} />
            Feature project
          </label>
          <label className="dashboard-checkbox">
            <input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} />
            Publish project
          </label>
        </div>
        <div className="dashboard-form__actions">
          <button className="btn btn--primary" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create project"}</button>
          {editing && <button className="btn btn--ghost" type="button" onClick={startCreate}>Cancel edit</button>}
        </div>
      </form>

      {loading ? <p className="collection-status" role="status">Loading projects…</p>
        : error ? <div className="collection-status collection-status--error" role="alert"><p>{error}</p><button className="btn btn--ghost" type="button" onClick={refresh}>Try again</button></div>
          : projects.length === 0 ? <p className="collection-status">No projects yet. Add a project above to get started.</p>
            : (
              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead><tr><th>Project</th><th>Visibility</th><th>Featured</th><th>Actions</th></tr></thead>
                  <tbody>
                    {projects.map((project) => (
                      <tr key={project.id}>
                        <td><strong>{project.title}</strong><span>{project.category}</span></td>
                        <td><span className={`dashboard-badge ${project.isPublished ? "dashboard-badge--published" : ""}`}>{project.isPublished ? "Published" : "Draft"}</span></td>
                        <td>{project.isFeatured ? "Yes" : "No"}</td>
                        <td className="dashboard-table__actions">
                          <button className="btn btn--ghost" type="button" onClick={() => startEdit(project)}>Edit</button>
                          <button className="btn btn--danger" type="button" onClick={() => remove(project)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
    </section>
  );
}

function FaqManager({ onNotice }) {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankFaq);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setFaqs(await getApi("/faqs/admin"));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh, revision]);

  const resetForm = () => {
    setEditing(null);
    setForm(blankFaq);
  };

  const startEdit = (faq) => {
    setEditing(faq.id);
    setForm({
      question: faq.question,
      answer: faq.answer,
      displayOrder: String(faq.displayOrder),
      isPublished: faq.isPublished,
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const body = {
      question: form.question.trim(),
      answer: form.answer.trim(),
      displayOrder: Number(form.displayOrder) || 0,
      isPublished: form.isPublished,
    };

    try {
      const result = editing
        ? await putApi(`/faqs/${editing}`, body)
        : await postApi("/faqs", body);
      onNotice({ type: "success", message: result.message || "FAQ saved." });
      resetForm();
      setRevision((value) => value + 1);
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (faq) => {
    if (!window.confirm(`Delete FAQ "${faq.question}"?`)) return;
    try {
      const result = await deleteApi(`/faqs/${faq.id}`);
      onNotice({ type: "success", message: result.message || "FAQ deleted." });
      if (editing === faq.id) resetForm();
      setRevision((value) => value + 1);
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    }
  };

  return (
    <section className="dashboard-panel" aria-labelledby="manage-faqs-title">
      <div className="dashboard-panel__heading">
        <div>
          <h2 id="manage-faqs-title">FAQ management</h2>
          <p>Draft answers stay private until published on the website.</p>
        </div>
      </div>

      <form className="dashboard-form" onSubmit={submit}>
        <h3>{editing ? "Edit FAQ" : "New FAQ"}</h3>
        <div className="dashboard-form__grid">
          <label className="field dashboard-form__wide">
            <span>Question</span>
            <input required maxLength={500} value={form.question} onChange={(event) => setForm({ ...form, question: event.target.value })} />
          </label>
          <label className="field dashboard-form__wide">
            <span>Answer</span>
            <textarea required maxLength={10000} value={form.answer} onChange={(event) => setForm({ ...form, answer: event.target.value })} />
          </label>
          <label className="field">
            <span>Display order</span>
            <input type="number" min="0" max="100000" value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: event.target.value })} />
          </label>
          <label className="dashboard-checkbox">
            <input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} />
            Publish this FAQ
          </label>
        </div>
        <div className="dashboard-form__actions">
          <button className="btn btn--primary" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create FAQ"}</button>
          {editing && <button className="btn btn--ghost" type="button" onClick={resetForm}>Cancel edit</button>}
        </div>
      </form>

      {loading ? <p className="collection-status" role="status">Loading FAQs…</p>
        : error ? <div className="collection-status collection-status--error" role="alert"><p>{error}</p><button className="btn btn--ghost" type="button" onClick={refresh}>Try again</button></div>
          : faqs.length === 0 ? <p className="collection-status">No FAQs yet. Add one above to get started.</p>
            : (
              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead><tr><th>Question</th><th>Order</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {faqs.map((faq) => (
                      <tr key={faq.id}>
                        <td><strong>{faq.question}</strong><span>{faq.answer}</span></td>
                        <td>{faq.displayOrder}</td>
                        <td><span className={`dashboard-badge ${faq.isPublished ? "dashboard-badge--published" : ""}`}>{faq.isPublished ? "Published" : "Draft"}</span></td>
                        <td className="dashboard-table__actions">
                          <button className="btn btn--ghost" type="button" onClick={() => startEdit(faq)}>Edit</button>
                          <button className="btn btn--danger" type="button" onClick={() => remove(faq)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
    </section>
  );
}

function AdminUsers({ currentUserId, onNotice }) {
  const [users, setUsers] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [userResult, pendingResult] = await Promise.all([
        getApi("/admin/users"),
        getApi("/admin/pending-teachers"),
      ]);
      setUsers(userResult.users || []);
      setPending(pendingResult.pendingTeachers || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh, revision]);

  const approve = async (teacherId) => {
    try {
      const result = await putApi(`/admin/approve-teacher/${teacherId}`, {});
      onNotice({ type: "success", message: result.message || "Instructor approved." });
      setRevision((value) => value + 1);
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    }
  };

  const updateUser = async (user, role, tier) => {
    try {
      const result = await putApi(`/admin/users/${user.id}`, { role, tier });
      onNotice({ type: "success", message: result.message || "Account updated." });
      setRevision((value) => value + 1);
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    }
  };

  const deactivateUser = async (user) => {
    if (!window.confirm(`Deactivate ${user.name}'s account? Existing records will be retained.`)) return;
    try {
      const result = await deleteApi(`/admin/users/${user.id}`);
      onNotice({ type: "success", message: result.message || "Account deactivated." });
      setRevision((value) => value + 1);
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    }
  };

  if (loading) return <p className="collection-status" role="status">Loading accounts…</p>;
  if (error) return <div className="collection-status collection-status--error" role="alert"><p>{error}</p><button className="btn btn--ghost" type="button" onClick={refresh}>Try again</button></div>;

  return (
    <>
      <section className="dashboard-panel" aria-labelledby="pending-instructors-title">
        <div className="dashboard-panel__heading">
          <div><h2 id="pending-instructors-title">Instructor approvals</h2><p>Approve instructor accounts before they can manage courses.</p></div>
        </div>
        {pending.length === 0 ? <p className="collection-status">No pending instructor applications.</p> : (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead><tr><th>Instructor</th><th>Applied</th><th>Action</th></tr></thead>
              <tbody>{pending.map((teacher) => (
                <tr key={teacher.id}>
                  <td><strong>{teacher.name}</strong><span>{teacher.email}</span></td>
                  <td>{new Date(teacher.createdAt).toLocaleDateString()}</td>
                  <td><button className="btn btn--primary" type="button" onClick={() => approve(teacher.id)}>Approve</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dashboard-panel" aria-labelledby="accounts-title">
        <div className="dashboard-panel__heading">
          <div><h2 id="accounts-title">Accounts</h2><p>Manage account role and plan. Passwords are never displayed here.</p></div>
        </div>
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead><tr><th>Account</th><th>Role</th><th>Plan</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>{users.map((user) => <UserRow key={user.id} user={user} currentUserId={currentUserId} onSave={updateUser} onDeactivate={deactivateUser} />)}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function AdminStats({ onNotice }) {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankMetric);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMetrics(await getApi("/stats/admin"));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh, revision]);

  const resetForm = () => {
    setEditing(null);
    setForm(blankMetric);
  };

  const startEdit = (metric) => {
    setEditing(metric.id);
    setForm({
      label: metric.label,
      source: metric.source,
      manualValue: metric.manualValue || "",
      prefix: metric.prefix,
      suffix: metric.suffix,
      displayOrder: String(metric.displayOrder),
      isPublished: metric.isPublished,
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const body = {
        label: form.label.trim(),
        source: form.source,
        manualValue: form.manualValue.trim(),
        prefix: form.prefix,
        suffix: form.suffix,
        displayOrder: Number(form.displayOrder) || 0,
        isPublished: form.isPublished,
      };
      const result = editing
        ? await putApi(`/stats/${editing}`, body)
        : await postApi("/stats", body);
      onNotice({ type: "success", message: result.message || "Statistic saved." });
      resetForm();
      setRevision((value) => value + 1);
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (metric) => {
    if (!window.confirm(`Delete the "${metric.label}" statistic?`)) return;
    try {
      const result = await deleteApi(`/stats/${metric.id}`);
      onNotice({ type: "success", message: result.message || "Statistic deleted." });
      if (editing === metric.id) resetForm();
      setRevision((value) => value + 1);
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    }
  };

  const sourceLabel = (source) => metricSources.find((item) => item.value === source)?.label || source;

  return (
    <section className="dashboard-panel" aria-labelledby="stats-management-title">
      <div className="dashboard-panel__heading">
        <div><h2 id="stats-management-title">Website statistics</h2><p>Use a live count from the database or enter a value manually. Only published statistics appear on the homepage.</p></div>
      </div>

      <form className="dashboard-form" onSubmit={submit}>
        <h3>{editing ? "Edit statistic" : "Add a statistic"}</h3>
        <div className="dashboard-form__grid">
          <label className="field">
            <span>Label</span>
            <input required maxLength={100} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
          </label>
          <label className="field">
            <span>Value source</span>
            <select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}>
              {metricSources.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
            </select>
          </label>
          {form.source === "manual" ? (
            <label className="field">
              <span>Manual value</span>
              <input required={form.isPublished} maxLength={50} placeholder="e.g. 5+ or 24/7" value={form.manualValue} onChange={(event) => setForm({ ...form, manualValue: event.target.value })} />
            </label>
          ) : (
            <>
              <label className="field">
                <span>Prefix (optional)</span>
                <input maxLength={20} placeholder="e.g. $" value={form.prefix} onChange={(event) => setForm({ ...form, prefix: event.target.value })} />
              </label>
              <label className="field">
                <span>Suffix (optional)</span>
                <input maxLength={20} placeholder="e.g. +" value={form.suffix} onChange={(event) => setForm({ ...form, suffix: event.target.value })} />
              </label>
            </>
          )}
          <label className="field">
            <span>Display order</span>
            <input type="number" min="0" max="100000" value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: event.target.value })} />
          </label>
          <label className="dashboard-checkbox">
            <input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} />
            Publish on the website
          </label>
        </div>
        <div className="dashboard-form__actions">
          <button className="btn btn--primary" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create statistic"}</button>
          {editing && <button className="btn btn--ghost" type="button" onClick={resetForm}>Cancel edit</button>}
        </div>
      </form>

      {loading ? <p className="collection-status" role="status">Loading statistics…</p>
        : error ? <div className="collection-status collection-status--error" role="alert"><p>{error}</p><button className="btn btn--ghost" type="button" onClick={refresh}>Try again</button></div>
          : metrics.length === 0 ? <p className="collection-status">No statistics yet. Add one above to show verified figures on the homepage.</p>
            : (
              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead><tr><th>Statistic</th><th>Source</th><th>Value</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>{metrics.map((metric) => (
                    <tr key={metric.id}>
                      <td><strong>{metric.label}</strong><span>Order {metric.displayOrder}</span></td>
                      <td>{sourceLabel(metric.source)}</td>
                      <td>{metric.previewValue || "Not set"}</td>
                      <td><span className={`dashboard-badge ${metric.isPublished ? "dashboard-badge--published" : ""}`}>{metric.isPublished ? "Published" : "Draft"}</span></td>
                      <td className="dashboard-table__actions">
                        <button className="btn btn--ghost" type="button" onClick={() => startEdit(metric)}>Edit</button>
                        <button className="btn btn--danger" type="button" onClick={() => remove(metric)}>Delete</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
    </section>
  );
}

function AdminTeamMembers({ onNotice }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankTeamMember);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMembers(await getApi("/team-members/admin"));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh, revision]);

  const resetForm = () => {
    setEditing(null);
    setForm(blankTeamMember);
  };

  const startEdit = (member) => {
    setEditing(member.id);
    setForm({
      name: member.name,
      title: member.title,
      bio: member.bio || "",
      photoUrl: member.photoUrl || "",
      displayOrder: String(member.displayOrder),
      isPublished: member.isPublished,
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        title: form.title.trim(),
        bio: form.bio.trim(),
        photoUrl: form.photoUrl.trim(),
        displayOrder: Number(form.displayOrder) || 0,
        isPublished: form.isPublished,
      };
      const result = editing
        ? await putApi(`/team-members/${editing}`, body)
        : await postApi("/team-members", body);
      onNotice({ type: "success", message: result.message || "Team member saved." });
      resetForm();
      setRevision((value) => value + 1);
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (member) => {
    if (!window.confirm(`Delete ${member.name} from the team?`)) return;
    try {
      const result = await deleteApi(`/team-members/${member.id}`);
      onNotice({ type: "success", message: result.message || "Team member deleted." });
      if (editing === member.id) resetForm();
      setRevision((value) => value + 1);
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    }
  };

  return (
    <section className="dashboard-panel" aria-labelledby="team-members-title">
      <div className="dashboard-panel__heading">
        <div><h2 id="team-members-title">Team member management</h2><p>Manage the people shown in the public About section.</p></div>
      </div>

      <form className="dashboard-form" onSubmit={submit}>
        <h3>{editing ? "Edit team member" : "Add a team member"}</h3>
        <div className="dashboard-form__grid">
          <label className="field">
            <span>Name</span>
            <input required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="field">
            <span>Role / title</span>
            <input required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label className="field dashboard-form__wide">
            <span>Photo URL (optional)</span>
            <input type="url" maxLength={2048} placeholder="https://…" value={form.photoUrl} onChange={(event) => setForm({ ...form, photoUrl: event.target.value })} />
          </label>
          <label className="field dashboard-form__wide">
            <span>Bio (optional)</span>
            <textarea maxLength={10000} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
          </label>
          <label className="field">
            <span>Display order</span>
            <input type="number" min="0" max="100000" value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: event.target.value })} />
          </label>
          <label className="dashboard-checkbox">
            <input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} />
            Publish on the website
          </label>
        </div>
        <div className="dashboard-form__actions">
          <button className="btn btn--primary" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create team member"}</button>
          {editing && <button className="btn btn--ghost" type="button" onClick={resetForm}>Cancel edit</button>}
        </div>
      </form>

      {loading ? <p className="collection-status" role="status">Loading team members…</p>
        : error ? <div className="collection-status collection-status--error" role="alert"><p>{error}</p><button className="btn btn--ghost" type="button" onClick={refresh}>Try again</button></div>
          : members.length === 0 ? <p className="collection-status">No team members yet. Add one above.</p>
            : (
              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead><tr><th>Member</th><th>Order</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>{members.map((member) => (
                    <tr key={member.id}>
                      <td><strong>{member.name}</strong><span>{member.title}</span></td>
                      <td>{member.displayOrder}</td>
                      <td><span className={`dashboard-badge ${member.isPublished ? "dashboard-badge--published" : ""}`}>{member.isPublished ? "Published" : "Draft"}</span></td>
                      <td className="dashboard-table__actions">
                        <button className="btn btn--ghost" type="button" onClick={() => startEdit(member)}>Edit</button>
                        <button className="btn btn--danger" type="button" onClick={() => remove(member)}>Delete</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
    </section>
  );
}

function UserRow({ user, currentUserId, onSave, onDeactivate }) {
  const [role, setRole] = useState(user.role);
  const [tier, setTier] = useState(user.tier);
  const isCurrentAdmin = user.id === currentUserId;

  return (
    <tr>
      <td><strong>{user.name}</strong><span>{user.email}{user.isApproved === false && user.role === "instructor" ? " · awaiting approval" : ""}</span></td>
      <td>
        <label className="sr-only" htmlFor={`user-role-${user.id}`}>Role for {user.name}</label>
        <select id={`user-role-${user.id}`} value={role} disabled={isCurrentAdmin} onChange={(event) => setRole(event.target.value)}>
          <option value="student">Student</option>
          <option value="instructor">Instructor</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
        </select>
      </td>
      <td>
        <label className="sr-only" htmlFor={`user-tier-${user.id}`}>Plan for {user.name}</label>
        <select id={`user-tier-${user.id}`} value={tier} onChange={(event) => setTier(event.target.value)}>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
      </td>
      <td>{new Date(user.createdAt).toLocaleDateString()}</td>
      <td className="dashboard-table__actions">
        <button className="btn btn--ghost" type="button" disabled={isCurrentAdmin} onClick={() => onSave(user, role, tier)}>Save</button>
        <button className="btn btn--danger" type="button" disabled={isCurrentAdmin} onClick={() => onDeactivate(user)}>Deactivate</button>
      </td>
    </tr>
  );
}

function mergeSupportMessages(current, incoming) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, { ...byId.get(message.id), ...message }));
  return [...byId.values()].sort((first, second) => (
    new Date(first.createdAt) - new Date(second.createdAt) || first.id - second.id
  ));
}

function SupportInbox() {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const listSequence = useRef(0);
  const messageSequence = useRef(0);
  const selectedConversation = conversations.find((item) => item.id === selectedId);
  const selectedChannel = selectedConversation?.channel;

  const refreshConversations = useCallback(async () => {
    const sequence = ++listSequence.current;
    try {
      const { items } = await getApiList("/support/inbox/support?page=1&limit=50");
      if (sequence !== listSequence.current) return;
      setConversations(items);
      setSelectedId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? null);
      setError("");
    } catch (requestError) {
      if (sequence === listSequence.current) setError(requestError.message);
    } finally {
      if (sequence === listSequence.current) setLoading(false);
    }
  }, []);

  const refreshMessages = useCallback(async () => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    const sequence = ++messageSequence.current;
    try {
      if (!selectedChannel) return;
      const result = await getApi(`/support/inbox/${selectedChannel}/${selectedId}/messages`);
      if (sequence !== messageSequence.current) return;
      setMessages((current) => mergeSupportMessages(current, result.conversation.messages || []));
      setError("");
    } catch (requestError) {
      if (sequence === messageSequence.current) setError(requestError.message);
    }
  }, [selectedChannel, selectedId]);

  useEffect(() => {
    setLoading(true);
    setConversations([]);
    setSelectedId(null);
    setMessages([]);
    refreshConversations();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshConversations();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [refreshConversations]);

  useEffect(() => {
    messageSequence.current += 1;
    setMessages([]);
    refreshMessages();
    if (!selectedId || !selectedChannel) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshMessages();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refreshMessages, selectedChannel, selectedId]);

  const sendReply = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending || !selectedId || !selectedChannel) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      const result = await postApi(`/support/inbox/${selectedChannel}/${selectedId}/messages`, { message });
      setMessages((current) => mergeSupportMessages(current, [result.message]));
      setDraft("");
      setNotice(result.emailSent ? "Reply sent." : "Reply saved, but the email notification did not send.");
      refreshConversations();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="dashboard-panel" aria-labelledby="support-inbox-title">
      <div className="dashboard-panel__heading">
        <div><h2 id="support-inbox-title">Support inbox</h2><p>Admins and moderators share these conversations and can reply to the same user thread.</p></div>
      </div>
      {error && <p className="collection-status collection-status--error" role="alert">{error}</p>}
      <div className="support-inbox">
        <div className="support-inbox__list" aria-label="Support conversations">
          {loading ? <p className="collection-status">Loading conversations…</p>
            : conversations.length === 0 ? <p className="collection-status">No support conversations yet.</p>
              : conversations.map((item) => {
                const person = item.owner || { name: item.guestName, email: item.guestEmail };
                const latest = item.messages?.[0];
                return (
                  <button
                    key={item.id}
                    className={`support-inbox__conversation${selectedId === item.id ? " is-active" : ""}`}
                    type="button"
                    aria-pressed={selectedId === item.id}
                    onClick={() => { setSelectedId(item.id); setMessages([]); setDraft(""); setNotice(""); }}
                  >
                    <strong>{person?.name || "User"}</strong>
                    <span>{person?.email}</span>
                    <p>{latest?.body || "Conversation started"}</p>
                  </button>
                );
              })}
        </div>
        <div className="support-inbox__thread">
          {!selectedId ? <p className="support-inbox__empty">Choose a conversation to view messages.</p> : (
            <>
              <div className="support-inbox__messages" aria-live="polite">
                {messages.map((message) => (
                  <article key={message.id} className={`support-inbox__message${message.senderType === "staff" ? " is-staff" : ""}`}>
                    <span>{message.senderName || (message.senderType === "staff" ? "Staff" : "User")}</span>
                    <p>{message.body}</p>
                    <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
                  </article>
                ))}
              </div>
              {notice && <p className="support-inbox__notice" role="status">{notice}</p>}
              <form className="support-inbox__composer" onSubmit={sendReply}>
                <label className="sr-only" htmlFor="support-inbox-reply">Write a reply</label>
                <textarea id="support-inbox-reply" rows={2} maxLength={5000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a reply…" />
                <button className="btn btn--primary" type="submit" disabled={sending || !draft.trim()}>{sending ? "Sending…" : "Reply"}</button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ContactInbox() {
  const [messages, setMessages] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getApiList(`/contact/admin?page=${page}&limit=20`);
      setMessages(result.items);
      setTotalPages(result.totalPages);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <section className="dashboard-panel" aria-labelledby="contact-inbox-title">
      <div className="dashboard-panel__heading">
        <div><h2 id="contact-inbox-title">Contact form messages</h2><p>Messages submitted through the contact form, separate from support chat.</p></div>
        <button className="btn btn--ghost" type="button" disabled={loading} onClick={refresh}>Refresh</button>
      </div>
      {loading ? <p className="collection-status" role="status">Loading contact messages…</p>
        : error ? <div className="collection-status collection-status--error" role="alert"><p>{error}</p><button className="btn btn--ghost" type="button" onClick={refresh}>Try again</button></div>
          : messages.length === 0 ? <p className="collection-status">No contact form messages yet.</p> : (
            <>
              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead><tr><th>Received</th><th>Contact</th><th>Subject and message</th><th>Email status</th></tr></thead>
                  <tbody>{messages.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.createdAt).toLocaleString()}</td>
                      <td><strong>{item.name}</strong><span><a href={`mailto:${item.email}`}>{item.email}</a></span>{item.phone && <span>{item.phone}</span>}</td>
                      <td><strong>{item.subject}</strong><p className="contact-inbox__message">{item.message}</p></td>
                      <td>{item.emailSentAt ? `Sent ${new Date(item.emailSentAt).toLocaleString()}` : item.emailDeliveryFailed ? "Delivery failed" : "Pending"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="contact-inbox__pagination">
                <button className="btn btn--ghost" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
                <span>Page {page} of {totalPages}</span>
                <button className="btn btn--ghost" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
              </div>
            </>
          )}
    </section>
  );
}

function AdminOverview() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError("");
    getApi("/admin/dashboard")
      .then((result) => setDashboard(result.dashboard))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [revision]);

  return (
    <section className="dashboard-overview" aria-labelledby="admin-overview-title">
      <div className="dashboard-panel__heading">
        <div><h2 id="admin-overview-title">Overview</h2><p>A live snapshot of accounts and published content.</p></div>
        <button className="btn btn--ghost" type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh</button>
      </div>
      {loading ? <p className="collection-status" role="status">Loading administrator overview…</p>
        : error ? <p className="collection-status collection-status--error" role="alert">{error}</p>
          : dashboard && <MetricCards metrics={[
            { label: "Total accounts", value: dashboard.users.total },
            { label: "Instructors", value: dashboard.users.teachers },
            { label: "Pending instructors", value: dashboard.users.pendingTeachers },
            { label: "Courses", value: dashboard.courses.total },
            { label: "Published courses", value: dashboard.courses.published },
            { label: "Projects", value: dashboard.projects.total },
            { label: "Published projects", value: dashboard.projects.published },
          ]} />}
    </section>
  );
}

const workspaceSections = {
  admin: [
    { id: "overview", label: "Overview" },
    { id: "stats", label: "Website statistics" },
    { id: "team", label: "Team members" },
    { id: "accounts", label: "Accounts" },
    { id: "support", label: "Support inbox" },
    { id: "contacts", label: "Contact messages" },
    { id: "courses", label: "Courses" },
    { id: "projects", label: "Projects" },
    { id: "faqs", label: "FAQs" },
    { id: "notifications", label: "Notifications" },
  ],
  moderator: [
    { id: "support", label: "Support inbox" },
    { id: "contacts", label: "Contact messages" },
    { id: "notifications", label: "Notifications" },
  ],
  instructor: [
    { id: "builder", label: "Course builder" },
    { id: "submissions", label: "Submissions & grading" },
    { id: "classrooms", label: "Classrooms" },
    { id: "courses", label: "Courses" },
    { id: "notifications", label: "Notifications" },
  ],
  student: [
    { id: "learning", label: "My learning" },
    { id: "classrooms", label: "My classes" },
    { id: "notifications", label: "Notifications" },
  ],
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [notice, setNotice] = useState(null);
  const [authError, setAuthError] = useState("");
  const [activeSection, setActiveSection] = useState("");
  const sections = user ? workspaceSections[user.role] || [] : [];

  useEffect(() => {
    if (!user) {
      setAuthError("Sign in to view your dashboard.");
      return;
    }
    setAuthError("");
  }, [user]);

  useEffect(() => {
    setActiveSection(workspaceSections[user?.role]?.[0]?.id || "");
  }, [user?.role]);

  if (!user) {
    return (
      <section className="auth-section">
        <div className="auth-card">
          <div className="auth-card__intro"><span className="auth-eyebrow">UTKRIX LEARNING</span><h1>Dashboard</h1></div>
          <p className="auth-message auth-message--error" role="alert">{authError}</p>
          <a className="btn btn--primary auth-form__submit" href="#/login">Sign in</a>
        </div>
      </section>
    );
  }

  const roleLabel = user.role === "admin" ? "Administrator" : user.role === "moderator" ? "Moderator" : user.role === "instructor" ? "Instructor" : "Student";
  const workspaceDescription = user.role === "admin"
    ? "Manage website content, team profiles, statistics, and accounts."
    : user.role === "moderator"
      ? "Review and respond to support requests and contact messages."
      : user.role === "instructor"
        ? "Build course lessons, manage your classes, and review student submissions."
        : "Browse courses and manage your learning activity.";

  const activeSectionLabel = sections.find((section) => section.id === activeSection)?.label || "Dashboard";
  const renderWorkspace = () => {
    if (activeSection === "notifications") return <NotificationCenter onNotice={setNotice} />;
    if (user.role === "admin") {
      switch (activeSection) {
        case "overview": return <AdminOverview />;
        case "stats": return <AdminStats onNotice={setNotice} />;
        case "team": return <AdminTeamMembers onNotice={setNotice} />;
        case "accounts": return <AdminUsers currentUserId={user.id} onNotice={setNotice} />;
        case "support": return <SupportInbox />;
        case "contacts": return <ContactInbox />;
        case "courses": return <CourseManager onNotice={setNotice} />;
        case "projects": return <ProjectManager onNotice={setNotice} />;
        case "faqs": return <FaqManager onNotice={setNotice} />;
        default: return null;
      }
    }
    if (user.role === "moderator") {
      return activeSection === "contacts" ? <ContactInbox /> : <SupportInbox />;
    }
    if (user.role === "instructor") {
      if (activeSection === "courses") return <CourseManager onNotice={setNotice} />;
      if (activeSection === "builder") return <LearningWorkspace mode="builder" onNotice={setNotice} />;
      if (activeSection === "submissions") return <LearningWorkspace mode="submissions" onNotice={setNotice} />;
      return <ClassroomWorkspace role={user.role} onNotice={setNotice} />;
    }
    if (user.role === "student" && activeSection === "learning") {
      return <LearningWorkspace mode="learning" onNotice={setNotice} />;
    }
    if (user.role === "student" && activeSection === "classrooms") {
      return <ClassroomWorkspace role={user.role} onNotice={setNotice} />;
    }
    return (
      <section className="dashboard-panel" aria-labelledby="browse-courses-title">
        <div className="dashboard-panel__heading">
          <div><h2 id="browse-courses-title">Explore our courses</h2><p>Browse the public course catalog or contact our team.</p></div>
          <a className="btn btn--primary" href="#courses">Browse courses</a>
        </div>
      </section>
    );
  };

  return (
    <section className="dashboard-section" aria-labelledby="dashboard-title">
      <div className="container">
        <div className="dashboard-heading">
          <div>
            <span className="auth-eyebrow">{roleLabel} workspace</span>
            <h1 id="dashboard-title">Welcome, {user.name}</h1>
            <p>{workspaceDescription}</p>
          </div>
          <button className="btn btn--ghost" type="button" onClick={() => { signOut(); window.location.hash = "#home"; }}>Sign out</button>
        </div>
        <DashboardNotice notice={notice} onDismiss={() => setNotice(null)} />
        {sections.length > 0 ? (
          <div className="dashboard-workspace">
            <nav className="dashboard-nav" aria-label={`${roleLabel} workspace sections`}>
              {sections.map((section) => (
                <button
                  key={section.id}
                  className="dashboard-nav__item"
                  type="button"
                  aria-current={activeSection === section.id ? "page" : undefined}
                  onClick={() => setActiveSection(section.id)}
                >
                  {section.label}
                </button>
              ))}
            </nav>
            <div className="dashboard-workspace__content" aria-label={activeSectionLabel}>
              {renderWorkspace()}
            </div>
          </div>
        ) : renderWorkspace()}
      </div>
    </section>
  );
}
