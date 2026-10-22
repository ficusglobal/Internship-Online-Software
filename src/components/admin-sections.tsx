import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { adminApi, type AdminBatch, type AdminCollege, type AdminCourse, type AdminDistrict, type AdminLetter, type AdminUniversity } from "../lib/admin-api";
import { ApiError } from "../lib/auth-api";
import { toast } from "./toast";
import { Button, Input } from "./ui";

export type FieldErrors = Record<string, string>;

// Turns any thrown value into a message and the per-field errors the backend returned
export function describeError(err: unknown): { message: string; fields: FieldErrors } {
  if (err instanceof ApiError) return { message: err.message, fields: err.fieldErrors };
  return { message: err instanceof Error ? err.message : "Something went wrong. Please try again.", fields: {} };
}

export const todayIso = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

// Client-side checks that mirror the backend rules, so most mistakes are caught before a request
export function requiredErrors(values: Record<string, string>, required: string[], labels: Record<string, string>): FieldErrors {
  const errors: FieldErrors = {};
  required.forEach((key) => {
    if (!values[key]?.trim()) errors[key] = `${labels[key] ?? key} is required`;
  });
  return errors;
}

// Shared state for one form: values, per-field errors, a form-level error and a busy flag
function useAdminForm<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const change = (key: keyof T) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
    setFields((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  // Runs one save: shows errors inline and in a toast, and resets the form on success
  const save = async (validation: FieldErrors, action: () => Promise<unknown>, successMessage: string, onSuccess?: () => void) => {
    setFormError("");
    setFields(validation);
    if (Object.keys(validation).length > 0) {
      setFormError("Please correct the highlighted fields.");
      return;
    }
    setBusy(true);
    try {
      await action();
      toast.success(successMessage);
      setValues(initial);
      setFields({});
      onSuccess?.();
    } catch (err) {
      const { message, fields: serverFields } = describeError(err);
      setFields(serverFields);
      setFormError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return { values, setValues, fields, formError, busy, change, save };
}

function FieldMessage({ name, fields }: { name: string; fields: FieldErrors }) {
  return fields[name] ? <small className="admin-field-error">{fields[name]}</small> : null;
}

function FormAlert({ message }: { message: string }) {
  return message ? (
    <p className="admin-alert" role="alert">
      {message}
    </p>
  ) : null;
}

function Panel({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <section className="admin-panel">
      <header className="admin-panel-head">
        <h2>{title}</h2>
        {text && <p>{text}</p>}
      </header>
      {children}
    </section>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <p className="admin-muted" role="status">
      <LoaderCircle className="spin" size={16} /> {label}
    </p>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="admin-muted">{text}</p>;
}

// ---------------------------------------------------------------- Colleges (district-wise)

interface MasterProps {
  universities: AdminUniversity[];
  districts: AdminDistrict[];
}

export function CollegesSection({ universities, districts }: MasterProps) {
  const [universityId, setUniversityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [colleges, setColleges] = useState<AdminCollege[] | null>(null);
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const form = useAdminForm({ name: "", code: "", addressLine1: "", city: "", state: "", pincode: "" });
  const labels = { name: "College name", pincode: "Pincode" };

  const latest = useRef(0);

  useEffect(() => {
    if (!universityId || !districtId) {
      setColleges(null);
      return;
    }
    const request = ++latest.current;
    setListError("");
    setColleges(null);
    adminApi
      .colleges(Number(universityId), Number(districtId))
      .then((list) => request === latest.current && setColleges(list))
      .catch((err: unknown) => request === latest.current && setListError(describeError(err).message));
  }, [universityId, districtId, reloadKey]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const errors = requiredErrors(form.values, ["name"], labels);
    if (form.values.pincode && !/^\d{6}$/.test(form.values.pincode)) errors.pincode = "Pincode must be 6 digits";
    if (!universityId) errors.universityId = "Choose a university first";
    if (!districtId) errors.districtId = "Choose a district first";
    form.save(
      errors,
      () =>
        adminApi.createCollege({
          universityId: Number(universityId),
          districtId: Number(districtId),
          name: form.values.name.trim(),
          code: form.values.code.trim() || undefined,
          addressLine1: form.values.addressLine1.trim() || undefined,
          city: form.values.city.trim() || undefined,
          state: form.values.state.trim() || undefined,
          pincode: form.values.pincode.trim() || undefined,
        }),
      "College added.",
      () => setReloadKey((key) => key + 1),
    );
  };

  return (
    <Panel title="Colleges" text="Choose a university and a district to see its colleges, then add a new one.">
      <div className="admin-picker">
        <label>
          University
          <select className="admin-select" value={universityId} onChange={(event) => setUniversityId(event.target.value)}>
            <option value="">Select university</option>
            {universities.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>
          District
          <select className="admin-select" value={districtId} onChange={(event) => setDistrictId(event.target.value)}>
            <option value="">Select district</option>
            {districts.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      </div>

      {listError && <FormAlert message={listError} />}
      {!universityId || !districtId ? (
        <Empty text="Select a university and a district to continue." />
      ) : colleges === null && !listError ? (
        <Loading label="Loading colleges…" />
      ) : colleges && colleges.length === 0 ? (
        <Empty text="No colleges yet for this university and district." />
      ) : colleges ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>City</th>
                <th>Pincode</th>
              </tr>
            </thead>
            <tbody>
              {colleges.map((college) => (
                <tr key={college.id}>
                  <td>{college.name}</td>
                  <td>{college.code ?? "—"}</td>
                  <td>{college.city ?? "—"}</td>
                  <td>{college.pincode ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <form className="admin-form" onSubmit={submit} noValidate>
        <h3>Add a college</h3>
        <FormAlert message={form.formError} />
        <FieldMessage name="universityId" fields={form.fields} />
        <FieldMessage name="districtId" fields={form.fields} />
        <div className="admin-grid">
          <label>
            College name *
            <Input value={form.values.name} onChange={form.change("name")} />
            <FieldMessage name="name" fields={form.fields} />
          </label>
          <label>
            College code
            <Input value={form.values.code} onChange={form.change("code")} />
            <FieldMessage name="code" fields={form.fields} />
          </label>
          <label className="admin-span-2">
            Address
            <Input value={form.values.addressLine1} onChange={form.change("addressLine1")} />
            <FieldMessage name="addressLine1" fields={form.fields} />
          </label>
          <label>
            City
            <Input value={form.values.city} onChange={form.change("city")} />
          </label>
          <label>
            State
            <Input value={form.values.state} onChange={form.change("state")} />
          </label>
          <label>
            Pincode
            <Input inputMode="numeric" maxLength={6} value={form.values.pincode} onChange={form.change("pincode")} />
            <FieldMessage name="pincode" fields={form.fields} />
          </label>
        </div>
        <Button type="submit" disabled={form.busy}>
          {form.busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Add college
        </Button>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------- Courses and batches

export function CoursesSection() {
  const [courses, setCourses] = useState<AdminCourse[] | null>(null);
  const [courseError, setCourseError] = useState("");
  const [courseKey, setCourseKey] = useState(0);
  const [courseId, setCourseId] = useState("");
  const [batches, setBatches] = useState<AdminBatch[] | null>(null);
  const [batchKey, setBatchKey] = useState(0);
  const courseForm = useAdminForm({
    name: "",
    code: "",
    description: "",
    theoryDurationHours: "",
    practicalDurationHours: "",
    reportPreparationHours: "",
    totalDurationHours: "",
  });
  const batchForm = useAdminForm({ batchName: "", startDate: "", endDate: "", fee: "", maxStudents: "" });
  const courseLabels = { name: "Course name", code: "Course code" };
  const batchLabels = { batchName: "Batch name", startDate: "Start date", endDate: "End date", fee: "Fee" };

  const latestCourses = useRef(0);
  const latestBatches = useRef(0);

  useEffect(() => {
    const request = ++latestCourses.current;
    setCourseError("");
    adminApi
      .courses()
      .then((list) => request === latestCourses.current && setCourses(list))
      .catch((err: unknown) => request === latestCourses.current && setCourseError(describeError(err).message));
  }, [courseKey]);

  useEffect(() => {
    if (!courseId) {
      setBatches(null);
      return;
    }
    const request = ++latestBatches.current;
    setBatches(null);
    adminApi
      .batches(Number(courseId))
      .then((list) => request === latestBatches.current && setBatches(list))
      .catch(() => request === latestBatches.current && setBatches([]));
  }, [courseId, batchKey]);

  const hours = ["theoryDurationHours", "practicalDurationHours", "reportPreparationHours", "totalDurationHours"] as const;

  const submitCourse = (event: FormEvent) => {
    event.preventDefault();
    const errors = requiredErrors(courseForm.values, ["name", "code"], courseLabels);
    hours.forEach((key) => {
      const value = courseForm.values[key];
      if (value && (!/^\d+$/.test(value) || Number(value) < 0)) errors[key] = "Enter a whole number of hours";
    });
    courseForm.save(
      errors,
      () =>
        adminApi.createCourse({
          name: courseForm.values.name.trim(),
          code: courseForm.values.code.trim(),
          description: courseForm.values.description.trim() || undefined,
          theoryDurationHours: courseForm.values.theoryDurationHours ? Number(courseForm.values.theoryDurationHours) : undefined,
          practicalDurationHours: courseForm.values.practicalDurationHours ? Number(courseForm.values.practicalDurationHours) : undefined,
          reportPreparationHours: courseForm.values.reportPreparationHours ? Number(courseForm.values.reportPreparationHours) : undefined,
          totalDurationHours: courseForm.values.totalDurationHours ? Number(courseForm.values.totalDurationHours) : undefined,
        }),
      "Course added.",
      () => setCourseKey((key) => key + 1),
    );
  };

  const submitBatch = (event: FormEvent) => {
    event.preventDefault();
    const v = batchForm.values;
    const errors = requiredErrors(v, ["batchName", "startDate", "endDate", "fee"], batchLabels);
    if (!courseId) errors.courseId = "Choose a course first";
    if (v.startDate && v.startDate < todayIso()) errors.startDate = "Start date cannot be in the past";
    if (v.startDate && v.endDate && v.endDate < v.startDate) errors.endDate = "End date cannot be before the start date";
    if (v.fee && (Number.isNaN(Number(v.fee)) || Number(v.fee) < 0)) errors.fee = "Enter a valid fee";
    if (v.maxStudents && (!/^\d+$/.test(v.maxStudents) || Number(v.maxStudents) < 1)) errors.maxStudents = "Enter a whole number, 1 or more";
    batchForm.save(
      errors,
      () =>
        adminApi.createBatch({
          courseId: Number(courseId),
          batchName: v.batchName.trim(),
          startDate: v.startDate,
          endDate: v.endDate,
          fee: Number(v.fee),
          maxStudents: v.maxStudents ? Number(v.maxStudents) : undefined,
        }),
      "Batch added.",
      () => setBatchKey((key) => key + 1),
    );
  };

  return (
    <>
      <Panel
        title="Courses"
        text="Courses are shared by all universities. Batches belong to a course."
      >
        {courseError && <FormAlert message={courseError} />}
        {courses === null && !courseError ? (
          <Loading label="Loading courses…" />
        ) : courses && courses.length === 0 ? (
          <Empty text="No courses yet." />
        ) : courses ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Total hours</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id}>
                    <td>{course.name}</td>
                    <td>{course.code}</td>
                    <td>{course.totalDurationHours ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <form className="admin-form" onSubmit={submitCourse} noValidate>
          <h3>Add a course</h3>
          <FormAlert message={courseForm.formError} />
          <div className="admin-grid">
            <label>
              Course name *
              <Input value={courseForm.values.name} onChange={courseForm.change("name")} />
              <FieldMessage name="name" fields={courseForm.fields} />
            </label>
            <label>
              Course code *
              <Input value={courseForm.values.code} onChange={courseForm.change("code")} />
              <FieldMessage name="code" fields={courseForm.fields} />
            </label>
            <label className="admin-span-2">
              Description
              <Input value={courseForm.values.description} onChange={courseForm.change("description")} />
            </label>
            <label>
              Theory hours
              <Input inputMode="numeric" value={courseForm.values.theoryDurationHours} onChange={courseForm.change("theoryDurationHours")} />
              <FieldMessage name="theoryDurationHours" fields={courseForm.fields} />
            </label>
            <label>
              Practical hours
              <Input inputMode="numeric" value={courseForm.values.practicalDurationHours} onChange={courseForm.change("practicalDurationHours")} />
              <FieldMessage name="practicalDurationHours" fields={courseForm.fields} />
            </label>
            <label>
              Report preparation hours
              <Input inputMode="numeric" value={courseForm.values.reportPreparationHours} onChange={courseForm.change("reportPreparationHours")} />
              <FieldMessage name="reportPreparationHours" fields={courseForm.fields} />
            </label>
            <label>
              Total hours
              <Input inputMode="numeric" value={courseForm.values.totalDurationHours} onChange={courseForm.change("totalDurationHours")} />
              <FieldMessage name="totalDurationHours" fields={courseForm.fields} />
            </label>
          </div>
          <Button type="submit" disabled={courseForm.busy}>
            {courseForm.busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Add course
          </Button>
        </form>
      </Panel>

      <Panel title="Batches" text="Choose a course to see its batches and add a new one.">
        <label className="admin-inline-label">
          Course
          <select className="admin-select" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">Select course</option>
            {(courses ?? []).map((course) => (
              <option key={course.id} value={course.id}>{course.name}</option>
            ))}
          </select>
        </label>

        {!courseId ? (
          <Empty text="Select a course to see its batches." />
        ) : batches === null ? (
          <Loading label="Loading batches…" />
        ) : batches.length === 0 ? (
          <Empty text="No batches for this course yet." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Fee</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>{batch.batchName}</td>
                    <td>{batch.startDate ?? "—"}</td>
                    <td>{batch.endDate ?? "—"}</td>
                    <td>₹{batch.fee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form className="admin-form" onSubmit={submitBatch} noValidate>
          <h3>Add a batch</h3>
          <FormAlert message={batchForm.formError} />
          <FieldMessage name="courseId" fields={batchForm.fields} />
          <div className="admin-grid">
            <label>
              Batch name *
              <Input value={batchForm.values.batchName} onChange={batchForm.change("batchName")} />
              <FieldMessage name="batchName" fields={batchForm.fields} />
            </label>
            <label>
              Fee (₹) *
              <Input inputMode="decimal" value={batchForm.values.fee} onChange={batchForm.change("fee")} />
              <FieldMessage name="fee" fields={batchForm.fields} />
            </label>
            <label>
              Start date *
              <Input type="date" min={todayIso()} value={batchForm.values.startDate} onChange={batchForm.change("startDate")} />
              <FieldMessage name="startDate" fields={batchForm.fields} />
            </label>
            <label>
              End date *
              <Input type="date" min={batchForm.values.startDate || undefined} value={batchForm.values.endDate} onChange={batchForm.change("endDate")} />
              <FieldMessage name="endDate" fields={batchForm.fields} />
            </label>
            <label>
              Maximum students
              <Input inputMode="numeric" value={batchForm.values.maxStudents} onChange={batchForm.change("maxStudents")} />
              <FieldMessage name="maxStudents" fields={batchForm.fields} />
            </label>
          </div>
          <Button type="submit" disabled={batchForm.busy || !courseId}>
            {batchForm.busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Add batch
          </Button>
        </form>
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------- Universities and districts

export function MastersSection({ universities, districts, onChanged }: MasterProps & { onChanged: () => void }) {
  const uniForm = useAdminForm({ name: "", code: "" });
  const districtForm = useAdminForm({ name: "" });

  const submitUniversity = (event: FormEvent) => {
    event.preventDefault();
    uniForm.save(
      requiredErrors(uniForm.values, ["name", "code"], { name: "University name", code: "University code" }),
      () => adminApi.createUniversity({ name: uniForm.values.name.trim(), code: uniForm.values.code.trim() }),
      "University added.",
      onChanged,
    );
  };

  const submitDistrict = (event: FormEvent) => {
    event.preventDefault();
    districtForm.save(
      requiredErrors(districtForm.values, ["name"], { name: "District name" }),
      () => adminApi.createDistrict({ name: districtForm.values.name.trim() }),
      "District added.",
      onChanged,
    );
  };

  return (
    <Panel title="Universities and districts" text="Colleges are added under a university and a district, so add those first.">
      <div className="admin-two-col">
        <div>
          <h3>Universities ({universities.length})</h3>
          <ul className="admin-list">
            {universities.map((item) => (
              <li key={item.id}>
                {item.name} <small>{item.code}</small>
              </li>
            ))}
          </ul>
          <form className="admin-form" onSubmit={submitUniversity} noValidate>
            <FormAlert message={uniForm.formError} />
            <div className="admin-grid">
              <label>
                University name *
                <Input value={uniForm.values.name} onChange={uniForm.change("name")} />
                <FieldMessage name="name" fields={uniForm.fields} />
              </label>
              <label>
                University code *
                <Input value={uniForm.values.code} onChange={uniForm.change("code")} />
                <FieldMessage name="code" fields={uniForm.fields} />
              </label>
            </div>
            <Button type="submit" disabled={uniForm.busy}>
              {uniForm.busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Add university
            </Button>
          </form>
        </div>
        <div>
          <h3>Districts ({districts.length})</h3>
          <ul className="admin-list">
            {districts.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
          <form className="admin-form" onSubmit={submitDistrict} noValidate>
            <FormAlert message={districtForm.formError} />
            <label>
              District name *
              <Input value={districtForm.values.name} onChange={districtForm.change("name")} />
              <FieldMessage name="name" fields={districtForm.fields} />
            </label>
            <Button type="submit" disabled={districtForm.busy}>
              {districtForm.busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Add district
            </Button>
          </form>
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- Acceptance letters (search)

export function LettersSection() {
  const filters = useAdminForm({ collegeCode: "", academicSession: "" });
  const [letters, setLetters] = useState<AdminLetter[] | null>(null);
  const [error, setError] = useState("");

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    setError("");
    setLetters(null);
    try {
      setLetters(await adminApi.letters({ collegeCode: filters.values.collegeCode.trim(), academicSession: filters.values.academicSession.trim() }));
    } catch (err) {
      setError(describeError(err).message);
    }
  };

  useEffect(() => {
    void search();
    // Load everything on first open; later searches use the button
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Panel title="Acceptance letters" text="Search issued letters by college code and session.">
      <form className="admin-picker" onSubmit={search}>
        <label>
          College code
          <Input value={filters.values.collegeCode} onChange={filters.change("collegeCode")} placeholder="e.g. DBKN" />
        </label>
        <label>
          Academic session
          <Input value={filters.values.academicSession} onChange={filters.change("academicSession")} placeholder="e.g. 2023-2027" />
        </label>
        <Button type="submit" className="button-outline">Search</Button>
      </form>
      {error && <FormAlert message={error} />}
      {letters === null && !error ? (
        <Loading label="Searching letters…" />
      ) : letters && letters.length === 0 ? (
        <Empty text="No letters match this search." />
      ) : letters ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Letter no.</th>
                <th>Student</th>
                <th>College</th>
                <th>Session</th>
                <th>Issued</th>
              </tr>
            </thead>
            <tbody>
              {letters.map((letter) => (
                <tr key={letter.letterNumber}>
                  <td>{letter.letterNumber}</td>
                  <td>{letter.studentName ?? "—"}</td>
                  <td>{letter.collegeName ?? "—"}</td>
                  <td>{letter.academicSession ?? "—"}</td>
                  <td>{letter.generatedAt ? new Date(letter.generatedAt).toLocaleDateString("en-IN") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Panel>
  );
}

// ---------------------------------------------------------------- Administrators

export function AdministratorsSection() {
  const form = useAdminForm({ fullName: "", email: "", mobileNo: "", password: "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const errors = requiredErrors(form.values, ["fullName", "email", "mobileNo", "password"], {
      fullName: "Full name",
      email: "Email",
      mobileNo: "Mobile number",
      password: "Password",
    });
    if (form.values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.values.email)) errors.email = "Enter a valid email";
    if (form.values.mobileNo && !/^\d{10}$/.test(form.values.mobileNo)) errors.mobileNo = "Enter a 10-digit mobile number";
    if (form.values.password && form.values.password.length < 8) errors.password = "Use at least 8 characters";
    form.save(
      errors,
      () =>
        adminApi.createAdministrator({
          fullName: form.values.fullName.trim(),
          email: form.values.email.trim(),
          mobileNo: form.values.mobileNo.trim(),
          password: form.values.password,
        }),
      "University administrator created.",
    );
  };

  return (
    <Panel title="Create university administrator" text="Creates a login for a university administrator. Your own session is not changed.">
      <form className="admin-form" onSubmit={submit} noValidate>
        <FormAlert message={form.formError} />
        <div className="admin-grid">
          <label>
            Full name *
            <Input value={form.values.fullName} onChange={form.change("fullName")} />
            <FieldMessage name="fullName" fields={form.fields} />
          </label>
          <label>
            Email *
            <Input type="email" value={form.values.email} onChange={form.change("email")} />
            <FieldMessage name="email" fields={form.fields} />
          </label>
          <label>
            Mobile number *
            <Input inputMode="numeric" maxLength={10} value={form.values.mobileNo} onChange={form.change("mobileNo")} />
            <FieldMessage name="mobileNo" fields={form.fields} />
          </label>
          <label>
            Temporary password *
            <Input type="password" value={form.values.password} onChange={form.change("password")} />
            <FieldMessage name="password" fields={form.fields} />
          </label>
        </div>
        <Button type="submit" disabled={form.busy}>
          {form.busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Create administrator
        </Button>
      </form>
    </Panel>
  );
}
