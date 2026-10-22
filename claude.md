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
  Stages: `sign-in` → `acceptance-letter` (student) | `cyber-cafe` (cafe) | `university-select` → `panel` (admin).
  Sessions survive a reload: `lib/session.ts` stores the role, name and token expiry (`authSession`) next to `authToken`; an expired token signs the user out. `logout()` clears them.
- `src/features/auth/auth.tsx` — public landing, role picker, login/registration screens (`SignIn`). `forgot-password-flow.tsx` (same folder) is the student reset.
- `src/features/registration/student-registration-form.tsx` — 4-step student registration (details → internship/account → review → pay).
  `mode="self" | "cyber-cafe"`. Calls `onComplete(response, message, snapshot)`.
- `src/features/cyber-cafe/cyber-cafe-workspace.tsx` — signed-in cafe registers students, then sees/downloads that student's letter.
- `src/features/letter/acceptance-letter.tsx` — acceptance letter page (preview + Download + details sidebar), used by students and cafes.
- `src/features/letter/acceptance-letter-document.tsx` — the printable A4 letter (794×1123px) incl. verification QR.
- `src/features/letter/acceptance-letter-verification.tsx` — QR landing page; shows TRUE/FALSE.
- `src/lib/auth-api.ts` — fetch wrapper (`request`, throws `ApiError` with `status`), `authApi`, `masterDataApi`, DTO types.
  Bearer token is **opt-in** per call (`request(path, init, auth)`): login, registration and `/public/master/*` send none;
  only `/student/me` and `/student/{id}` send it (`auth: true` = stored token, string = explicit token).
- `src/lib/payment.ts` — Razorpay Checkout loader + `collectPayment()`.
- `src/lib/acceptance-letter.ts` — letter number/date formatting, verification URL, PDF export.
- `src/features/student/student-home.tsx`, `src/features/admin/admin-dashboard.tsx` (+ `admin-sections.tsx`) — student home and the live admin dashboard.
- `src/lib/cache.ts` — 5-minute cache for public master data; admin writes clear their lists.
- Shared UI in `src/shared/components/`; all global CSS in `src/styles/`. Screens are lazy-loaded (`App.tsx`).
- Styles are global CSS files imported from `main.tsx`/components (`styles.css` is minified; add new styles in separate files,
  e.g. `acceptance-letter.css`). Theme tokens: `--bg --surface --soft --border --text --muted --purple* --shadow`.

## Flows

### Student self-registration
1. Home → "Student registration" → `StudentRegistrationForm` (mode `self`).
2. Step 2: the email field has a **Verify** button → `POST /auth/register/email/send-otp` (pre-account, keyed by email) →
   OTP box → "Submit OTP" → `POST /auth/register/email/verify-otp`. Continuing past step 2 requires a verified email.
   The verification is good for 30 minutes and is used up by the registration.
3. Step 4 "Pay ₹X & register": `POST /auth/register/student` creates the account first (REGISTERED), then
   `GET /student/me` gives `registrationId` → `POST /payment/create-order` → Razorpay Checkout with that `order_id`
   (`checkoutRegistration`) → `POST /payment/verify` (backend checks the signature → ENROLLED).
   A cancelled payment keeps the account: the form says so and the student can pay from the letter page ("Complete payment").
   If a later step fails, the state is kept, so the retry does not register or charge again.
4. Token stored in localStorage (`authToken`, `userId`) → stage `acceptance-letter`.

### Cyber cafe registration
1. Cafe signs in (or registers the cafe) → `CyberCafeWorkspace`.
2. Same form with `mode="cyber-cafe"`. The registration request sends the cafe's bearer token (`useStoredSession`) so the backend
   links the registration to the cafe. The OTP goes to the student's email; cafe staff enter it.
3. The student's returned token is **not** stored; it is passed to `AcceptanceLetter` as `authToken` to load `/student/me`
   for that student and to pay the order. "Register another student" resets the form.

### Forgot password (students)
Sign-in → "Forgot password?" → `ForgotPasswordFlow`: `POST /auth/password/forgot` → code → `POST /auth/password/verify-otp`
(checks the code, does not use it) → new password + confirm → `POST /auth/password/reset` (the code is checked and used here).
Success returns to sign-in.

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

## Backend contract assumptions / TODO
- `AuthResponse`: `{ token, userId, name, email, role: SUPER_ADMIN | UNIVERSITY_ADMIN | STUDENT | CYBER_CAFE }`.
- Payments are server-verified: `/payment/create-order` (needs the registration and a verified email) and `/payment/verify`
  (signature check with the key secret, then ENROLLED). The frontend sends no payment fields to `/auth/register/student`.
- `StudentDetails.letterNumber` is not returned by `/student/me`; the letter number comes from `/acceptance-letters/me`.
- **DB migration**: `sql/email_verification.sql` (in the backend repo) must be run before starting the backend,
  because `ddl-auto=validate`.

## Conventions
- Formik for forms, lucide-react icons, bilingual (English / Hindi) copy on student-facing screens.
- `toast.success/error` from `shared/components/toast.tsx` for feedback; there is no `toast.info`.
- `qrcode.react` v4 has only named exports (`QRCodeCanvas`, `QRCodeSVG`) — no default import.
