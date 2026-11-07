import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { Form, Formik } from "formik";
import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  authApi,
  masterDataApi,
  registrationEmailApi,
  type AuthResponse,
  type ConsentSummary,
  type EmailVerificationResult,
  type InternshipBatch,
  type InternshipCourse,
  type MasterAcademicSession,
  type MasterCollege,
  type MasterDegree,
  type MasterDepartment,
  type MasterDistrict,
  type MasterMajorSubject,
  type MasterUniversity,
  type StudentDetails,
} from "../../lib/auth-api";
import { consentReady } from "../../lib/consent";
import { PaymentCancelledError } from "../../lib/payment";
import {
  checkoutRegistration,
  confirmRegistrationPayment,
  type ConfirmedPayment,
} from "../../lib/registration-payment";
import { DropdownSelector } from "../../shared/components/dropdown-selector";
import { toast } from "../../shared/components/toast";
import { Button, Input } from "../../shared/components/ui";
import { ConsentUpload } from "../consent/consent-upload";
import { EmailOtp } from "./email-otp";

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

const requiredFields: Array<keyof RegistrationValues> = [
  "fullName",
  "fatherName",
  "mobileNo",
  "gender",
  "universityId",
  "districtId",
  "collegeId",
  "degree",
  "department",
  "semester",
  "academicSessionId",
  "majorSubjectId",
  "registrationNumber",
  "collegeRollNumber",
  "courseId",
  "batchId",
  "email",
  "password",
  "confirmPassword",
];

const academicFields: Array<keyof RegistrationValues> = [
  "fullName",
  "fatherName",
  "mobileNo",
  "gender",
  "universityId",
  "districtId",
  "collegeId",
  "degree",
  "department",
  "departmentOther",
  "semester",
  "academicSessionId",
  "majorSubjectId",
  "registrationNumber",
  "collegeRollNumber",
];

const internshipFields: Array<keyof RegistrationValues> = [
  "courseId",
  "batchId",
  "email",
  "password",
  "confirmPassword",
];

const NUMBER_PATTERN = /^\d{1,20}$/;
// The email proof from /auth/register/email/verify-otp lives 30 minutes; refresh a little early
const EMAIL_PROOF_MAX_MS = 29 * 60 * 1000;

// Department codes ending in _OTHERS ("UG_OTHERS", "PG_OTHERS") need a typed department name
const isOthersDepartment = (code: string) => code.endsWith("_OTHERS");

const validate = (values: RegistrationValues) => {
  const errors: Partial<Record<keyof RegistrationValues, string>> = {};

  requiredFields.forEach((field) => {
    const value = values[field];
    if (typeof value === "string" && !value.trim()) {
      errors[field] = "Required / आवश्यक है";
    }
  });

  if (values.mobileNo && !/^\d{10}$/.test(values.mobileNo)) {
    errors.mobileNo =
      "Enter a valid 10-digit mobile number / 10 अंकों का नंबर दर्ज करें";
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Enter a valid email address";
  }
  if (values.password && values.password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }
  if (values.confirmPassword && values.confirmPassword !== values.password) {
    errors.confirmPassword = "Passwords do not match";
  }
  if (isOthersDepartment(values.department) && !values.departmentOther.trim()) {
    errors.departmentOther = "Enter your department name / अपने विभाग का नाम लिखें";
  }
  // Same rules as the backend: digits only, at most 20 (registration number and roll number)
  if (values.registrationNumber.trim() && !NUMBER_PATTERN.test(values.registrationNumber.trim())) {
    errors.registrationNumber = "Digits only, up to 20 / केवल अंक, अधिकतम 20";
  }
  if (values.collegeRollNumber.trim() && !NUMBER_PATTERN.test(values.collegeRollNumber.trim())) {
    errors.collegeRollNumber = "Digits only, up to 20 / केवल अंक, अधिकतम 20";
  }
  if (!values.termsAccepted) {
    errors.termsAccepted = "You must accept the terms to register";
  }

  return errors;
};

// Keeps only the 10 digits of a mobile number. A pasted "+91" country prefix is dropped first,
// so "+91 98765-43210" becomes "9876543210" instead of "9198765432".
const mobileDigits = (raw: string) => raw.trim().replace(/^\+91/, "").replace(/\D/g, "").slice(0, 10);

const STEP_LABELS = ["Details", "Internship", "Verify email", "Review", "Consent", "Payment"];

// The step that holds each field, so a server-side field error can take the user back to it
const STEP_OF_FIELD: Partial<Record<string, 1 | 2>> = {
  fullName: 1,
  fatherName: 1,
  mobileNo: 1,
  gender: 1,
  collegeId: 1,
  degree: 1,
  department: 1,
  departmentOther: 1,
  semester: 1,
  academicSessionId: 1,
  majorSubjectId: 1,
  registrationNumber: 1,
  collegeRollNumber: 1,
  batchId: 2,
  email: 2,
  password: 2,
  confirmPassword: 2,
};

// A proof that this email was verified before the account exists
interface EmailProof {
  email: string;
  token: string;
  verifiedAt: number;
}

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);

const formatDate = (value?: string) => {
  if (!value) return "Date not specified";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
};

const formatFee = (fee?: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(fee ?? 0));

// The account created in step 3 (before payment) and its registration id
interface RegistrationSession {
  response: AuthResponse;
  registrationId?: string;
}

interface StudentRegistrationFormProps {
  // "cyber-cafe" registers on behalf of a student while the cafe stays signed in.
  mode?: "self" | "cyber-cafe";
  onComplete: (
    response: AuthResponse,
    successMessage: string,
    snapshot: Partial<StudentDetails>,
  ) => void;
}

export function StudentRegistrationForm({
  mode = "self",
  onComplete,
}: StudentRegistrationFormProps) {
  // 1 details, 2 internship & password, 3 email code (before the account exists), 4 review
  // (creates the account), 5 consent letter, 6 payment. The backend opens payment only after 5.
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  // Set once the account exists, so a cancelled or failed payment does not register the email twice
  const [session, setSession] = useState<RegistrationSession | null>(null);
  // Set when the email code was entered correctly; the register request needs its token
  const [emailProof, setEmailProof] = useState<EmailProof | null>(null);
  const [degrees, setDegrees] = useState<MasterDegree[]>([]);
  const [departments, setDepartments] = useState<MasterDepartment[]>([]);
  const [semesters, setSemesters] = useState<number[]>([]);
  const [sessions, setSessions] = useState<MasterAcademicSession[]>([]);
  const [subjects, setSubjects] = useState<MasterMajorSubject[]>([]);
  const [degreeLoading, setDegreeLoading] = useState(false);
  const [degreeError, setDegreeError] = useState("");
  const degreeRequest = useRef(0);
  // Confirmed by Razorpay; kept so a failed signature check is retried without charging again
  const [payment, setPayment] = useState<ConfirmedPayment | null>(null);
  const [consent, setConsent] = useState<ConsentSummary | null>(null);
  const [registrationError, setRegistrationError] = useState("");
  const [universities, setUniversities] = useState<MasterUniversity[]>([]);
  const [districts, setDistricts] = useState<MasterDistrict[]>([]);
  const [colleges, setColleges] = useState<MasterCollege[]>([]);
  const [courses, setCourses] = useState<InternshipCourse[]>([]);
  const [batches, setBatches] = useState<InternshipBatch[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);
  const [collegesLoading, setCollegesLoading] = useState(false);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [masterError, setMasterError] = useState("");
  const [collegeError, setCollegeError] = useState("");
  const [batchError, setBatchError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const masterRequest = useRef(0);
  const collegeRequest = useRef(0);
  const batchRequest = useRef(0);

  const loadMasterData = async () => {
    const requestId = ++masterRequest.current;
    setMasterLoading(true);
    setMasterError("");
    try {
      const [nextUniversities, nextDistricts, nextCourses, nextDegrees, nextSessions, nextSubjects] =
        await Promise.all([
          masterDataApi.universities(),
          masterDataApi.districts(),
          masterDataApi.courses(),
          masterDataApi.degrees(),
          masterDataApi.academicSessions(),
          masterDataApi.majorSubjects(),
        ]);
      if (requestId !== masterRequest.current) return;
      // Copies: the cached lists are shared with other screens and must not be re-sorted in place
      setUniversities([...nextUniversities].sort((a, b) => a.name.localeCompare(b.name)));
      setDistricts([...nextDistricts].sort((a, b) => a.name.localeCompare(b.name)));
      setCourses([...nextCourses].sort((a, b) => a.name.localeCompare(b.name)));
      setDegrees(nextDegrees);
      // Newest session first
      setSessions(nextSessions.filter((item) => item.isActive !== false).sort((a, b) => b.name.localeCompare(a.name)));
      setSubjects(nextSubjects.filter((item) => item.isActive !== false).sort((a, b) => a.name.localeCompare(b.name)));
      if (
        !nextUniversities.length ||
        !nextDistricts.length ||
        !nextCourses.length ||
        !nextDegrees.length ||
        !nextSessions.length ||
        !nextSubjects.length
      ) {
        setMasterError(
          "Registration setup is incomplete. Ask an administrator to add at least one university, district, internship course, academic session and major subject, then retry.",
        );
      }
    } catch (error) {
      if (requestId !== masterRequest.current) return;
      setMasterError(
        error instanceof Error
          ? error.message
          : "Unable to load registration options.",
      );
    } finally {
      if (requestId === masterRequest.current) setMasterLoading(false);
    }
  };

  useEffect(() => {
    void loadMasterData();
  }, []);

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

  // Departments and semesters depend on the degree (UG: 1-8, PG: 1-4)
  const loadDegreeOptions = async (degree: string) => {
    const requestId = ++degreeRequest.current;
    setDepartments([]);
    setSemesters([]);
    setDegreeError("");
    if (!degree) return;

    setDegreeLoading(true);
    try {
      const [nextDepartments, nextSemesters] = await Promise.all([
        masterDataApi.departments(degree),
        masterDataApi.semesters(degree),
      ]);
      if (requestId !== degreeRequest.current) return;
      setDepartments(nextDepartments);
      setSemesters(nextSemesters);
    } catch (error) {
      if (requestId !== degreeRequest.current) return;
      setDegreeError(error instanceof Error ? error.message : "Unable to load departments and semesters.");
    } finally {
      if (requestId === degreeRequest.current) setDegreeLoading(false);
    }
  };

  const loadColleges = async (universityId: string, districtId: string) => {
    const requestId = ++collegeRequest.current;
    setColleges([]);
    setCollegeError("");
    if (!universityId || !districtId) return;

    setCollegesLoading(true);
    try {
      const nextColleges = await masterDataApi.colleges(
        Number(universityId),
        Number(districtId),
      );
      if (requestId !== collegeRequest.current) return;
      setColleges(nextColleges.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      if (requestId !== collegeRequest.current) return;
      setCollegeError(
        error instanceof Error ? error.message : "Unable to load colleges.",
      );
    } finally {
      if (requestId === collegeRequest.current) setCollegesLoading(false);
    }
  };

  const loadBatches = async (courseId: string) => {
    const requestId = ++batchRequest.current;
    setBatches([]);
    setBatchError("");
    if (!courseId) return;

    setBatchesLoading(true);
    try {
      const nextBatches = await masterDataApi.batches(Number(courseId));
      if (requestId !== batchRequest.current) return;
      setBatches(nextBatches);
    } catch (error) {
      if (requestId !== batchRequest.current) return;
      setBatchError(
        error instanceof Error ? error.message : "Unable to load batches.",
      );
    } finally {
      if (requestId === batchRequest.current) setBatchesLoading(false);
    }
  };

  return (
    <Formik
      initialValues={initialValues}
      validate={validate}
      onSubmit={() => undefined}
    >
      {({
        errors,
        handleChange,
        isSubmitting,
        setFieldError,
        setFieldTouched,
        setFieldValue,
        setSubmitting,
        touched,
        values,
      }) => {
        const selectedUniversity = universities.find(
          (item) => String(item.id) === values.universityId,
        );
        const selectedDistrict = districts.find(
          (item) => String(item.id) === values.districtId,
        );
        const selectedCollege = colleges.find(
          (item) => String(item.id) === values.collegeId,
        );
        const selectedCourse = courses.find(
          (item) => String(item.id) === values.courseId,
        );
        const selectedBatch = batches.find(
          (item) => String(item.id) === values.batchId,
        );
        const selectedDegree = degrees.find((item) => item.code === values.degree);
        const selectedDepartment = departments.find((item) => item.code === values.department);
        const selectedSession = sessions.find((item) => String(item.id) === values.academicSessionId);
        const selectedSubject = subjects.find((item) => String(item.id) === values.majorSubjectId);
        // What is shown and stored for the department: its label, or the typed name for "Others"
        const departmentName = isOthersDepartment(values.department)
          ? values.departmentOther.trim()
          : selectedDepartment?.label ?? values.department;
        const emailProofValid =
          Boolean(emailProof) &&
          emailProof?.email === values.email.trim() &&
          Date.now() - (emailProof?.verifiedAt ?? 0) < EMAIL_PROOF_MAX_MS;

        const message = (field: keyof RegistrationValues) => {
          const error = touched[field] ? errors[field] : undefined;
          return (
            <small
              className={
                error ? "field-error" : "field-error field-error-placeholder"
              }
              aria-live="polite"
            >
              {error ?? " "}
            </small>
          );
        };

        // Validates the step's fields, then asks the backend whether the values are already taken
        // (GET /auth/register/check) so a duplicate is reported now instead of after verifying the email.
        // If the check itself cannot be done the user continues; the register request checks again.
        const continueTo = async (
          fields: Array<keyof RegistrationValues>,
          nextStep: 2 | 3,
        ) => {
          fields.forEach((field) => setFieldTouched(field, true));
          const nextErrors = validate(values);
          if (fields.some((field) => nextErrors[field])) {
            toast.error("Please correct the highlighted fields before continuing.");
            return;
          }
          setSubmitError("");

          setSubmitting(true);
          try {
            const result =
              nextStep === 2
                ? await authApi.checkAvailability({
                    mobileNo: values.mobileNo,
                    registrationNumber: values.registrationNumber.trim(),
                    collegeRollNumber: values.collegeRollNumber.trim(),
                    collegeId: Number(values.collegeId),
                  })
                : await authApi.checkAvailability({ email: values.email.trim() });
            if (!result.available) {
              const taken: Array<[keyof RegistrationValues, boolean | undefined, string]> = [
                ["mobileNo", result.mobileNoExists, "This mobile number is already registered"],
                ["registrationNumber", result.registrationNumberExists, "This registration number is already registered"],
                ["collegeRollNumber", result.collegeRollNumberExists, "This roll number is already registered for this college"],
                ["email", result.emailExists, "This email is already registered. Sign in instead"],
              ];
              taken.forEach(([field, exists, fallback]) => {
                if (!exists) return;
                setFieldTouched(field, true, false);
                setFieldError(field, result.messages?.[field] ?? fallback);
              });
              toast.error("Some details are already registered. Please correct them.");
              return;
            }
          } catch (error) {
            // Bad format (400) is the user's to fix; anything else must not block registration
            if (error instanceof ApiError && error.status === 400) {
              toast.error(error.message);
              return;
            }
          } finally {
            setSubmitting(false);
          }
          setStep(nextStep);
        };

        // Step 4 -> 5: creates the account with the proof from the email code. The registration id comes back
        // in the response, so the consent step needs no extra request.
        const createAccount = async () => {
          const nextErrors = validate(values);
          (Object.keys(initialValues) as Array<keyof RegistrationValues>).forEach(
            (field) => setFieldTouched(field, true),
          );
          if (Object.keys(nextErrors).length > 0) {
            toast.error("Please complete every required field before registering.");
            return;
          }
          if (!emailProof || !emailProofValid) {
            setEmailProof(null);
            setStep(3);
            toast.error("Please verify your email again to continue.");
            return;
          }

          setSubmitting(true);
          setSubmitError("");
          try {
            const response = await authApi.registerStudent(
              {
                fullName: values.fullName.trim(),
                email: values.email.trim(),
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
            setStep(5);
            if (!created.registrationId) void resolveRegistrationId(created);
          } catch (error) {
            const messageText = error instanceof Error ? error.message : "Unable to create the account.";
            setSubmitError(messageText);
            toast.error(messageText);
            if (error instanceof ApiError) {
              // Field errors from the server go back to the step that has the field
              const fieldErrors = Object.entries(error.fieldErrors).filter(([field]) => STEP_OF_FIELD[field]);
              fieldErrors.forEach(([field, text]) => setFieldError(field, text));
              const firstStep = fieldErrors.length ? Math.min(...fieldErrors.map(([field]) => STEP_OF_FIELD[field] ?? 2)) : 0;
              if (firstStep) setStep(firstStep as 1 | 2);
              else if (error.fieldErrors.emailVerificationToken || /verif|otp|token/i.test(error.message)) {
                // The proof was refused (expired or already used): verify the email again
                setEmailProof(null);
                setStep(3);
              }
            }
          } finally {
            setSubmitting(false);
          }
        };

        // Step 6: Razorpay order -> Checkout -> signature check (ENROLLED). Retries reuse what is already done.
        const completePayment = async () => {
          if (!session?.registrationId || !consentReady(consent)) return;
          const { response, registrationId } = session;
          const fee = Number(selectedBatch?.fee ?? 0);
          setSubmitting(true);
          setSubmitError("");
          try {
            let paid = payment;
            if (!paid && fee > 0) {
              try {
                paid = await checkoutRegistration({
                  registrationId,
                  authToken: response.token,
                  description: `${selectedCourse?.name ?? "Internship"} · ${selectedBatch?.batchName ?? ""}`,
                  customer: {
                    name: values.fullName.trim(),
                    email: values.email.trim(),
                    contact: values.mobileNo,
                  },
                  notes: {
                    registrationNumber: values.registrationNumber.trim(),
                    batchId: values.batchId,
                    registeredVia: mode === "cyber-cafe" ? "CYBER_CAFE" : "SELF",
                  },
                });
                setPayment(paid);
              } catch (error) {
                if (error instanceof PaymentCancelledError) {
                  setSubmitting(false);
                  toast.error("Payment cancelled. Your account is saved; complete the payment to finish registration.");
                  return;
                }
                throw error;
              }
            }

            if (paid) {
              await confirmRegistrationPayment(paid, response.token);
            }

            onComplete(response, paid ? "Payment received. Your acceptance letter is ready." : "Registration completed.", {
              id: response.userId,
              fullName: values.fullName.trim(),
              fatherName: values.fatherName.trim(),
              email: values.email.trim(),
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
            const messageText = error instanceof Error ? error.message : "Unable to complete registration.";
            setSubmitError(messageText);
            setSubmitting(false);
            toast.error(messageText);
          }
        };

        return (
          <Form className="auth-form registration-form">
            <div className="registration-progress">
              {STEP_LABELS.map((label, index) => {
                const n = index + 1;
                const state = step === n ? "active" : step > n ? "complete" : "";
                return (
                  <div className="registration-step" key={label}>
                    <span className={state}>{n}</span>
                    <small className={state}>{label}</small>
                  </div>
                );
              })}
              <b>
                Step {step} of {STEP_LABELS.length} / चरण {step} का {STEP_LABELS.length}
              </b>
            </div>

            {masterLoading && (
              <div className="registration-status" role="status">
                <LoaderCircle className="spin" size={16} />
                Loading universities, districts, and courses…
              </div>
            )}
            {masterError && (
              <div className="registration-status registration-status-error" role="alert">
                <span>{masterError}</span>
                <button type="button" onClick={() => void loadMasterData()}>
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            )}

            {step === 1 && (
              <>
                <p className="registration-step-copy">
                  Personal and academic details / व्यक्तिगत और शैक्षणिक जानकारी
                </p>
                <label>
                  Full name / पूरा नाम
                  <Input
                    name="fullName"
                    autoComplete="name"
                    value={values.fullName}
                    onChange={handleChange}
                    onBlur={() => setFieldTouched("fullName", true)}
                  />
                  {message("fullName")}
                </label>
                <label>
                  Parent or guardian name / माता-पिता या अभिभावक का नाम
                  <Input
                    name="fatherName"
                    value={values.fatherName}
                    onChange={handleChange}
                    onBlur={() => setFieldTouched("fatherName", true)}
                  />
                  {message("fatherName")}
                </label>
                <label>
                  Mobile number / मोबाइल नंबर
                  <Input
                    name="mobileNo"
                    autoComplete="tel"
                    inputMode="numeric"
                    value={values.mobileNo}
                    // Digits only: letters and symbols are dropped as they are typed or pasted.
                    // No maxLength: it would cut a pasted "+91 98765-43210" before the +91 is removed;
                    // mobileDigits already caps the value at 10 digits.
                    onChange={(event) => setFieldValue("mobileNo", mobileDigits(event.target.value))}
                    onBlur={() => setFieldTouched("mobileNo", true)}
                  />
                  {message("mobileNo")}
                </label>
                <label>
                  Gender / लिंग
                  <DropdownSelector
                    ariaLabel="Gender"
                    value={values.gender}
                    onValueChange={(value) => setFieldValue("gender", value)}
                    onBlur={() => setFieldTouched("gender", true)}
                    options={[
                      { value: "MALE", label: "Male / पुरुष" },
                      { value: "FEMALE", label: "Female / महिला" },
                      { value: "OTHER", label: "Other / अन्य" },
                    ]}
                    placeholder="Select gender / लिंग चुनें"
                  />
                  {message("gender")}
                </label>
                <label>
                  Degree / डिग्री
                  <DropdownSelector
                    ariaLabel="Degree"
                    value={values.degree}
                    onValueChange={(value) => {
                      setFieldValue("degree", value);
                      // Departments and semesters belong to one degree
                      setFieldValue("department", "");
                      setFieldValue("departmentOther", "");
                      setFieldValue("semester", "");
                      void loadDegreeOptions(value);
                    }}
                    onBlur={() => setFieldTouched("degree", true)}
                    disabled={masterLoading || !degrees.length}
                    options={degrees.map((item) => ({ value: item.code, label: item.label }))}
                    placeholder="Select degree / डिग्री चुनें"
                  />
                  {message("degree")}
                </label>
                <label>
                  Department / विभाग
                  <DropdownSelector
                    ariaLabel="Department"
                    value={values.department}
                    onValueChange={(value) => {
                      setFieldValue("department", value);
                      if (!isOthersDepartment(value)) setFieldValue("departmentOther", "");
                    }}
                    onBlur={() => setFieldTouched("department", true)}
                    disabled={!values.degree || degreeLoading || !departments.length}
                    options={departments.map((item) => ({ value: item.code, label: item.label }))}
                    placeholder={
                      degreeLoading
                        ? "Loading departments…"
                        : !values.degree
                          ? "Select degree first / पहले डिग्री चुनें"
                          : "Select department / विभाग चुनें"
                    }
                  />
                  {degreeError ? <small className="field-error">{degreeError}</small> : message("department")}
                </label>
                {isOthersDepartment(values.department) && (
                  <label>
                    Department name / विभाग का नाम
                    <Input
                      name="departmentOther"
                      value={values.departmentOther}
                      maxLength={100}
                      onChange={handleChange}
                      onBlur={() => setFieldTouched("departmentOther", true)}
                      placeholder="e.g. B.Voc"
                    />
                    {message("departmentOther")}
                  </label>
                )}
                <label>
                  Semester / सेमेस्टर
                  <DropdownSelector
                    ariaLabel="Semester"
                    value={values.semester}
                    onValueChange={(value) => setFieldValue("semester", value)}
                    onBlur={() => setFieldTouched("semester", true)}
                    disabled={!values.degree || degreeLoading || !semesters.length}
                    options={semesters.map((item) => ({ value: String(item), label: `Semester ${item}` }))}
                    placeholder={
                      !values.degree ? "Select degree first / पहले डिग्री चुनें" : "Select semester / सेमेस्टर चुनें"
                    }
                  />
                  {message("semester")}
                </label>
                <label>
                  Academic session / शैक्षणिक सत्र
                  <DropdownSelector
                    ariaLabel="Academic session"
                    value={values.academicSessionId}
                    onValueChange={(value) => setFieldValue("academicSessionId", value)}
                    onBlur={() => setFieldTouched("academicSessionId", true)}
                    disabled={masterLoading || !sessions.length}
                    options={sessions.map((item) => ({ value: String(item.id), label: item.name }))}
                    placeholder="Select session / सत्र चुनें"
                  />
                  {message("academicSessionId")}
                </label>
                <label>
                  Major subject / मुख्य विषय
                  <DropdownSelector
                    ariaLabel="Major subject"
                    value={values.majorSubjectId}
                    onValueChange={(value) => setFieldValue("majorSubjectId", value)}
                    onBlur={() => setFieldTouched("majorSubjectId", true)}
                    disabled={masterLoading || !subjects.length}
                    options={subjects.map((item) => ({ value: String(item.id), label: item.name }))}
                    placeholder="Select major subject / विषय चुनें"
                  />
                  {message("majorSubjectId")}
                </label>
                <label>
                  University / विश्वविद्यालय
                  <DropdownSelector
                    ariaLabel="University"
                    value={values.universityId}
                    onValueChange={(value) => {
                      setFieldValue("universityId", value);
                      setFieldValue("collegeId", "");
                      void loadColleges(value, values.districtId);
                    }}
                    onBlur={() => setFieldTouched("universityId", true)}
                    disabled={masterLoading || !universities.length}
                    options={universities.map((item) => ({
                      value: String(item.id),
                      label: item.name,
                    }))}
                    placeholder="Select university / विश्वविद्यालय चुनें"
                  />
                  {message("universityId")}
                </label>
                <label>
                  District / जिला
                  <DropdownSelector
                    ariaLabel="District"
                    value={values.districtId}
                    onValueChange={(value) => {
                      setFieldValue("districtId", value);
                      setFieldValue("collegeId", "");
                      void loadColleges(values.universityId, value);
                    }}
                    onBlur={() => setFieldTouched("districtId", true)}
                    disabled={masterLoading || !districts.length}
                    options={districts.map((item) => ({
                      value: String(item.id),
                      label: item.name,
                    }))}
                    placeholder="Select district / जिला चुनें"
                  />
                  {message("districtId")}
                </label>
                <label>
                  College / कॉलेज
                  <DropdownSelector
                    ariaLabel="College"
                    value={values.collegeId}
                    onValueChange={(value) => setFieldValue("collegeId", value)}
                    onBlur={() => setFieldTouched("collegeId", true)}
                    disabled={
                      !values.universityId ||
                      !values.districtId ||
                      collegesLoading ||
                      !colleges.length
                    }
                    options={colleges.map((item) => ({
                      value: String(item.id),
                      label: item.city ? `${item.name} · ${item.city}` : item.name,
                    }))}
                    placeholder={
                      collegesLoading
                        ? "Loading colleges…"
                        : !values.universityId || !values.districtId
                          ? "Select university and district first"
                          : colleges.length
                            ? "Select college / कॉलेज चुनें"
                            : "No colleges available"
                    }
                  />
                  {collegeError ? (
                    <small className="field-error">{collegeError}</small>
                  ) : (
                    message("collegeId")
                  )}
                </label>
                <label>
                  University registration number / विश्वविद्यालय पंजीकरण नंबर
                  <Input
                    name="registrationNumber"
                    inputMode="numeric"
                    maxLength={20}
                    value={values.registrationNumber}
                    onChange={(event) => setFieldValue("registrationNumber", event.target.value.replace(/\D/g, "").slice(0, 20))}
                    onBlur={() => setFieldTouched("registrationNumber", true)}
                  />
                  {message("registrationNumber")}
                </label>
                <label>
                  College roll number / कॉलेज रोल नंबर
                  <Input
                    name="collegeRollNumber"
                    inputMode="numeric"
                    maxLength={20}
                    value={values.collegeRollNumber}
                    onChange={(event) => setFieldValue("collegeRollNumber", event.target.value.replace(/\D/g, "").slice(0, 20))}
                    onBlur={() => setFieldTouched("collegeRollNumber", true)}
                  />
                  {message("collegeRollNumber")}
                </label>
                <Button
                  type="button"
                  disabled={masterLoading || Boolean(masterError) || isSubmitting}
                  onClick={() => void continueTo(academicFields, 2)}
                >
                  Continue / आगे बढ़ें <ArrowRight size={16} />
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <p className="registration-step-copy">
                  Internship and account details / इंटर्नशिप और अकाउंट की जानकारी
                </p>
                <label>
                  Internship course / इंटर्नशिप कोर्स
                  <DropdownSelector
                    ariaLabel="Internship course"
                    value={values.courseId}
                    onValueChange={(value) => {
                      setFieldValue("courseId", value);
                      setFieldValue("batchId", "");
                      void loadBatches(value);
                    }}
                    onBlur={() => setFieldTouched("courseId", true)}
                    disabled={masterLoading || !courses.length}
                    options={courses.map((item) => ({
                      value: String(item.id),
                      label: item.name,
                    }))}
                    placeholder="Select course / कोर्स चुनें"
                  />
                  {message("courseId")}
                </label>
                <label>
                  Batch / बैच
                  <DropdownSelector
                    ariaLabel="Internship batch"
                    value={values.batchId}
                    onValueChange={(value) => setFieldValue("batchId", value)}
                    onBlur={() => setFieldTouched("batchId", true)}
                    disabled={!values.courseId || batchesLoading || !batches.length}
                    options={batches.map((item) => ({
                      value: String(item.id),
                      label: `${item.batchName} · ${formatDate(item.startDate)} · ${formatFee(item.fee)}`,
                    }))}
                    placeholder={
                      batchesLoading
                        ? "Loading batches…"
                        : !values.courseId
                          ? "Select course first / पहले कोर्स चुनें"
                          : batches.length
                            ? "Select batch / बैच चुनें"
                            : "No active batches available"
                    }
                  />
                  {batchError ? (
                    <small className="field-error">{batchError}</small>
                  ) : (
                    message("batchId")
                  )}
                </label>
                <label>
                  Email / ईमेल
                  <Input
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={values.email}
                    onChange={handleChange}
                    onBlur={() => setFieldTouched("email", true)}
                    placeholder="you@email.com"
                    readOnly={Boolean(session)}
                  />
                  {message("email")}
                </label>
                <label>
                  Password / पासवर्ड
                  <Input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={values.password}
                    onChange={handleChange}
                    onBlur={() => setFieldTouched("password", true)}
                    minLength={8}
                    placeholder="At least 8 characters"
                  />
                  {message("password")}
                </label>
                <label>
                  Confirm password / पासवर्ड की पुष्टि करें
                  <Input
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={values.confirmPassword}
                    onChange={handleChange}
                    onBlur={() => setFieldTouched("confirmPassword", true)}
                    minLength={8}
                    placeholder="Re-enter your password"
                  />
                  {message("confirmPassword")}
                </label>
                <div className="registration-actions">
                  <Button
                    type="button"
                    className="button-outline"
                    onClick={() => setStep(1)}
                  >
                    Back / वापस
                  </Button>
                  <Button type="button" disabled={isSubmitting} onClick={() => void continueTo(internshipFields, 3)}>
                    Verify email <ArrowRight size={16} />
                  </Button>
                </div>
              </>
            )}

            {step === 3 && (
              <div className="registration-verify">
                <p className="registration-step-copy">
                  Verify your email / अपना ईमेल सत्यापित करें
                </p>
                {emailProofValid ? (
                  <>
                    <p className="registration-status" role="status">
                      <CheckCircle2 size={16} /> <b>{values.email.trim()}</b> is verified.
                    </p>
                    <div className="registration-actions">
                      <Button type="button" className="button-outline" onClick={() => setStep(2)}>
                        Back / वापस
                      </Button>
                      <Button type="button" onClick={() => setStep(4)}>
                        Review registration <ArrowRight size={16} />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="registration-status" role="status">
                      We emailed a 6-digit code to <b>{values.email.trim()}</b>. Enter it to continue. Your
                      account is created after the review step.
                      <small lang="hi">आपके ईमेल पर 6 अंकों का कोड भेजा गया है। जारी रखने के लिए उसे दर्ज करें।</small>
                    </p>
                    <EmailOtp<EmailVerificationResult>
                      // A new key per address, so changing the email sends a fresh code
                      key={values.email.trim()}
                      email={values.email.trim()}
                      autoSend
                      api={registrationEmailApi}
                      onVerified={(result) => {
                        setEmailProof({ email: values.email.trim(), token: result.emailVerificationToken, verifiedAt: Date.now() });
                        setStep(4);
                      }}
                    />
                    <div className="registration-actions">
                      <Button type="button" className="button-outline" onClick={() => setStep(2)}>
                        Change email / ईमेल बदलें
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="registration-review">
                <p className="registration-step-copy">
                  Review and confirm / समीक्षा और पुष्टि
                </p>
                <div className="review-grid">
                  <section>
                    <span>Student</span>
                    <b>{values.fullName}</b>
                    <small>{values.email} · {values.mobileNo}</small>
                  </section>
                  <section>
                    <span>College</span>
                    <b>{selectedCollege?.name}</b>
                    <small>{selectedUniversity?.name} · {selectedDistrict?.name}</small>
                  </section>
                  <section>
                    <span>Course</span>
                    <b>{selectedCourse?.name}</b>
                    <small>
                      {selectedDegree?.label ?? values.degree} · {departmentName} · Semester {values.semester}
                    </small>
                    <small>{selectedSession?.name} · {selectedSubject?.name}</small>
                  </section>
                  <section>
                    <span>Batch</span>
                    <b>{selectedBatch?.batchName}</b>
                    <small>
                      {formatDate(selectedBatch?.startDate)} to {formatDate(selectedBatch?.endDate)}
                    </small>
                  </section>
                </div>
                <div className="review-fee">
                  <span>Course fee</span>
                  <b>{formatFee(selectedBatch?.fee)}</b>
                </div>
                <label className="terms-checkbox">
                  <input
                    type="checkbox"
                    checked={values.termsAccepted}
                    onChange={(event) =>
                      setFieldValue("termsAccepted", event.target.checked)
                    }
                    onBlur={() => setFieldTouched("termsAccepted", true)}
                  />
                  <span>
                    I confirm the details above and accept the Terms of Service and Privacy Policy.
                    <small lang="hi">मैं ऊपर दी गई जानकारी की पुष्टि करता/करती हूँ और नियम व गोपनीयता नीति स्वीकार करता/करती हूँ।</small>
                  </span>
                </label>
                {message("termsAccepted")}
                {submitError && (
                  <p className="registration-submit-error" role="alert">
                    {submitError}
                  </p>
                )}
                <div className="registration-actions">
                  <Button
                    type="button"
                    className="button-outline"
                    disabled={isSubmitting || Boolean(session)}
                    onClick={() => setStep(3)}
                  >
                    Back / वापस
                  </Button>
                  <Button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void createAccount()}
                  >
                    {isSubmitting && <LoaderCircle className="spin" size={16} />}
                    Create account <ArrowRight size={16} />
                  </Button>
                </div>
              </div>
            )}

            {step === 5 && session && (
              <div className="registration-consent">
                <p className="registration-step-copy">
                  Upload the consent letter / सहमति पत्र अपलोड करें
                </p>
                <p className="registration-status consent-intro">
                  Upload the consent letter signed by your college. Payment opens once it is uploaded.
                  <small lang="hi">कॉलेज द्वारा हस्ताक्षरित सहमति पत्र अपलोड करें। अपलोड के बाद भुगतान खुलेगा।</small>
                </p>
                {session.registrationId ? (
                  <ConsentUpload
                    registrationId={session.registrationId}
                    authToken={session.response.token}
                    onChange={setConsent}
                  />
                ) : registrationError ? (
                  <div className="registration-status registration-status-error" role="alert">
                    <span>{registrationError}</span>
                    <button type="button" onClick={() => void resolveRegistrationId(session)}>
                      <RefreshCw size={14} /> Retry
                    </button>
                  </div>
                ) : (
                  <p className="registration-status" role="status">
                    <LoaderCircle className="spin" size={16} /> Loading your registration…
                  </p>
                )}
                <div className="registration-actions">
                  <Button type="button" disabled={!consentReady(consent)} onClick={() => setStep(6)}>
                    Continue to payment / भुगतान पर जाएँ <ArrowRight size={16} />
                  </Button>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="registration-payment">
                <p className="registration-step-copy">
                  Payment / भुगतान
                </p>
                <div className="payment-summary">
                  <div className="payment-row">
                    <span>Course</span>
                    <b>{selectedCourse?.name}</b>
                  </div>
                  <div className="payment-row">
                    <span>Batch</span>
                    <b>{selectedBatch?.batchName}</b>
                  </div>
                  <div className="payment-row">
                    <span>Student</span>
                    <b>{values.fullName}</b>
                  </div>
                  <div className="payment-row payment-total">
                    <span>Total Amount</span>
                    <b>{formatFee(selectedBatch?.fee)}</b>
                  </div>
                </div>
                {payment && (
                  <p className="registration-status" role="status">
                    <CheckCircle2 size={16} /> Payment received · {payment.paymentId}
                  </p>
                )}
                {submitError && (
                  <p className="registration-submit-error" role="alert">
                    {submitError}
                  </p>
                )}
                <p className="payment-method-title">
                  Secure payment via Razorpay (UPI, cards, net banking) / सुरक्षित भुगतान
                </p>
                <div className="registration-actions">
                  <Button
                    type="button"
                    className="button-outline"
                    disabled={isSubmitting || Boolean(payment)}
                    onClick={() => setStep(5)}
                  >
                    Back / वापस
                  </Button>
                  <Button
                    type="button"
                    disabled={isSubmitting || !session?.registrationId || !consentReady(consent)}
                    onClick={() => void completePayment()}
                  >
                    {isSubmitting ? (
                      <>
                        <LoaderCircle className="spin" size={16} /> Processing…
                      </>
                    ) : payment || !Number(selectedBatch?.fee) ? (
                      <>
                        Complete registration <CheckCircle2 size={16} />
                      </>
                    ) : (
                      <>
                        Pay {formatFee(selectedBatch?.fee)} &amp; complete <ArrowRight size={16} />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Form>
        );
      }}
    </Formik>
  );
}
