# UtkriX Technologies Website

Responsive marketing and learning-discovery website for UtkriX Technologies. It is a React single-page application built with Vite. Published courses and projects are loaded from the e-learning backend; registration and sign-in use its account APIs and OAuth providers.

## Current status

- The home page presents company information, services, stats, mission/vision/goals, backend-published courses, projects, and FAQs, plus contact details.
- The database currently includes six clearly labeled sample projects and six sample courses; these are database records, not frontend constants.
- Privacy Policy and Terms of Service are available as hash-routed document pages.
- Student registration, email verification, password login/reset, and Google/Facebook/GitHub OAuth entry points are available through the backend. New registrations are students; administrators assign instructor access.
- The contact area has a traditional project inquiry form, stored in the database and delivered through configured SMTP. A separate floating home-page chat icon opens the Admin/Moderator support messenger.
- Several service, company, team, and statistics entries are explicitly placeholders. Replace them with verified company content before launch.
- Signed-in users have role-based dashboards for administrators, moderators, instructors, and students. The admin workspace manages selected site content, accounts, and inboxes; company, services, and legal-page content remain bundled static data.
- Students can join instructor-led classrooms with a class code, complete structured lessons, submit assignments, and view grades and feedback. Paid enrollment and payment are not implemented.

## Technology

- React 18
- Vite 7
- JavaScript (ES modules)
- CSS with light/dark theme tokens
- Browser `fetch` for form submissions and the shared API client for chat; no additional runtime dependency

## Getting started

Requires Node.js compatible with the installed Vite version (Node.js 20.19+ or 22.12+ is recommended for Vite 7).

```bash
npm install
npm run dev       # Vite proxies /api to the backend at http://localhost:5000
npm run build     # production files in dist/
npm run preview   # preview the production build
```

For local development, copy `.env.example` to `.env` and adjust `API_PROXY_TARGET` if the backend is not listening on port 5000. For a separate production frontend/API origin, set `VITE_API_BASE_URL` to the API's `/api/v1` URL and allow the frontend origin in the backend's `CORS_ORIGIN`. If the frontend and backend share an origin, keep the default `/api/v1` and route `/api` to the backend through the web server.

The site can be hosted as static files. Configure the host to serve `index.html` for the root path and as a fallback for `/login` and `/register`; those account pages can be opened directly by URL. Other in-site navigation uses URL hashes.

## Site pages and behavior

### Home page

The single-page landing view contains:

1. Home/hero, brand message, and calls to action
2. Services and published course catalog
3. Company statistics
4. About and team
5. Mission, vision, and goals
6. Published projects
7. Contact details and support chat

Header navigation targets `#home`, `#about`, `#courses`, `#projects`, and `#contact`. Services and mission content are on the page but are not individual header navigation items.

### Legal pages

- `#/privacy-policy`
- `#/terms-of-service`

Legal content is bundled in the source; these routes do not retrieve documents from a server.

### Dashboards

After signing in, use **Dashboard** in the header (`#/dashboard`). The available sections depend on the account role:

| Role | Available now |
|---|---|
| **Administrator** | Live account/course/project overview; manage accounts, roles, instructor access and account status; manage courses, projects, FAQs, team members, and website statistics; reply to support chats, review contact-form messages, and view notifications. |
| **Moderator** | Work with the support inbox, review contact-form messages, and view notifications. Moderators do not have account or course-management access. |
| **Instructor** | Manage only courses assigned to their account; create and edit courses; build modules and lessons with video/document resources; view enrolled students; share instructor-only classroom posts and assignments; review submissions, grade work, leave feedback, and view notifications. Free-tier instructors can create up to two courses. |
| **Student** | Browse the public catalog, join a classroom with its instructor-provided class code, study its structured lessons, track completion, submit assignment responses, view grades and feedback, and receive course notifications. Student access is limited to joined classes. |

Classroom posts are read-only for students and the stream refreshes periodically; it is not a real-time group chat. Classroom uploads are private, limited to 25 MB, and available only to the assigned instructor, an administrator, or an enrolled student. A course completion certificate is issued after all lessons are completed and every course assignment has been graded. Certificates are currently shown in the student learning workspace; there is no separate certificate download or verification page.

The instructor and student workspaces use the same responsive dashboard navigation and shared card/form styles. Student learning views show completion progress and feedback; the instructor workspace groups curriculum and grading tools by course.

#### Recommended dashboard roadmap (not implemented)

The following are proposed improvements, not features currently available in the dashboards.

**Role-specific workspaces**

- **Administrator:** add classroom and enrollment oversight, assignment administration, reports, and settings. Expand the overview with enrollment, classroom activity, pending instructor approval, and course engagement metrics.
- **Instructor:** add course-level analytics and tools for organizing resources across larger curricula.
- **Student:** add a resume-last-lesson shortcut, due-date reminders, and downloadable or verifiable certificates.
- **Moderator:** add a focused support overview, reported-content and user-report queues, and activity history. Keep account roles and financial settings administrator-only.

The core learning path is now supported: instructors build course modules and lessons, students enroll by class code and track lesson completion, assignment responses can be submitted and graded with feedback, and a certificate is issued when course requirements are met. A possible data hierarchy is `Course → Modules → Lessons and Assignments → Submissions → Grades and Feedback`, with enrollments linked to student progress.

**Further business and platform improvements**

- Add quizzes, automated grading, attendance, and course discussions.
- Add reporting for enrollments, course engagement, and instructor performance; consider revenue reporting only after payments exist.
- Add coupons, payment handling, and instructor earnings only with the required financial controls.
- Add a content-management editor for currently bundled company, services, mission, and legal content. Team, statistics, projects, and FAQs already have admin management.
- Add searchable/filterable reporting tables, richer trend charts, and accessible loading/empty states throughout the dashboards.
- Add audit history for sensitive administrative actions.

**Potential API groups**

These are illustrative future interfaces; they are not currently implemented API routes:

| Area | Example endpoints |
|---|---|
| Analytics | `GET /api/v1/analytics/admin` |

Modules, lessons, progress, assignment submissions, grading, and certificate issuance are implemented under the authenticated `/api/v1/classrooms/{courseId}` routes. The notification center is available at `/api/v1/notifications`; it records new class content, assignments, and grading updates for enrolled students. Due-date reminders and the proposed analytics API are not implemented. Any additions must enforce authorization in the backend: students may access only their enrollments and submissions, instructors only their assigned courses, and moderators only their explicitly granted support/moderation scope. Validate uploads, authorize private-file access, and record sensitive administrative actions.

### Implemented interactions

- Responsive navigation menu; it closes when a navigation link is selected and supports Escape.
- Active section indication while scrolling, where `IntersectionObserver` is supported.
- Light/dark theme switch. The initial theme follows the operating-system preference; a user-selected theme is saved in `localStorage` under `utkrix-theme`.
- The contact form validates and stores inquiries, then emails them to the configured contact address.
- The floating support chat provides Admin and Moderator channels with guest or signed-in access.
  - Guest conversations are tied to a private token kept in the current browser; signed-in conversations are tied to the account. Each identity gets one conversation per channel.
  - Messages and replies are stored in the database; email notifications use SMTP and failed notifications do not discard messages.
- Keyboard skip link, focus indication, semantic landmarks, and accessible form labels/status messaging.
- Contact links use the visitor's email and phone handlers; the address opens a Google Maps search.
- Courses are searchable and filterable by published category, with server pagination and clear loading, empty, and error states.
- Published projects and courses load from the backend API. Signed-in sessions are kept in `sessionStorage` and can be ended from the site navigation.
- OAuth callbacks use browser-bound state, PKCE for Google/GitHub, and a short-lived, single-use exchange code before an access token is stored.

## API and external-service inventory

### Application APIs

The app uses the backend support, course, project, and authentication endpoints. Company profile, services, and legal documents remain bundled static data.

| Capability | Current implementation | API status |
|---|---|---|
| Contact form submission | `POST /api/v1/contact` | Connected; server validates, stores the message in `contact_messages`, and sends via Nodemailer/SMTP |
| Support chat | `/api/v1/support/conversations/{channel}` and its `/messages` endpoint | Connected separately through the floating chat launcher; one thread per visitor/account per Admin or Moderator channel |
| Support inbox | `/api/v1/support/inbox/{channel}` and its conversation `/messages` endpoint | Shared staff queues; admins can access both channels, moderators can access the Moderator channel |
| Course catalog and categories | `GET /api/v1/courses`, `GET /api/v1/courses/categories` | Connected; published course data, search, filters, and pagination |
| Project catalog | `GET /api/v1/projects` | Connected; returns only published projects |
| FAQ section | `GET /api/v1/faqs` | Connected; published answers are ordered by display order |
| Account registration and email sign-in | `/api/v1/auth/register`, `/login`, `/verify-email`, `/password-reset/*` | Connected; email verification and password reset require configured SMTP |
| Classrooms and learning | `/api/v1/classrooms` | Instructors build modules and lessons, create assignments, review submissions, and grade only their assigned courses; enrolled students complete lessons, track progress, submit assignments, and view feedback/certificates |
| Notifications | `/api/v1/notifications` | Per-account inbox for new class content, assignments, and grading updates; mark one or all as read |
| Social sign-in | `/api/v1/auth/oauth/{provider}` for Google, Facebook, and GitHub | Connected; provider credentials and registered callback URLs are required |
| Company/services/legal content | Static modules under `src/data/` and `src/config/` | Bundled content |
| Theme preference | Browser `localStorage` | Browser storage API, not a server API |

Administrators manage projects with `GET /api/v1/projects/admin`, `POST /api/v1/projects`, `PUT /api/v1/projects/{id}`, and `DELETE /api/v1/projects/{id}`. They manage FAQs with `GET /api/v1/faqs/admin` and the FAQ create, update, and delete endpoints. These management endpoints require an administrator bearer token. Admins assign moderator roles in account management.

The instructor workspace provides a roster and a single class stream for announcements, notes, external links, MP4/WebM videos, and assignments. The stream refreshes automatically while the page is open. Uploaded classroom files are stored outside the public uploads directory and can only be accessed by the assigned instructor, an administrator, or an enrolled student. Students can join using the class code and read or download the instructor's posts; posting is instructor-only. Classroom file uploads are limited to 25 MB.

### OAuth provider configuration

Set the following secrets in the backend `.env` or deployment secret store. Register each callback URL exactly as `OAUTH_CALLBACK_BASE_URL/{provider}/callback` (for example, `http://localhost:5000/api/v1/auth/oauth/google/callback` during local development). Set `FRONTEND_URL` to the website origin (the local Vite origin is `http://localhost:5173`).

| Provider | Required settings | Requested scopes |
|---|---|---|
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `openid email profile` |
| Facebook | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, supported `FACEBOOK_GRAPH_VERSION` | `email,public_profile` |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | `read:user user:email` |

Google/GitHub use PKCE and all providers use a short-lived, HTTP-only, same-site state cookie. Google/GitHub verified emails can be linked to an existing account. Facebook does not provide a verified-email claim through this profile flow, so new Facebook accounts must verify their address by email before signing in. All registration creates student accounts; administrators assign instructor access from account management.

The backend sends contact form and support notifications to `CONTACT_TO` (or `SMTP_USER` if no separate recipient is configured); staff replies are emailed to the chat user. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` in the backend `.env`. Use a sender address authorized by the SMTP provider (for Gmail, use the account or a verified alias and an App Password). For a custom sending domain, publish the provider's SPF and DKIM records and a DMARC policy. Contact messages use a fixed subject and the visitor's address only as `Reply-To`; contact form messages and chat messages are stored before attempting email delivery, so no message is lost if SMTP is temporarily unavailable. Correct configuration improves deliverability but cannot guarantee inbox placement. SMTP credentials remain backend-only.

The public course and project cards load from MySQL through the backend APIs. The current six courses and six projects are explicitly labeled fictional sample records inserted into the database for local testing, not hardcoded in the website source.

### External requests and protocol links

| Integration | Use | Notes |
|---|---|---|
| Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) | Loads Figtree and Sora styles/fonts from `index.html` | Third-party network request; self-host fonts to remove this dependency |
| Google Maps URL (`https://www.google.com/maps/search/?api=1&query=...`) | Opens a search for the configured company address | A link, not an authenticated Maps API integration; no API key is configured |
| `mailto:` | Opens the visitor's configured email application | Does not send email from the website |
| `tel:` | Opens the visitor's phone handler | Does not place a call from the website |

### Browser APIs used

The frontend uses `localStorage` for the theme, `matchMedia` for system theme preference, `IntersectionObserver` for active navigation state, `hashchange` for hash routing, and standard DOM focus/scroll APIs. These are browser capabilities and are not backend endpoints.

### Support chat API

```http
POST /api/v1/support/guest-access
Content-Type: application/json
```

Guest visitors provide a name and email once, then keep the returned private access token in this browser. Signed-in users use their account token instead. Each identity can open one thread in each channel: `admin` or `moderator`.

```json
{
  "name": "Visitor name",
  "email": "visitor@example.com"
}
```

Open or resume a channel with `GET /api/v1/support/conversations/{channel}` or `POST` to the same path. Send messages to `/api/v1/support/conversations/{channel}/messages` with the guest token in `X-Guest-Access-Token` or a signed-in bearer token. Admins can access both staff queues; moderators can access the Moderator queue. Chat messages persist even when SMTP notification delivery fails.


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
- **FR-08:** Let visitors and signed-in users message either the Admin or Moderator team in a responsive support chat.
- **FR-09:** Provide keyboard-accessible navigation, focus handling, and live status messaging.

#### Required for an operational public website

- **FR-10:** Replace placeholder company profile, service descriptions, team members, project details, and statistics with approved and accurate content.
- **FR-11:** Persist chat conversations and messages, and send SMTP notifications to staff and users.
- **FR-12:** Validate and constrain chat inputs on the server; do not rely on browser validation as a security or data-integrity boundary.
- **FR-13:** Restrict each staff queue to the appropriate roles and keep guest access tokens private to the browser that created them.
- **FR-14:** Confirm the public contact information, international phone format, legal entity details, and legal text with the business owner.

### Non-functional requirements

These are recommended acceptance requirements for launch; the repository does not currently define numeric service-level targets.

- **NFR-01 — Responsive:** Content and controls should remain usable on supported mobile, tablet, and desktop viewport sizes.
- **NFR-02 — Accessibility:** Preserve semantic HTML, labels, keyboard access, visible focus, meaningful image alternatives, and adequate contrast. Target WCAG 2.2 AA and verify with automated and manual checks.
- **NFR-03 — Performance:** Keep the page lightweight, optimize/compress image assets, lazy-load below-the-fold imagery, and avoid blocking third-party resources where practical.
- **NFR-04 — Compatibility:** Test current stable Chrome, Edge, Firefox, and Safari, plus mobile browsers used by the target audience.
- **NFR-05 — Security:** Serve over HTTPS. If a form API is added, validate and encode untrusted data, rate-limit submissions, protect against spam/abuse, keep secrets on the server, and configure restrictive CORS/security headers as appropriate.
- **NFR-06 — Privacy:** Disclose chat identity, message storage, staff access, email notifications, and retention accurately in the Privacy Policy.
- **NFR-07 — Reliability:** Save messages before attempting SMTP delivery so a temporary email outage does not lose a conversation.
- **NFR-08 — SEO and sharing:** Maintain a descriptive page title and metadata, social-sharing image, favicon, and indexable production content. Consider server rendering or static prerendering if search visibility for legal/content routes is important.
- **NFR-09 — Maintainability:** Keep company settings in `src/config/site.js`, reusable page content in `src/data/`, and avoid hard-coding editable business content into components.
- **NFR-10 — Observability:** If a backend is added, log server-side delivery failures without logging unnecessary personal data; monitor endpoint availability and delivery outcomes.

## What is needed next

### Content and business decisions

- Approve the company story, mission/vision/goals, service descriptions, team identities/photos, project case studies, and real statistics.
- Verify company name/legal entity, address, phone, email, operating hours, and response-time expectations.
- Review legal notices against the actual data collection, analytics, hosting, and email practices.

### Support operations

1. Configure backend SMTP credentials and `CONTACT_TO` (or `SMTP_USER` as the fallback recipient).
2. Assign moderator access to trusted accounts from the administrator account dashboard.
3. Keep the guest chat token in the browser where its conversations were started; clearing site storage removes that guest's access.
4. Configure HTTPS, CORS, and monitoring for production deployment.
5. Test guest/account chat, channel permissions, message persistence, and behavior during SMTP outages.

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
| Public and signed-in support chat | `src/components/SupportMessenger.jsx` |
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
