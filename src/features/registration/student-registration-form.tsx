import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { Form, Formik } from "formik";
import { useEffect, useRef, useState } from "react";
import {
  authApi,
  masterDataApi,
  emailVerificationApi,
  type AuthResponse,
  type InternshipBatch,
  type InternshipCourse,
  type MasterCollege,
  type MasterDistrict,
  type MasterUniversity,
  type StudentDetails,
} from "../../lib/auth-api";
import { PaymentCancelledError } from "../../lib/payment";
import {
  checkoutRegistration,
  confirmRegistrationPayment,
  type ConfirmedPayment,
} from "../../lib/registration-payment";
import { DropdownSelector } from "../../shared/components/dropdown-selector";
import { toast } from "../../shared/components/toast";
import { Button, Input } from "../../shared/components/ui";
import "../../styles/email-verification.css";

interface RegistrationValues {
  fullName: string;
  fatherName: string;
  mobileNo: string;
  gender: "" | "MALE" | "FEMALE" | "OTHER";
  universityId: string;
  districtId: string;
  collegeId: string;
  degree: string;
  department: string;
  // Start and end dates of the academic session (YYYY-MM-DD); sent as academicSession "YYYY-YYYY"
  sessionStart: string;
  sessionEnd: string;
  majorSubject: string;
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
  sessionStart: "",
  sessionEnd: "",
  majorSubject: "",
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
  "sessionStart",
  "sessionEnd",
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
  "sessionStart",
  "sessionEnd",
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
  if (values.sessionStart && values.sessionEnd && values.sessionEnd <= values.sessionStart) {
    errors.sessionEnd = "End date must be after the start date";
  }
  if (!values.termsAccepted) {
    errors.termsAccepted = "You must accept the terms to register";
  }

  return errors;
};

// Keeps only the 10 digits of a mobile number. A pasted "+91" country prefix is dropped first,
// so "+91 98765-43210" becomes "9876543210" instead of "9198765432".
const mobileDigits = (raw: string) => raw.trim().replace(/^\+91/, "").replace(/\D/g, "").slice(0, 10);

const RESEND_SECONDS = 60;

const STEP_LABELS = ["Details", "Internship", "Review", "Verify email", "Payment"];

// "2023-06-01" + "2027-05-31" -> "2023-2027" (the academicSession sent to the backend)
const academicSessionOf = (values: Pick<RegistrationValues, "sessionStart" | "sessionEnd">) =>
  `${values.sessionStart.slice(0, 4)}-${values.sessionEnd.slice(0, 4)}`;

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

// The account created in step 4 (before payment) and its registration id
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
  // 1 details, 2 internship & password, 3 review (creates the account), 4 email code, 5 payment
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  // Set once the account exists, so a cancelled or failed payment does not register the email twice
  const [session, setSession] = useState<RegistrationSession | null>(null);
  // Confirmed by Razorpay; kept so a failed signature check is retried without charging again
  const [payment, setPayment] = useState<ConfirmedPayment | null>(null);
  // Email verification after the account is created (step 4)
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState<"" | "sending" | "verifying">("");
  const [otpError, setOtpError] = useState("");
  const [resendIn, setResendIn] = useState(0);
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
      const [nextUniversities, nextDistricts, nextCourses] =
        await Promise.all([
          masterDataApi.universities(),
          masterDataApi.districts(),
          masterDataApi.courses(),
        ]);
      if (requestId !== masterRequest.current) return;
      setUniversities(nextUniversities.sort((a, b) => a.name.localeCompare(b.name)));
      setDistricts(nextDistricts.sort((a, b) => a.name.localeCompare(b.name)));
      setCourses(nextCourses.sort((a, b) => a.name.localeCompare(b.name)));
      if (
        !nextUniversities.length ||
        !nextDistricts.length ||
        !nextCourses.length
      ) {
        setMasterError(
          "Registration setup is incomplete. Ask an administrator to add at least one university, district, and internship course, then retry.",
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

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

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

        const continueTo = (
          fields: Array<keyof RegistrationValues>,
          nextStep: 2 | 3 | 4,
        ) => {
          fields.forEach((field) => setFieldTouched(field, true));
          const nextErrors = validate(values);
          if (fields.some((field) => nextErrors[field])) {
            toast.error("Please correct the highlighted fields before continuing.");
            return;
          }
          setSubmitError("");
          setStep(nextStep);
        };

        const sendEmailCode = async () => {
          if (!session) return;
          setOtpBusy("sending");
          setOtpError("");
          try {
            const result = await emailVerificationApi.sendCode(session.response.email);
            setOtpCode("");
            setResendIn(RESEND_SECONDS);
            toast.success(result.message);
          } catch (error) {
            const messageText = error instanceof Error ? error.message : "Unable to send the code.";
            setOtpError(messageText);
            toast.error(messageText);
          } finally {
            setOtpBusy("");
          }
        };

        const submitEmailCode = async () => {
          if (!session) return;
          if (!/^\d{6}$/.test(otpCode)) {
            setOtpError("Enter the 6-digit code from your email.");
            return;
          }
          setOtpBusy("verifying");
          setOtpError("");
          try {
            await emailVerificationApi.verifyCode(session.response.email, otpCode);
            toast.success("Email verified successfully.");
            setStep(5);
          } catch (error) {
            const messageText = error instanceof Error ? error.message : "Unable to verify the code.";
            setOtpError(messageText);
            toast.error(messageText);
          } finally {
            setOtpBusy("");
          }
        };

        // Step 3 -> 4: creates the account. The backend emails a verification code to it.
        const createAccount = async () => {
          const nextErrors = validate(values);
          (Object.keys(initialValues) as Array<keyof RegistrationValues>).forEach(
            (field) => setFieldTouched(field, true),
          );
          if (Object.keys(nextErrors).length > 0) {
            toast.error("Please complete every required field before registering.");
            return;
          }

          setSubmitting(true);
          setSubmitError("");
          try {
            const response = await authApi.registerStudent(
              {
                fullName: values.fullName.trim(),
                fatherName: values.fatherName.trim(),
                mobileNo: values.mobileNo,
                gender: values.gender as "MALE" | "FEMALE" | "OTHER",
                collegeId: Number(values.collegeId),
                degree: values.degree.trim(),
                department: values.department.trim(),
                academicSession: academicSessionOf(values),
                majorSubject: values.majorSubject.trim(),
                registrationNumber: values.registrationNumber.trim(),
                collegeRollNumber: values.collegeRollNumber.trim(),
                batchId: Number(values.batchId),
                email: values.email.trim(),
                password: values.password,
                confirmPassword: values.confirmPassword,
                termsAccepted: values.termsAccepted,
                registeredVia: mode === "cyber-cafe" ? "CYBER_CAFE" : "SELF",
              },
              // A cyber cafe is signed in; the backend links the registration to it from this token
              mode === "cyber-cafe",
            );
            setSession({ response });
            setOtpCode("");
            setOtpError("");
            setResendIn(RESEND_SECONDS);
            setStep(4);
          } catch (error) {
            const messageText = error instanceof Error ? error.message : "Unable to create the account.";
            setSubmitError(messageText);
            toast.error(messageText);
          } finally {
            setSubmitting(false);
          }
        };

        // Step 5: Razorpay order -> Checkout -> signature check (ENROLLED). Retries reuse what is already done.
        const completePayment = async () => {
          if (!session) return;
          const { response } = session;
          const fee = Number(selectedBatch?.fee ?? 0);
          setSubmitting(true);
          setSubmitError("");
          try {
            let registrationId = session.registrationId;
            if (!registrationId) {
              registrationId = (await authApi.getStudentDetails(response.token)).registrationId;
              if (!registrationId) {
                throw new Error("Your registration could not be found. Please try again.");
              }
              setSession({ response, registrationId });
            }

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
              degree: values.degree.trim(),
              department: values.department.trim(),
              academicSession: academicSessionOf(values),
              majorSubject: values.majorSubject.trim(),
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
                Step {step} of 5 / चरण {step} का 5
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
                    maxLength={10}
                    value={values.mobileNo}
                    // Digits only: letters and symbols are dropped as they are typed or pasted
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
                  <Input
                    name="degree"
                    value={values.degree}
                    onChange={handleChange}
                    onBlur={() => setFieldTouched("degree", true)}
                    placeholder="e.g. B.Tech, BCA, B.Sc"
                  />
                  {message("degree")}
                </label>
                <label>
                  Department / विभाग
                  <Input
                    name="department"
                    value={values.department}
                    onChange={handleChange}
                    onBlur={() => setFieldTouched("department", true)}
                    placeholder="e.g. Computer Science"
                  />
                  {message("department")}
                </label>
                <fieldset className="session-range">
                  <legend>Academic session / शैक्षणिक सत्र</legend>
                  <div className="session-range-fields">
                    <label>
                      Start date / आरंभ तिथि
                      <Input
                        name="sessionStart"
                        type="date"
                        value={values.sessionStart}
                        max={values.sessionEnd || undefined}
                        onChange={handleChange}
                        onBlur={() => setFieldTouched("sessionStart", true)}
                      />
                      {message("sessionStart")}
                    </label>
                    <label>
                      End date / समाप्ति तिथि
                      <Input
                        name="sessionEnd"
                        type="date"
                        value={values.sessionEnd}
                        min={values.sessionStart || undefined}
                        onChange={handleChange}
                        onBlur={() => setFieldTouched("sessionEnd", true)}
                      />
                      {message("sessionEnd")}
                    </label>
                  </div>
                </fieldset>
                <label>
                  Major subject / मुख्य विषय <span className="optional-label">Optional</span>
                  <Input
                    name="majorSubject"
                    value={values.majorSubject}
                    onChange={handleChange}
                    placeholder="e.g. Data Science"
                  />
                  <small className="field-error field-error-placeholder"> </small>
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
                    value={values.registrationNumber}
                    onChange={handleChange}
                    onBlur={() => setFieldTouched("registrationNumber", true)}
                  />
                  {message("registrationNumber")}
                </label>
                <label>
                  College roll number / कॉलेज रोल नंबर
                  <Input
                    name="collegeRollNumber"
                    value={values.collegeRollNumber}
                    onChange={handleChange}
                    onBlur={() => setFieldTouched("collegeRollNumber", true)}
                  />
                  {message("collegeRollNumber")}
                </label>
                <Button
                  type="button"
                  disabled={masterLoading || Boolean(masterError)}
                  onClick={() => continueTo(academicFields, 2)}
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
                  <Button type="button" onClick={() => continueTo(internshipFields, 3)}>
                    Review registration <ArrowRight size={16} />
                  </Button>
                </div>
              </>
            )}

            {step === 3 && (
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
                    <small>{values.degree} · {values.department}</small>
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
                    onClick={() => setStep(2)}
                  >
                    Back / वापस
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void createAccount()}
                  >
                    Create account &amp; verify email <ArrowRight size={16} />
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="registration-verify">
                <p className="registration-step-copy">
                  Verify your email / अपना ईमेल सत्यापित करें
                </p>
                <p className="registration-status" role="status">
                  <CheckCircle2 size={16} /> Your account is created. Enter the 6-digit code sent to{" "}
                  <b>{session?.response.email}</b>. Payment opens after verification.
                </p>
                <div className="email-otp-box">
                  <div className="email-verify-row">
                    <Input
                      name="emailOtp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="6-digit code / 6 अंकों का कोड"
                      aria-label="Email verification code"
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                    <Button
                      type="button"
                      disabled={otpBusy !== "" || otpCode.length !== 6}
                      onClick={() => void submitEmailCode()}
                    >
                      {otpBusy === "verifying" && <LoaderCircle className="spin" size={16} />}
                      Verify OTP / OTP सत्यापित करें
                    </Button>
                  </div>
                  {otpError && <small className="field-error">{otpError}</small>}
                </div>
                <div className="registration-actions">
                  <Button
                    type="button"
                    className="button-outline"
                    disabled={otpBusy !== "" || resendIn > 0}
                    onClick={() => void sendEmailCode()}
                  >
                    {otpBusy === "sending" && <LoaderCircle className="spin" size={16} />}
                    {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code / कोड फिर से भेजें"}
                  </Button>
                </div>
              </div>
            )}

            {step === 5 && (
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
                    disabled={isSubmitting}
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
