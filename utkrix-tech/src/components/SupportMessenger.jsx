import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApi, postApi } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import Icon from "./Icon.jsx";

const GUEST_STORAGE_KEY = "utkrix-support-guest";
const SUPPORT_CHANNEL = "support";

function readGuest() {
  try {
    const saved = JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY));
    if (saved?.accessToken && saved?.name && saved?.email) return saved;
  } catch {
    localStorage.removeItem(GUEST_STORAGE_KEY);
  }
  return null;
}

export default function SupportMessenger() {
  const { user } = useAuth();
  const [guest, setGuest] = useState(readGuest);
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [guestForm, setGuestForm] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const threadRef = useRef(null);
  const loadSequence = useRef(0);

  const staffUser = user?.role === "admin" || user?.role === "moderator";
  const requestOptions = useMemo(() => (
    guest && !user ? { headers: { "X-Guest-Access-Token": guest.accessToken } } : {}
  ), [guest, user]);

  const loadConversation = useCallback(async (silent = false) => {
    if (!isOpen || staffUser || (!user && !guest)) return;
    const sequence = ++loadSequence.current;
    if (!silent) setLoading(true);

    try {
      let result;
      try {
        result = await getApi(`/support/conversations/${SUPPORT_CHANNEL}`, requestOptions);
      } catch (requestError) {
        if (requestError.status !== 404) throw requestError;
        result = await postApi(
          `/support/conversations/${SUPPORT_CHANNEL}`,
          guest && !user ? { name: guest.name, email: guest.email } : {},
          requestOptions
        );
      }

      if (sequence !== loadSequence.current) return;
      setConversation(result.conversation);
      setMessages((current) => mergeMessages(current, result.conversation.messages || []));
      setError("");
    } catch (requestError) {
      if (sequence === loadSequence.current) setError(requestError.message);
    } finally {
      if (!silent && sequence === loadSequence.current) setLoading(false);
    }
  }, [guest, isOpen, requestOptions, staffUser, user]);

  useEffect(() => {
    loadConversation();
    if (!isOpen || staffUser || (!user && !guest)) return undefined;
    const timer = window.setInterval(() => loadConversation(true), 5000);
    return () => window.clearInterval(timer);
  }, [guest, isOpen, loadConversation, staffUser, user]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => () => {
    loadSequence.current += 1;
  }, []);

  const startGuestChat = async (event) => {
    event.preventDefault();
    setStarting(true);
    setError("");
    try {
      const { accessToken } = await postApi("/support/guest-access", guestForm);
      const nextGuest = { ...guestForm, accessToken };
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(nextGuest));
      setGuest(nextGuest);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending || !conversation) return;

    setSending(true);
    setError("");
    setNotice("");
    try {
      const result = await postApi(`/support/conversations/${SUPPORT_CHANNEL}/messages`, { message }, requestOptions);
      setMessages((current) => mergeMessages(current, [result.message]));
      setDraft("");
      if (!result.emailSent) setNotice("Your message is saved. The team will still see it in their inbox, but the email notification did not send.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`support-messenger${isOpen ? " is-open" : ""}`}>
      {isOpen && (
        <section className="support-chat" id="support-chat-panel" aria-label="Message our team">
          <div className="support-chat__header">
            <div>
              <span className="support-chat__eyebrow">UTKRIX SUPPORT</span>
              <h3>Message our team</h3>
              <p>Your conversation is shared with our support team.</p>
            </div>
            <div className="support-chat__header-actions">
              <span className="support-chat__status"><span /> Online</span>
              <button className="support-chat__close" type="button" onClick={() => setIsOpen(false)} aria-label="Close support chat">
                <Icon name="close" size={20} />
              </button>
            </div>
          </div>

          {staffUser ? (
            <p className="support-chat__notice">Use the dashboard inbox to reply to user conversations.</p>
          ) : (
            <>
              {!user && !guest ? (
                <form className="support-chat__guest-form" onSubmit={startGuestChat}>
                  <p>Start a guest chat. Your private access stays in this browser.</p>
                  <label>
                    Name
                    <input required maxLength={100} value={guestForm.name} onChange={(event) => setGuestForm({ ...guestForm, name: event.target.value })} />
                  </label>
                  <label>
                    Email
                    <input required type="email" maxLength={254} value={guestForm.email} onChange={(event) => setGuestForm({ ...guestForm, email: event.target.value })} />
                  </label>
                  <button className="btn btn--primary" type="submit" disabled={starting}>{starting ? "Starting…" : "Start chat"}</button>
                  {error && <p className="support-chat__error" role="alert">{error}</p>}
                </form>
              ) : (
                <>
                  <div className="support-chat__thread" ref={threadRef} aria-live="polite" aria-label="Conversation messages">
                    {loading ? <p className="support-chat__empty">Loading conversation…</p>
                      : error ? <p className="support-chat__error" role="alert">{error}</p>
                        : messages.length === 0 ? <p className="support-chat__empty">Send a message to start your conversation with our team.</p>
                          : messages.map((message) => (
                            <article key={message.id} className={`support-chat__message${message.senderType === "staff" ? " is-staff" : " is-user"}`}>
                              <span>{message.senderType === "staff" ? message.senderName : "You"}</span>
                              <p>{message.body}</p>
                              <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
                            </article>
                          ))}
                  </div>
                  {notice && <p className="support-chat__notice" role="status">{notice}</p>}
                  <form className="support-chat__composer" onSubmit={sendMessage}>
                    <label className="sr-only" htmlFor="support-chat-message">Write a message</label>
                    <textarea id="support-chat-message" rows={2} maxLength={5000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" disabled={!conversation || loading} />
                    <button className="btn btn--primary" type="submit" disabled={sending || !draft.trim() || !conversation}>{sending ? "Sending…" : "Send"}</button>
                  </form>
                  {error && !loading && <button className="btn btn--ghost support-chat__retry" type="button" onClick={() => loadConversation()}>Try again</button>}
                </>
              )}
            </>
          )}
        </section>
      )}
      <button
        className={`support-messenger__launcher${isOpen ? " is-open" : ""}`}
        type="button"
        aria-label={isOpen ? "Close support chat" : "Open support chat"}
        aria-expanded={isOpen}
        aria-controls="support-chat-panel"
        onClick={() => setIsOpen((open) => !open)}
      >
        <Icon name={isOpen ? "close" : "message"} size={25} />
        {!isOpen && <span className="support-messenger__label">Chat with us</span>}
      </button>
    </div>
  );
}

function mergeMessages(current, incoming) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, { ...byId.get(message.id), ...message }));
  return [...byId.values()].sort((first, second) => (
    new Date(first.createdAt) - new Date(second.createdAt) || first.id - second.id
  ));
}
