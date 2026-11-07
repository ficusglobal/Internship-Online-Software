import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import {
  adminApi,
  type AdminBatch,
  type AdminCollege,
  type AdminCourse,
  type AdminUniversity,
  type StudentPage,
} from "../../lib/admin-api";
import { DropdownSelector } from "../../shared/components/dropdown-selector";
import { Pagination } from "../../shared/components/pagination";
import { Avatar, byName, describeError, EmptyState, FormAlert, Loading, optionalNumber, optionsOf, Panel, StatusBadge } from "./admin-ui";

// GET /admin/students?status= : ENROLLED = paid, REGISTERED = payment pending
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ENROLLED", label: "Enrolled (paid)" },
  { value: "REGISTERED", label: "Registered (payment pending)" },
];

interface Filters {
  universityId: string;
  collegeId: string;
  courseId: string;
  batchId: string;
  status: string;
}

const noFilters: Filters = { universityId: "", collegeId: "", courseId: "", batchId: "", status: "" };

// SUPER_ADMIN: every student, narrowed by university, college, course, batch and status.
// `universities` is loaded once by the dashboard; the other dropdowns load here.
export function StudentListPanel({ universities, onOpen }: { universities: AdminUniversity[]; onOpen: (studentId: string) => void }) {
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [colleges, setColleges] = useState<AdminCollege[]>([]);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [batches, setBatches] = useState<AdminBatch[]>([]);
  const [optionsError, setOptionsError] = useState("");
  const [result, setResult] = useState<StudentPage | null>(null);
  const [error, setError] = useState("");
  const latest = useRef(0);

  useEffect(() => {
    adminApi
      .courses()
      .then((list) => setCourses(byName(list)))
      .catch((err: unknown) => setOptionsError(describeError(err).message));
  }, []);

  // Colleges narrow to the chosen university
  useEffect(() => {
    let current = true;
    adminApi
      .colleges({ universityId: optionalNumber(filters.universityId) })
      .then((list) => current && setColleges(byName(list)))
      .catch((err: unknown) => current && setOptionsError(describeError(err).message));
    return () => {
      current = false;
    };
  }, [filters.universityId]);

  // Batches narrow to the chosen course
  useEffect(() => {
    let current = true;
    adminApi
      .batches(optionalNumber(filters.courseId))
      .then((list) => current && setBatches(list))
      .catch((err: unknown) => current && setOptionsError(describeError(err).message));
    return () => {
      current = false;
    };
  }, [filters.courseId]);

  useEffect(() => {
    const request = ++latest.current;
    setError("");
    setResult(null);
    adminApi
      .students({
        status: filters.status || undefined,
        universityId: optionalNumber(filters.universityId),
        collegeId: optionalNumber(filters.collegeId),
        courseId: optionalNumber(filters.courseId),
        batchId: optionalNumber(filters.batchId),
        page,
        size,
      })
      .then((next) => request === latest.current && setResult(next))
      .catch((err: unknown) => request === latest.current && setError(describeError(err).message));
  }, [filters, page, size]);

  // Any filter change goes back to the first page; a changed parent filter clears its dependent one
  const setFilter = (key: keyof Filters) => (value: string) => {
    setPage(0);
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "universityId" ? { collegeId: "" } : {}),
      ...(key === "courseId" ? { batchId: "" } : {}),
    }));
  };

  const pageSize = size;
  const shown = result ? (result.clientPaged ? result.rows.slice(page * pageSize, (page + 1) * pageSize) : result.rows) : [];
  // Without a total or page count, a full page means there may be one more
  const hasNext = shown.length === pageSize;
  const filtered = Object.values(filters).some(Boolean);

  return (
    <Panel title="Students" text="All registered students. Narrow the list with the filters, then open a student for the full details.">
      {optionsError && <FormAlert message={optionsError} />}
      <div className="admin-toolbar">
        <label>
          University
          <DropdownSelector ariaLabel="University" value={filters.universityId} onValueChange={setFilter("universityId")} options={optionsOf(universities, (item) => item.name, "All universities")} />
        </label>
        <label>
          College
          <DropdownSelector ariaLabel="College" value={filters.collegeId} onValueChange={setFilter("collegeId")} options={optionsOf(colleges, (item) => item.name, "All colleges")} />
        </label>
        <label>
          Course
          <DropdownSelector ariaLabel="Course" value={filters.courseId} onValueChange={setFilter("courseId")} options={optionsOf(courses, (item) => item.name, "All courses")} />
        </label>
        <label>
          Batch
          <DropdownSelector
            ariaLabel="Batch"
            value={filters.batchId}
            onValueChange={setFilter("batchId")}
            options={optionsOf(batches, (item) => (item.course?.name ? `${item.batchName} · ${item.course.name}` : item.batchName), "All batches")}
          />
        </label>
        <label>
          Status
          <DropdownSelector ariaLabel="Status" value={filters.status} onValueChange={setFilter("status")} options={STATUS_OPTIONS} />
        </label>
        {filtered && (
          <button
            type="button"
            className="admin-link"
            onClick={() => {
              setPage(0);
              setFilters(noFilters);
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <FormAlert message={error} />}
      {result === null && !error ? (
        <Loading label="Loading students…" />
      ) : result && shown.length === 0 ? (
        <EmptyState text={page > 0 ? "No more students." : filtered ? "No students match these filters." : "No students registered yet."} />
      ) : result ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Contact</th>
                <th>College</th>
                <th>Course / Batch</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row, index) => (
                <tr key={row.registrationId ?? row.studentId ?? index}>
                  <td>
                    <div className="admin-person">
                      <Avatar name={row.studentName} size="sm" />
                      <div>
                        <strong>{row.studentName ?? "—"}</strong>
                        {(row.studentRegistrationNumber ?? row.registrationNumber) && <small className="admin-subtext">Reg. {row.studentRegistrationNumber ?? row.registrationNumber}</small>}
                      </div>
                    </div>
                  </td>
                  <td>
                    {row.email ?? "—"}
                    {row.mobileNo && <small className="admin-subtext">{row.mobileNo}</small>}
                  </td>
                  <td>{row.collegeName ?? "—"}</td>
                  <td>
                    {row.courseName ?? "—"}
                    {row.batchName && <small className="admin-subtext">{row.batchName}</small>}
                  </td>
                  <td><StatusBadge status={row.registrationStatus} /></td>
                  <td>
                    {row.studentId && (
                      <button type="button" className="admin-icon-button" title="Student details" aria-label="Student details" onClick={() => onOpen(row.studentId!)}>
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

      {result && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={result.total}
          totalPages={result.totalPages}
          hasNext={hasNext}
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPage(0);
            setSize(next);
          }}
          noun="students"
        />
      )}
    </Panel>
  );
}
