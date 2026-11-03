# UtkriX Technologies Website

Responsive marketing and learning-discovery website for UtkriX Technologies. It is a React single-page application built with Vite. Published courses and projects are loaded from the e-learning backend; registration and sign-in use its account APIs and OAuth providers.

## Current status

- The home page presents company information, services, stats, mission/vision/goals, backend-published courses and projects, and contact details.
- Privacy Policy and Terms of Service are available as hash-routed document pages.
- Student/instructor registration, email verification, password login/reset, and Google/Facebook/GitHub OAuth entry points are available through the backend.
- The contact form validates fields in the browser and submits them to the backend contact API, which delivers them through configured SMTP. Contact messages are emailed, not stored by this frontend.
- Several service, company, team, and statistics entries are explicitly placeholders. Replace them with verified company content before launch.
- The website does not include an administrator CMS or course enrollment/payment pages. Projects are managed through admin-only backend endpoints.

## Technology

- React 18
- Vite 7
- JavaScript (ES modules)
- CSS with light/dark theme tokens
- Browser `fetch` for the contact endpoint; no additional runtime dependency

## Getting started

Requires Node.js compatible with the installed Vite version (Node.js 20.19+ or 22.12+ is recommended for Vite 7).

```bash
npm install
npm run dev       # Vite proxies /api to the backend at http://localhost:5000
npm run build     # production files in dist/
npm run preview   # preview the production build
```

For local development, copy `.env.example` to `.env` and adjust `API_PROXY_TARGET` if the backend is not listening on port 5000. For a separate production frontend/API origin, set `VITE_API_BASE_URL` to the API's `/api/v1` URL and allow the frontend origin in the backend's `CORS_ORIGIN`. If the frontend and backend share an origin, keep the default `/api/v1` and route `/api` to the backend through the web server.

The site can be hosted as static files. Configure the host to serve `index.html` for the root path. The current navigation uses URL hashes, so it does not require server-side route rewrites.

## Site pages and behavior

### Home page

The single-page landing view contains:

1. Home/hero, brand message, and calls to action
2. Services and published course catalog
3. Company statistics
4. About and team
5. Mission, vision, and goals
6. Published projects
7. Contact details and contact form

Header navigation targets `#home`, `#about`, `#courses`, `#projects`, and `#contact`. Services and mission content are on the page but are not individual header navigation items.

### Legal pages

- `#/privacy-policy`
- `#/terms-of-service`

Legal content is bundled in the source; these routes do not retrieve documents from a server.

### Implemented interactions

- Responsive navigation menu; it closes when a navigation link is selected and supports Escape.
- Active section indication while scrolling, where `IntersectionObserver` is supported.
- Light/dark theme switch. The initial theme follows the operating-system preference; a user-selected theme is saved in `localStorage` under `utkrix-theme`.
- Contact form client-side validation:
  - Name is required and must contain 2–100 characters.
  - Email is required and checked for a basic valid format (up to 254 characters).
  - Phone is optional; when entered, it accepts digits, spaces, `+`, parentheses, and hyphens (7–16 characters).
  - Subject is required (up to 150 characters); message is required (10–5000 characters).
  - Sending is rate-limited by the backend; delivery status is shown and failed submissions remain available for retry.
- Keyboard skip link, focus indication, semantic landmarks, and accessible form labels/status messaging.
- Contact links use the visitor's email and phone handlers; the address opens a Google Maps search.
- Courses are searchable and filterable by published category, with server pagination and clear loading, empty, and error states.
- Published projects and courses load from the backend API. Signed-in sessions are kept in `sessionStorage` and can be ended from the site navigation.
- OAuth callbacks use browser-bound state, PKCE for Google/GitHub, and a short-lived, single-use exchange code before an access token is stored.

## API and external-service inventory

### Application APIs

The app uses the backend contact, course, project, and authentication endpoints. Company profile, services, and legal documents remain bundled static data.

| Capability | Current implementation | API status |
|---|---|---|
| Contact form submission | `POST /api/v1/contact` with name, email, optional phone, subject, message, and an empty honeypot field | Connected; backend validates and sends email over SMTP |
| Course catalog and categories | `GET /api/v1/courses`, `GET /api/v1/courses/categories` | Connected; published course data, search, filters, and pagination |
| Project catalog | `GET /api/v1/projects` | Connected; returns only published projects |
| Account registration and email sign-in | `/api/v1/auth/register`, `/login`, `/verify-email`, `/password-reset/*` | Connected; email verification and password reset require configured SMTP |
| Social sign-in | `/api/v1/auth/oauth/{provider}` for Google, Facebook, and GitHub | Connected; provider credentials and registered callback URLs are required |
| Company/services/legal content | Static modules under `src/data/` and `src/config/` | Bundled content |
| Theme preference | Browser `localStorage` | Browser storage API, not a server API |

Administrators manage projects with `GET /api/v1/projects/admin`, `GET /api/v1/projects/admin/{id}`, `POST /api/v1/projects`, `PUT /api/v1/projects/{id}`, and `DELETE /api/v1/projects/{id}`. All management endpoints require an administrator bearer token.

### OAuth provider configuration

Set the following secrets in the backend `.env` or deployment secret store. Register each callback URL exactly as `OAUTH_CALLBACK_BASE_URL/{provider}/callback` (for example, `http://localhost:5000/api/v1/auth/oauth/google/callback` during local development). Set `FRONTEND_URL` to the website origin (the local Vite origin is `http://localhost:5173`).

| Provider | Required settings | Requested scopes |
|---|---|---|
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `openid email profile` |
| Facebook | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, supported `FACEBOOK_GRAPH_VERSION` | `email,public_profile` |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | `read:user user:email` |

Google/GitHub use PKCE and all providers use a short-lived, HTTP-only, same-site state cookie. Google/GitHub verified emails can be linked to an existing account. Facebook does not provide a verified-email claim through this profile flow, so new Facebook accounts must verify their address by email before signing in. OAuth registration creates student accounts; instructor registration is available through the email form and still requires administrator approval.

The backend sends contact messages to `CONTACT_TO` (or `SMTP_USER` if no separate recipient is configured), with the visitor's email as the reply-to address. The form shows the backend's success/error response and retains entered values if delivery fails. SMTP credentials remain backend-only.

### External requests and protocol links

| Integration | Use | Notes |
|---|---|---|
| Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) | Loads Figtree and Sora styles/fonts from `index.html` | Third-party network request; self-host fonts to remove this dependency |
| Google Maps URL (`https://www.google.com/maps/search/?api=1&query=...`) | Opens a search for the configured company address | A link, not an authenticated Maps API integration; no API key is configured |
| `mailto:` | Opens the visitor's configured email application | Does not send email from the website |
| `tel:` | Opens the visitor's phone handler | Does not place a call from the website |

### Browser APIs used

The frontend uses `localStorage` for the theme, `matchMedia` for system theme preference, `IntersectionObserver` for active navigation state, `hashchange` for hash routing, and standard DOM focus/scroll APIs. These are browser capabilities and are not backend endpoints.

### Contact API contract

```http
POST /api/v1/contact
Content-Type: application/json
```

Request (phone is optional):

```json
{
  "name": "Visitor name",
  "email": "visitor@example.com",
  "phone": "+977 0000000000",
  "subject": "Project inquiry",
  "message": "Tell us about your project.",
  "website": ""
}
```

The API returns `{ "success": true, "message": "..." }` after SMTP delivery, or a non-2xx `{ "success": false, "message": "..." }` response for validation, rate-limit, or delivery failures. The endpoint does not persist messages, so delivery depends on backend SMTP configuration.


## Requirements

### Functional requirements

#### Implemented in the current frontend

- **FR-01:** Show the company's landing page and its content sections.
- **FR-02:** Allow visitors to navigate between page sections using header/footer links and hero calls to action.
- **FR-03:** Show Privacy Policy and Terms of Service as separate hash-routed pages, with in-document section navigation.
- **FR-04:** Provide a responsive navigation menu, including Escape-to-close behavior.
- **FR-05:** Let visitors toggle light/dark mode and retain their explicit selection across reloads.
- **FR-06:** Indicate the currently active page section where supported by the browser.
- **FR-07:** Display company address, email, and telephone links.
- **FR-08:** Validate contact form inputs in the browser and explain invalid fields to the visitor.
- **FR-09:** Provide keyboard-accessible navigation, focus handling, and live status messaging.

#### Required for an operational public website

- **FR-10:** Replace placeholder company profile, service descriptions, team members, project details, and statistics with approved and accurate content.
- **FR-11:** Deliver valid contact form submissions to a designated company inbox or inquiry-management system, with visible success and failure states. Define what happens when the service is unavailable.
- **FR-12:** Validate and constrain form fields on the server; do not rely on browser validation as a security or data-integrity boundary.
- **FR-13:** Decide whether contact requests should be stored, emailed, or both, and define access controls and retention/deletion behavior if stored.
- **FR-14:** Confirm the public contact information, international phone format, legal entity details, and legal text with the business owner.

### Non-functional requirements

These are recommended acceptance requirements for launch; the repository does not currently define numeric service-level targets.

- **NFR-01 — Responsive:** Content and controls should remain usable on supported mobile, tablet, and desktop viewport sizes.
- **NFR-02 — Accessibility:** Preserve semantic HTML, labels, keyboard access, visible focus, meaningful image alternatives, and adequate contrast. Target WCAG 2.2 AA and verify with automated and manual checks.
- **NFR-03 — Performance:** Keep the page lightweight, optimize/compress image assets, lazy-load below-the-fold imagery, and avoid blocking third-party resources where practical.
- **NFR-04 — Compatibility:** Test current stable Chrome, Edge, Firefox, and Safari, plus mobile browsers used by the target audience.
- **NFR-05 — Security:** Serve over HTTPS. If a form API is added, validate and encode untrusted data, rate-limit submissions, protect against spam/abuse, keep secrets on the server, and configure restrictive CORS/security headers as appropriate.
- **NFR-06 — Privacy:** Disclose any collection, processing, third-party sharing, and retention of visitor data accurately in the Privacy Policy. The current frontend does not submit form data.
- **NFR-07 — Reliability:** A failed contact request must not be presented as a success; provide a useful retry path or direct email fallback.
- **NFR-08 — SEO and sharing:** Maintain a descriptive page title and metadata, social-sharing image, favicon, and indexable production content. Consider server rendering or static prerendering if search visibility for legal/content routes is important.
- **NFR-09 — Maintainability:** Keep company settings in `src/config/site.js`, reusable page content in `src/data/`, and avoid hard-coding editable business content into components.
- **NFR-10 — Observability:** If a backend is added, log server-side delivery failures without logging unnecessary personal data; monitor endpoint availability and delivery outcomes.

## What is needed next

### Content and business decisions

- Approve the company story, mission/vision/goals, service descriptions, team identities/photos, project case studies, and real statistics.
- Verify company name/legal entity, address, phone, email, operating hours, and response-time expectations.
- Review legal notices against the actual data collection, analytics, hosting, and email practices.

### If the contact form should send inquiries

1. Choose a backend/API host and an email delivery provider or inquiry-management destination.
2. Agree on the endpoint contract, allowed field lengths, required/optional fields, validation rules, and error responses.
3. Implement server-side validation, abuse/spam controls, safe logging, and email delivery; keep provider credentials in server-side environment variables.
4. Connect the React submit handler to the endpoint and add loading, success, validation, network-failure, and retry states. Do not clear the form until the submission is confirmed.
5. Configure production API URL, HTTPS, CORS if frontend and API origins differ, and monitoring.
6. Test successful requests, invalid input, server errors, network loss, duplicate submissions, spam controls, and privacy behavior.

If no backend is planned, retain the explicit UI notice and direct visitors to the email/phone links rather than claiming the form sends messages.

### Before launch

- Remove or replace all visible placeholder notes and placeholder copy.
- Check all image files and links; update branding, favicon, and social-sharing metadata.
- Decide whether to self-host Google Fonts and whether analytics/cookie consent is needed. No analytics or cookie-consent tool is currently configured.
- Run the production build and test the built site on the intended static host.
- Add automated tests for form validation, routing, theme persistence, responsive navigation, and any future API integration.

## Updating content and assets

| Content | Location |
|---|---|
| Company name, contact details, navigation, legal page routes | `src/config/site.js` |
| Services | `src/data/services.js` |
| Company story | `src/data/about.js` |
| Statistics | `src/data/stats.js` |
| Team | `src/data/team.js` |
| Mission, vision, and goals | `src/data/mvg.js` |
| Projects | Admin-only `/api/v1/projects` endpoints and the MySQL `projects` table |
| Privacy Policy and Terms of Service | `src/data/dataNotice.js`, `src/data/usageAgreement.js` |
| Contact form validation and future submission handler | `src/components/ContactForm.jsx` |
| Legal routes and page composition | `src/App.jsx` |
| Colors and typography tokens | `src/styles/tokens.css` |
| Global and responsive styles | `src/styles/global.css` |
| Page title, metadata, favicon links, Google Fonts | `index.html` |
| Logo, banner, social image, and project art | `public/assets/` |

Legal source text and its extractor are in `scripts/`. If regenerating legal data, use the project's supported Python environment to run `scripts/extract_legal.py` with the source text and destination module.

## Project structure

```text
public/                 Static images, icons, and other public assets
scripts/                Legal document extraction helper and source text
src/
  api/                  Backend API client helpers
  auth/                 Browser session context
  components/           Shared UI components
  config/               Company and navigation configuration
  data/                 Static page content
  hooks/                Theme, API collections, hash routing, active-section behavior
  sections/             Home, course catalog, project catalog, and other sections
  styles/               Design tokens and global styles
```
