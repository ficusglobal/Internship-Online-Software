// Code-split screens. Each loader is used both by React.lazy (to render the screen) and by
// preload() (to start downloading it early, e.g. on hover or while a sign-in request is in flight).
// Because import() caches the module, a preload makes the later lazy render instant.

export const screens = {
  admin: () => import("../features/admin/admin-dashboard").then((m) => ({ default: m.AdminDashboard })),
  letter: () => import("../features/letter/acceptance-letter").then((m) => ({ default: m.AcceptanceLetter })),
  studentHome: () => import("../features/student/student-home").then((m) => ({ default: m.StudentHome })),
  cyberCafe: () => import("../features/cyber-cafe/cyber-cafe-workspace").then((m) => ({ default: m.CyberCafeWorkspace })),
  verification: () =>
    import("../features/letter/acceptance-letter-verification").then((m) => ({
      default: m.AcceptanceLetterVerification,
    })),
  registration: () =>
    import("../features/registration/student-registration-form").then((m) => ({
      default: m.StudentRegistrationForm,
    })),
  forgotPassword: () =>
    import("../features/auth/forgot-password-flow").then((m) => ({ default: m.ForgotPasswordFlow })),
};

export type ScreenName = keyof typeof screens;

// Starts the download without waiting; a failed preload is ignored (the screen retries when opened)
export function preload(...names: ScreenName[]): void {
  names.forEach((name) => {
    screens[name]().catch(() => undefined);
  });
}
