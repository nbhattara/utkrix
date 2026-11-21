import Icon from "./Icon.jsx";

// Marks content that must be replaced with real company information.
export default function PlaceholderNote({ children = "Placeholder content. Replace with real company information." }) {
  return (
    <p className="placeholder-note">
      <Icon name="info" size={16} /> <span>{children}</span>
    </p>
  );
}
