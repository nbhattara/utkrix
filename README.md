# UtkriX Technologies: website

Frontend-only React single-page site (Vite). No backend, no API calls: all content is static.

**Sections:** Home, About, Projects, Contact (in-page smooth scrolling), plus Mission/Vision/Goals,
and separate **Privacy Policy** and **Terms of Service** pages (footer links).
**Features:** light/dark theme (header toggle, saved in `localStorage`, follows the system by default),
mobile-first responsive layout with a collapsible menu, keyboard-friendly and accessible markup.

## Setup

Requires Node.js 18+.

```bash
npm install
npm run dev       # development server (http://localhost:5173)
npm run build     # production build in /dist
npm run preview   # serve the production build locally
```

## Folder structure

```
index.html                  page shell, favicon links, fonts, no-flash theme script
public/
  favicon.ico, favicon-32.png, apple-touch-icon.png
  assets/
    logo-light.png          logo for the light theme (transparent)
    logo-dark.png           logo for the dark theme (transparent)
    logo-mark.png           icon only (hero artwork)
    company-overview.jpg              banner shown in About
    og-image.jpg            social sharing image
    projects/project-N.svg  placeholder project images
scripts/
  extract_legal.py          turns the supplied legal text into src/data/*.js
  privacy_policy.txt, terms_of_service.txt   the supplied source text
src/
  config/site.js            company details, asset paths, navigation  <- edit here
  data/                     all editable content (services, stats, team, projects, about, mission/vision/goals)
    dataNotice.js, usageAgreement.js      legal text (verbatim from the supplied documents)
  styles/tokens.css         colours and fonts (themes)  <- brand palette lives here
  styles/global.css         all component styles
  components/               Header, Footer, Logo, ThemeToggle, ContactForm, DocumentPage, ...
  sections/                 Hero, Services, Stats, About, MissionVision, Projects, Contact
  hooks/                    useTheme, useHashRoute, useActiveSection
```

## Where to replace things

| What | Where |
| --- | --- |
| **Logo** | Replace `public/assets/logo-light.png` and `logo-dark.png` (keep the file names, transparent PNG). Paths are set in `src/config/site.js` (`assets`). The header falls back to a text wordmark if an image fails to load. |
| **Favicon** | Replace `public/favicon.ico`, `favicon-32.png`, `apple-touch-icon.png` (links are in `index.html`). |
| **Company details** | `src/config/site.js` (`company`): name, address, email, phone, tagline. Used in the header, hero, contact section and footer. |
| **Services, stats, team, about, mission/vision/goals** | `src/data/services.js`, `stats.js`, `team.js`, `about.js`, `mvg.js`. Everything is marked as placeholder; delete the `<PlaceholderNote />` lines in `src/sections/*.jsx` once the real content is in. |
| **Projects** | `src/data/projects.js`. Add or remove objects; the grid updates. Put images in `public/assets/projects/`. |
| **Team photos** | Add `photo: "/assets/team/name.jpg"` to a member in `src/data/team.js`. |
| **Privacy Policy / Terms** | Text lives in `src/data/dataNotice.js` and `usageAgreement.js` (see below). |
| **Brand colours** | `src/styles/tokens.css`. `--brand-*` hold the logo colours; the light and dark theme blocks define every colour used by the site. |
| **Fonts** | Google Fonts link in `index.html` (Sora, Figtree), variables in `tokens.css`. Self-host them if you want no third-party requests. |

### Legal pages

The Privacy Policy and Terms of Service were extracted from the supplied documents, with only line wraps
joined and nothing added or rewritten. To update them, edit the data files directly, or replace the text in
`scripts/` and run:

```bash
python3 scripts/extract_legal.py scripts/privacy_policy.txt src/data/dataNotice.js privacyPolicy
python3 scripts/extract_legal.py scripts/terms_of_service.txt src/data/usageAgreement.js termsOfService
```

Routes: `#/privacy-policy` and `#/terms-of-service`. Add another page by adding a data file and an entry in
`legalDocs` (`src/App.jsx`) and `legalPages` (`src/config/site.js`).

### Contact form

Client-side validation only (name, email, optional phone, message). Nothing is sent.
**TODO:** connect the submit handler: `handleValidSubmit` in `src/components/ContactForm.jsx`. Update the
confirmation message there at the same time.

## Notes

- **Blank page in Brave / with ad-blockers (dev server only):** content blockers can block files whose names look like ads or policy pages. That is why the legal data files are named `dataNotice.js` and `usageAgreement.js`, and why the banner image is `company-overview.jpg`. Keep that in mind when naming new files, or lower Shields for `localhost` while developing.

- Navigation uses URL hashes (`#about`, `#/privacy-policy`), so it works on any static host with no server rules.
- Phone is shown and linked exactly as supplied (`tel:9768682231`). Use `+9779768682231` in the link if you want it to dial from abroad.
