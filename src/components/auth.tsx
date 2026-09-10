import {
  ArrowRight,
  Building2,
  Check,
  ChevronLeft,
  GraduationCap,
  LockKeyhole,
  Mail,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { Field, Form, Formik } from "formik";
import { useState } from "react";
import type { Theme, University } from "../types";
import { Button } from "./ui";
import { Popover } from "./popover";
import { StudentRegistrationForm } from "./components/student-registration-form";
import { authApi, type AuthResponse } from "../lib/auth-api";
import { toast } from "./toast";
import "../auth-layout.css";
import "../auth-role.css";
import "../auth-mobile-fix.css";
import "../auth-navbar.css";

export type UserRole = "admin" | "student" | "cyber-cafe";
type PublicPage = "home" | "features" | "contact";
type StudentFlow = "login" | "register" | "details";

interface SignInProps {
  onAuthenticated: (role: UserRole) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}
interface BilingualTextProps {
  english: string;
  hindi: string;
  className?: string;
}

const publicPages: Record<
  PublicPage,
  { eyebrow: string; title: string; description: string; hindi: string }
> = {
  home: {
    eyebrow: "WELCOME TO FICUS GLOBAL",
    title: "A simpler way to manage internships.",
    description:
      "One trusted place for students, colleges, and programme teams.",
    hindi: "विद्यार्थियों, कॉलेजों और कार्यक्रम टीमों के लिए एक भरोसेमंद जगह।",
  },
  features: {
    eyebrow: "WHAT YOU CAN DO",
    title: "Everything important, without the confusion.",
    description:
      "Students can see their journey clearly while administrators can keep every programme on track.",
    hindi:
      "विद्यार्थी अपनी यात्रा आसानी से देख सकते हैं और प्रशासक हर कार्यक्रम को व्यवस्थित रख सकते हैं।",
  },
  contact: {
    eyebrow: "CONTACT",
    title: "We are here to help.",
    description:
      "Get in touch with the Ficus Global support team for access and programme queries.",
    hindi:
      "पहुँच और कार्यक्रम से जुड़े प्रश्नों के लिए फिकस ग्लोबल सहायता टीम से संपर्क करें।",
  },
};

function BilingualText({ english, hindi, className }: BilingualTextProps) {
  return (
    <span className={`bilingual-text ${className ?? ""}`}>
      <span>{english}</span>
      <span lang="hi">{hindi}</span>
    </span>
  );
}
interface CredentialsFormProps {
  registration?: boolean;
  role: UserRole;
  onSubmit: (values: CredentialsValues) => void;
  onLogin?: () => void;
  onCyberCafeRegister?: () => void;
}

interface CredentialsValues {
  email: string;
  password: string;
  confirmPassword: string;
  shopName: string;
  ownerName: string;
  address: string;
  mobileNo: string;
}

function CredentialsForm({
  registration = false,
  role,
  onSubmit,
  onLogin,
  onCyberCafeRegister,
}: CredentialsFormProps) {
  const accountLabel =
    role === "admin"
      ? "Administrator"
      : role === "cyber-cafe"
        ? "Cyber cafe"
        : "Student";
  return (
    <Formik
      initialValues={{
        email: "",
        password: "",
        confirmPassword: "",
        shopName: "",
        ownerName: "",
        address: "",
        mobileNo: "",
      }}
      validate={(values) => {
        const errors: Record<string, string> = {};
        if (!values.email) errors.email = "Email is required.";
        if (role === "cyber-cafe" && registration) {
          if (!values.shopName) errors.shopName = "Shop name is required.";
          if (!values.ownerName) errors.ownerName = "Owner name is required.";
          if (!values.address) errors.address = "Address is required.";
          if (!/^\d{10}$/.test(values.mobileNo))
            errors.mobileNo = "Enter a valid 10-digit mobile number.";
        }
        if (!values.password) errors.password = "Password is required.";
        else if (values.password.length < 8)
          errors.password = "Password must be at least 8 characters.";
        if (registration && !values.confirmPassword)
          errors.confirmPassword = "Please confirm your password.";
        else if (registration && values.confirmPassword !== values.password)
          errors.confirmPassword = "Passwords do not match.";
        return errors;
      }}
      onSubmit={onSubmit}
    >
      {({ errors, touched }) => (
        <Form className="auth-form">
          {role === "cyber-cafe" && registration && (
            <>
              <label>
                Cyber cafe / shop name
                <div className="auth-input auth-input-plain">
                  <Field
                    className="input"
                    name="shopName"
                    placeholder="Your shop name"
                    required
                  />
                </div>
                {touched.shopName && errors.shopName && (
                  <small className="field-error">{errors.shopName}</small>
                )}
              </label>
              <label>
                Owner name
                <div className="auth-input auth-input-plain">
                  <Field
                    className="input"
                    name="ownerName"
                    placeholder="Owner's full name"
                    required
                  />
                </div>
                {touched.ownerName && errors.ownerName && (
                  <small className="field-error">{errors.ownerName}</small>
                )}
              </label>
              <label>
                Shop address
                <div className="auth-input auth-input-plain">
                  <Field
                    className="input"
                    name="address"
                    placeholder="Full business address"
                    required
                  />
                </div>
                {touched.address && errors.address && (
                  <small className="field-error">{errors.address}</small>
                )}
              </label>
              <label>
                Mobile number
                <div className="auth-input auth-input-plain">
                  <Field
                    className="input"
                    name="mobileNo"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    required
                  />
                </div>
                {touched.mobileNo && errors.mobileNo && (
                  <small className="field-error">{errors.mobileNo}</small>
                )}
              </label>
            </>
          )}
          <label>
            {accountLabel} email
            <div className="auth-input">
              <Mail size={17} />
              <Field
                className="input"
                name="email"
                type="email"
                placeholder={
                  role === "admin" ? "admin@university.edu" : "you@email.com"
                }
                required
              />
            </div>
            {touched.email && errors.email && (
              <small className="field-error">{errors.email}</small>
            )}
          </label>
          <label>
            Password
            <div className="auth-input">
              <LockKeyhole size={17} />
              <Field
                className="input"
                name="password"
                type="password"
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </div>
            {touched.password && errors.password && (
              <small className="field-error">{errors.password}</small>
            )}
          </label>
          {registration && (
            <label>
              Confirm password
              <div className="auth-input">
                <LockKeyhole size={17} />
                <Field
                  className="input"
                  name="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  minLength={8}
                  required
                />
              </div>
              {touched.confirmPassword && errors.confirmPassword && (
                <small className="field-error">{errors.confirmPassword}</small>
              )}
            </label>
          )}
          {!registration && (
            <button type="button" className="forgot-password">
              Forgot password?
            </button>
          )}
          <Button type="submit">
            {registration ? "Create account" : "Sign in"}{" "}
            <ArrowRight size={16} />
          </Button>
          {registration && (
            <button
              type="button"
              className="auth-login-inline"
              onClick={onLogin}
            >
              Already registered? Sign in instead.
            </button>
          )}
          {role === "student" && onCyberCafeRegister && (
            <button
              type="button"
              className="auth-role-switch"
              onClick={onCyberCafeRegister}
            >
              Register a cyber cafe instead <ArrowRight size={15} />
            </button>
          )}
        </Form>
      )}
    </Formik>
  );
}

export function SignIn({ onAuthenticated, theme, setTheme }: SignInProps) {
  const [role, setRole] = useState<UserRole>("student");
  const [studentFlow, setStudentFlow] = useState<StudentFlow>("register");
  const [publicPage, setPublicPage] = useState<PublicPage | null>("home");
  const [authError, setAuthError] = useState("");
  const registering = role === "student" && studentFlow !== "login";
  const cyberCafeRegistering =
    role === "cyber-cafe" && studentFlow === "register";
  const isRegistration = registering || cyberCafeRegistering;
  const detailsStep = role === "student" && studentFlow === "details";
  const selectRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setStudentFlow(
      nextRole === "student"
        ? "details"
        : nextRole === "admin"
          ? "login"
          : "register",
    );
    setAuthError("");
    setPublicPage(null);
  };
  const showLogin = () => {
    setRole("student");
    setStudentFlow("login");
    setPublicPage(null);
  };
  const showRegister = () => {
    setRole("student");
    setStudentFlow("details");
    setPublicPage(null);
  };
  const showCyberCafeRegister = () => {
    setRole("cyber-cafe");
    setStudentFlow("register");
    setAuthError("");
    setPublicPage(null);
  };
  const showCyberCafeLogin = () => {
    setRole("cyber-cafe");
    setStudentFlow("login");
    setAuthError("");
    setPublicPage(null);
  };
  const handleAuthResponse = (response: AuthResponse, successMessage?: string) => {
    localStorage.setItem("authToken", response.token);
    toast.success(successMessage ?? "Authentication completed successfully.");
    onAuthenticated(
      response.role === "STUDENT"
        ? "student"
        : response.role === "CYBER_CAFE"
          ? "cyber-cafe"
          : "admin",
    );
  };
  const submitCredentials = async (values: CredentialsValues) => {
    setAuthError("");
    const operation = role === "cyber-cafe" && isRegistration
      ? "Cyber cafe registration"
      : role === "cyber-cafe"
        ? "Cyber cafe sign-in"
        : role === "admin"
          ? "Administrator sign-in"
          : "Student sign-in";
    try {
      if (role === "cyber-cafe" && isRegistration) {
        handleAuthResponse(await authApi.registerCyberCafe(values), "Cyber cafe account created successfully.");
      } else {
        handleAuthResponse(await authApi.login(values.email, values.password), `${operation} successful.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to continue. Please try again.";
      setAuthError(message);
      toast.error(`${operation} failed: ${message}`);
    }
  };
  const navigation = (
    <>
      <header className="auth-navbar">
        <div className="auth-navbar-inner">
          <Popover
            className="auth-role-popover auth-brand-role-selector"
            trigger={({ open, toggle }) => (
              <button
                className="auth-role-icon"
                type="button"
                aria-label="Choose Student, Administrator, or Cyber Cafe"
                aria-expanded={open}
                onClick={toggle}
              >
                <GraduationCap size={24} />
              </button>
            )}
          >
            {({ close }) => (
              <div className="auth-role-menu" role="menu">
                <p>Continue as</p>
                <button
                  type="button"
                  className={role === "student" ? "selected" : ""}
                  onClick={() => {
                    selectRole("student");
                    close();
                  }}
                >
                  <GraduationCap size={16} />
                  <span>
                    <b>Student</b>
                    <small>विद्यार्थी</small>
                  </span>
                  {role === "student" && <Check size={15} />}
                </button>
                <button
                  type="button"
                  className={role === "admin" ? "selected" : ""}
                  onClick={() => {
                    selectRole("admin");
                    close();
                  }}
                >
                  <ShieldCheck size={16} />
                  <span>
                    <b>Administrator</b>
                    <small>Manage programmes</small>
                  </span>
                  {role === "admin" && <Check size={15} />}
                </button>
                <button
                  type="button"
                  className={role === "cyber-cafe" ? "selected" : ""}
                  onClick={() => {
                    selectRole("cyber-cafe");
                    close();
                  }}
                >
                  <Building2 size={16} />
                  <span>
                    <b>Cyber Cafe</b>
                    <small>Register students</small>
                  </span>
                  {role === "cyber-cafe" && <Check size={15} />}
                </button>
              </div>
            )}
          </Popover>
          <nav className="auth-top-nav" aria-label="Public navigation">
            {(Object.keys(publicPages) as PublicPage[]).map((page) => (
              <button
                key={page}
                className={publicPage === page ? "active" : ""}
                onClick={() => setPublicPage(page)}
              >
                {page}
              </button>
            ))}
          </nav>
          <button
            className="auth-theme-toggle auth-header-theme-toggle"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          >
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            <span>{theme === "light" ? "Dark" : "Light"}</span>
          </button>
        </div>
      </header>
      <nav className="auth-bottom-nav" aria-label="Public navigation">
        {(Object.keys(publicPages) as PublicPage[]).map((page) => (
          <button
            key={page}
            className={publicPage === page ? "active" : ""}
            onClick={() => setPublicPage(page)}
          >
            {page}
          </button>
        ))}
      </nav>
    </>
  );
  if (publicPage) {
    const page = publicPages[publicPage];
    return (
      <main className={`auth-page public-auth-page auth-${role}`}>
        {navigation}
        <section className="public-page">
          <span className="auth-eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <BilingualText english={page.description} hindi={page.hindi} />
          {publicPage === "home" ? (
            <div className="public-page-actions">
              <Button onClick={showRegister}>
                Student registration <ArrowRight size={16} />
              </Button>
              <button className="public-login-button" onClick={showLogin}>
                Student login <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <Button onClick={showRegister}>
              Get started <ArrowRight size={16} />
            </Button>
          )}
        </section>
      </main>
    );
  }
  const title = detailsStep
    ? ["Internship registration", "इंटर्नशिप पंजीकरण"]
    : registering
      ? ["Create your internship account", "अपना इंटर्नशिप अकाउंट बनाएं"]
      : [
          "Sign in to your internship account",
          "अपने इंटर्नशिप अकाउंट में साइन इन करें",
        ];
  const description = detailsStep
    ? [
        "Complete the three steps below to finish your internship registration.",
        "इंटर्नशिप पंजीकरण पूरा करने के लिए नीचे दिए गए तीन चरण पूरे करें।",
      ]
    : registering
      ? [
          "Use your email and a password of at least 8 characters to begin registration.",
          "पंजीकरण शुरू करने के लिए अपना ईमेल और कम से कम 8 अक्षरों का पासवर्ड उपयोग करें।",
        ]
      : [
          "Sign in with the email and password you used for your internship account.",
          "अपने इंटर्नशिप अकाउंट के ईमेल और पासवर्ड से साइन इन करें।",
        ];
  return (
    <main className={`auth-page auth-${role}`}>
      {navigation}
      <section className="auth-showcase">
        <div className="auth-brand">
          <span className="brand-mark">
            <GraduationCap size={20} />
          </span>
          Ficus Global
        </div>
        <div className="auth-promise">
          <span className="auth-kicker">
            <Sparkles size={14} />
            {registering
              ? "Start your internship"
              : role === "student"
                ? "Your internship journey"
                : "Programme administration"}
          </span>
          <h1>
            {registering
              ? "Take the first step towards your internship."
              : role === "student"
                ? "Your internship, all in one place."
                : "Run every university programme with confidence."}
          </h1>
          <BilingualText
            className="auth-bilingual-copy"
            english="Easily view your attendance, payment and certificate updates."
            hindi="अपनी उपस्थिति, भुगतान और प्रमाणपत्र की जानकारी आसानी से देखें।"
          />
          <div className="auth-benefits">
            {[
              "Track your internship progress",
              "Check attendance and payments",
              "Get reports and certificates",
            ].map((benefit) => (
              <span key={benefit}>
                <Check size={15} />
                {benefit}
              </span>
            ))}
          </div>
        </div>
        <small>© 2026 Ficus Global. Built for learning teams.</small>
      </section>
      <section className="auth-shell">
        <div className="auth-card">
          <div className="auth-card-heading">
            <span className="auth-eyebrow">
              {cyberCafeRegistering
                ? "CYBER CAFE REGISTRATION"
                : registering
                  ? "STUDENT REGISTRATION / विद्यार्थी पंजीकरण"
                  : role === "student"
                    ? "STUDENT LOGIN / विद्यार्थी लॉगिन"
                    : role === "cyber-cafe"
                      ? "CYBER CAFE LOGIN"
                      : "ADMINISTRATOR LOGIN"}
            </span>
            <h2>
              {role === "student" ? (
                <BilingualText english={title[0]} hindi={title[1]} />
              ) : role === "cyber-cafe" ? (
                cyberCafeRegistering ? (
                  "Register your cyber cafe"
                ) : (
                  "Sign in to your cyber cafe workspace"
                )
              ) : (
                "Sign in to your admin workspace"
              )}
            </h2>
            {role === "student" ? (
              <BilingualText
                className="auth-description-bilingual"
                english={description[0]}
                hindi={description[1]}
              />
            ) : role === "cyber-cafe" ? (
              <p>
                {cyberCafeRegistering
                  ? "Create a business account to register students from your cyber cafe."
                  : "Use your cyber cafe email and password to sign in."}
              </p>
            ) : (
              <p>
                Use your administrator account to manage university programmes.
              </p>
            )}
          </div>
          {detailsStep ? (
            <>
              <StudentRegistrationForm onComplete={handleAuthResponse} />
              <button
                type="button"
                className="auth-role-switch student-registration-switch"
                onClick={showCyberCafeRegister}
              >
                Register a cyber cafe instead <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <div className={`role-context role-${role}`}>
                <span>
                  {role === "admin" ? (
                    <Building2 size={16} />
                  ) : (
                    <GraduationCap size={16} />
                  )}
                </span>
                {role === "student" ? (
                  <BilingualText
                    english={
                      registering
                        ? "After creating your account, share a few details to finish registration."
                        : "Your internship details will open after sign in."
                    }
                    hindi={
                      registering
                        ? "अकाउंट बनाने के बाद पंजीकरण पूरा करने के लिए कुछ जानकारी भरें।"
                        : "साइन इन करने के बाद आपकी इंटर्नशिप की जानकारी खुल जाएगी।"
                    }
                  />
                ) : (
                  <p>
                    {role === "cyber-cafe"
                      ? "Your cyber cafe account can register and manage students."
                      : "You will choose a university after signing in."}
                  </p>
                )}
              </div>
              <CredentialsForm
                key={`${role}-${isRegistration ? "register" : "login"}`}
                role={role}
                registration={isRegistration}
                onLogin={role === "cyber-cafe" ? showCyberCafeLogin : showLogin}
                onCyberCafeRegister={showCyberCafeRegister}
                onSubmit={submitCredentials}
              />
              {authError && (
                <p className="auth-api-error" role="alert">
                  {authError}
                </p>
              )}
            </>
          )}
          <p className="auth-help">
            Need help? / मदद चाहिए? <button>Contact support</button>
          </p>
        </div>
      </section>
    </main>
  );
}

interface UniversitySelectProps {
  universities: University[];
  onSelect: (university: University) => void;
  onBack: () => void;
}
export function UniversitySelect({
  universities,
  onSelect,
  onBack,
}: UniversitySelectProps) {
  return (
    <main className="university-select-page">
      <section className="university-select-card">
        <button className="back-button" onClick={onBack}>
          <ChevronLeft size={17} /> Back to sign in
        </button>
        <div className="select-icon">
          <Building2 size={23} />
        </div>
        <span className="auth-eyebrow">ADMIN WORKSPACE</span>
        <h1>Choose a university</h1>
        <p>
          Select the university you want to manage. You can switch this later
          from the panel.
        </p>
        <div className="university-options">
          {universities.map((university, index) => (
            <button
              className="university-option"
              key={university.id}
              onClick={() => onSelect(university)}
            >
              <span className={`university-monogram tone-${index % 3}`}>
                {university.name.slice(0, 1)}
              </span>
              <span>
                <b>{university.name}</b>
                <small>{university.city}</small>
              </span>
              <ArrowRight size={18} />
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
