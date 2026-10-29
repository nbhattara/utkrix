import { useRef, useState } from "react";
import { company } from "../config/site.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\d\s-]{7,16}$/;

const validate = (v) => {
  const e = {};
  if (v.name.trim().length < 2) e.name = "Enter your name (at least 2 characters).";
  if (!v.email.trim()) e.email = "Enter your email address.";
  else if (!EMAIL_RE.test(v.email.trim())) e.email = "Enter a valid email address, like name@example.com.";
  if (v.phone.trim() && !PHONE_RE.test(v.phone.trim())) e.phone = "Use digits, spaces, + or - only (7 to 16 characters).";
  if (v.message.trim().length < 10) e.message = "Write a message of at least 10 characters.";
  return e;
};

const empty = { name: "", email: "", phone: "", message: "" };

// TODO: submit handler. The form is UI-only for now and sends nothing.
// When a backend or form service exists, send `values` from here
// (for example with fetch) and show real success / error states.
function handleValidSubmit(values) {
  void values;
}

export default function ContactForm() {
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [checked, setChecked] = useState(false);
  const formRef = useRef(null);

  const onChange = (e) => {
    const next = { ...values, [e.target.name]: e.target.value };
    setValues(next);
    setChecked(false);
    if (touched[e.target.name]) setErrors(validate(next));
  };
  const onBlur = (e) => {
    setTouched((t) => ({ ...t, [e.target.name]: true }));
    setErrors(validate(values));
  };
  const onSubmit = (e) => {
    e.preventDefault();
    const errs = validate(values);
    setErrors(errs);
    setTouched({ name: true, email: true, phone: true, message: true });
    const firstBad = Object.keys(errs)[0];
    if (firstBad) {
      setChecked(false);
      formRef.current.elements[firstBad].focus();
      return;
    }
    handleValidSubmit(values);
    setChecked(true);
    setValues(empty);
    setTouched({});
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
    <form ref={formRef} className="form" onSubmit={onSubmit} noValidate aria-label="Contact form">
      {field("name", "Name", { type: "text", autoComplete: "name" })}
      {field("email", "Email", { type: "email", autoComplete: "email", inputMode: "email" })}
      {field("phone", "Phone", { type: "tel", autoComplete: "tel", inputMode: "tel" }, true)}
      {field("message", "Message", { as: "textarea", rows: 5 })}
      <button type="submit" className="btn btn--primary">Send message</button>
      <div role="status" aria-live="polite">
        {checked && (
          <p className="form__note">
            Your details look good, but this form does not send messages yet. Please email{" "}
            <a href={`mailto:${company.email}`}>{company.email}</a> for now.
          </p>
        )}
      </div>
    </form>
  );
}
