import { useCallback, useEffect, useState } from "react";
import { getApi, postApi, putApi } from "../api/client.js";

const formatDate = (value) => new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

export default function NotificationCenter({ onNotice }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getApi("/notifications");
      setNotifications(result.notifications || []);
      setUnreadCount(result.unreadCount || 0);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [revision]);

  useEffect(() => { refresh(); }, [refresh]);

  const markRead = async (id) => {
    setSaving(true);
    try {
      await putApi(`/notifications/${id}/read`, {});
      setRevision((value) => value + 1);
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    } finally {
      setSaving(false);
    }
  };

  const markAllRead = async () => {
    setSaving(true);
    try {
      const result = await postApi("/notifications/read-all", {});
      onNotice({ type: "success", message: result.message || "Notifications marked as read." });
      setRevision((value) => value + 1);
    } catch (requestError) {
      onNotice({ type: "error", message: requestError.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="dashboard-panel" aria-labelledby="notification-center-title">
      <div className="dashboard-panel__heading">
        <div><h2 id="notification-center-title">Notifications</h2><p>{unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "You are up to date."}</p></div>
        <div className="dashboard-form__actions">
          <button className="btn btn--ghost" type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh</button>
          {!!unreadCount && <button className="btn btn--primary" type="button" disabled={saving} onClick={markAllRead}>Mark all read</button>}
        </div>
      </div>
      {loading ? <p className="collection-status" role="status">Loading notifications…</p>
        : error ? <div className="collection-status collection-status--error" role="alert"><p>{error}</p><button className="btn btn--ghost" type="button" onClick={() => setRevision((value) => value + 1)}>Try again</button></div>
          : notifications.length ? (
            <ul className="notification-list">
              {notifications.map((item) => (
                <li className={`notification-item ${item.readAt ? "" : "notification-item--unread"}`} key={item.id}>
                  <div>
                    <span className="auth-eyebrow">{item.type}</span>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                    <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                  </div>
                  {!item.readAt && <button className="btn btn--ghost" type="button" disabled={saving} onClick={() => markRead(item.id)}>Mark read</button>}
                </li>
              ))}
            </ul>
          )           : <p className="collection-status">No notifications yet. New lessons, announcements, materials, assignments, and grading updates will appear here.</p>}
    </section>
  );
}
