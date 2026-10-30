import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, LoaderCircle, Plus } from "lucide-react";
import {
  adminApi,
  type AdminBatch,
  type AdminCollege,
  type AdminCourse,
  type AdminDistrict,
  type AdminLetter,
  type AdminUniversity,
} from "../../lib/admin-api";
import { DropdownSelector } from "../../shared/components/dropdown-selector";
import { Button, Input } from "../../shared/components/ui";
import {
  ActiveBadge,
  byName,
  describeError,
  Empty,
  FieldMessage,
  FormAlert,
  FormButtons,
  Loading,
  optionalNumber,
  optionsOf,
  Panel,
  requiredErrors,
  RowActions,
  todayIso,
  useAdminForm,
  useRowAction,
} from "./admin-ui";

export { describeError } from "./admin-ui";

const scrollToForm = (form: HTMLFormElement | null) => form?.scrollIntoView({ behavior: "smooth", block: "start" });

// The college code is printed in the letter number FG/<code>/<session>/<serial>; the backend
// refuses to issue a letter for a code longer than 30 characters.
const COLLEGE_CODE_MAX = 30;

// ---------------------------------------------------------------- Colleges (district-wise)

interface MasterProps {
  universities: AdminUniversity[];
  districts: AdminDistrict[];
}

const emptyCollege = { universityId: "", districtId: "", name: "", code: "", addressLine1: "", city: "", state: "", pincode: "" };

export function CollegesSection({ universities, districts }: MasterProps) {
  const [universityId, setUniversityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [colleges, setColleges] = useState<AdminCollege[] | null>(null);
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const form = useAdminForm(emptyCollege);
  const rows = useRowAction();
  const formRef = useRef<HTMLFormElement>(null);
  const labels = { name: "College name", universityId: "University", districtId: "District" };

  const latest = useRef(0);

  useEffect(() => {
    const request = ++latest.current;
    setListError("");
    setColleges(null);
    adminApi
      .colleges({ universityId: optionalNumber(universityId), districtId: optionalNumber(districtId) })
      .then((list) => request === latest.current && setColleges(byName(list)))
      .catch((err: unknown) => request === latest.current && setListError(describeError(err).message));
  }, [universityId, districtId, reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);

  const cancelEdit = () => {
    setEditingId(null);
    form.load({ ...emptyCollege, universityId, districtId });
  };

  const startEdit = (college: AdminCollege) => {
    setEditingId(college.id);
    form.load({
      universityId: String(college.university?.id ?? ""),
      districtId: String(college.district?.id ?? ""),
      name: college.name,
      code: college.code ?? "",
      addressLine1: college.addressLine1 ?? "",
      city: college.city ?? "",
      state: college.state ?? "",
      pincode: college.pincode ?? "",
    });
    scrollToForm(formRef.current);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const v = form.values;
    // The filters pre-fill the university and district of a new college
    const adding = editingId === null;
    const values = {
      ...v,
      universityId: v.universityId || (adding ? universityId : ""),
      districtId: v.districtId || (adding ? districtId : ""),
    };
    const errors = requiredErrors(values, ["name", "universityId", "districtId"], labels);
    const code = values.code.trim();
    if (code.length > COLLEGE_CODE_MAX) errors.code = `College code can be at most ${COLLEGE_CODE_MAX} characters`;
    else if (code.includes("/")) errors.code = "College code cannot contain “/” (it is part of the letter number)";
    if (values.pincode.trim() && !/^\d{6}$/.test(values.pincode.trim())) errors.pincode = "Pincode must be 6 digits";
    const body = {
      universityId: Number(values.universityId),
      districtId: Number(values.districtId),
      name: values.name.trim(),
      addressLine1: values.addressLine1.trim(),
      city: values.city.trim(),
      state: values.state.trim(),
      pincode: values.pincode.trim(),
    };
    form.save(
      errors,
      () =>
        editingId === null
          ? adminApi.college.create({
              ...body,
              code: code || undefined,
              addressLine1: body.addressLine1 || undefined,
              city: body.city || undefined,
              state: body.state || undefined,
              pincode: body.pincode || undefined,
            })
          : // Empty strings are sent so cleared fields are cleared (an empty code is stored as no code)
            adminApi.college.update(editingId, { ...body, code }),
      editingId === null ? "College added." : "College updated.",
      () => {
        setEditingId(null);
        reload();
      },
    );
  };

  const toggle = (college: AdminCollege) => {
    const active = college.active !== false;
    void rows
      .run(`c${college.id}`, () => adminApi.college.update(college.id, { active: !active }), active ? "College deactivated." : "College activated.")
      .then((ok) => ok && reload());
  };

  const remove = (college: AdminCollege) => {
    void rows
      .run(`c${college.id}`, () => adminApi.college.remove(college.id), "College deleted.", `Delete ${college.name}? This cannot be undone.`)
      .then((ok) => {
        if (!ok) return;
        if (editingId === college.id) cancelEdit();
        reload();
      });
  };

  return (
    <Panel title="Colleges" text="Filter by university and district. Inactive colleges are hidden from the registration form.">
      <div className="admin-picker">
        <label>
          University
          <DropdownSelector
            ariaLabel="University"
            value={universityId}
            onValueChange={setUniversityId}
            options={optionsOf(universities, (item) => item.name, "All universities")}
          />
        </label>
        <label>
          District
          <DropdownSelector
            ariaLabel="District"
            value={districtId}
            onValueChange={setDistrictId}
            options={optionsOf(districts, (item) => item.name, "All districts")}
          />
        </label>
      </div>

      {listError && <FormAlert message={listError} />}
      {colleges === null && !listError ? (
        <Loading label="Loading colleges…" />
      ) : colleges && colleges.length === 0 ? (
        <Empty text="No colleges match these filters." />
      ) : colleges ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>University / District</th>
                <th>City</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {colleges.map((college) => (
                <tr key={college.id}>
                  <td>{college.name}</td>
                  <td>
                    {college.code ?? <span className="admin-warning" title="Acceptance letters need a college code">No code</span>}
                  </td>
                  <td>
                    {college.university?.name ?? "—"}
                    <small className="admin-subtext">{college.district?.name ?? "—"}</small>
                  </td>
                  <td>{college.city || "—"}</td>
                  <td><ActiveBadge active={college.active} /></td>
                  <td>
                    <RowActions
                      busy={rows.busyKey === `c${college.id}`}
                      active={college.active}
                      onEdit={() => startEdit(college)}
                      onToggle={() => toggle(college)}
                      onDelete={() => remove(college)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <form ref={formRef} className="admin-form" onSubmit={submit} noValidate>
        <h3>{editingId === null ? "Add a college" : "Edit college"}</h3>
        <FormAlert message={form.formError} />
        <div className="admin-grid">
          <label>
            University *
            <DropdownSelector
              ariaLabel="University"
              value={form.values.universityId || (editingId === null ? universityId : "")}
              onValueChange={form.set("universityId")}
              options={optionsOf(universities, (item) => item.name)}
              placeholder="Select university"
            />
            <FieldMessage name="universityId" fields={form.fields} />
          </label>
          <label>
            District *
            <DropdownSelector
              ariaLabel="District"
              value={form.values.districtId || (editingId === null ? districtId : "")}
              onValueChange={form.set("districtId")}
              options={optionsOf(districts, (item) => item.name)}
              placeholder="Select district"
            />
            <FieldMessage name="districtId" fields={form.fields} />
          </label>
          <label>
            College name *
            <Input value={form.values.name} onChange={form.change("name")} />
            <FieldMessage name="name" fields={form.fields} />
          </label>
          <label>
            College code
            <Input value={form.values.code} maxLength={COLLEGE_CODE_MAX} onChange={form.change("code")} placeholder="Needed for acceptance letters" />
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
        <FormButtons busy={form.busy} editing={editingId !== null} addLabel="Add college" onCancel={cancelEdit} icon={<Plus size={16} />} />
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------- Courses and batches

const HOURS = ["theoryDurationHours", "practicalDurationHours", "reportPreparationHours", "totalDurationHours"] as const;
const emptyCourse = {
  name: "",
  code: "",
  description: "",
  theoryDurationHours: "",
  practicalDurationHours: "",
  reportPreparationHours: "",
  totalDurationHours: "",
};
const emptyBatch = { courseId: "", batchName: "", startDate: "", endDate: "", fee: "", maxStudents: "", status: "" };
// The backend creates batches as OPEN and accepts any status text on update (stored in capitals)
const BATCH_STATUSES = ["OPEN", "CLOSED"];

const hoursOf = (value?: number) => (value === undefined || value === null ? "" : String(value));

export function CoursesSection() {
  const [courses, setCourses] = useState<AdminCourse[] | null>(null);
  const [courseError, setCourseError] = useState("");
  const [courseKey, setCourseKey] = useState(0);
  const [editingCourse, setEditingCourse] = useState<number | null>(null);
  const [courseId, setCourseId] = useState("");
  const [batches, setBatches] = useState<AdminBatch[] | null>(null);
  const [batchError, setBatchError] = useState("");
  const [batchKey, setBatchKey] = useState(0);
  const [editingBatch, setEditingBatch] = useState<AdminBatch | null>(null);
  const courseForm = useAdminForm(emptyCourse);
  const batchForm = useAdminForm(emptyBatch);
  const rows = useRowAction();
  const courseFormRef = useRef<HTMLFormElement>(null);
  const batchFormRef = useRef<HTMLFormElement>(null);
  const courseLabels = { name: "Course name", code: "Course code" };
  const batchLabels = { courseId: "Course", batchName: "Batch name", startDate: "Start date", endDate: "End date", fee: "Fee" };

  const latestCourses = useRef(0);
  const latestBatches = useRef(0);

  useEffect(() => {
    const request = ++latestCourses.current;
    setCourseError("");
    adminApi
      .courses()
      .then((list) => request === latestCourses.current && setCourses(byName(list)))
      .catch((err: unknown) => request === latestCourses.current && setCourseError(describeError(err).message));
  }, [courseKey]);

  useEffect(() => {
    const request = ++latestBatches.current;
    setBatches(null);
    setBatchError("");
    adminApi
      .batches(optionalNumber(courseId))
      .then((list) => request === latestBatches.current && setBatches(list))
      .catch((err: unknown) => request === latestBatches.current && setBatchError(describeError(err).message));
  }, [courseId, batchKey]);

  const reloadCourses = () => setCourseKey((key) => key + 1);
  // A course rename shows in the batch list too
  const reloadBatches = () => setBatchKey((key) => key + 1);

  // ---- courses

  const cancelCourse = () => {
    setEditingCourse(null);
    courseForm.reset();
  };

  const startCourseEdit = (course: AdminCourse) => {
    setEditingCourse(course.id);
    const sum = (course.theoryDurationHours ?? 0) + (course.practicalDurationHours ?? 0) + (course.reportPreparationHours ?? 0);
    courseForm.load({
      name: course.name,
      code: course.code,
      description: course.description ?? "",
      theoryDurationHours: hoursOf(course.theoryDurationHours),
      practicalDurationHours: hoursOf(course.practicalDurationHours),
      reportPreparationHours: hoursOf(course.reportPreparationHours),
      // Left empty when it is just the sum, so changing a part keeps the total in step
      totalDurationHours: course.totalDurationHours === sum ? "" : hoursOf(course.totalDurationHours),
    });
    scrollToForm(courseFormRef.current);
  };

  const submitCourse = (event: FormEvent) => {
    event.preventDefault();
    const v = courseForm.values;
    const errors = requiredErrors(v, ["name", "code"], courseLabels);
    HOURS.forEach((key) => {
      if (v[key].trim() && !/^\d+$/.test(v[key].trim())) errors[key] = "Enter a whole number of hours (0 or more)";
    });
    const body = {
      name: v.name.trim(),
      code: v.code.trim(),
      description: v.description.trim(),
      theoryDurationHours: optionalNumber(v.theoryDurationHours),
      practicalDurationHours: optionalNumber(v.practicalDurationHours),
      reportPreparationHours: optionalNumber(v.reportPreparationHours),
      totalDurationHours: optionalNumber(v.totalDurationHours),
    };
    courseForm.save(
      errors,
      () =>
        editingCourse === null
          ? adminApi.course.create({ ...body, description: body.description || undefined })
          : adminApi.course.update(editingCourse, body),
      editingCourse === null ? "Course added." : "Course updated.",
      () => {
        setEditingCourse(null);
        reloadCourses();
        reloadBatches();
      },
    );
  };

  const toggleCourse = (course: AdminCourse) => {
    const active = course.isActive !== false;
    void rows
      .run(`course${course.id}`, () => adminApi.course.update(course.id, { isActive: !active }), active ? "Course deactivated." : "Course activated.")
      .then((ok) => ok && reloadCourses());
  };

  const removeCourse = (course: AdminCourse) => {
    void rows
      .run(`course${course.id}`, () => adminApi.course.remove(course.id), "Course deleted.", `Delete ${course.name}? This cannot be undone.`)
      .then((ok) => {
        if (!ok) return;
        if (editingCourse === course.id) cancelCourse();
        if (courseId === String(course.id)) setCourseId("");
        reloadCourses();
      });
  };

  // ---- batches

  const cancelBatch = () => {
    setEditingBatch(null);
    batchForm.reset();
  };

  const startBatchEdit = (batch: AdminBatch) => {
    setEditingBatch(batch);
    batchForm.load({
      courseId: String(batch.course?.id ?? ""),
      batchName: batch.batchName,
      startDate: batch.startDate?.slice(0, 10) ?? "",
      endDate: batch.endDate?.slice(0, 10) ?? "",
      fee: batch.fee !== undefined && batch.fee !== null ? String(batch.fee) : "",
      maxStudents: batch.maxStudents ? String(batch.maxStudents) : "",
      status: batch.status ?? "",
    });
    scrollToForm(batchFormRef.current);
  };

  const submitBatch = (event: FormEvent) => {
    event.preventDefault();
    const editing = editingBatch !== null;
    const v = { ...batchForm.values, courseId: batchForm.values.courseId || (editing ? "" : courseId) };
    // Dates are required for a new batch; older batches may have none, and an update leaves empty dates unchanged
    const errors = requiredErrors(v, editing ? ["courseId", "batchName", "fee"] : ["courseId", "batchName", "startDate", "endDate", "fee"], batchLabels);
    // New batches cannot start in the past; an existing batch keeps its dates
    if (!editing && v.startDate && v.startDate < todayIso()) errors.startDate = "Start date cannot be in the past";
    if (v.startDate && v.endDate && v.endDate < v.startDate) errors.endDate = "End date cannot be before the start date";
    if (v.fee.trim() && (!/^\d+(\.\d{1,2})?$/.test(v.fee.trim()) || Number(v.fee) <= 0)) errors.fee = "Enter a fee greater than 0 (up to 2 decimals)";
    if (v.maxStudents.trim() && (!/^\d+$/.test(v.maxStudents.trim()) || Number(v.maxStudents) < 1)) errors.maxStudents = "Enter a whole number, 1 or more";
    if (editing && !v.status.trim()) errors.status = "Status is required";
    const body = {
      courseId: Number(v.courseId),
      batchName: v.batchName.trim(),
      startDate: v.startDate,
      endDate: v.endDate,
      fee: Number(v.fee),
      maxStudents: optionalNumber(v.maxStudents),
    };
    batchForm.save(
      errors,
      () =>
        editingBatch === null
          ? adminApi.batch.create(body)
          : adminApi.batch.update(editingBatch.id, {
              ...body,
              startDate: body.startDate || undefined,
              endDate: body.endDate || undefined,
              status: v.status.trim().toUpperCase(),
            }),
      editing ? "Batch updated." : "Batch added.",
      () => {
        setEditingBatch(null);
        reloadBatches();
      },
    );
  };

  const toggleBatch = (batch: AdminBatch) => {
    const active = batch.isActive !== false;
    void rows
      .run(`batch${batch.id}`, () => adminApi.batch.update(batch.id, { isActive: !active }), active ? "Batch deactivated." : "Batch activated.")
      .then((ok) => ok && reloadBatches());
  };

  const removeBatch = (batch: AdminBatch) => {
    void rows
      .run(`batch${batch.id}`, () => adminApi.batch.remove(batch.id), "Batch deleted.", `Delete batch ${batch.batchName}? This cannot be undone.`)
      .then((ok) => {
        if (!ok) return;
        if (editingBatch?.id === batch.id) cancelBatch();
        reloadBatches();
      });
  };

  const statusOptions = batchForm.values.status && !BATCH_STATUSES.includes(batchForm.values.status)
    ? [...BATCH_STATUSES, batchForm.values.status]
    : BATCH_STATUSES;

  return (
    <>
      <Panel title="Courses" text="Courses are shared by all universities. Inactive courses are hidden from the registration form.">
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
                  <th>Hours (theory / practical / report)</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id}>
                    <td>{course.name}</td>
                    <td>{course.code}</td>
                    <td>
                      {course.theoryDurationHours ?? 0} / {course.practicalDurationHours ?? 0} / {course.reportPreparationHours ?? 0}
                    </td>
                    <td>{course.totalDurationHours ?? "—"}</td>
                    <td><ActiveBadge active={course.isActive} /></td>
                    <td>
                      <RowActions
                        busy={rows.busyKey === `course${course.id}`}
                        active={course.isActive}
                        onEdit={() => startCourseEdit(course)}
                        onToggle={() => toggleCourse(course)}
                        onDelete={() => removeCourse(course)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <form ref={courseFormRef} className="admin-form" onSubmit={submitCourse} noValidate>
          <h3>{editingCourse === null ? "Add a course" : "Edit course"}</h3>
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
              <Input
                inputMode="numeric"
                value={courseForm.values.totalDurationHours}
                onChange={courseForm.change("totalDurationHours")}
                placeholder="Empty = sum of the three"
              />
              <FieldMessage name="totalDurationHours" fields={courseForm.fields} />
            </label>
          </div>
          <FormButtons busy={courseForm.busy} editing={editingCourse !== null} addLabel="Add course" onCancel={cancelCourse} icon={<Plus size={16} />} />
        </form>
      </Panel>

      <Panel title="Batches" text="Each batch belongs to a course. Inactive batches cannot be chosen when registering.">
        <label className="admin-inline-label">
          Course
          <DropdownSelector
            ariaLabel="Course"
            value={courseId}
            onValueChange={setCourseId}
            options={optionsOf(courses ?? [], (course) => course.name, "All courses")}
          />
        </label>

        {batchError && <FormAlert message={batchError} />}
        {batches === null && !batchError ? (
          <Loading label="Loading batches…" />
        ) : batches && batches.length === 0 ? (
          <Empty text="No batches yet." />
        ) : batches ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Course</th>
                  <th>Start – End</th>
                  <th>Fee</th>
                  <th>Max</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>{batch.batchName}</td>
                    <td>{batch.course?.name ?? "—"}</td>
                    <td>
                      {batch.startDate ?? "—"} – {batch.endDate ?? "—"}
                    </td>
                    <td>₹{batch.fee}</td>
                    <td>{batch.maxStudents ?? "—"}</td>
                    <td>
                      <ActiveBadge active={batch.isActive} />
                      <small className="admin-subtext">{batch.status}</small>
                    </td>
                    <td>
                      <RowActions
                        busy={rows.busyKey === `batch${batch.id}`}
                        active={batch.isActive}
                        onEdit={() => startBatchEdit(batch)}
                        onToggle={() => toggleBatch(batch)}
                        onDelete={() => removeBatch(batch)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <form ref={batchFormRef} className="admin-form" onSubmit={submitBatch} noValidate>
          <h3>{editingBatch === null ? "Add a batch" : `Edit batch ${editingBatch.batchName}`}</h3>
          <FormAlert message={batchForm.formError} />
          <div className="admin-grid">
            <label>
              Course *
              <DropdownSelector
                ariaLabel="Course"
                value={batchForm.values.courseId || (editingBatch === null ? courseId : "")}
                onValueChange={batchForm.set("courseId")}
                options={optionsOf(courses ?? [], (course) => course.name)}
                placeholder="Select course"
              />
              <FieldMessage name="courseId" fields={batchForm.fields} />
            </label>
            <label>
              Batch name *
              <Input value={batchForm.values.batchName} onChange={batchForm.change("batchName")} />
              <FieldMessage name="batchName" fields={batchForm.fields} />
            </label>
            <label>
              Start date{editingBatch === null && " *"}
              <Input
                type="date"
                min={editingBatch === null ? todayIso() : undefined}
                value={batchForm.values.startDate}
                onChange={batchForm.change("startDate")}
              />
              <FieldMessage name="startDate" fields={batchForm.fields} />
            </label>
            <label>
              End date{editingBatch === null && " *"}
              <Input type="date" min={batchForm.values.startDate || undefined} value={batchForm.values.endDate} onChange={batchForm.change("endDate")} />
              <FieldMessage name="endDate" fields={batchForm.fields} />
            </label>
            <label>
              Fee (₹) *
              <Input inputMode="decimal" value={batchForm.values.fee} onChange={batchForm.change("fee")} />
              <FieldMessage name="fee" fields={batchForm.fields} />
            </label>
            <label>
              Maximum students
              <Input inputMode="numeric" value={batchForm.values.maxStudents} onChange={batchForm.change("maxStudents")} />
              <FieldMessage name="maxStudents" fields={batchForm.fields} />
            </label>
            {editingBatch !== null && (
              <label>
                Status *
                <DropdownSelector
                  ariaLabel="Status"
                  value={batchForm.values.status}
                  onValueChange={batchForm.set("status")}
                  options={statusOptions.map((status) => ({ value: status, label: status }))}
                />
                <FieldMessage name="status" fields={batchForm.fields} />
              </label>
            )}
          </div>
          <FormButtons busy={batchForm.busy} editing={editingBatch !== null} addLabel="Add batch" onCancel={cancelBatch} icon={<Plus size={16} />} />
        </form>
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------- Universities and districts

export function MastersSection({ universities, districts, onChanged }: MasterProps & { onChanged: () => void }) {
  const uniForm = useAdminForm({ name: "", code: "" });
  const districtForm = useAdminForm({ name: "" });
  const [editingUni, setEditingUni] = useState<number | null>(null);
  const [editingDistrict, setEditingDistrict] = useState<number | null>(null);
  const rows = useRowAction();

  const submitUniversity = (event: FormEvent) => {
    event.preventDefault();
    const body = { name: uniForm.values.name.trim(), code: uniForm.values.code.trim() };
    uniForm.save(
      requiredErrors(uniForm.values, ["name", "code"], { name: "University name", code: "University code" }),
      () => (editingUni === null ? adminApi.university.create(body) : adminApi.university.update(editingUni, body)),
      editingUni === null ? "University added." : "University updated.",
      () => {
        setEditingUni(null);
        onChanged();
      },
    );
  };

  const submitDistrict = (event: FormEvent) => {
    event.preventDefault();
    const body = { name: districtForm.values.name.trim() };
    districtForm.save(
      requiredErrors(districtForm.values, ["name"], { name: "District name" }),
      () => (editingDistrict === null ? adminApi.district.create(body) : adminApi.district.update(editingDistrict, body)),
      editingDistrict === null ? "District added." : "District updated.",
      () => {
        setEditingDistrict(null);
        onChanged();
      },
    );
  };

  const toggleUniversity = (item: AdminUniversity) => {
    const active = item.active !== false;
    void rows
      .run(`u${item.id}`, () => adminApi.university.update(item.id, { active: !active }), active ? "University deactivated." : "University activated.")
      .then((ok) => ok && onChanged());
  };

  const removeUniversity = (item: AdminUniversity) => {
    void rows
      .run(`u${item.id}`, () => adminApi.university.remove(item.id), "University deleted.", `Delete ${item.name}? This cannot be undone.`)
      .then((ok) => {
        if (!ok) return;
        if (editingUni === item.id) {
          setEditingUni(null);
          uniForm.reset();
        }
        onChanged();
      });
  };

  const removeDistrict = (item: AdminDistrict) => {
    void rows
      .run(`d${item.id}`, () => adminApi.district.remove(item.id), "District deleted.", `Delete ${item.name}? This cannot be undone.`)
      .then((ok) => {
        if (!ok) return;
        if (editingDistrict === item.id) {
          setEditingDistrict(null);
          districtForm.reset();
        }
        onChanged();
      });
  };

  return (
    <Panel title="Universities and districts" text="Colleges are added under a university and a district, so add those first. Inactive universities are hidden from the registration form.">
      <div className="admin-two-col">
        <div>
          <h3>Universities ({universities.length})</h3>
          <ul className="admin-list">
            {universities.map((item) => (
              <li key={item.id} className="admin-list-row">
                <span>
                  {item.name} <small>{item.code}</small> <ActiveBadge active={item.active} />
                </span>
                <RowActions
                  busy={rows.busyKey === `u${item.id}`}
                  active={item.active}
                  onEdit={() => {
                    setEditingUni(item.id);
                    uniForm.load({ name: item.name, code: item.code });
                  }}
                  onToggle={() => toggleUniversity(item)}
                  onDelete={() => removeUniversity(item)}
                />
              </li>
            ))}
          </ul>
          <form className="admin-form" onSubmit={submitUniversity} noValidate>
            <h3>{editingUni === null ? "Add a university" : "Edit university"}</h3>
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
            <FormButtons
              busy={uniForm.busy}
              editing={editingUni !== null}
              addLabel="Add university"
              onCancel={() => {
                setEditingUni(null);
                uniForm.reset();
              }}
              icon={<Plus size={16} />}
            />
          </form>
        </div>
        <div>
          <h3>Districts ({districts.length})</h3>
          <ul className="admin-list">
            {districts.map((item) => (
              <li key={item.id} className="admin-list-row">
                <span>{item.name}</span>
                <RowActions
                  busy={rows.busyKey === `d${item.id}`}
                  onEdit={() => {
                    setEditingDistrict(item.id);
                    districtForm.load({ name: item.name });
                  }}
                  onDelete={() => removeDistrict(item)}
                />
              </li>
            ))}
          </ul>
          <form className="admin-form" onSubmit={submitDistrict} noValidate>
            <h3>{editingDistrict === null ? "Add a district" : "Edit district"}</h3>
            <FormAlert message={districtForm.formError} />
            <label>
              District name *
              <Input value={districtForm.values.name} onChange={districtForm.change("name")} />
              <FieldMessage name="name" fields={districtForm.fields} />
            </label>
            <FormButtons
              busy={districtForm.busy}
              editing={editingDistrict !== null}
              addLabel="Add district"
              onCancel={() => {
                setEditingDistrict(null);
                districtForm.reset();
              }}
              icon={<Plus size={16} />}
            />
          </form>
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- Acceptance letters (search)

export function LettersSection({ onOpenStudent }: { onOpenStudent: (studentId: string) => void }) {
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
                <th>Details</th>
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
                  <td>
                    {letter.studentId && (
                      <button type="button" className="admin-icon-button" title="Student details" aria-label="Student details" onClick={() => onOpenStudent(letter.studentId!)}>
                        <Eye size={15} />
                      </button>
                    )}
                  </td>
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
    if (form.values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.values.email.trim())) errors.email = "Enter a valid email";
    if (form.values.mobileNo && !/^\d{10}$/.test(form.values.mobileNo.trim())) errors.mobileNo = "Enter a 10-digit mobile number";
    // BCrypt only uses the first 72 bytes (same limit as the password reset)
    if (form.values.password && (form.values.password.length < 8 || form.values.password.length > 72)) errors.password = "Use 8 to 72 characters";
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
    <Panel title="Create university administrator" text="Creates a login for a university administrator, who can look up students. Your own session is not changed.">
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
            <Input type="password" maxLength={72} value={form.values.password} onChange={form.change("password")} />
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
