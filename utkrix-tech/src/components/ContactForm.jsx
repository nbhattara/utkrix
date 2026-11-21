import { useState } from "react";
import { company } from "../config/site.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\d\s-]{7,16}$/;
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, "");
const empty = { name: "", email: "", phone: "", subject: "", message: "", website: "" };

function validate(values) {
  const errors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const phone = values.phone.trim();

  if (name.length < 2 || name.length > 100) errors.name = "Enter your name (2 to 100 characters).";
  if (!email) errors.email = "Enter your email address.";
  else if (email.length > 254) errors.email = "Email addresses must be 254 characters or fewer.";
  else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address, like name@example.com.";
  if (phone && !PHONE_RE.test(phone)) errors.phone = "Use digits, spaces, + or - only (7 to 16 characters).";
  if (!values.subject.trim() || values.subject.trim().length > 150) errors.subject = "Enter a subject (up to 150 characters).";
  if (values.message.trim().length < 10 || values.message.trim().length > 5000) errors.message = "Write a message of 10 to 5000 characters.";
  return errors;
}

export default function ContactForm() {
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onChange = (event) => {
    const next = { ...values, [event.target.name]: event.target.value };
    setValues(next);
    setStatus(null);
    if (touched[event.target.name]) setErrors(validate(next));
  };

  const onBlur = (event) => {
    setTouched((current) => ({ ...current, [event.target.name]: true }));
    setErrors(validate(values));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    setTouched({ name: true, email: true, phone: true, subject: true, message: true });

    const firstInvalidField = Object.keys(nextErrors)[0];
    if (firstInvalidField) {
      event.currentTarget.elements[firstInvalidField].focus();
      return;
    }

    setIsSubmitting(true);
    setStatus(null);
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
          website: values.website,
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

      setStatus({ type: "success", message: result.message || "Thanks for reaching out. Your message has been received." });
      setValues(empty);
      setTouched({});
      setErrors({});
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
    const error = touched[name] && errors[name];
    const Tag = props.as || "input";
    return (
      <div className="field" key={name}>
        <label htmlFor={`cf-${name}`}>
          {label}{optional && <span className="field__opt"> (optional)</span>}
        </label>
        <Tag
          id={`cf-${name}`}
          name={name}
          value={values[name]}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `cf-${name}-err` : undefined}
          {...props}
        />
        {error && <p className="field__error" id={`cf-${name}-err`}>{errors[name]}</p>}
      </div>
    );
  };

  return (
    <form className="form" onSubmit={onSubmit} noValidate aria-label="Contact form" aria-busy={isSubmitting}>
      {field("name", "Name", { type: "text", autoComplete: "name", maxLength: 100 })}
      {field("email", "Email", { type: "email", autoComplete: "email", inputMode: "email", maxLength: 254 })}
      {field("phone", "Phone", { type: "tel", autoComplete: "tel", inputMode: "tel", maxLength: 16 }, true)}
      {field("subject", "Subject", { type: "text", maxLength: 150 })}
      {field("message", "Message", { as: "textarea", rows: 5, maxLength: 5000 })}
      <div className="contact-form__honeypot" aria-hidden="true">
        <label htmlFor="cf-website">Leave this field empty</label>
        <input id="cf-website" name="website" value={values.website} onChange={onChange} tabIndex={-1} autoComplete="off" />
      </div>
      <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send message"}
      </button>
      <div role="status" aria-live="polite">
        {status && <p className={`form__note${status.type === "error" ? " form__note--error" : ""}`}>{status.message}</p>}
      </div>
    </form>
  );
}
