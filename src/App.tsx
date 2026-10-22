import { lazy, Suspense, useEffect, useState } from "react";
import { SignIn, type UserRole } from "./features/auth/auth";
import { ToastViewport } from "./shared/components/toast";
import { clearSession, loadSession } from "./lib/session";
import type { StudentDetails } from "./lib/auth-api";
import type { Theme } from "./types";
import { screens } from "./lib/screens";

// Each screen is its own chunk (see lib/screens.ts). Sign-in stays eager: it is the first screen everyone sees.
const AdminDashboard = lazy(screens.admin);
const AcceptanceLetter = lazy(screens.letter);
const StudentHome = lazy(screens.studentHome);
const CyberCafeWorkspace = lazy(screens.cyberCafe);
const AcceptanceLetterVerification = lazy(screens.verification);

type AppStage = "sign-in" | "student-home" | "acceptance-letter" | "cyber-cafe" | "admin-dashboard";

// Public QR verification page: /student/acceptance-letter/:studentId
const VERIFY_PATH = /^\/student\/acceptance-letter\/([^/]+)\/?$/;

// A saved session (see lib/session.ts) brings the user back to their screen after a reload
function stageFor(role: UserRole): AppStage {
  if (role === "student") return "student-home";
  if (role === "cyber-cafe") return "cyber-cafe";
  return "admin-dashboard";
}

function Loading() {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <div className="spinner" />
    </div>
  );
}

function AppContent() {
  const [restored] = useState(loadSession);
  const [stage, setStage] = useState<AppStage>(() => (restored ? stageFor(restored.role) : "sign-in"));
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "light");
  const [adminName, setAdminName] = useState(restored?.role === "admin" ? restored.name : "");
  const [authenticatedStudentName, setAuthenticatedStudentName] = useState(
    restored?.role === "student" ? restored.name : "",
  );
  const [registrationSnapshot, setRegistrationSnapshot] = useState<Partial<StudentDetails>>();

  const logout = () => {
    clearSession();
    setRegistrationSnapshot(undefined);
    setStage("sign-in");
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  if (stage === "sign-in") {
    return (
      <>
        <SignIn
          theme={theme}
          setTheme={setTheme}
          onAuthenticated={(nextRole, name, registration) => {
            if (nextRole === "student") {
              setAuthenticatedStudentName(name || "Student");
              setRegistrationSnapshot(registration);
              // A new registration goes straight to the letter; a sign-in opens the student home
              setStage(registration ? "acceptance-letter" : "student-home");
            } else if (nextRole === "cyber-cafe") {
              setStage("cyber-cafe");
            } else {
              setAdminName(name || "Administrator");
              setStage("admin-dashboard");
            }
          }}
        />
        <ToastViewport />
      </>
    );
  }

  return (
    <>
      <Suspense fallback={<Loading />}>
        {stage === "student-home" && (
          <StudentHome
            name={authenticatedStudentName || "Student"}
            onOpenLetter={() => setStage("acceptance-letter")}
            onLogout={logout}
          />
        )}
        {stage === "acceptance-letter" && (
          <AcceptanceLetter
            studentName={authenticatedStudentName}
            fallbackDetails={registrationSnapshot}
            onContinue={() => setStage("student-home")}
            onLogout={logout}
          />
        )}
        {stage === "cyber-cafe" && <CyberCafeWorkspace onLogout={logout} />}
        {stage === "admin-dashboard" && <AdminDashboard name={adminName || "Administrator"} onLogout={logout} />}
      </Suspense>
      <ToastViewport />
    </>
  );
}

export default function App() {
  const verify = window.location.pathname.match(VERIFY_PATH);
  if (verify) {
    return (
      <Suspense fallback={<Loading />}>
        <AcceptanceLetterVerification studentId={decodeURIComponent(verify[1])} />
      </Suspense>
    );
  }
  return <AppContent />;
}
