import { assets, company } from "../config/site.js";

// Shows the supplied logo. Two transparent PNGs, one per theme (swapped with CSS).
// If an image fails to load, the text wordmark below is shown instead.
export default function Logo({ className = "" }) {
  const hideOnError = (e) => {
    e.currentTarget.style.display = "none";
    e.currentTarget.parentElement.classList.add("logo--fallback");
  };
  return (
    <span className={`logo ${className}`}>
      <img className="logo__img logo__img--light" src={assets.logoLight} alt={company.name} width="740" height="202" onError={hideOnError} />
      <img className="logo__img logo__img--dark" src={assets.logoDark} alt="" aria-hidden="true" width="747" height="213" onError={hideOnError} />
      <span className="logo__text" aria-hidden="true">{company.wordmark}</span>
    </span>
  );
}
