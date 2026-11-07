import { useEffect, useRef, useState, type FormEvent } from "react";
import { adminApi, type AdminBatch, type AdminCourse } from "../../lib/admin-api";
import { useListView } from "../../lib/use-list-view";
import { DropdownSelector } from "../../shared/components/dropdown-selector";
import { ErrorState } from "../../shared/components/error-state";
import { Pagination } from "../../shared/components/pagination";
import { TableSkeleton } from "../../shared/components/skeleton";
import { Input } from "../../shared/components/ui";
import {
  ActiveBadge,
  AddButton,
  byName,
  deleteConfirm,
  describeError,
  EmptyState,
  FieldMessage,
  FormAlert,
  FormModal,
  Loading,
  optionalNumber,
  optionsOf,
  Panel,
  requiredErrors,
  RowActions,
  SearchInput,
  todayIso,
  useAdminForm,
  useRowAction,
} from "./admin-ui";

const HOURS = ["theoryDurationHours", "practicalDurationHours", "reportPreparationHours", "totalDurationHours"] as const;
// The backend creates batches as OPEN and accepts any status text on update (stored in capitals)
const BATCH_STATUSES = ["OPEN", "CLOSED"];

const hoursOf = (value?: number) => (value === undefined || value === null ? "" : String(value));

type CourseEditor = { course?: AdminCourse } | null;
type BatchEditor = { batch?: AdminBatch } | null;

export function CoursesSection() {
  const [courses, setCourses] = useState<AdminCourse[] | null>(null);
  const [courseError, setCourseError] = useState("");
  const [courseKey, setCourseKey] = useState(0);
  const [courseEditor, setCourseEditor] = useState<CourseEditor>(null);
  const [courseId, setCourseId] = useState("");
  const [batches, setBatches] = useState<AdminBatch[] | null>(null);
  const [batchError, setBatchError] = useState("");
  const [batchKey, setBatchKey] = useState(0);
  const [batchEditor, setBatchEditor] = useState<BatchEditor>(null);
  const rows = useRowAction();
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

  const courseView = useListView(courses, (course) => [course.name, course.code, course.description].filter(Boolean).join(" "));
  const batchView = useListView(batches, (batch) => [batch.batchName, batch.course?.name, batch.status].filter(Boolean).join(" "), courseId);

  const toggleCourse = (course: AdminCourse) => {
    const active = course.isActive !== false;
    void rows
      .run(`course${course.id}`, () => adminApi.course.update(course.id, { isActive: !active }), active ? "Course deactivated." : "Course activated.")
      .then((ok) => ok && reloadCourses());
  };

  const removeCourse = (course: AdminCourse) => {
    void rows
      .run(`course${course.id}`, () => adminApi.course.remove(course.id), "Course deleted.", deleteConfirm("course", course.name))
      .then((ok) => {
        if (!ok) return;
        if (courseId === String(course.id)) setCourseId("");
        reloadCourses();
      });
  };

  const toggleBatch = (batch: AdminBatch) => {
    const active = batch.isActive !== false;
    void rows
      .run(`batch${batch.id}`, () => adminApi.batch.update(batch.id, { isActive: !active }), active ? "Batch deactivated." : "Batch activated.")
      .then((ok) => ok && reloadBatches());
  };

  const removeBatch = (batch: AdminBatch) => {
    void rows
      .run(`batch${batch.id}`, () => adminApi.batch.remove(batch.id), "Batch deleted.", deleteConfirm("batch", batch.batchName))
      .then((ok) => ok && reloadBatches());
  };

  return (
    <>
      <Panel
        title="Courses"
        text="Courses are shared by all universities. Inactive courses are hidden from the registration form."
        actions={<AddButton label="Add course" onClick={() => setCourseEditor({})} />}
      >
        {courseError ? (
          <ErrorState title="Couldn't load courses" message={courseError} onRetry={reloadCourses} />
        ) : courses === null ? (
          <TableSkeleton headers={["Name", "Code", "Hours (theory / practical / report)", "Total", "Status", "Actions"]} rows={2} rowHeight={57} toolbar label="Loading courses" />
        ) : courses.length === 0 ? (
          <EmptyState text="No courses yet." actionLabel="Add course" onAction={() => setCourseEditor({})} />
        ) : courseView.rows ? (
          <>
            <div className="admin-toolbar">
              <SearchInput value={courseView.query} onChange={courseView.setQuery} placeholder="Search courses by name or code" label="Search courses" />
            </div>
            {courseView.matches === 0 ? (
              <EmptyState text={`No courses match “${courseView.query.trim()}”.`} />
            ) : (
              <>
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
                      {courseView.rows.map((course) => (
                        <tr key={course.id}>
                          <td>{course.name}</td>
                          <td className="admin-nowrap">{course.code}</td>
                          <td>
                            {course.theoryDurationHours ?? 0} / {course.practicalDurationHours ?? 0} / {course.reportPreparationHours ?? 0}
                          </td>
                          <td>{course.totalDurationHours ?? "—"}</td>
                          <td><ActiveBadge active={course.isActive} /></td>
                          <td>
                            <RowActions
                              busy={rows.busyKey === `course${course.id}`}
                              active={course.isActive}
                              onEdit={() => setCourseEditor({ course })}
                              onToggle={() => toggleCourse(course)}
                              onDelete={() => removeCourse(course)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...courseView.pagination} noun="courses" />
              </>
            )}
          </>
        ) : null}
      </Panel>

      <Panel
        title="Batches"
        text="Each batch belongs to a course. Inactive batches cannot be chosen when registering."
        actions={<AddButton label="Add batch" onClick={() => setBatchEditor({})} />}
      >
        <div className="admin-toolbar">
          <label>
            Course
            <DropdownSelector ariaLabel="Course" value={courseId} onValueChange={setCourseId} options={optionsOf(courses ?? [], (course) => course.name, "All courses")} />
          </label>
          <SearchInput value={batchView.query} onChange={batchView.setQuery} placeholder="Search batches by name or course" label="Search batches" />
        </div>

        {batchError ? (
          <ErrorState title="Couldn't load batches" message={batchError} onRetry={reloadBatches} />
        ) : batches === null ? (
          <TableSkeleton headers={["Batch", "Course", "Start – End", "Fee", "Max", "Status", "Actions"]} rows={4} rowHeight={68} label="Loading batches" />
        ) : batches.length === 0 ? (
          <EmptyState text={courseId ? "No batches for this course yet." : "No batches yet."} actionLabel="Add batch" onAction={() => setBatchEditor({})} />
        ) : batchView.rows && batchView.matches === 0 ? (
          <EmptyState text={`No batches match “${batchView.query.trim()}”.`} />
        ) : batchView.rows ? (
          <>
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
                  {batchView.rows.map((batch) => (
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
                          onEdit={() => setBatchEditor({ batch })}
                          onToggle={() => toggleBatch(batch)}
                          onDelete={() => removeBatch(batch)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...batchView.pagination} noun="batches" />
          </>
        ) : null}
      </Panel>

      {courseEditor && (
        <CourseModal
          course={courseEditor.course}
          onClose={() => setCourseEditor(null)}
          onSaved={() => {
            setCourseEditor(null);
            reloadCourses();
            reloadBatches();
          }}
        />
      )}
      {batchEditor && (
        <BatchModal
          batch={batchEditor.batch}
          courses={courses ?? []}
          defaultCourseId={courseId}
          onClose={() => setBatchEditor(null)}
          onSaved={() => {
            setBatchEditor(null);
            reloadBatches();
          }}
        />
      )}
    </>
  );
}

function CourseModal({ course, onClose, onSaved }: { course?: AdminCourse; onClose: () => void; onSaved: () => void }) {
  const editing = course !== undefined;
  const sum = (course?.theoryDurationHours ?? 0) + (course?.practicalDurationHours ?? 0) + (course?.reportPreparationHours ?? 0);
  const form = useAdminForm({
    name: course?.name ?? "",
    code: course?.code ?? "",
    description: course?.description ?? "",
    theoryDurationHours: hoursOf(course?.theoryDurationHours),
    practicalDurationHours: hoursOf(course?.practicalDurationHours),
    reportPreparationHours: hoursOf(course?.reportPreparationHours),
    // Left empty when it is just the sum, so changing a part keeps the total in step
    totalDurationHours: course && course.totalDurationHours !== sum ? hoursOf(course.totalDurationHours) : "",
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const v = form.values;
    const errors = requiredErrors(v, ["name", "code"], { name: "Course name", code: "Course code" });
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
    form.save(
      errors,
      () => (editing ? adminApi.course.update(course.id, body) : adminApi.course.create({ ...body, description: body.description || undefined })),
      editing ? "Course updated." : "Course added.",
      onSaved,
    );
  };

  return (
    <FormModal title={editing ? `Edit ${course.name}` : "Add a course"} onClose={onClose} onSubmit={submit} busy={form.busy} formError={form.formError} submitLabel={editing ? "Save changes" : "Add course"}>
      <div className="admin-grid">
        <label>
          Course name *
          <Input value={form.values.name} onChange={form.change("name")} />
          <FieldMessage name="name" fields={form.fields} />
        </label>
        <label>
          Course code *
          <Input value={form.values.code} onChange={form.change("code")} />
          <FieldMessage name="code" fields={form.fields} />
        </label>
        <label className="admin-span-2">
          Description
          <Input value={form.values.description} onChange={form.change("description")} />
        </label>
        <label>
          Theory hours
          <Input inputMode="numeric" value={form.values.theoryDurationHours} onChange={form.change("theoryDurationHours")} />
          <FieldMessage name="theoryDurationHours" fields={form.fields} />
        </label>
        <label>
          Practical hours
          <Input inputMode="numeric" value={form.values.practicalDurationHours} onChange={form.change("practicalDurationHours")} />
          <FieldMessage name="practicalDurationHours" fields={form.fields} />
        </label>
        <label>
          Report preparation hours
          <Input inputMode="numeric" value={form.values.reportPreparationHours} onChange={form.change("reportPreparationHours")} />
          <FieldMessage name="reportPreparationHours" fields={form.fields} />
        </label>
        <label>
          Total hours
          <Input inputMode="numeric" value={form.values.totalDurationHours} onChange={form.change("totalDurationHours")} placeholder="Empty = sum of the three" />
          <FieldMessage name="totalDurationHours" fields={form.fields} />
        </label>
      </div>
    </FormModal>
  );
}

interface BatchModalProps {
  batch?: AdminBatch;
  courses: AdminCourse[];
  // The course filter pre-fills a new batch
  defaultCourseId: string;
  onClose: () => void;
  onSaved: () => void;
}

function BatchModal({ batch, courses, defaultCourseId, onClose, onSaved }: BatchModalProps) {
  const editing = batch !== undefined;
  const form = useAdminForm({
    courseId: String(batch?.course?.id ?? defaultCourseId),
    batchName: batch?.batchName ?? "",
    startDate: batch?.startDate?.slice(0, 10) ?? "",
    endDate: batch?.endDate?.slice(0, 10) ?? "",
    fee: batch && batch.fee !== undefined && batch.fee !== null ? String(batch.fee) : "",
    maxStudents: batch?.maxStudents ? String(batch.maxStudents) : "",
    status: batch?.status ?? "",
  });
  const labels = { courseId: "Course", batchName: "Batch name", startDate: "Start date", endDate: "End date", fee: "Fee" };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const v = form.values;
    // Dates are required for a new batch; older batches may have none, and an update leaves empty dates unchanged
    const errors = requiredErrors(v, editing ? ["courseId", "batchName", "fee"] : ["courseId", "batchName", "startDate", "endDate", "fee"], labels);
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
    form.save(
      errors,
      () =>
        editing
          ? adminApi.batch.update(batch.id, { ...body, startDate: body.startDate || undefined, endDate: body.endDate || undefined, status: v.status.trim().toUpperCase() })
          : adminApi.batch.create(body),
      editing ? "Batch updated." : "Batch added.",
      onSaved,
    );
  };

  const statusOptions = form.values.status && !BATCH_STATUSES.includes(form.values.status) ? [...BATCH_STATUSES, form.values.status] : BATCH_STATUSES;

  return (
    <FormModal title={editing ? `Edit batch ${batch.batchName}` : "Add a batch"} onClose={onClose} onSubmit={submit} busy={form.busy} formError={form.formError} submitLabel={editing ? "Save changes" : "Add batch"}>
      <div className="admin-grid">
        <label>
          Course *
          <DropdownSelector ariaLabel="Course" value={form.values.courseId} onValueChange={form.set("courseId")} options={optionsOf(courses, (course) => course.name)} placeholder="Select course" />
          <FieldMessage name="courseId" fields={form.fields} />
        </label>
        <label>
          Batch name *
          <Input value={form.values.batchName} onChange={form.change("batchName")} />
          <FieldMessage name="batchName" fields={form.fields} />
        </label>
        <label>
          Start date{!editing && " *"}
          <Input type="date" min={editing ? undefined : todayIso()} value={form.values.startDate} onChange={form.change("startDate")} />
          <FieldMessage name="startDate" fields={form.fields} />
        </label>
        <label>
          End date{!editing && " *"}
          <Input type="date" min={form.values.startDate || undefined} value={form.values.endDate} onChange={form.change("endDate")} />
          <FieldMessage name="endDate" fields={form.fields} />
        </label>
        <label>
          Fee (₹) *
          <Input inputMode="decimal" value={form.values.fee} onChange={form.change("fee")} />
          <FieldMessage name="fee" fields={form.fields} />
        </label>
        <label>
          Maximum students
          <Input inputMode="numeric" value={form.values.maxStudents} onChange={form.change("maxStudents")} />
          <FieldMessage name="maxStudents" fields={form.fields} />
        </label>
        {editing && (
          <label>
            Status *
            <DropdownSelector ariaLabel="Status" value={form.values.status} onValueChange={form.set("status")} options={statusOptions.map((status) => ({ value: status, label: status }))} />
            <FieldMessage name="status" fields={form.fields} />
          </label>
        )}
      </div>
    </FormModal>
  );
}
