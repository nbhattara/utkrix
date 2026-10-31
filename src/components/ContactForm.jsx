import { useRef, useState } from "react";
import { company } from "../config/site.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\d\s-]{7,16}$/;
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, "");

const validate = (v) => {
  const e = {};
  if (v.name.trim().length < 2 || v.name.trim().length > 100) e.name = "Enter your name (2 to 100 characters).";
  if (!v.email.trim()) e.email = "Enter your email address.";
  else if (v.email.trim().length > 254) e.email = "Email addresses must be 254 characters or fewer.";
  else if (!EMAIL_RE.test(v.email.trim())) e.email = "Enter a valid email address, like name@example.com.";
  if (v.phone.trim() && !PHONE_RE.test(v.phone.trim())) e.phone = "Use digits, spaces, + or - only (7 to 16 characters).";
  if (!v.subject.trim() || v.subject.trim().length > 150) e.subject = "Enter a subject (up to 150 characters).";
  if (v.message.trim().length < 10 || v.message.trim().length > 5000) e.message = "Write a message of 10 to 5000 characters.";
  return e;
};

const empty = { name: "", email: "", phone: "", subject: "", message: "" };

export default function ContactForm() {
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef(null);

  const onChange = (e) => {
    const next = { ...values, [e.target.name]: e.target.value };
    setValues(next);
    setStatus(null);
    if (touched[e.target.name]) setErrors(validate(next));
  };
  const onBlur = (e) => {
    setTouched((t) => ({ ...t, [e.target.name]: true }));
    setErrors(validate(values));
  };
  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(values);
    setErrors(errs);
    setTouched({ name: true, email: true, phone: true, subject: true, message: true });
    const firstBad = Object.keys(errs)[0];
    if (firstBad) {
      setStatus(null);
      formRef.current.elements[firstBad].focus();
      return;
    }

    setStatus(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          subject: values.subject.trim(),
          message: values.message.trim(),
          website: "",
        }),
      });

      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error("The server returned an invalid response. Please try again later.");
      }

      if (!result || typeof result !== "object") {
        throw new Error("The server returned an invalid response. Please try again later.");
      }

      if (!response.ok || result.success !== true) {
        throw new Error(result.message || "We could not send your message. Please try again later.");
      }

      setStatus({ type: "success", message: result.message || "Thanks for reaching out. Your message has been sent." });
      setValues(empty);
      setTouched({});
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof TypeError
          ? `Unable to reach the contact service. Please try again or email ${company.email}.`
          : error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = (name, label, props = {}, optional = false) => {
    const err = touched[name] && errors[name];
    const Tag = props.as || "input";
    return (
      <div className="field">
        <label htmlFor={`cf-${name}`}>{label}{optional && <span className="field__opt"> (optional)</span>}</label>
        <Tag
          id={`cf-${name}`}
          name={name}
          value={values[name]}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={err ? "true" : undefined}
          aria-describedby={err ? `cf-${name}-err` : undefined}
          {...props}
          as={undefined}
        />
        {err && <p className="field__error" id={`cf-${name}-err`}>{errors[name]}</p>}
      </div>
    );
  };

  return (
    <form ref={formRef} className="form" onSubmit={onSubmit} noValidate aria-label="Contact form" aria-busy={isSubmitting}>
      {field("name", "Name", { type: "text", autoComplete: "name", maxLength: 100 })}
      {field("email", "Email", { type: "email", autoComplete: "email", inputMode: "email", maxLength: 254 })}
      {field("phone", "Phone", { type: "tel", autoComplete: "tel", inputMode: "tel", maxLength: 16 }, true)}
      {field("subject", "Subject", { type: "text", maxLength: 150 })}
      {field("message", "Message", { as: "textarea", rows: 5, maxLength: 5000 })}
      <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send message"}
      </button>
      <div role="status" aria-live="polite">
        {status && (
          <p className={`form__note${status.type === "error" ? " form__note--error" : ""}`}>
            {status.message}
          </p>
        )}
      </div>
    </form>
  );
}
