# UtkriX Technologies — Complete Project Documentation

> Audience: future developers, AI coding assistants, administrators, maintainers, and project managers.
> Last updated: 2026-11-19. Verify against source before relying on details — this document reflects the repository at the time of writing.

---

## 1. Project Overview

UtkriX Technologies is a company website + e-learning platform monorepo. It consists of **four deployable applications** sharing one backend and one database:

| App | Directory | Purpose | Dev port |
|---|---|---|---|
| Marketing website | repo root (`src/`) | Company info, services, courses, projects, contact, support messenger | 5177 (direct), 5173 (gateway) |
| Auth app | `login-frontend/` | Sign in, register, forgot/reset password, email verify, OAuth entry | 5174 |
| Employee/student portal | `utkrix-tech/` | Role-based dashboards (admin, instructor, student) | 5175 |
| Backend API | `elearning-master-backend/` | Express 5 REST API, Prisma/MySQL, auth, classrooms, uploads | 5000 |

**Communication model:** all frontends call the same backend (`/api/v1`). In local dev each Vite app proxies `/api` → `localhost:5000`, so requests are same-origin. In production, frontends call the deployed API origin directly with `credentials: 'include'` and CSRF headers. A dev gateway (`scripts/dev-gateway.js`) routes `*.localhost` / `*.lvh.me` hostnames to the right Vite server for subdomain-style local testing.

**Monorepo note:** the root `package.json` is the marketing site *and* the orchestration root (`npm run start` runs everything). `login-frontend/` and `utkrix-tech/` are independent Vite projects with their own `package.json`.

---

## 2. Architecture Decision Records (ADR)

| # | Decision | Reason | Alternatives | Status |
|---|---|---|---|---|
| ADR-1 | React 18 + Vite 7 frontends, plain JS (no TypeScript) | Fast dev, simple mental model, matches existing code | Next.js, TS | Implemented |
| ADR-2 | Express 5 + CommonJS backend (`server.js` at root, not `src/`) | Existing codebase convention; minimal churn | ESM rewrite, NestJS | Implemented |
| ADR-3 | Prisma ORM 5.20 + MySQL (TiDB Cloud in dev/prod) | Type-safe queries, migrations, TiDB compatibility | TypeORM, raw SQL | Implemented |
| ADR-4 | JWT access tokens (short-lived) + DB-backed refresh tokens in HttpOnly cookies | Secure session restore across apps without storing tokens in JS | Session store, OAuth-only | Implemented |
| ADR-5 | Cookie-based SSO across subdomains via shared `COOKIE_DOMAIN` | One login serves all apps | Per-app auth, token-in-localStorage | Implemented (requires real domain in prod; `*.utkrixtech.com` is a public suffix and cannot share cookies — see §9) |
| ADR-6 | Centralized auth on dedicated `login.*` app; marketing site links out | Clean separation, single credential surface | Auth embedded in main site | Implemented |
| ADR-7 | Cloudflare R2 (S3 API) for all uploads, replacing local disk | Vercel/serverless has ephemeral disk | Local disk, other object stores | **Partially implemented** — storage service + middleware/controller migration done; presigned direct-upload flow and legacy-file migration still pending (§7) |
| ADR-8 | One R2 bucket `utkrix` with `public/` and `private/` key prefixes | Simpler billing/management | Two buckets | Implemented in config (`R2_PUBLIC_BUCKET`/`R2_PRIVATE_BUCKET` may point to the same bucket) |
| ADR-9 | Role-based access enforced server-side (`admin`, `instructor`, `student`, `moderator`?) — see `Role` enum | Security boundary | Frontend-only checks | Implemented |
| ADR-10 | Vercel deployment: frontends as static Vite builds; backend as serverless function via `api/index.js` | Vercel cannot run persistent Express; function wrapper preserves all routes | Render/Railway/VPS for backend | Configured, **not yet verified in production** |
| ADR-11 | In-memory rate limiting (Redis evaluated and removed) | Simplicity; Redis adds infra cost/complexity | Redis-backed store | Implemented (in-memory; per-instance on serverless) |
| ADR-12 | `dev-gateway.js` hostname router for local subdomain testing | Reproduces prod subdomain layout locally | /etc/hosts edits | Implemented |
| ADR-13 | `*.lvh.me` for cookie-sharing local subdomains | `*.localhost` cookies rejected by browsers | Real DNS, lvh.me | Implemented (dev only) |

**Unverified/historical:** details of earlier auth hardening (PKCE OAuth, CSRF cookie flow) are implemented in code but their original design docs were removed; treat code as source of truth.

---

## 3. Technology Stack

### Frontend (all three apps)
- **React 18** (`react`, `react-dom` ^18.3.1), **Vite 7** (^7.3.7/8), plain JavaScript ES modules — no TypeScript.
- **Routing:** main site & portal use lightweight **hash routing** (`#/...`); login app uses `react-router`-style routing (verify `login-frontend/src/App.jsx`).
- **Styling:** hand-written CSS with light/dark theme tokens (`src/styles/global.css`); theme persisted in `localStorage` key `utkrix-theme`.
- **HTTP:** browser `fetch` via per-app API clients (`src/api/client.js`, `src/api/authClient.js`) with `credentials: 'include'` and `X-CSRF-Token` header.
- **Icons:** custom `Icon.jsx` component set (no icon library).
- **State:** React context (`src/auth/AuthContext.jsx`) for session; `sessionStorage`/`localStorage` for tokens/theme.
- **Validation:** client-side form validation; authoritative validation is backend `express-validator`.

### Backend (`elearning-master-backend/`)
- **Node.js 22**, **Express 5.2**, **CommonJS**.
- Key deps: `@prisma/client` 5.20, `bcryptjs` 3, `jsonwebtoken` 9, `cookie-parser`, `cors`, `helmet` 8, `express-rate-limit` 7, `express-validator` 7, `hpp`, `xss`, `multer` 2.4, `nodemailer` 10, `winston` 3, `morgan`, `compression`, `swagger-jsdoc`/`swagger-ui-express`, `uuid`, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (R2).
- Entry: `server.js` — builds the Express app, registers middleware/routes, exports `app`, and only calls `app.listen` when run directly (`require.main === module`). `api/index.js` re-exports the app for Vercel.

### Database
- **MySQL** (TiDB Cloud serverless in current env: `gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000`).
- **Prisma 5.20** — schema at `prisma/schema.prisma`, migrations in `prisma/migrations/` (11 migration dirs), client generated to `node_modules/.prisma`.
- Connection via `MYSQL_URL` (Prisma datasource) — `DB_HOST/PORT/USERNAME/PASSWORD/DATABASE` vars also exist in `.env`.

### Infrastructure / external services
- **Vercel** — frontends + backend function (`elearning-master-backend/vercel.json` rewrites all paths → `/api/index.js`).
- **Cloudflare R2** — S3-compatible object storage (`services/storage/r2StorageService.js`).
- **SMTP** — Gmail (`smtp.gmail.com:587`) via nodemailer for verification/password-reset/contact emails.
- **OAuth** — Google, Facebook, GitHub (authorization-code + PKCE for Google/GitHub, state cookie, single-use exchange code).
- **Redis** — evaluated and **removed**; rate limiting is in-memory.
- **Swagger** — `openapi.json` committed; `/api-docs` UI + `/api-docs.json` served by backend.

---

## 4. Frontend Applications

### 4.1 Marketing website (repo root)
- Hash-routed single-page app: `#/home`, `#/about`, `#/courses`, `#/projects`, `#/contact`, `#/privacy-policy`, `#/terms-of-service`, `#/dashboard`.
- Sections: hero, services, course catalog (search/filter/pagination), stats, about/team, mission/vision/goals, projects, contact form, **SupportMessenger** chat widget (guest or logged-in; admins/moderators directed to dashboard inbox).
- Dashboards by role (admin/moderator/instructor/student) under `#/dashboard` — classroom workspace, materials, assignments, grading, notifications, support inbox (staff), account management (admin).
- Key files: `src/App.jsx`, `src/api/client.js`, `src/auth/AuthContext.jsx`, `src/components/{Header,SupportMessenger,Icon}.jsx`, `src/sections/`, `src/styles/global.css`.
- Consumes: `/api/v1/courses`, `/projects`, `/contact`, `/support/*`, `/auth/*`, `/notifications`, `/classrooms/*`, `/dashboard`, `/faqs`, `/team-members`, `/stats`.

### 4.2 Login app (`login-frontend/`)
- Routes: login, register, forgot password, reset password, verify email; OAuth buttons (Google/Facebook/GitHub) start the backend OAuth flow.
- `src/api/authClient.js` — auth endpoints, credentialed requests, CSRF header.
- On success redirects to `VITE_EMPLOYEES_URL` (admin → `VITE_ADMIN_URL` currently same target) with `?redirect=` allowlist checking.
- **No image logo** — text branding only (known cosmetic gap).

### 4.3 Portal (`utkrix-tech/`)
- Employee/student/admin workspace; restores session silently via `POST /api/v1/auth/refresh` (throttled ~60s in sessionStorage to avoid rate limits).
- Same dashboard features as the main site's `#/dashboard` (shared backend APIs).

### How they connect
Login app sets HttpOnly `refreshToken` + readable `csrf_token` cookies (host-only on `localhost` in dev; `COOKIE_DOMAIN` in prod). Portal/website call `/auth/refresh` on load → new access token (in-memory) + rotated refresh cookie. Access tokens are short-lived JWTs sent as `Authorization: Bearer` or returned in body per client implementation — **verify per client before assuming**.

---

## 5. Backend (`elearning-master-backend/`)

### Structure
```
server.js            # app assembly, middleware order, listen guard, graceful shutdown
api/index.js         # Vercel function entry (re-exports app)
config/              # prisma client singleton, db config
controllers/         # auth, oauth, course, classroom, contact, dashboard, faq, notification, project, stats, support, teamMember
middleware/          # authMiddleware, roleMiddleware, csrfMiddleware, rateLimitMiddleware,
                     # uploadMiddleware, classroomUploadMiddleware, errorMiddleware, etc.
routes/              # authRoutes, classroomRoutes, contactRoutes, courseRoutes, dashboardRoutes,
                     # faqRoutes, notificationRoutes, projectRoutes, statsRoutes, supportRoutes, teamMemberRoutes
services/            # authService, refreshTokenService, email service, storage/r2StorageService.js
utils/               # AppError, logger (winston), pagination, validators
prisma/              # schema.prisma + migrations
scripts/             # provisionAdmin.js, generateOpenApi.js, smokeApi.js, dev helpers
tests/               # node:test suites (auth cookies/security, oauth, pagination, refresh tokens, support, openapi)
uploads/ private-uploads/ tmp/ logs/   # local-dev fallbacks only
```

### Middleware order (server.js)
helmet → CORS (explicit allowlist, credentials) → compression → JSON/urlencoded → cookie-parser → morgan → HPP → xss sanitization → static `/uploads` (dev) → health/docs routes → `/api/v1/*` routers → Swagger UI → error middleware.

`app.set('trust proxy', 1)` for correct `req.ip` behind proxies. Production guards: `JWT_SECRET` ≥32 bytes, no wildcard CORS.

### API surface (all under `/api/v1` unless noted)
| Router | Base | Auth | Notes |
|---|---|---|---|
| authRoutes | `/auth` | mixed | register, login, logout, refresh, verify-email, password-reset/*, oauth/{provider} start+callback+exchange |
| classroomRoutes | `/classrooms` | protect | course classroom workspace: posts/materials/assignments/lessons, enrollment via join code, progress, submissions, grading, certificates, **attachment upload/download** |
| courseRoutes | `/courses` | mixed | public catalog; instructor CRUD; `upload.image.single('thumbnail')` |
| contactRoutes | `/contact` | public + rate-limited | emails via SMTP |
| supportRoutes | `/support` | guest-capable | messenger conversations/messages |
| notificationRoutes | `/notifications` | protect | user notifications |
| dashboardRoutes | `/dashboard` | role-based | admin/instructor/student workspaces |
| projectRoutes, faqRoutes, statsRoutes, teamMemberRoutes | respective | public read / admin write | site content |
| — | `/api/health` | public | `{success, database: connected\|disconnected}` |
| — | `/api-docs`, `/api-docs.json` | public | Swagger |

Exact per-endpoint request/response shapes live in `openapi.json` and route files — consult those rather than this summary. Classroom attachment download: `GET /api/v1/classrooms/:courseId/files/:itemType/:fileId` (itemType ∈ materials|assignments|lessons) — enforces `assertClassAccess`, then redirects to a 5-min presigned R2 URL for R2 keys or streams local files for legacy keys.

### Roles
`Role` enum in schema (values seen in usage): `admin`, `instructor`, `student`, `moderator`. Enforcement via `middleware/roleMiddleware.js` (`authorize(...)`) + per-controller ownership checks (`isManager`, `assertClassAccess`).

### Upload pipeline (current)
1. `multer.memoryStorage()` (no disk writes).
2. MIME+extension allowlist + size limits (image 10MB, video 100MB, document 25MB, material 10MB, assignment 15MB, classroom attachment 25MB).
3. `services/storage/r2StorageService.js#saveUpload` → R2 PutObject when `R2_*` configured, else local `uploads/`/`private-uploads/` fallback.
4. `req.file.filename` = storage key; `req.file.url` = public URL (public bucket only); controllers persist the key in DB (`attachmentKey`, `thumbnail`).
5. Cleanup on validation failure via `deleteObject` (R2 or local unlink).

---

## 6. Authentication & Security

- **Registration:** `POST /auth/register` → bcrypt hash → verification email (SMTP). If email send fails, user is rolled back and API returns 503 (implemented earlier).
- **Login:** `POST /auth/login` → access JWT + refresh token (DB row, rotated on use) + cookies.
- **Cookies:** `refreshToken` HttpOnly, `csrf_token` readable; `Secure` in production; `SameSite=Lax`; domain from `COOKIE_DOMAIN` (empty = host-only). CSRF enforced via `X-CSRF-Token` header matching the cookie on mutating requests.
- **Refresh:** `POST /auth/refresh` — dedicated lenient limiter (60/15min) for silent session restore; rotates tokens, detects reuse.
- **Logout:** revokes refresh token server-side + clears cookies.
- **Password reset:** token via `AuthToken` + email; OTP-style verify-email flow.
- **OAuth:** `/auth/oauth/{google|facebook|github}` → provider → callback → single-use exchange code → session cookies (same as password login, incl. refresh cookie).
- **Rate limits:** auth 5/15m (failed only), login 10/15m, refresh 60/15m, register 5/15m, email actions 5/15m, contact 3/15m, support 40/15m, general 100/15m. In-memory (per-instance).
- **Headers:** helmet (CSP disabled for Swagger), HPP, xss-clean, CORS explicit origins + credentials.
- **Validation:** express-validator on routes; multer MIME+ext checks; object-key traversal guards in storage service.
- **Logging:** winston → `logs/*.log` locally; console-only on Vercel (`VERCEL` env detected). No secrets/tokens logged.

**Production requirements:** `NODE_ENV=production`, `JWT_SECRET` ≥32B, explicit `CORS_ORIGINS`, `COOKIE_SECURE=true`, real `COOKIE_DOMAIN` (custom domain — `*.utkrixtech.com` cannot share cookies), valid SMTP, OAuth secrets, R2 creds.

---

## 7. Cloudflare R2 Storage

**Implemented** (`services/storage/r2StorageService.js`):
- AWS SDK v3 S3 client → `https://<account>.r2.cloudflarestorage.com` (or `R2_ENDPOINT`).
- `saveUpload`, `deleteObject`, `headObject`, `getPresignedDownloadUrl` (5-min default), `getPresignedUploadUrl`, `publicUrlFor`, `uniqueKey` (timestamp+random+safe ext), `assertSafeKey` (traversal guard), `isR2Configured`.
- Visibility model: `public` vs `private` + `subdir` prefix → keys like `public/image/<key>`, `classrooms/<key>` (private). **Note:** implementation uses `R2_PUBLIC_BUCKET`/`R2_PRIVATE_BUCKET` env vars; per project decision both may point to the single `utkrix` bucket with prefix separation.
- Local fallback preserves legacy layout (`uploads/`, `private-uploads/classrooms/`) when R2 env absent.

**Bucket layout (target):**
```
utkrix/
├── public/    # courses/, thumbnails/, profiles/, media/  (public URLs via R2_PUBLIC_URL)
└── private/   # classrooms/, assignments/, materials/, attachments/  (presigned only)
```

**Env:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_URL` — backend-only, never `VITE_*`.

**Security status:** private downloads require auth + `assertClassAccess` then 302 → presigned URL. Private bucket has no public access. ✅

**Remaining work (not yet implemented):**
- Presigned **direct-to-R2 upload** endpoints + frontend integration — required because Vercel Functions cap request bodies (~4.5 MB); classroom attachments >4.5 MB currently fail on Vercel.
- Migration script for existing `uploads/`+`private-uploads/` files → R2 (dry-run/resumable).
- Storage unit tests.

---

## 8. Database (Prisma)

**Datasource:** MySQL via `MYSQL_URL`. **Generate:** `npx prisma generate` (postinstall). **Migrate:** `npx prisma migrate deploy` — ⚠️ TiDB rejects `ADD COLUMN`+`ADD INDEX` in one ALTER (error 1072); `npx prisma db push` was used to sync schema. Two migrations are marked failed/rolled-back in `_prisma_migrations` — schema itself is in sync.

**Enums:** `Role` (admin/instructor/student/moderator — verify exact values in schema), `Tier`, `SupportChannel`, `SupportSender`, `StatsSource`.

**Models (25):** User, Course, CourseEnrollment, CourseAnnouncement, CourseMaterial, CourseAssignment, CourseModule, CourseLesson, CourseLessonProgress, CourseAssignmentSubmission, CourseCertificate, Notification, Project, Faq, TeamMember, StatsMetric, ContactMessage, SupportConversation, SupportMessage, AuthToken, OAuthAccount, RefreshToken, AuditLog (+ any truncated in listing — check `schema.prisma`).

**Key relationships:** User 1—N Course (instructor); Course 1—N Enrollment/Module/Announcement/Material/Assignment; Module 1—N Lesson; Lesson 1—N Progress; Assignment 1—N Submission; User 1—N Certificate/Notification/SupportConversation/AuthToken/OAuthAccount/RefreshToken; AuditLog standalone.

**Business rules:** classroom access = instructor-of-course OR admin OR enrolled student; instructor free tier ≤2 courses; certificate issued when all lessons complete + all assignments graded.

**ER diagram:** generate from `schema.prisma` (e.g. `npx prisma-erd` or VS Code Prisma extension) — relations are all declared in the schema file.

**Seed/provision:** `npm run admin:provision` creates/updates admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env. No formal seed script — demo users were inserted directly (see session history).

**Backup:** TiDB Cloud automated backups + `mysqldump` for manual snapshots. Restore: point `MYSQL_URL` at target and `prisma migrate deploy` / `db push`.

---

## 9. Environment Variables

### Backend (`elearning-master-backend/.env`) — **backend-only secrets**
| Variable | Purpose | Required |
|---|---|---|
| `PORT` | API port (5000) | dev |
| `NODE_ENV` | `production` enables strict checks | prod |
| `MYSQL_URL` | Prisma datasource (full mysql:// URL) | ✅ |
| `DB_HOST/PORT/USERNAME/PASSWORD/DATABASE` | TiDB discrete vars (app-level use) | ✅ |
| `JWT_SECRET` | ≥32 bytes in prod | ✅ |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | token signing | ✅ |
| `CORS_ORIGINS` | comma-separated allowlist | ✅ |
| `CORS_ORIGIN` | legacy single-origin fallback | optional |
| `COOKIE_DOMAIN` | shared cookie domain; empty = host-only | prod SSO |
| `COOKIE_SECURE`, `COOKIE_SAME_SITE` | cookie flags | prod |
| `FRONTEND_URL`, `AUTH_DOMAIN` | post-login redirects | ✅ |
| `OAUTH_CALLBACK_BASE_URL` | `{base}/api/v1/auth/oauth` | OAuth |
| `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_APP_ID/SECRET`, `FACEBOOK_GRAPH_VERSION`, `GITHUB_CLIENT_ID/SECRET` | OAuth | per-provider |
| `SMTP_HOST/PORT/SECURE/USER/PASSWORD/FROM`, `EMAIL_BRAND_NAME`, `CONTACT_TO`, `ADMIN_EMAIL` | email | email features |
| `R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/ENDPOINT/PUBLIC_BUCKET/PRIVATE_BUCKET/PUBLIC_URL` | object storage | uploads in prod |
| `LOG_LEVEL` | winston level | optional |
| `ADMIN_PASSWORD`, `DEMO_*` | provisioning/demo | optional |

### Frontends (`VITE_*` — public, safe to expose)
| App | Variable | Purpose |
|---|---|---|
| root | `VITE_API_BASE_URL` | `/api/v1` (proxy) or absolute API URL |
| root | `VITE_API_URL` | backend origin for non-API calls |
| root/login/portal | `VITE_MAIN_SITE_URL`, `VITE_LOGIN_URL`, `VITE_EMPLOYEES_URL`, `VITE_ADMIN_URL` | cross-app redirect targets |
| login | `VITE_API_URL` | `/` (same-origin proxy) or absolute |

**Rules:** never put secrets in `VITE_*`; `.env` is gitignored; `.env.example` holds placeholders only.

---

## 10. Running Locally (Windows/PowerShell)

```powershell
npm run start        # repo root — starts backend + all 3 frontends + gateway (scripts/dev-all.js)
# or individually:
cd elearning-master-backend; npm run dev     # API :5000
npm run dev                                 # website :5177
cd login-frontend; npm run dev              # :5174
cd utkrix-tech; npm run dev                 # :5175
node scripts/dev-gateway.js                 # :5173 hostname router
```

URLs: main `localhost:5173`/`:5177`, login `localhost:5174`, portal `localhost:5175`. Subdomain variants (`login.localhost:5173`, `*.lvh.me:5173`) route via gateway; use plain ports for cookie-sharing SSO locally.

Backend scripts: `npm run dev` (nodemon), `npm start`, `npm test` (node:test), `npm run admin:provision`, `npm run swagger`, `npm run smoke:api`.

---

## 11. Deployment

- **Frontends → Vercel:** three projects (root, `login-frontend/`, `utkrix-tech/`). Set `VITE_*` env vars per §9, deploy, verify API URL.
- **Backend → Vercel:** project root `elearning-master-backend/`; `api/index.js` + `vercel.json` route all paths to the function. Set all backend env vars in Vercel. ⚠️ Not yet verified live.
- **Alternative backend hosts:** Render/Railway/VPS run `npm start` unchanged.
- **DNS/cookies:** cross-subdomain SSO on `*.utkrixtech.com` is impossible (public suffix). Use a custom domain (e.g. `login.utkrixtech.com`) with `COOKIE_DOMAIN=.utkrixtech.com`, or keep per-app sessions.
- **Rollback:** frontends — Vercel instant rollback to previous deployment; backend — redeploy previous commit; DB — TiDB point-in-time recovery / snapshot.

---

## 12. Testing & Verification

- Backend: `npm test` (node:test) — suites for auth cookies, auth security, OAuth, pagination, refresh tokens, support messenger, OpenAPI spec. **Known pre-existing failures:** tests requiring production `JWT_SECRET` length, `users` table in test DB, and OAuth env — unrelated to app runtime.
- Frontend: Playwright (`npm test` at root) — homepage, auth redirect, accessibility specs via gateway `:5173`.
- API smoke: `npm run smoke:api`.
- Manual checklist before release: register→verify→login→refresh→dashboard per role; classroom upload→download authz (enrolled vs non-enrolled); thumbnail upload; contact form; support chat; Swagger loads.

---

## 13. Known Issues & TODO

1. **SMTP credentials rejected by Gmail (535)** — registration/password-reset emails fail; registration rolls back with 503. Needs valid Gmail App Password for `SMTP_USER`.
2. **Presigned direct-to-R2 upload flow** — not built; required for >4.5 MB files on Vercel.
3. **Legacy upload migration to R2** — script not written; local `uploads/`/`private-uploads/` remain the fallback.
4. **Migration history drift** — two Prisma migrations marked failed; schema synced via `db push`.
5. **Rate limits are per-instance** in serverless (in-memory).
6. **Login app has no logo image** (text branding only).
7. **`admin.*` and `employees.*` currently serve the same portal app** — dedicated admin frontend not built.
8. **Shared-cookie SSO requires custom domain** in production.
9. Placeholder company/team/statistical content flagged in README should be replaced before public launch.

---

## 14. File Change Log (this migration effort)

**Created:** `services/storage/r2StorageService.js`, `api/index.js`, `vercel.json` (backend), `scripts/dev-all.js`, `DOCUMENTATION.md`.
**Modified:** `middleware/uploadMiddleware.js`, `middleware/classroomUploadMiddleware.js`, `middleware/rateLimitMiddleware.js` (reverted to in-memory), `controllers/classroomController.js`, `controllers/courseController.js`, `controllers/authController.js`, `controllers/oauthController.js`, `middleware/csrfMiddleware.js`, `routes/classroomRoutes.js`, `utils/logger.js`, `server.js`, `.env.example`, `package.json` (root + backend), `README.md`, frontend `.env`/`AuthContext`/`client.js` files, `scripts/dev-gateway.js`, `playwright.config.js`, `tests/auth.spec.js`.
**Dependencies added:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`. **Removed:** `rate-limit-redis`, `redis`.
**DB:** `utkrix` database created on TiDB; schema synced via `db push`; demo/admin users provisioned.

*End of documentation.*
