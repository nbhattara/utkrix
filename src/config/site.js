// Single source of truth for company details and navigation.
// Company details are used exactly as supplied.
export const company = {
  name: "UtkriX Technologies",
  wordmark: "UtkriX",
  legalEntity: "Utkrista Shikshya Pvt Ltd",
  address: "Damak-09, Jhapa, Nepal",
  email: "utkrixtechnologies@gmail.com",
  phone: "9768682231",
  // Taken from the supplied banner. Replace if the company wording changes.
  tagline: "Engineering the Exceptional",
  motto: ["Ideas", "Code", "Real solutions"],
};

// Asset paths: replace the files in /public/assets (see README). Same file names = no code changes.
export const assets = {
  logoLight: "/assets/logo-light.png", // used on the light theme
  logoDark: "/assets/logo-dark.png", // used on the dark theme
  logoMark: "/assets/logo-mark.png",
  banner: "/assets/company-overview.jpg",
};

// In-page sections (order = order on the page).
export const navItems = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "courses", label: "Courses" },
  { id: "projects", label: "Projects" },
  { id: "faqs", label: "FAQs" },
  { id: "contact", label: "Contact" },
];

export const legalPages = [
  { route: "privacy-policy", label: "Privacy Policy" },
  { route: "terms-of-service", label: "Terms of Service" },
];
