import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { SignIn, type SignInView } from "./features/auth/auth";
import { ToastViewport } from "./shared/components/toast";
import { clearSession, loadSession, type SessionRole, type StoredSession } from "./lib/session";
import type { StudentDetails } from "./lib/auth-api";
import { allowedReturn, homeFor, loginFor, paths } from "./lib/routes";
import type { Theme } from "./types";
import { screens } from "./lib/screens";

// Each screen is its own chunk (see lib/screens.ts), loaded when its route is first opened.
// Sign-in stays eager: it is the first screen everyone sees.
const AdminDashboard = lazy(screens.admin);
const AcceptanceLetter = lazy(screens.letter);
const StudentHome = lazy(screens.studentHome);
const CyberCafeWorkspace = lazy(screens.cyberCafe);
const AcceptanceLetterVerification = lazy(screens.verification);

function Loading() {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <div className="spinner" />
    </div>
  );
}

interface LocationState {
  from?: string;
}

// Protected route: no session -> that role's login (and back here afterwards); another role -> its own home
function RequireRole({ session, role, children }: { session: StoredSession | null; role: SessionRole; children: ReactNode }) {
  const location = useLocation();
  if (!session) return <Navigate to={loginFor(role)} replace state={{ from: location.pathname } satisfies LocationState} />;
  if (session.role !== role) return <Navigate to={homeFor(session.role)} replace />;
  return <>{children}</>;
}

function Verification() {
  const { studentId = "" } = useParams();
  return <AcceptanceLetterVerification studentId={studentId} />;
}

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  // A saved session (see lib/session.ts) brings the user back to their screen after a reload
  const [session, setSession] = useState<StoredSession | null>(loadSession);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "light");
  // Details from a registration that just finished; the letter page uses them until the API answers
  const [registrationSnapshot, setRegistrationSnapshot] = useState<Partial<StudentDetails>>();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const logout = () => {
    clearSession();
    setSession(null);
    setRegistrationSnapshot(undefined);
    navigate(paths.home, { replace: true });
  };

  const signIn = (view: SignInView) =>
    // Signed-in users skip the public and sign-in pages
    session ? (
      <Navigate to={homeFor(session.role)} replace />
    ) : (
      <SignIn
        view={view}
        theme={theme}
        setTheme={setTheme}
        onAuthenticated={(role, signedInName, registration, accountRole) => {
          // Built from the response (not re-read from storage, which can be blocked in private mode)
          const next: StoredSession = { role, accountRole, name: signedInName ?? "", expiresAt: Number.MAX_SAFE_INTEGER };
          setSession(next);
          setRegistrationSnapshot(next.role === "student" ? registration : undefined);
          const from = (location.state as LocationState | null)?.from;
          // A new registration goes straight to the letter; a sign-in returns to where the user was headed
          const target =
            next.role === "student" && registration ? paths.studentLetter : allowedReturn(next.role, from) ?? homeFor(next.role);
          navigate(target, { replace: true });
        }}
      />
    );

  const name = session?.name;

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path={paths.home} element={signIn("home")} />
        <Route path={paths.features} element={signIn("features")} />
        <Route path={paths.contact} element={signIn("contact")} />
        <Route path={paths.register} element={signIn("register")} />
        <Route path={paths.login} element={signIn("login")} />
        <Route path={paths.forgotPassword} element={signIn("forgot-password")} />
        <Route path={paths.adminLogin} element={signIn("admin-login")} />
        <Route path={paths.cafeLogin} element={signIn("cafe-login")} />
        <Route path={paths.cafeRegister} element={signIn("cafe-register")} />

        {/* Public QR verification: /student/acceptance-letter/:studentId */}
        <Route path={`${paths.studentLetter}/:studentId`} element={<Verification />} />

        <Route
          path={paths.studentHome}
          element={
            <RequireRole session={session} role="student">
              <StudentHome name={name || "Student"} onOpenLetter={() => navigate(paths.studentLetter)} onLogout={logout} />
            </RequireRole>
          }
        />
        <Route
          path={paths.studentLetter}
          element={
            <RequireRole session={session} role="student">
              <AcceptanceLetter
                studentName={name}
                fallbackDetails={registrationSnapshot}
                onContinue={() => navigate(paths.studentHome)}
                onLogout={logout}
              />
            </RequireRole>
          }
        />
        <Route
          path={paths.cafe}
          element={
            <RequireRole session={session} role="cyber-cafe">
              <CyberCafeWorkspace onLogout={logout} />
            </RequireRole>
          }
        />
        <Route
          path={`${paths.admin}/:section?/:studentId?`}
          element={
            <RequireRole session={session} role="admin">
              <AdminDashboard name={name || "Administrator"} accountRole={session?.accountRole} onLogout={logout} />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to={paths.home} replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <ToastViewport />
    </BrowserRouter>
  );
}
