import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { adminApi, type AdminAcademicSession, type AdminCollege, type AdminLetter } from "../../lib/admin-api";
import { useListView } from "../../lib/use-list-view";
import { DropdownSelector } from "../../shared/components/dropdown-selector";
import { ErrorState } from "../../shared/components/error-state";
import { Pagination } from "../../shared/components/pagination";
import { TableSkeleton } from "../../shared/components/skeleton";
import { byName, describeError, EmptyState, FormAlert, Loading, Panel, SearchInput } from "./admin-ui";

// Issued acceptance letters, searched by college and session (read-only: letters are issued after payment)
export function LettersSection({ onOpenStudent }: { onOpenStudent: (studentId: string) => void }) {
  // The letter number carries the college code, so the filter value is the code; sessions are filtered by name
  const [collegeCode, setCollegeCode] = useState("");
  const [session, setSession] = useState("");
  const [colleges, setColleges] = useState<AdminCollege[]>([]);
  const [sessions, setSessions] = useState<AdminAcademicSession[]>([]);
  const [optionsError, setOptionsError] = useState("");
  const [letters, setLetters] = useState<AdminLetter[] | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [optionsKey, setOptionsKey] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    Promise.all([adminApi.colleges(), adminApi.academicSessions()])
      .then(([collegeList, sessionList]) => {
        setColleges(byName(collegeList.filter((college) => college.code)));
        setSessions([...sessionList].sort((a, b) => b.name.localeCompare(a.name)));
      })
      .catch((err: unknown) => setOptionsError(describeError(err).message));
  }, [optionsKey]);

  // Searches on first open and whenever a filter changes
  useEffect(() => {
    const request = ++latest.current;
    setError("");
    setLetters(null);
    adminApi
      .letters({ collegeCode: collegeCode || undefined, academicSession: session || undefined })
      .then((list) => request === latest.current && setLetters(list))
      .catch((err: unknown) => request === latest.current && setError(describeError(err).message));
  }, [collegeCode, session, reloadKey]);

  const view = useListView(
    letters,
    (letter) => [letter.letterNumber, letter.studentName, letter.collegeName, letter.academicSession].filter(Boolean).join(" "),
    `${collegeCode}|${session}`,
  );

  return (
    <Panel title="Acceptance letters" text="Letters issued after payment. Filter by college and session, or search by letter number or student.">
      {optionsError && (
        <FormAlert
          message={`Some filters could not be loaded: ${optionsError}`}
          onRetry={() => {
            setOptionsError("");
            setOptionsKey((key) => key + 1);
          }}
        />
      )}
      <div className="admin-toolbar">
        <label>
          College
          <DropdownSelector
            ariaLabel="College"
            value={collegeCode}
            onValueChange={setCollegeCode}
            options={[{ value: "", label: "All colleges" }, ...colleges.map((college) => ({ value: college.code!, label: `${college.name} (${college.code})` }))]}
          />
        </label>
        <label>
          Academic session
          <DropdownSelector
            ariaLabel="Academic session"
            value={session}
            onValueChange={setSession}
            options={[{ value: "", label: "All sessions" }, ...sessions.map((item) => ({ value: item.name, label: item.name }))]}
          />
        </label>
        <SearchInput value={view.query} onChange={view.setQuery} placeholder="Search by letter number or student" label="Search letters" />
      </div>
      {error ? (
        <ErrorState title="Couldn't load acceptance letters" message={error} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : letters === null ? (
        <TableSkeleton headers={["Letter no.", "Student", "College", "Session", "Issued", "Details"]} rows={8} rowHeight={60} label="Loading acceptance letters" />
      ) : letters.length === 0 ? (
        <EmptyState text="No letters match this search." />
      ) : view.rows && view.matches === 0 ? (
        <EmptyState text={`No letters match “${view.query.trim()}”.`} />
      ) : view.rows ? (
        <>
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
                {view.rows.map((letter) => (
                  <tr key={letter.letterNumber}>
                    <td className="admin-nowrap">{letter.letterNumber}</td>
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
          <Pagination {...view.pagination} noun="letters" />
        </>
      ) : null}
    </Panel>
  );
}
