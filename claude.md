# CLAUDE.md — Ficus Global Internship Portal (frontend)

React 18 + TypeScript + Vite SPA for Ficus Global's internship programme: student self-registration with payment,
cyber-cafe assisted registration, acceptance letters with QR verification, and an admin panel.

## Commands
- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build`
- `npm run lint` — type-check only (`tsc -b --noEmit`); there is no test suite

## Configuration (`.env`, see `.env.example`)
- `VITE_API_BASE_URL` — backend base **including `/api`** (default `https://internshipwale.com/api`, local `http://localhost:8080/api`).
  API paths in code are relative to it (`/auth/login`, `/student/me`), so never prefix paths with `/api` again.
- `VITE_RAZORPAY_KEY_ID` — Razorpay **key id** (public). Default is the project's test key `rzp_test_Td9wQnOjLMAsLD`
  (must match backend `razorpay.key.id`). The key *secret* belongs only on the backend.
- Both are read in `src/constants/api.ts`.

## Layout
- `src/App.tsx` — stage machine (no router; the verification path is matched by pathname). Paths: `/student/acceptance-letter/:studentId` (public QR verification) and `*` (app).
  Stages: `sign-in` → `student-home` / `acceptance-letter` (student) | `cyber-cafe` (cafe) | `admin-dashboard` (admin).
  Sessions survive a reload: `lib/session.ts` stores the role, the backend role (`accountRole`), name and token expiry (`authSession`)
  next to `authToken`; an expired token signs the user out. The JWT carries no role claim, so an admin session saved without
  `accountRole` is discarded (sign in again). `logout()` clears them.
- `src/features/auth/auth.tsx` — public landing, role picker, login/registration screens (`SignIn`). `forgot-password-flow.tsx` (same folder) is the student reset.
- `src/features/registration/student-registration-form.tsx` — 6-step student registration
  (details → internship/account → review (creates the account) → verify email → consent letter → pay).
  `mode="self" | "cyber-cafe"`. Calls `onComplete(response, message, snapshot)`. `email-otp.tsx` (same folder) is the code box.
- `src/features/consent/consent-upload.tsx` — consent letter status/upload/view, used by the form (step 5) and the letter page.
  `lib/consent.ts` mirrors the backend file rules (PDF/JPG/PNG by magic bytes, ≤ 5 MB) and `consentReady()`.
- `src/features/cyber-cafe/cyber-cafe-workspace.tsx` — signed-in cafe registers students, then sees/downloads that student's letter.
- `src/features/letter/acceptance-letter.tsx` — acceptance letter page (preview + Download + details sidebar), used by students and cafes.
- `src/features/letter/acceptance-letter-document.tsx` — the printable A4 letter (794×1123px) incl. verification QR.
- `src/features/letter/acceptance-letter-verification.tsx` — QR landing page; shows TRUE/FALSE.
- `src/lib/auth-api.ts` — fetch wrapper (`request`, throws `ApiError` with `status`), `authApi`, `masterDataApi`, DTO types.
  Bearer token is **opt-in** per call (`request(path, init, auth)`): login, registration, OTP and `/public/master/*` send none;
  `/student/**`, `/payment/**`, `/acceptance-letters/**` and `/admin/**` send it (`auth: true` = stored token, string = explicit token).
  A `FormData` body is sent as multipart; `requestBlob` downloads files (consent letter). Also `consentApi`, `whatsappGroupApi`.
- `src/lib/payment.ts` — Razorpay Checkout loader + `collectPayment()`.
- `src/lib/acceptance-letter.ts` — letter number/date formatting, verification URL, PDF export.
- `src/features/student/student-home.tsx` — student home (status, "My details" from `/student/me`, option cards).
  `whatsapp-group-card.tsx` (same folder) shows the group link on the letter page once paid.
- `src/features/admin/admin-dashboard.tsx` — admin shell, sections gated by role (see RBAC). Sections: `admin-sections.tsx`
  (colleges, courses & batches, universities & districts, letters, administrators), `admin-consents.tsx`, `admin-whatsapp.tsx`,
  `admin-students.tsx`; shared form/table helpers in `admin-ui.tsx`. API in `src/lib/admin-api.ts`.
- `src/lib/cache.ts` — 5-minute cache for public master data; admin writes clear the public lists they affect.
- Shared UI in `src/shared/components/`; all global CSS in `src/styles/`. Screens are lazy-loaded (`App.tsx`).
- Styles are global CSS files imported from `main.tsx`/components (`styles.css` is minified; add new styles in separate files,
  e.g. `acceptance-letter.css`). Theme tokens: `--bg --surface --soft --border --text --muted --purple* --shadow`.

## Flows

### Student self-registration
1. Home → "Student registration" → `StudentRegistrationForm` (mode `self`).
2. Step 3 "Create account": `POST /auth/register/student` creates the account (REGISTERED); the backend emails a 6-digit code.
3. Step 4: `POST /auth/email/verify-otp` (resend: `/auth/email/send-otp`, 60 s cooldown, 10 min expiry, 5 attempts).
4. Step 5: `GET /student/me` gives `registrationId` → consent letter upload
   `POST /student/registrations/{registrationId}/consent` (multipart `file`). Continue needs an uploaded, not rejected letter.
5. Step 6: `POST /payment/create-order` (backend requires verified email + uploaded, non-rejected consent) → Razorpay Checkout
   (`checkoutRegistration`) → `POST /payment/verify` (signature check → ENROLLED).
   A cancelled payment keeps the account: the student can finish from the letter page (consent card, "Complete payment";
   if create-order says the email is unverified, the page shows the code box). Retries never register or charge again.
6. Token stored in localStorage (`authToken`, `userId`) → stage `acceptance-letter`.

### Cyber cafe registration
1. Cafe signs in (or registers the cafe) → `CyberCafeWorkspace`.
2. Same form with `mode="cyber-cafe"`. The registration request sends the cafe's bearer token (`useStoredSession`) so the backend
   links the registration to the cafe. The OTP goes to the student's email; cafe staff enter it.
3. The student's returned token is **not** stored; it is passed to `AcceptanceLetter` as `authToken` to load `/student/me`
   for that student and to pay the order. "Register another student" resets the form.

### Forgot password (students)
Sign-in → "Forgot password?" → `ForgotPasswordFlow`: `POST /auth/password/forgot` → code + new password + confirm →
`POST /auth/password/reset` (checks and uses the code, also marks the email verified). Success returns to sign-in.

### Student login
Login → stage `student-home` (`features/student/student-home.tsx`: letter status and option cards; certificate, course and attendance are "Coming soon"). The acceptance letter opens from its card → `GET /student/me` → `GET /acceptance-letters/me`. If the registration is paid and no
letter exists yet, `POST /acceptance-letters/registrations/{registrationId}` issues it (idempotent).

### Acceptance letter
- Format copied from the physical Ficus Global letter (header waves, logo, "INTERNSHIP ACCEPTANCE LETTER", Letter No./Date,
  To: Student Name / Registration Number / Institution, fixed body text, Supervisor/Head IPO signature block, footer contacts).
  Body references `"<universityCode> Internship Guidelines for Undergraduate Programmes"` (default `LNMU`).
- **Letter number**: issued by the backend, format `FG/<collegeCode>/<session>/<serial>` (e.g. `FG/GPM/2024-2027/1`).
  The page reads it from `GET /acceptance-letters/me` and shows it in the "Letter Number" card and on the letter (`buildLetterNumber`).
  Until issued it shows `Pending`, and Download is disabled. The frontend never generates a number.
- **Date**: `DD-MM-YYYY` of the letter's `generatedAt` (issue date) ?? `acceptanceDate` ?? `registrationDate` ?? today.
- **Download**: `downloadLetterPdf` lazy-loads `html2canvas` + `jspdf`, captures the letter node at 2× and saves an A4 PDF.
  html2canvas quirks we hit: multiple inline SVGs / bottom-anchored SVGs get dropped (the waves are therefore one SVG data-URI
  background image), and CSS `box-shadow` on round elements renders wrong. The preview is scaled with a transform inside a
  clipped frame; `onclone` removes the transform and clipping before capture — keep `data-letter-scaler` on that wrapper.
- If `/student/me` fails, the page falls back to the registration snapshot (when available).

### QR verification
- QR encodes `${origin}/student/acceptance-letter/<studentId>` (`studentId` = `StudentDetails.id`, falling back to `userId`).
- Page calls `GET {API_BASE_URL}/student/{studentId}` (sends a bearer token only if one is in localStorage).
  2xx with a student record (or `verified: true`) → **TRUE**; 400/404 ("Student not found") → **FALSE**;
  401/403/network/5xx → "Verification unavailable" (never FALSE, a genuine letter must not look fake).
- Real response shape (both `/student/me` and `/student/{id}`): `studentId, studentName, studentRegistrationNumber, email, mobileNo,
  fatherName, collegeName, collegeCode, courseName, batchName, registrationStatus, …`, mapped by `toStudentDetails()` in auth-api.
  `{id}` accepts the auth `userId` or `studentId`; the QR uses `studentId`. No `courseCode` (resolved from master data by name),
  no `registrationDate` (so the letter date falls back to today), no payment fields.
- Whoever scans the QR is usually not logged in, so the backend must allow this endpoint without auth
  (or expose a dedicated public verify endpoint returning minimal fields). Currently the live API rejects anonymous calls.
- Hosting must rewrite unknown paths to `index.html` (SPA fallback) so the QR deep link loads.

### Consent letter and WhatsApp group
- Consent: status `GET /student/registrations/{id}/consent/status` (`consentStatus` is PENDING even before upload — check
  `consentUploaded`), file `GET /student/registrations/{id}/consent`. A new upload resets to PENDING; an APPROVED letter
  cannot be replaced by the student. Admin review: `GET /admin/consents?status=`, `PUT /admin/registrations/{id}/consent`
  `{status: APPROVED|REJECTED, reason}` (reason required for REJECTED, ≤ 500 chars).
- WhatsApp: one group per college + batch (`/admin/whatsapp-groups`, links must start with `https://chat.whatsapp.com/`),
  `POST /admin/whatsapp-groups/{id}/send-pending?resend=` emails it. Students: `GET /student/registrations/{id}/whatsapp-group`
  (400 before payment, 404 while no group exists).

### RBAC
- `/api/admin/**` is **SUPER_ADMIN only** (SecurityConfig). SUPER_ADMIN sees every dashboard section.
- UNIVERSITY_ADMIN counts as an admin only on the "owner or admin" endpoints (`/student/{id}`, consent status/file, letter by
  registration, WhatsApp group), so its dashboard has just **Students** (lookup by student ID or user ID).
- Students and cafes reach registration-scoped endpoints only for their own / their registered students (backend checks).

### Master data (admin)
- Lists come from `/admin/master/{universities|districts|colleges|courses|batches}` (include inactive); updates are partial PUTs.
- JSON active flag: `active` on University/College, `isActive` on Course/Batch/WhatsApp group.
- Delete of a record in use returns 409 with "Set it to inactive instead". College code ≤ 30 chars, no `/` (it is in the letter number).

## Backend contract assumptions / TODO
- `AuthResponse`: `{ token, userId, name, email, role: SUPER_ADMIN | UNIVERSITY_ADMIN | STUDENT | CYBER_CAFE }`.
- Payments are server-verified: `/payment/create-order` (needs the registration, a verified email and a consent letter) and `/payment/verify`
  (signature check with the key secret, then ENROLLED). The frontend sends no payment fields to `/auth/register/student`.
- `StudentDetails.letterNumber` is not returned by `/student/me`; the letter number comes from `/acceptance-letters/me`.
- **DB migration**: `sql/email_verification.sql` (in the backend repo) must be run before starting the backend,
  because `ddl-auto=validate`.

## Conventions
- Formik for forms, lucide-react icons, bilingual (English / Hindi) copy on student-facing screens.
- `toast.success/error` from `shared/components/toast.tsx` for feedback; there is no `toast.info`.
- `qrcode.react` v4 has only named exports (`QRCodeCanvas`, `QRCodeSVG`) — no default import.
