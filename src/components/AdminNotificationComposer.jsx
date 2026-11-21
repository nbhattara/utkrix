import { useState } from "react";
import { postApi } from "../api/client.js";

const blankForm = { title: "", body: "", imageUrl: "" };

export default function AdminNotificationComposer({ onNotice, onSent }) {
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await postApi("/notifications/broadcast", {
        title: form.title.trim(),
        body: form.body.trim(),
        imageUrl: form.imageUrl.trim() || null,
      });
      onNotice({ type: "success", message: result.message || "Notification sent." });
      setForm(blankForm);
      window.dispatchEvent(new Event("utkrix:notifications-changed"));
      onSent?.();
    } catch (requestError) {
      setError(requestError.message);
      onNotice({ type: "error", message: requestError.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="dashboard-panel" aria-labelledby="compose-notification-title">
      <div className="dashboard-panel__heading">
        <div>
          <h2 id="compose-notification-title">New announcement</h2>
          <p>Send a notification to every active account. An image is optional.</p>
        </div>
      </div>
      {error ? <div className="collection-status collection-status--error" role="alert"><p>{error}</p></div> : null}
      <form className="dashboard-form" onSubmit={submit}>
        <div className="dashboard-form__grid">
          <label className="field">
            <span>Title</span>
            <input required minLength={3} maxLength={150} value={form.title} onChange={update("title")} placeholder="e.g. New course available" />
          </label>
          <label className="field">
            <span>Image URL (optional)</span>
            <input type="url" maxLength={2048} value={form.imageUrl} onChange={update("imageUrl")} placeholder="https://…" />
          </label>
          <label className="field dashboard-form__wide">
            <span>Message</span>
            <textarea required maxLength={2000} value={form.body} onChange={update("body")} placeholder="Write the announcement…" />
          </label>
        </div>
        <div className="dashboard-form__actions">
          <button className="btn btn--primary" type="submit" disabled={saving}>{saving ? "Sending…" : "Send notification"}</button>
        </div>
      </form>
    </section>
  );
}
