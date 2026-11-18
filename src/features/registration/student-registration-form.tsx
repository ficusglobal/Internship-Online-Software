import { ArrowLeft, ArrowRight, BookOpenCheck, Building2, CheckCircle2, CircleAlert, CreditCard, FileCheck2, GraduationCap, LoaderCircle, Pencil, RefreshCw, RotateCcw, Send, ShieldCheck, UserRound, XCircle } from "lucide-react";
import { Form, Formik, useFormikContext } from "formik";
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import {
  ApiError,
  authApi,
  registrationEmailApi,
  type AuthResponse,
  type ConsentSummary,
  type EmailVerificationResult,
  type StudentDetails,
} from "../../lib/auth-api";
import { consentReady } from "../../lib/consent";
import { PaymentCancelledError } from "../../lib/payment";
import { checkoutRegistration, confirmRegistrationPayment, describePayment, type ConfirmedPayment } from "../../lib/registration-payment";
import { confirmAction } from "../../shared/components/confirm-dialog";
import { DropdownSelector } from "../../shared/components/dropdown-selector";
import { PaymentSummary } from "../../shared/components/payment-summary";
import { Skeleton } from "../../shared/components/skeleton";
import { toast } from "../../shared/components/toast";
import { Input } from "../../shared/components/ui";
import { ConsentUpload } from "../consent/consent-upload";
import { EmailOtp } from "./email-otp";
import { clearDraft, loadDraft, saveDraft, type RegistrationDraft } from "./registration-draft";
import { RegistrationStepper, type StepInfo } from "./registration-stepper";
import { useMobileAvailability, MOBILE_PATTERN } from "./use-mobile-availability";
import { useRegistrationOptions } from "./use-registration-options";
import "../../styles/registration-flow.css";

interface RegistrationValues {
  fullName: string;
  fatherName: string;
  mobileNo: string;
  gender: "" | "MALE" | "FEMALE" | "OTHER";
  universityId: string;
  districtId: string;
  collegeId: string;
  // Degree and department are codes from the master lists ("UG", "BSC"); the department list
  // depends on the degree. departmentOther is the free-text name asked for when the department is "Others".
  degree: string;
  department: string;
  departmentOther: string;
  semester: string;
  academicSessionId: string;
  majorSubjectId: string;
  registrationNumber: string;
  collegeRollNumber: string;
  courseId: string;
  batchId: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

type Field = keyof RegistrationValues;

const initialValues: RegistrationValues = {
  fullName: "",
  fatherName: "",
  mobileNo: "",
  gender: "",
  universityId: "",
  districtId: "",
  collegeId: "",
  degree: "",
  department: "",
  departmentOther: "",
  semester: "",
  academicSessionId: "",
  majorSubjectId: "",
  registrationNumber: "",
  collegeRollNumber: "",
  courseId: "",
  batchId: "",
  email: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
};

// The registration, in order. Verify comes first: the email must be verified before anything else is asked.
// The account is created at "Review"; the consent letter and the payment (one step) need the account.
const STEPS: StepInfo[] = [
  { label: "Verify", title: "Verify your mobile and email" },
  { label: "Details", title: "About you and your college" },
  { label: "Academic", title: "Academic details" },
  { label: "Review", title: "Review and create account" },
  { label: "Pay", title: "Consent letter and payment" },
];
const VERIFY = 0;
const DETAILS = 1;
const ACADEMIC = 2;
const REVIEW = 3;
const PAY = 4;

const STEP_HINTS = [
  "We verify your email first, so we can reach you. / पहले ईमेल सत्यापित होगा।",
  "Tell us who you are and where you study. / आप कौन हैं और कहाँ पढ़ते हैं।",
  "Your degree, session and university numbers. / आपकी डिग्री, सत्र और नंबर।",
  "Check everything, then set a password. / जाँचें, फिर पासवर्ड बनाएँ।",
  "Upload the signed consent letter and pay to finish. / सहमति पत्र अपलोड करें और भुगतान करें।",
];

const STEP_FIELDS: Record<number, Field[]> = {
  0: ["mobileNo", "email"],
  1: ["fullName", "fatherName", "gender", "universityId", "districtId", "collegeId", "courseId", "batchId"],
  2: ["degree", "department", "departmentOther", "semester", "academicSessionId", "majorSubjectId", "registrationNumber", "collegeRollNumber"],
  3: ["password", "confirmPassword", "termsAccepted"],
};

// The step that holds each field, so a server-side field error can take the user back to it
const STEP_OF_FIELD = Object.fromEntries(
  Object.entries(STEP_FIELDS).flatMap(([step, fields]) => fields.map((field) => [field, Number(step)])),
) as Partial<Record<string, number>>;

const NUMBER_PATTERN = /^\d{1,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// The email proof from /auth/register/email/verify-otp lives 30 minutes; refresh a little early
const EMAIL_PROOF_MAX_MS = 29 * 60 * 1000;

// Department codes ending in _OTHERS ("UG_OTHERS", "PG_OTHERS") need a typed department name
const isOthersDepartment = (code: string) => code.endsWith("_OTHERS");

const REQUIRED: Field[] = [
  "mobileNo", "email", "fullName", "fatherName", "gender", "universityId", "districtId", "collegeId", "courseId", "batchId",
  "degree", "department", "semester", "academicSessionId", "majorSubjectId", "registrationNumber", "collegeRollNumber", "password", "confirmPassword",
];

const validate = (values: RegistrationValues) => {
  const errors: Partial<Record<Field, string>> = {};
  REQUIRED.forEach((field) => {
    const value = values[field];
    if (typeof value === "string" && !value.trim()) errors[field] = "Required / आवश्यक है";
  });
  if (values.mobileNo && !MOBILE_PATTERN.test(values.mobileNo)) {
    errors.mobileNo = "Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9 / 10 अंकों का सही नंबर दर्ज करें";
  }
  if (values.email && !EMAIL_PATTERN.test(values.email)) errors.email = "Enter a valid email address / सही ईमेल दर्ज करें";
  if (values.password && values.password.length < 8) errors.password = "Password must be at least 8 characters / कम से कम 8 अक्षर";
  if (values.confirmPassword && values.confirmPassword !== values.password) errors.confirmPassword = "Passwords do not match / पासवर्ड मेल नहीं खाते";
  if (isOthersDepartment(values.department) && !values.departmentOther.trim()) {
    errors.departmentOther = "Enter your department name / अपने विभाग का नाम लिखें";
  }
  // Same rules as the backend: digits only, at most 20 (registration number and roll number)
  if (values.registrationNumber.trim() && !NUMBER_PATTERN.test(values.registrationNumber.trim())) errors.registrationNumber = "Digits only, up to 20 / केवल अंक, अधिकतम 20";
  if (values.collegeRollNumber.trim() && !NUMBER_PATTERN.test(values.collegeRollNumber.trim())) errors.collegeRollNumber = "Digits only, up to 20 / केवल अंक, अधिकतम 20";
  if (!values.termsAccepted) errors.termsAccepted = "You must accept the terms to register / नियम स्वीकार करना आवश्यक है";
  return errors;
};

// Keeps only the 10 digits of a mobile number. A pasted "+91" country prefix is dropped first,
// so "+91 98765-43210" becomes "9876543210" instead of "9198765432".
const mobileDigits = (raw: string) => raw.trim().replace(/^\+91/, "").replace(/\D/g, "").slice(0, 10);
const digitsOnly = (raw: string, max = 20) => raw.replace(/\D/g, "").slice(0, max);

const formatDate = (value?: string) => {
  if (!value) return "Date not specified";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
};

const formatFee = (fee?: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(fee ?? 0));

// A proof that this email was verified before the account exists
interface EmailProof {
  email: string;
  token: string;
  verifiedAt: number;
}

// The account created at Review (before payment) and its registration id
interface RegistrationSession {
  response: AuthResponse;
  registrationId?: string;
}

interface StudentRegistrationFormProps {
  // "cyber-cafe" registers on behalf of a student while the cafe stays signed in.
  mode?: "self" | "cyber-cafe";
  // Shown at the right of the card heading (e.g. "Already registered? Sign in")
  headerAction?: ReactNode;
  // Offered next to "this email is already registered"
  onSignIn?: () => void;
  onComplete: (response: AuthResponse, successMessage: string, snapshot: Partial<StudentDetails>) => void;
}

// Every dropdown of the form opens as a fixed layer, so the card's scrolling body and sticky footer never cover it
function Pick(props: ComponentProps<typeof DropdownSelector>) {
  return <DropdownSelector floating {...props} />;
}

type Draft = RegistrationDraft<RegistrationValues, RegistrationSession, EmailProof, ConfirmedPayment>;

export function StudentRegistrationForm(props: StudentRegistrationFormProps) {
  const scope = props.mode ?? "self";
  // Bumped by "Start over": the whole form (and its saved draft) begins again
  const [instance, setInstance] = useState(0);
  // Read once per instance: what a reload brought back
  const draft = useMemo(() => (instance >= 0 ? loadDraft<Draft>(scope) : null), [scope, instance]);
  const values = useMemo(() => ({ ...initialValues, ...(draft?.values ?? {}), password: "", confirmPassword: "", termsAccepted: false }), [draft]);
  return (
    <Formik key={instance} initialValues={values} onSubmit={() => undefined}>
      <RegistrationFlow {...props} scope={scope} draft={draft} onRestart={() => setInstance((current) => current + 1)} />
    </Formik>
  );
}

interface FlowProps extends StudentRegistrationFormProps {
  scope: string;
  draft: Draft | null;
  onRestart: () => void;
}

function RegistrationFlow({ mode = "self", scope, draft, onRestart, headerAction, onSignIn, onComplete }: FlowProps) {
  const { handleChange, setFieldTouched, setFieldValue, touched, values } = useFormikContext<RegistrationValues>();
  const [step, setStep] = useState(draft?.step ?? VERIFY);
  // The furthest step reached before the account exists; earlier steps can be reopened from the stepper
  const [reached, setReached] = useState(draft?.reached ?? VERIFY);
  // Set once the account exists, so a cancelled or failed payment does not register the email twice
  const [session, setSession] = useState<RegistrationSession | null>(draft?.session ?? null);
  // Set when the email code was entered correctly; the register request needs its token
  const [emailProof, setEmailProof] = useState<EmailProof | null>(draft?.emailProof ?? null);
  // The email a code was requested for (the field is then locked until it is verified or changed)
  const [codeEmail, setCodeEmail] = useState<string | null>(null);
  // Confirmed by Razorpay; kept so a failed signature check is retried without charging again
  const [payment, setPayment] = useState<ConfirmedPayment | null>(draft?.payment ?? null);
  const [consent, setConsent] = useState<ConsentSummary | null>(null);
  const [registrationError, setRegistrationError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  // True while the email is being checked before a code is sent
  const [emailChecking, setEmailChecking] = useState(false);
  // Set when the backend says this email already has an account (shown under the field with a Sign in link)
  const [emailTaken, setEmailTaken] = useState("");
  // Errors the backend reported for a field's value (already registered, rejected): shown until that value changes
  const [serverErrors, setServerErrors] = useState<Partial<Record<Field, { text: string; value: string }>>>({});
  const options = useRegistrationOptions();
  const bodyRef = useRef<HTMLDivElement>(null);
  // Set when the registration is finished, so the cleared draft is not written again
  const completed = useRef(false);

  // Every step opens at its top
  useEffect(() => {
    bodyRef.current?.scrollTo?.({ top: 0 });
  }, [step]);

  // After a reload: the dependent lists (colleges, batches, departments) are loaded again for the restored choices
  useEffect(() => {
    if (!draft) return;
    toast.success("Welcome back. Your saved progress was restored. / आपकी सहेजी हुई जानकारी वापस आ गई।");
    void options.loadColleges(values.universityId, values.districtId);
    void options.loadBatches(values.courseId);
    void options.loadDegreeOptions(values.degree);
    if (draft.session && !draft.session.registrationId) void resolveRegistrationId(draft.session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Saved on every change (never the passwords or the terms checkbox)
  const hasProgress = Object.entries(values).some(([field, value]) => field !== "termsAccepted" && field !== "password" && field !== "confirmPassword" && Boolean(value));
  useEffect(() => {
    if (completed.current) return;
    if (!hasProgress && !session) {
      clearDraft(scope);
      return;
    }
    const { password: _password, confirmPassword: _confirm, termsAccepted: _terms, ...safe } = values;
    saveDraft(scope, { values: safe, step, reached, session, emailProof, payment });
  }, [scope, values, step, reached, session, emailProof, payment, hasProgress]);

  // The consent letter is stored against the registration, whose id comes from /student/me
  const resolveRegistrationId = async (current: RegistrationSession) => {
    setRegistrationError("");
    try {
      const { registrationId } = await authApi.getStudentDetails(current.response.token);
      if (!registrationId) throw new Error("Your registration could not be found. Please try again.");
      setSession({ ...current, registrationId });
    } catch (error) {
      setRegistrationError(error instanceof Error ? error.message : "Unable to load your registration.");
    }
  };

        const email = values.email.trim();
        const mobile = useMobileAvailability(values.mobileNo);
        const proofValid = Boolean(emailProof) && emailProof?.email === email && Date.now() - (emailProof?.verifiedAt ?? 0) < EMAIL_PROOF_MAX_MS;
        const showMobileProblem = mobile.status === "taken" || mobile.status === "invalid" || mobile.status === "error";
        const mobileOk = mobile.status === "available" || mobile.status === "error";

        const selectedUniversity = options.universities.find((item) => String(item.id) === values.universityId);
        const selectedDistrict = options.districts.find((item) => String(item.id) === values.districtId);
        const selectedCollege = options.colleges.find((item) => String(item.id) === values.collegeId);
        const selectedCourse = options.courses.find((item) => String(item.id) === values.courseId);
        const selectedBatch = options.batches.find((item) => String(item.id) === values.batchId);
        const selectedDegree = options.degrees.find((item) => item.code === values.degree);
        const selectedDepartment = options.departments.find((item) => item.code === values.department);
        const selectedSession = options.sessions.find((item) => String(item.id) === values.academicSessionId);
        const selectedSubject = options.subjects.find((item) => String(item.id) === values.majorSubjectId);
        // What is shown and stored for the department: its label, or the typed name for "Others"
        const departmentName = isOthersDepartment(values.department) ? values.departmentOther.trim() : selectedDepartment?.label ?? values.department;
        const fee = Number(selectedBatch?.fee ?? 0);
        const locked = Boolean(session);

        // The errors of the current values, computed here (not by Formik, whose validation can run on the values from just
        // before a dropdown's change), plus what the backend said about the current value
        const liveErrors = validate(values);
        // "Send verification code": first asks the backend whether the email already has an account (so the student is
        // told to sign in instead of waiting for a code that never comes), then requests the code.
        const startEmailVerification = async () => {
          if (!EMAIL_PATTERN.test(email) || emailChecking) return;
          setFieldTouched("email", true);
          setEmailTaken("");
          setEmailChecking(true);
          try {
            const result = await authApi.checkAvailability({ email });
            if (result.emailExists) {
              setEmailTaken(result.messages?.email ?? "This email is already registered. Please sign in instead. / यह ईमेल पहले से पंजीकृत है, साइन इन करें।");
              return;
            }
          } catch (error) {
            // A rejected format (400) is the user's to fix; a failed check must not block (sending the code checks again)
            if (error instanceof ApiError && error.status === 400) {
              setEmailTaken(error.message);
              return;
            }
          } finally {
            setEmailChecking(false);
          }
          setCodeEmail(email);
        };

        const setServerError = (field: Field, text: string) => {
          setFieldTouched(field, true, false);
          setServerErrors((current) => ({ ...current, [field]: { text, value: String(values[field]) } }));
        };

        // Error text under a field, once it has been touched. An empty line keeps the height, so errors do not push the form around.
        const message = (field: Field) => {
          const server = serverErrors[field];
          const error = touched[field] ? liveErrors[field] ?? (server && server.value === String(values[field]) ? server.text : undefined) : undefined;
          return (
            <small className={error ? "field-error" : "field-error field-error-placeholder"} aria-live="polite">
              {error ?? " "}
            </small>
          );
        };

        // Marks the fields as touched and reports whether they are all valid
        const stepIsValid = (index: number) => {
          const fields = STEP_FIELDS[index] ?? [];
          fields.forEach((field) => setFieldTouched(field, true));
          const next = validate(values);
          const bad = fields.filter((field) => next[field] ?? (serverErrors[field]?.value === String(values[field]) ? serverErrors[field]?.text : undefined));
          if (bad.length) {
            // The errors are already shown under their fields: take the user to the first one (no extra toast covering the form)
            window.setTimeout(() => {
              const first = bodyRef.current?.querySelector<HTMLElement>(".field-error:not(.field-error-placeholder)")?.closest<HTMLElement>(".reg-field");
              first?.scrollIntoView({ block: "center", behavior: "smooth" });
              first?.querySelector<HTMLElement>("input:not([type=hidden]), button.dropdown-trigger, [role=radio]")?.focus({ preventScroll: true });
            }, 50);
            return false;
          }
          return true;
        };

        const goTo = (next: number) => {
          setSubmitError("");
          setStep(next);
          setReached((current) => (session ? current : Math.max(current, next)));
        };

        // Reports a value the backend already has, on its own field
        const reportTaken = (flags: Array<[Field, boolean | undefined, string | undefined, string]>) => {
          let any = false;
          flags.forEach(([field, exists, serverMessage, fallback]) => {
            if (!exists) return;
            any = true;
            setServerError(field, serverMessage ?? fallback);
          });
          return any;
        };

        // Step 4 -> 5: the university registration number and roll number must be free (the roll number per college)
        const checkAcademicDuplicates = async () => {
          try {
            const result = await authApi.checkAvailability({
              registrationNumber: values.registrationNumber.trim(),
              collegeRollNumber: values.collegeRollNumber.trim(),
              collegeId: Number(values.collegeId),
            });
            if (result.available) return true;
            reportTaken([
              ["registrationNumber", result.registrationNumberExists, result.messages?.registrationNumber, "This registration number is already registered"],
              ["collegeRollNumber", result.collegeRollNumberExists, result.messages?.collegeRollNumber, "This roll number is already registered for this college"],
            ]);
            toast.error("Some details are already registered. Please correct them.");
            return false;
          } catch (error) {
            // A bad format (400) is the user's to fix; a failed check must not block registration (the register call checks again)
            if (error instanceof ApiError && error.status === 400) {
              toast.error(error.message);
              return false;
            }
            return true;
          }
        };

        // Review: creates the account with the proof from the email code. The registration id comes back
        // in the response, so the consent step needs no extra request.
        const createAccount = async () => {
          const all = validate(values);
          (Object.keys(initialValues) as Field[]).forEach((field) => setFieldTouched(field, true));
          // The first step that has a problem is where the user is taken
          const firstBad = Object.keys(STEP_FIELDS).map(Number).find((index) => STEP_FIELDS[index].some((field) => all[field]));
          if (firstBad !== undefined) {
            toast.error("Please complete every required field before registering.");
            goTo(firstBad);
            return;
          }
          if (!emailProof || !proofValid) {
            setEmailProof(null);
            setCodeEmail(null);
            toast.error("Please verify your email again to continue.");
            goTo(VERIFY);
            return;
          }

          setBusy(true);
          setSubmitError("");
          try {
            const response = await authApi.registerStudent(
              {
                fullName: values.fullName.trim(),
                email,
                emailVerificationToken: emailProof.token,
                mobileNo: values.mobileNo,
                password: values.password,
                confirmPassword: values.confirmPassword,
                collegeId: Number(values.collegeId),
                fatherName: values.fatherName.trim(),
                gender: values.gender as "MALE" | "FEMALE" | "OTHER",
                degree: values.degree,
                department: values.department,
                departmentOther: isOthersDepartment(values.department) ? values.departmentOther.trim() : null,
                semester: Number(values.semester),
                academicSessionId: Number(values.academicSessionId),
                majorSubjectId: Number(values.majorSubjectId),
                registrationNumber: values.registrationNumber.trim(),
                collegeRollNumber: values.collegeRollNumber.trim(),
                batchId: Number(values.batchId),
                termsAccepted: values.termsAccepted,
              },
              // A cyber cafe is signed in; the backend links the registration to it from this token
              mode === "cyber-cafe",
            );
            // The email token is single-use, so it is spent now
            setEmailProof(null);
            const created: RegistrationSession = { response, registrationId: response.registrationId };
            setSession(created);
            goTo(PAY);
            if (!created.registrationId) void resolveRegistrationId(created);
          } catch (error) {
            const text = error instanceof Error ? error.message : "Unable to create the account.";
            setSubmitError(text);
            toast.error(text);
            if (error instanceof ApiError) {
              // Field errors from the server go back to the step that has the field
              const fieldErrors = Object.entries(error.fieldErrors).filter(([field]) => STEP_OF_FIELD[field] !== undefined);
              fieldErrors.forEach(([field, errorText]) => setServerError(field as Field, errorText));
              if (fieldErrors.length) goTo(Math.min(...fieldErrors.map(([field]) => STEP_OF_FIELD[field] as number)));
              else if (error.fieldErrors.emailVerificationToken || /verif|otp|token/i.test(error.message)) {
                // The proof was refused (expired or already used): verify the email again
                setEmailProof(null);
                setCodeEmail(null);
                goTo(VERIFY);
              }
            }
          } finally {
            setBusy(false);
          }
        };

        // Payment: Razorpay order -> Checkout -> signature check (ENROLLED). Retries reuse what is already done.
        const completePayment = async () => {
          if (!session?.registrationId || !consentReady(consent)) return;
          const { response, registrationId } = session;
          setBusy(true);
          setSubmitError("");
          try {
            let paid = payment;
            if (!paid && fee > 0) {
              try {
                const info = describePayment({
                    fullName: values.fullName,
                    registrationNumber: values.registrationNumber,
                    collegeName: selectedCollege?.name,
                    courseName: selectedCourse?.name,
                    batchName: selectedBatch?.batchName,
                    mobileNo: values.mobileNo,
                    email,
                });
                paid = await checkoutRegistration({
                  registrationId,
                  authToken: response.token,
                  title: info.title,
                  description: info.description,
                  customer: { name: values.fullName.trim(), email, contact: values.mobileNo },
                  notes: { ...info.notes, registeredVia: mode === "cyber-cafe" ? "CYBER_CAFE" : "SELF" },
                });
                setPayment(paid);
              } catch (error) {
                if (error instanceof PaymentCancelledError) {
                  setBusy(false);
                  toast.error("Payment cancelled. Your account is saved; complete the payment to finish registration.");
                  return;
                }
                throw error;
              }
            }
            if (paid) await confirmRegistrationPayment(paid, response.token);

            // Finished: the saved draft is no longer needed
            completed.current = true;
            clearDraft(scope);
            onComplete(response, paid ? "Payment received. Your acceptance letter is ready." : "Registration completed.", {
              id: response.studentId ?? response.userId,
              fullName: values.fullName.trim(),
              fatherName: values.fatherName.trim(),
              email,
              mobileNo: values.mobileNo,
              degree: selectedDegree?.label ?? values.degree,
              department: departmentName,
              semester: Number(values.semester),
              academicSession: selectedSession?.name,
              majorSubject: selectedSubject?.name,
              registrationNumber: values.registrationNumber.trim(),
              collegeRollNumber: values.collegeRollNumber.trim(),
              universityName: selectedUniversity?.name,
              universityCode: selectedUniversity?.code,
              collegeName: selectedCollege?.name,
              collegeCode: selectedCollege?.code,
              courseName: selectedCourse?.name,
              courseCode: selectedCourse?.code,
              batchName: selectedBatch?.batchName,
              fee,
              paymentStatus: paid ? "PAID" : "NOT REQUIRED",
              paymentId: paid?.paymentId,
              registrationId,
              registrationDate: new Date().toISOString(),
            });
          } catch (error) {
            const text = error instanceof Error ? error.message : "Unable to complete registration.";
            setSubmitError(text);
            setBusy(false);
            toast.error(text);
          }
        };

        // "Save & continue": checks the step, then moves on (or does the step's work)
        const advance = async () => {
          if (busy) return;
          if (step === VERIFY) {
            setFieldTouched("mobileNo", true);
            if (!MOBILE_PATTERN.test(values.mobileNo) || mobile.status === "invalid") {
              toast.error("Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.");
              return;
            }
            if (mobile.status === "taken") {
              toast.error("This mobile number is already registered. Please sign in instead.");
              return;
            }
            if (mobile.status === "checking") {
              toast.error("Please wait while we check your mobile number.");
              return;
            }
            if (!proofValid) {
              setFieldTouched("email", true);
              toast.error(email && EMAIL_PATTERN.test(email) ? "Verify your email with the 6-digit code to continue." : "Enter your email and verify it with the 6-digit code.");
              return;
            }
            goTo(DETAILS);
            return;
          }
          if (step === REVIEW) return void createAccount();
          if (step === PAY) return void completePayment();

          if (!stepIsValid(step)) return;
          if (step === ACADEMIC) {
            setBusy(true);
            const free = await checkAcademicDuplicates();
            setBusy(false);
            if (!free) return;
          }
          goTo(step + 1);
        };

        const back = () => {
          if (busy) return;
          if (step > VERIFY && step < PAY) goTo(step - 1);
        };

        const restart = async () => {
          const ok = await confirmAction({
            title: "Start over?",
            message: "Everything you entered so far will be cleared. / अब तक भरी गई सारी जानकारी हट जाएगी।",
            confirmLabel: "Start over",
            danger: true,
          });
          if (!ok) return;
          clearDraft(scope);
          onRestart();
        };

        const backDisabled = busy || step === VERIFY || step === PAY;
        const nextLabel = step === REVIEW ? "Create account" : step === PAY ? (payment || !fee ? "Complete registration" : `Pay ${formatFee(fee)}`) : "Save & continue";
        const nextDisabled = busy || (step === PAY && (!session?.registrationId || !consentReady(consent))) || options.loading || (step <= ACADEMIC && Boolean(options.error));

        // ---- the contents of each step
        const verifyStepContent = (
          <>
            <div className="reg-field">
              <label htmlFor="reg-mobile">Mobile number / मोबाइल नंबर</label>
              <div className={`reg-input-wrap has-status is-${showMobileProblem ? mobile.status : "idle"}`}>
                <span className="reg-prefix">+91</span>
                <Input
                  id="reg-mobile"
                  name="mobileNo"
                  autoComplete="tel-national"
                  inputMode="numeric"
                  enterKeyHint="next"
                  placeholder="10-digit mobile number"
                  value={values.mobileNo}
                  // Digits only: letters and symbols are dropped as they are typed or pasted
                  onChange={(event) => setFieldValue("mobileNo", mobileDigits(event.target.value))}
                  onBlur={() => setFieldTouched("mobileNo", true)}
                  aria-invalid={mobile.status === "taken" || mobile.status === "invalid"}
                  aria-describedby="reg-mobile-hint"
                />
                <span className="reg-status-icon" aria-hidden="true">
                  {(mobile.status === "taken" || mobile.status === "invalid") && <XCircle size={18} />}
                  {mobile.status === "error" && <CircleAlert size={18} />}
                </span>
              </div>
              {/* Only a problem is shown (the number is taken or invalid); the line keeps its height so nothing moves */}
              <small id="reg-mobile-hint" className={`reg-hint is-${showMobileProblem ? mobile.status : "idle"}`} role={showMobileProblem ? "alert" : undefined} aria-live="polite">
                {showMobileProblem ? mobile.message : null}
                {mobile.status === "error" && (
                  <button type="button" className="reg-link" onClick={mobile.recheck}>
                    Try again
                  </button>
                )}
              </small>
            </div>

            <div className="reg-field">
              <label htmlFor="reg-email">Email / ईमेल</label>
              <div className={`reg-input-wrap ${proofValid ? "has-status is-available" : ""}`}>
                <Input
                  id="reg-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  enterKeyHint="send"
                  placeholder="you@email.com"
                  value={values.email}
                  readOnly={Boolean(codeEmail) || proofValid}
                  onChange={(event) => {
                    setEmailTaken("");
                    handleChange(event);
                  }}
                  onBlur={() => setFieldTouched("email", true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !codeEmail && EMAIL_PATTERN.test(email)) {
                      event.preventDefault();
                      void startEmailVerification();
                    }
                  }}
                />
                {proofValid && (
                  <span className="reg-status-icon" aria-hidden="true">
                    <CheckCircle2 size={18} />
                  </span>
                )}
              </div>
              {message("email")}
              {emailTaken && (
                <p className="reg-taken" role="alert">
                  <CircleAlert size={16} />
                  <span>{emailTaken}</span>
                  {onSignIn && (
                    <button type="button" className="reg-link" onClick={onSignIn}>
                      Sign in
                    </button>
                  )}
                </p>
              )}
              {proofValid ? (
                <p className="reg-verified" role="status">
                  <ShieldCheck size={16} /> Email verified / ईमेल सत्यापित
                  <button
                    type="button"
                    className="reg-link"
                    onClick={() => {
                      setEmailProof(null);
                      setCodeEmail(null);
                    }}
                  >
                    <Pencil size={13} /> Change
                  </button>
                </p>
              ) : codeEmail ? (
                <button
                  type="button"
                  className="reg-link reg-change"
                  onClick={() => {
                    setCodeEmail(null);
                    setEmailProof(null);
                  }}
                >
                  <Pencil size={13} /> Use a different email
                </button>
              ) : (
                <button type="button" className="button reg-send" disabled={!EMAIL_PATTERN.test(email) || emailChecking} onClick={() => void startEmailVerification()}>
                  {emailChecking ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />} Send verification code
                </button>
              )}
            </div>

            {codeEmail && !proofValid && (
              <div className="reg-otp">
                <p className="reg-otp-title">
                  Enter the 6-digit code sent to <b>{codeEmail}</b>
                  <small lang="hi">{codeEmail} पर भेजा गया 6 अंकों का कोड दर्ज करें</small>
                </p>
                <EmailOtp<EmailVerificationResult>
                  // A new key per address, so changing the email sends a fresh code
                  key={codeEmail}
                  email={codeEmail}
                  autoSend
                  api={registrationEmailApi}
                  onSendFailed={(error) => {
                    // 409 = this email got an account in the meantime: go back to the field, with the reason
                    if (error instanceof ApiError && error.status === 409) {
                      setEmailTaken(error.message);
                      setCodeEmail(null);
                    }
                  }}
                  onVerified={(result) => setEmailProof({ email: codeEmail, token: result.emailVerificationToken, verifiedAt: Date.now() })}
                />
              </div>
            )}
          </>
        );

        // A titled group of fields inside a step
        const section = (icon: ReactNode, title: string, children: ReactNode) => (
          <section className="reg-section" key={title}>
            <h4 className="reg-section-title">
              <span aria-hidden="true">{icon}</span>
              {title}
            </h4>
            <div className="reg-fields">{children}</div>
          </section>
        );

        const genderOptions = [
          { value: "MALE", label: "Male", hi: "पुरुष" },
          { value: "FEMALE", label: "Female", hi: "महिला" },
          { value: "OTHER", label: "Other", hi: "अन्य" },
        ] as const;

        const detailsStep = (
          <>
            {section(
              <UserRound size={16} />,
              "About you / आपके बारे में",
              <>
                <div className="reg-field">
                  <label htmlFor="reg-fullName">Full name / पूरा नाम</label>
                  <Input id="reg-fullName" name="fullName" autoComplete="name" value={values.fullName} onChange={handleChange} onBlur={() => setFieldTouched("fullName", true)} />
                  {message("fullName")}
                </div>
                <div className="reg-field">
                  <label htmlFor="reg-fatherName">Parent or guardian name / अभिभावक का नाम</label>
                  <Input id="reg-fatherName" name="fatherName" value={values.fatherName} onChange={handleChange} onBlur={() => setFieldTouched("fatherName", true)} />
                  {message("fatherName")}
                </div>
                <div className="reg-field is-wide">
                  <span className="reg-label" id="reg-gender-label">Gender / लिंग</span>
                  <div className="reg-segment" role="radiogroup" aria-labelledby="reg-gender-label">
                    {genderOptions.map((option) => (
                      <button
                        type="button"
                        role="radio"
                        key={option.value}
                        aria-checked={values.gender === option.value}
                        className={values.gender === option.value ? "is-selected" : ""}
                        onClick={() => {
                          setFieldValue("gender", option.value);
                          setFieldTouched("gender", true, false);
                        }}
                      >
                        {option.label}
                        <small lang="hi">{option.hi}</small>
                      </button>
                    ))}
                  </div>
                  {message("gender")}
                </div>
              </>,
            )}
            {section(
              <Building2 size={16} />,
              "College and internship / कॉलेज और इंटर्नशिप",
              <>
                <div className="reg-field">
                  <label>University / विश्वविद्यालय</label>
                  <Pick
                    ariaLabel="University"
                    value={values.universityId}
                    onValueChange={(value) => {
                      setFieldValue("universityId", value);
                      setFieldValue("collegeId", "");
                      void options.loadColleges(value, values.districtId);
                    }}
                    onBlur={() => setFieldTouched("universityId", true)}
                    disabled={options.loading || !options.universities.length}
                    options={options.universities.map((item) => ({ value: String(item.id), label: item.name }))}
                    placeholder="Select university / विश्वविद्यालय चुनें"
                  />
                  {message("universityId")}
                </div>
                <div className="reg-field">
                  <label>District / जिला</label>
                  <Pick
                    ariaLabel="District"
                    value={values.districtId}
                    onValueChange={(value) => {
                      setFieldValue("districtId", value);
                      setFieldValue("collegeId", "");
                      void options.loadColleges(values.universityId, value);
                    }}
                    onBlur={() => setFieldTouched("districtId", true)}
                    disabled={options.loading || !options.districts.length}
                    options={options.districts.map((item) => ({ value: String(item.id), label: item.name }))}
                    placeholder="Select district / जिला चुनें"
                  />
                  {message("districtId")}
                </div>
                <div className="reg-field is-wide">
                  <label>College / कॉलेज</label>
                  <Pick
                    ariaLabel="College"
                    value={values.collegeId}
                    onValueChange={(value) => setFieldValue("collegeId", value)}
                    onBlur={() => setFieldTouched("collegeId", true)}
                    disabled={!values.universityId || !values.districtId || options.collegesLoading || !options.colleges.length}
                    options={options.colleges.map((item) => ({ value: String(item.id), label: item.city ? `${item.name} · ${item.city}` : item.name }))}
                    placeholder={
                      options.collegesLoading
                        ? "Loading colleges…"
                        : !values.universityId || !values.districtId
                          ? "Select university and district first"
                          : options.colleges.length
                            ? "Select college / कॉलेज चुनें"
                            : "No colleges available"
                    }
                  />
                  {options.collegeError ? <small className="field-error">{options.collegeError}</small> : message("collegeId")}
                </div>
                <div className="reg-field">
                  <label>Internship course / इंटर्नशिप कोर्स</label>
                  <Pick
                    ariaLabel="Internship course"
                    value={values.courseId}
                    onValueChange={(value) => {
                      setFieldValue("courseId", value);
                      setFieldValue("batchId", "");
                      void options.loadBatches(value);
                    }}
                    onBlur={() => setFieldTouched("courseId", true)}
                    disabled={options.loading || !options.courses.length}
                    options={options.courses.map((item) => ({ value: String(item.id), label: item.name }))}
                    placeholder="Select course / कोर्स चुनें"
                  />
                  {message("courseId")}
                </div>
                <div className="reg-field">
                  <label>Batch / बैच</label>
                  <Pick
                    ariaLabel="Internship batch"
                    value={values.batchId}
                    onValueChange={(value) => setFieldValue("batchId", value)}
                    onBlur={() => setFieldTouched("batchId", true)}
                    disabled={!values.courseId || options.batchesLoading || !options.batches.length}
                    options={options.batches.map((item) => ({ value: String(item.id), label: `${item.batchName} · ${formatDate(item.startDate)} · ${formatFee(item.fee)}` }))}
                    placeholder={
                      options.batchesLoading
                        ? "Loading batches…"
                        : !values.courseId
                          ? "Select course first / पहले कोर्स चुनें"
                          : options.batches.length
                            ? "Select batch / बैच चुनें"
                            : "No active batches available"
                    }
                  />
                  {options.batchError ? <small className="field-error">{options.batchError}</small> : message("batchId")}
                </div>
                {selectedBatch && (
                  <div className="reg-note" role="status">
                    <span>Course fee / शुल्क</span>
                    <b>{formatFee(selectedBatch.fee)}</b>
                    <small>
                      {formatDate(selectedBatch.startDate)} – {formatDate(selectedBatch.endDate)}
                    </small>
                  </div>
                )}
              </>,
            )}
          </>
        );

        const academicStep = (
          <>
            {section(
              <GraduationCap size={16} />,
              "Degree / डिग्री",
              <>
                <div className="reg-field">
                  <label>Degree / डिग्री</label>
                  <Pick
                    ariaLabel="Degree"
                    value={values.degree}
                    onValueChange={(value) => {
                      setFieldValue("degree", value);
                      // Departments and semesters belong to one degree
                      setFieldValue("department", "");
                      setFieldValue("departmentOther", "");
                      setFieldValue("semester", "");
                      void options.loadDegreeOptions(value);
                    }}
                    onBlur={() => setFieldTouched("degree", true)}
                    disabled={options.loading || !options.degrees.length}
                    options={options.degrees.map((item) => ({ value: item.code, label: item.label }))}
                    placeholder="Select degree / डिग्री चुनें"
                  />
                  {message("degree")}
                </div>
                <div className="reg-field">
                  <label>Semester / सेमेस्टर</label>
                  <Pick
                    ariaLabel="Semester"
                    value={values.semester}
                    onValueChange={(value) => setFieldValue("semester", value)}
                    onBlur={() => setFieldTouched("semester", true)}
                    disabled={!values.degree || options.degreeLoading || !options.semesters.length}
                    options={options.semesters.map((item) => ({ value: String(item), label: `Semester ${item}` }))}
                    placeholder={!values.degree ? "Select degree first / पहले डिग्री चुनें" : "Select semester / सेमेस्टर चुनें"}
                  />
                  {message("semester")}
                </div>
                <div className="reg-field is-wide">
                  <label>Department / विभाग</label>
                  <Pick
                    ariaLabel="Department"
                    value={values.department}
                    onValueChange={(value) => {
                      setFieldValue("department", value);
                      if (!isOthersDepartment(value)) setFieldValue("departmentOther", "");
                    }}
                    onBlur={() => setFieldTouched("department", true)}
                    disabled={!values.degree || options.degreeLoading || !options.departments.length}
                    options={options.departments.map((item) => ({ value: item.code, label: item.label }))}
                    placeholder={options.degreeLoading ? "Loading departments…" : !values.degree ? "Select degree first / पहले डिग्री चुनें" : "Select department / विभाग चुनें"}
                  />
                  {options.degreeError ? <small className="field-error">{options.degreeError}</small> : message("department")}
                </div>
                {isOthersDepartment(values.department) && (
                  <div className="reg-field is-wide">
                    <label htmlFor="reg-departmentOther">Department name / विभाग का नाम</label>
                    <Input id="reg-departmentOther" name="departmentOther" value={values.departmentOther} maxLength={100} onChange={handleChange} onBlur={() => setFieldTouched("departmentOther", true)} placeholder="e.g. B.Voc" />
                    {message("departmentOther")}
                  </div>
                )}
                <div className="reg-field">
                  <label>Academic session / शैक्षणिक सत्र</label>
                  <Pick
                    ariaLabel="Academic session"
                    value={values.academicSessionId}
                    onValueChange={(value) => setFieldValue("academicSessionId", value)}
                    onBlur={() => setFieldTouched("academicSessionId", true)}
                    disabled={options.loading || !options.sessions.length}
                    options={options.sessions.map((item) => ({ value: String(item.id), label: item.name }))}
                    placeholder="Select session / सत्र चुनें"
                  />
                  {message("academicSessionId")}
                </div>
                <div className="reg-field">
                  <label>Major subject / मुख्य विषय</label>
                  <Pick
                    ariaLabel="Major subject"
                    value={values.majorSubjectId}
                    onValueChange={(value) => setFieldValue("majorSubjectId", value)}
                    onBlur={() => setFieldTouched("majorSubjectId", true)}
                    disabled={options.loading || !options.subjects.length}
                    options={options.subjects.map((item) => ({ value: String(item.id), label: item.name }))}
                    placeholder="Select major subject / विषय चुनें"
                  />
                  {message("majorSubjectId")}
                </div>
              </>,
            )}
            {section(
              <BookOpenCheck size={16} />,
              "University numbers / विश्वविद्यालय नंबर",
              <>
                <div className="reg-field">
                  <label htmlFor="reg-registrationNumber">University registration no. / पंजीकरण नंबर</label>
                  <Input
                    id="reg-registrationNumber"
                    name="registrationNumber"
                    inputMode="numeric"
                    maxLength={20}
                    value={values.registrationNumber}
                    onChange={(event) => setFieldValue("registrationNumber", digitsOnly(event.target.value))}
                    onBlur={() => setFieldTouched("registrationNumber", true)}
                  />
                  {message("registrationNumber")}
                </div>
                <div className="reg-field">
                  <label htmlFor="reg-collegeRollNumber">College roll no. / रोल नंबर</label>
                  <Input
                    id="reg-collegeRollNumber"
                    name="collegeRollNumber"
                    inputMode="numeric"
                    maxLength={20}
                    value={values.collegeRollNumber}
                    onChange={(event) => setFieldValue("collegeRollNumber", digitsOnly(event.target.value))}
                    onBlur={() => setFieldTouched("collegeRollNumber", true)}
                  />
                  {message("collegeRollNumber")}
                </div>
              </>,
            )}
          </>
        );

        // A summary row; "Edit" reopens its step (only before the account exists)
        const summary = (label: string, value: ReactNode, editStep: number) => (
          <div className="reg-summary-row" key={label}>
            <dt>{label}</dt>
            <dd>{value || "—"}</dd>
            {!locked && (
              <button type="button" className="reg-link" onClick={() => goTo(editStep)} aria-label={`Edit ${label}`}>
                <Pencil size={13} /> Edit
              </button>
            )}
          </div>
        );

        const reviewStep = (
          <>
            <dl className="reg-summary">
              {summary("Mobile", `+91 ${values.mobileNo}`, VERIFY)}
              {summary("Email", <>{email} <span className="reg-ok">verified</span></>, VERIFY)}
              {summary("Name", values.fullName, DETAILS)}
              {summary("Parent / guardian", values.fatherName, DETAILS)}
              {summary("College", selectedCollege && `${selectedCollege.name} · ${selectedUniversity?.name ?? ""} · ${selectedDistrict?.name ?? ""}`, DETAILS)}
              {summary("Course", selectedCourse && `${selectedCourse.name} · ${selectedBatch?.batchName ?? ""} · ${formatFee(selectedBatch?.fee)}`, DETAILS)}
              {summary("Degree", [selectedDegree?.label, departmentName, values.semester && `Semester ${values.semester}`].filter(Boolean).join(" · "), ACADEMIC)}
              {summary("Session / subject", [selectedSession?.name, selectedSubject?.name].filter(Boolean).join(" · "), ACADEMIC)}
              {summary("Registration / roll no.", `${values.registrationNumber} / ${values.collegeRollNumber}`, ACADEMIC)}
            </dl>
            {section(
              <ShieldCheck size={16} />,
              "Create your password / पासवर्ड बनाएँ",
              <>
                <div className="reg-field">
                  <label htmlFor="reg-password">Password / पासवर्ड</label>
                  <Input id="reg-password" name="password" type="password" autoComplete="new-password" value={values.password} onChange={handleChange} onBlur={() => setFieldTouched("password", true)} placeholder="At least 8 characters" />
                  {message("password")}
                </div>
                <div className="reg-field">
                  <label htmlFor="reg-confirmPassword">Confirm password / पुष्टि करें</label>
                  <Input id="reg-confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={handleChange} onBlur={() => setFieldTouched("confirmPassword", true)} placeholder="Re-enter your password" />
                  {message("confirmPassword")}
                </div>
                <label className="reg-terms">
                  <input type="checkbox" checked={values.termsAccepted} onChange={(event) => setFieldValue("termsAccepted", event.target.checked)} onBlur={() => setFieldTouched("termsAccepted", true)} />
                  <span>
                    I confirm the details above and accept the Terms of Service and Privacy Policy.
                    <small lang="hi">मैं ऊपर दी गई जानकारी की पुष्टि करता/करती हूँ और नियम व गोपनीयता नीति स्वीकार करता/करती हूँ।</small>
                  </span>
                </label>
                {message("termsAccepted")}
                {submitError && (
                  <p className="reg-error" role="alert">
                    {submitError}
                  </p>
                )}
              </>,
            )}
          </>
        );

        // The consent letter and the payment share one step: the letter is uploaded first, then "Pay" opens
        const payStep = (
          <>
            {section(
              <FileCheck2 size={16} />,
              "1 · Consent letter / सहमति पत्र",
              <>
                <p className="reg-lead">
                  Upload the consent letter signed by your college. Payment opens once it is uploaded.
                  <small lang="hi">कॉलेज द्वारा हस्ताक्षरित सहमति पत्र अपलोड करें। अपलोड के बाद भुगतान खुलेगा।</small>
                </p>
                {session?.registrationId ? (
                  <ConsentUpload registrationId={session.registrationId} authToken={session.response.token} onChange={setConsent} />
                ) : registrationError ? (
                  <div className="registration-status registration-status-error" role="alert">
                    <span>{registrationError}</span>
                    <button type="button" onClick={() => session && void resolveRegistrationId(session)}>
                      <RefreshCw size={14} /> Retry
                    </button>
                  </div>
                ) : (
                  <p className="registration-status" role="status">
                    <LoaderCircle className="spin" size={16} /> Loading your registration…
                  </p>
                )}
              </>,
            )}
            {section(
              <CreditCard size={16} />,
              "2 · Payment / भुगतान",
              <>
                <PaymentSummary
                  name={values.fullName.trim()}
                  registrationNumber={values.registrationNumber}
                  email={email}
                  mobile={values.mobileNo}
                  college={selectedCollege?.name}
                  course={selectedCourse?.name}
                  batch={selectedBatch?.batchName}
                  period={selectedBatch ? `${formatDate(selectedBatch.startDate)} – ${formatDate(selectedBatch.endDate)}` : undefined}
                  amount={fee}
                  paymentId={payment?.paymentId}
                />
                {!consentReady(consent) && !payment && (
                  <p className="reg-hint reg-hint-flat" role="status">
                    Upload your consent letter above to unlock payment. / भुगतान के लिए पहले सहमति पत्र अपलोड करें।
                  </p>
                )}
                {submitError && (
                  <p className="reg-error" role="alert">
                    {submitError}
                  </p>
                )}
              </>,
            )}
          </>
        );

        const bodies = [section(<ShieldCheck size={16} />, "Mobile and email / मोबाइल और ईमेल", verifyStepContent), detailsStep, academicStep, reviewStep, payStep];

        return (
          <Form
            className="reg-card"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void advance();
            }}
          >
            <header className="reg-head">
              <span className="reg-head-badge" aria-hidden="true">
                <GraduationCap size={22} />
              </span>
              <div className="reg-head-text">
                <h2>{mode === "cyber-cafe" ? "Register a student" : "Student registration"}</h2>
                <p>{mode === "cyber-cafe" ? "Fill in the student's details and collect the internship fee." : "Register for your internship in a few quick steps."}</p>
              </div>
              {headerAction}
            </header>

            <RegistrationStepper steps={STEPS} current={step} reached={reached} locked={locked} onSelect={goTo} />

            <div className="reg-body" ref={bodyRef}>
              {options.loading && (
                <div className="registration-status registration-status-loading" role="status" aria-busy="true">
                  <Skeleton height={14} width="min(22rem, 90%)" />
                  <span className="skeleton-sr">Loading universities, districts and courses…</span>
                </div>
              )}
              {options.error && step <= 3 && (
                <div className="registration-status registration-status-error" role="alert">
                  <span>{options.error}</span>
                  <button type="button" onClick={() => void options.reload()}>
                    <RefreshCw size={14} /> Retry
                  </button>
                </div>
              )}
              <div className="reg-step-head">
                <h3 className="reg-step-title">{STEPS[step].title}</h3>
                <p>{STEP_HINTS[step]}</p>
              </div>
              <div className="reg-step-panel" key={step}>
                {bodies[step]}
              </div>
            </div>

            <footer className="reg-foot">
              <span className="reg-saved" aria-live="polite">
                {hasProgress && !completed.current ? (
                  <>
                    <CheckCircle2 size={14} /> <span>Progress saved</span>
                    {!locked && (
                      <button type="button" className="reg-link" onClick={() => void restart()} disabled={busy}>
                        <RotateCcw size={12} /> Start over
                      </button>
                    )}
                  </>
                ) : null}
              </span>
              {/* Once the account exists there is nothing to go back to */}
              {step !== PAY && (
                <button type="button" className="button button-outline reg-back" onClick={back} disabled={backDisabled}>
                  <ArrowLeft size={16} /> Back
                </button>
              )}
              <button type="submit" className="button reg-next" disabled={nextDisabled}>
                {busy ? <LoaderCircle className="spin" size={16} /> : null}
                {nextLabel}
                {!busy && <ArrowRight size={16} />}
              </button>
            </footer>
          </Form>
        );
}
