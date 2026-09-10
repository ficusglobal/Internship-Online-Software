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
  type AuthResponse,
  type InternshipBatch,
  type InternshipCourse,
  type MasterCollege,
  type MasterDistrict,
  type MasterUniversity,
} from "../../lib/auth-api";
import { DropdownSelector } from "../dropdown-selector";
import { toast } from "../toast";
import { Button, Input } from "../ui";

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
  academicSession: string;
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
  academicSession: "",
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
  "academicSession",
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
  "academicSession",
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
  if (!values.termsAccepted) {
    errors.termsAccepted = "You must accept the terms to register";
  }

  return errors;
};

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

interface StudentRegistrationFormProps {
  onComplete: (response: AuthResponse, successMessage?: string) => void;
}

export function StudentRegistrationForm({
  onComplete,
}: StudentRegistrationFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
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
          nextStep: 2 | 3,
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

        const registerStudent = async () => {
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
            const response = await authApi.registerStudent({
              fullName: values.fullName.trim(),
              fatherName: values.fatherName.trim(),
              mobileNo: values.mobileNo,
              gender: values.gender as "MALE" | "FEMALE" | "OTHER",
              collegeId: Number(values.collegeId),
              degree: values.degree.trim(),
              department: values.department.trim(),
              academicSession: values.academicSession.trim(),
              majorSubject: values.majorSubject.trim(),
              registrationNumber: values.registrationNumber.trim(),
              collegeRollNumber: values.collegeRollNumber.trim(),
              batchId: Number(values.batchId),
              email: values.email.trim(),
              password: values.password,
              confirmPassword: values.confirmPassword,
              termsAccepted: values.termsAccepted,
            });
            onComplete(response, "Student registration completed successfully.");
          } catch (error) {
            const messageText =
              error instanceof Error
                ? error.message
                : "Unable to register student.";
            setSubmitError(messageText);
            setSubmitting(false);
            toast.error(messageText);
          }
        };

        return (
          <Form className="auth-form registration-form">
            <div className="registration-progress">
              <span className={step === 1 ? "active" : "complete"}>1</span>
              <i />
              <span
                className={step === 2 ? "active" : step === 3 ? "complete" : ""}
              >
                2
              </span>
              <i />
              <span className={step === 3 ? "active" : ""}>3</span>
              <b>
                Step {step} of 3 / चरण {step} का 3
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
                    onChange={handleChange}
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
                <label>
                  Academic session / शैक्षणिक सत्र
                  <Input
                    name="academicSession"
                    value={values.academicSession}
                    onChange={handleChange}
                    onBlur={() => setFieldTouched("academicSession", true)}
                    placeholder="e.g. 2025-2026"
                  />
                  {message("academicSession")}
                </label>
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
                  <Button
                    type="button"
                    onClick={() => continueTo(internshipFields, 3)}
                  >
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
                    disabled={isSubmitting}
                    onClick={() => setStep(2)}
                  >
                    Back / वापस
                  </Button>
                  <Button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void registerStudent()}
                  >
                    {isSubmitting ? (
                      <>
                        <LoaderCircle className="spin" size={16} /> Registering…
                      </>
                    ) : (
                      <>
                        Complete registration <CheckCircle2 size={16} />
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
