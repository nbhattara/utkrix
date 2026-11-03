import Icon from "./Icon.jsx";

export default function ThemeToggle({ theme, onToggle }) {
  const dark = theme === "dark";
  return (
    <button type="button" className="icon-btn" onClick={onToggle} aria-pressed={dark} aria-label="Dark theme" title={dark ? "Switch to light theme" : "Switch to dark theme"}>
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  );
}
