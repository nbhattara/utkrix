import { useCallback, useEffect, useState } from "react";
import { deleteApi, getApi, getApiList, postApi, putApi } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

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
                  <thead><tr><th>Course</th><th>Status</th><th>Students</th><th>Lessons</th><th>Actions</th></tr></thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr key={course.id}>
                        <td><strong>{course.title}</strong><span>{course.category} · NPR {Number(course.price).toLocaleString("en-NP")}</span></td>
                        <td><span className={`dashboard-badge ${course.isPublished ? "dashboard-badge--published" : ""}`}>{course.isPublished ? "Published" : "Draft"}</span></td>
                        <td>{course._count?.enrollments ?? 0}</td>
                        <td>{course._count?.lessons ?? 0}</td>
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

function StudentDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getApi("/student/dashboard")
      .then((result) => setData(result.dashboard))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {loading ? <p className="collection-status" role="status">Loading your learning overview…</p>
        : error ? <p className="collection-status collection-status--error" role="alert">{error}</p>
          : data && (
            <MetricCards metrics={[
              { label: "Enrolled courses", value: data.enrollments?.total },
              { label: "In progress", value: data.enrollments?.active },
              { label: "Completed", value: data.enrollments?.completed },
              { label: "Average progress", value: data.enrollments?.avgProgress != null ? `${data.enrollments.avgProgress}%` : null },
              { label: "Certificates", value: data.certificates?.total },
              { label: "Pending payments", value: data.payments?.pending },
            ]} />
          )}

      <section className="dashboard-panel" aria-labelledby="my-learning-title">
        <div className="dashboard-panel__heading">
          <div><h2 id="my-learning-title">Your learning</h2><p>Pick up where you left off.</p></div>
          <a className="btn btn--primary" href="#courses">Browse courses</a>
        </div>
        {data?.recentCourses?.length ? (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead><tr><th>Course</th><th>Status</th><th>Progress</th><th>Action</th></tr></thead>
              <tbody>{data.recentCourses.map((enrollment) => (
                <tr key={enrollment.id}>
                  <td><strong>{enrollment.course?.title}</strong><span>{enrollment.course?.category}</span></td>
                  <td><span className="dashboard-badge">{enrollment.status}</span></td>
                  <td>{Math.round(Number(enrollment.completionPercentage))}%</td>
                  <td><a href="#courses">Explore courses</a></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : !loading && <p className="collection-status">You have not enrolled in a course yet. Browse the catalog to get started.</p>}
      </section>
    </>
  );
}

function InstructorDashboard({ onNotice }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    getApi("/teacher/dashboard")
      .then((result) => setData(result.dashboard))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [revision]);

  return (
    <>
      {loading ? <p className="collection-status" role="status">Loading instructor overview…</p>
        : error ? <p className="collection-status collection-status--error" role="alert">{error}</p>
          : data && <MetricCards metrics={[
            { label: "Your courses", value: data.courses?.total },
            { label: "Published", value: data.courses?.published },
            { label: "Drafts", value: data.courses?.draft },
            { label: "Students", value: data.enrollments?.total },
            { label: "Active enrollments", value: data.enrollments?.active },
            { label: "Quizzes", value: data.quizzes?.total },
          ]} />}
      <CourseManager onNotice={onNotice} onDataChange={() => setRevision((value) => value + 1)} />
    </>
  );
}

function AdminDashboard({ user, onNotice }) {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getApi("/admin/dashboard")
      .then((result) => setDashboard(result.dashboard))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {loading ? <p className="collection-status" role="status">Loading administrator overview…</p>
        : error ? <p className="collection-status collection-status--error" role="alert">{error}</p>
          : dashboard && <MetricCards metrics={[
            { label: "Total accounts", value: dashboard.users?.total },
            { label: "Instructors", value: dashboard.users?.teachers },
            { label: "Pending instructors", value: dashboard.users?.pendingTeachers },
            { label: "Courses", value: dashboard.courses?.total },
            { label: "Published courses", value: dashboard.courses?.published },
            { label: "Enrollments", value: dashboard.courses?.enrollments },
            { label: "Pending payments", value: dashboard.payments?.pending },
            { label: "Certificates", value: dashboard.certificates?.issued },
          ]} />}
      <AdminUsers currentUserId={user.id} onNotice={onNotice} />
      <CourseManager onNotice={onNotice} />
      <ProjectManager onNotice={onNotice} />
    </>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [notice, setNotice] = useState(null);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!user) {
      setAuthError("Sign in to view your dashboard.");
      return;
    }
    setAuthError("");
  }, [user]);

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

  const roleLabel = user.role === "admin" ? "Administrator" : user.role === "instructor" ? "Instructor" : "Student";

  return (
    <section className="dashboard-section" aria-labelledby="dashboard-title">
      <div className="container">
        <div className="dashboard-heading">
          <div>
            <span className="auth-eyebrow">{roleLabel} workspace</span>
            <h1 id="dashboard-title">Welcome, {user.name}</h1>
            <p>Manage your learning and account activity.</p>
          </div>
          <button className="btn btn--ghost" type="button" onClick={() => { signOut(); window.location.hash = "#home"; }}>Sign out</button>
        </div>
        <DashboardNotice notice={notice} onDismiss={() => setNotice(null)} />
        {user.role === "admin" ? <AdminDashboard user={user} onNotice={setNotice} />
          : user.role === "instructor" ? <InstructorDashboard onNotice={setNotice} />
            : <StudentDashboard />}
      </div>
    </section>
  );
}
