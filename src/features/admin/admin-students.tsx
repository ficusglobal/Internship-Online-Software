import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, BookOpen, Building2, ExternalLink, Eye, FileCheck2, FileText, GraduationCap, LoaderCircle, Mail, MessageCircle, Phone, Search, UserRound } from "lucide-react";
import {
  acceptanceLetterApi,
  ApiError,
  authApi,
  consentApi,
  whatsappGroupApi,
  type AcceptanceLetter,
  type ConsentSummary,
  type StudentDetails,
  type StudentGroup,
} from "../../lib/auth-api";
import { openFile } from "../../lib/consent";
import { toast } from "../../shared/components/toast";
import { Button } from "../../shared/components/ui";
import { Avatar, CopyButton, describeError, FormAlert, Loading, Panel, StatusBadge } from "./admin-ui";

const PAID_STATUSES = new Set(["ENROLLED", "IN_PROGRESS", "COMPLETED"]);

interface Lookup {
  student: Partial<StudentDetails>;
  consent: ConsentSummary | null;
  letter: AcceptanceLetter | null;
  group: StudentGroup | null;
  // Why a part could not be shown (e.g. "not issued yet")
  notes: { consent?: string; letter?: string; group?: string };
}

// A 404 only means "not there yet"; anything else is shown as the error it is
const missing = (err: unknown, notFound: string) =>
  err instanceof ApiError && err.status === 404 ? notFound : describeError(err).message;

async function lookUp(id: string): Promise<Lookup> {
  const student = await authApi.getStudentById(id);
  const result: Lookup = { student, consent: null, letter: null, group: null, notes: {} };
  const registrationId = student.registrationId;
  if (!registrationId) return result;
  const paid = PAID_STATUSES.has(student.registrationStatus ?? "");
  await Promise.all([
    consentApi
      .status(registrationId)
      .then((consent) => (result.consent = consent))
      .catch((err: unknown) => (result.notes.consent = describeError(err).message)),
    acceptanceLetterApi
      .getByRegistration(registrationId)
      .then((letter) => (result.letter = letter))
      .catch((err: unknown) => (result.notes.letter = missing(err, "Not issued yet (issued after payment)."))),
    paid
      ? whatsappGroupApi
          .forRegistration(registrationId)
          .then((group) => (result.group = group))
          .catch((err: unknown) => (result.notes.group = missing(err, "No group for this college and batch yet.")))
      : Promise.resolve((result.notes.group = "Available after payment.")),
  ]);
  return result;
}

const GENDERS: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

// SUPER_ADMIN and UNIVERSITY_ADMIN: GET /student/{id} accepts a student id or a user id (the id in the
// letter's QR code is the student id). Consent, letter and group use the "owner or admin" endpoints.
// `initialId` comes from the URL (/admin/students/:studentId); `onLookup` puts a new search in the URL,
// so a lookup can be bookmarked, shared and reached with the back button. `onBack` returns to the list.
export function StudentsSection({ initialId = "", onLookup, onBack }: { initialId?: string; onLookup?: (id: string) => void; onBack?: () => void }) {
  const [id, setId] = useState(initialId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Lookup | null>(null);

  const search = async (value: string) => {
    const query = value.trim();
    if (!query) {
      setError("Enter a student ID or user ID.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await lookUp(query));
    } catch (err) {
      setError(
        err instanceof ApiError && (err.status === 400 || err.status === 404)
          ? "No student found with this ID."
          : describeError(err).message,
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setId(initialId);
    if (initialId) void search(initialId);
    else {
      setResult(null);
      setError("");
    }
    // Runs when the URL names another student
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const query = id.trim();
    // A new id goes through the URL (which runs the search); the same id is searched again directly
    if (onLookup && query && query !== initialId) onLookup(query);
    else void search(id);
  };

  const viewConsent = (registrationId: string) => {
    openFile(() => consentApi.download(registrationId)).catch((err: unknown) => toast.error(describeError(err).message));
  };

  return (
    <>
      {initialId && onBack && (
        <button type="button" className="admin-back" onClick={onBack}>
          <ArrowLeft size={16} /> All students
        </button>
      )}
      <Panel title="Student lookup" text="Find a student by student ID (printed as the QR code on the acceptance letter) or user ID.">
        <form className="admin-lookup" onSubmit={submit}>
          <div className="admin-search">
            <Search size={16} />
            <input value={id} onChange={(event) => setId(event.target.value)} placeholder="Paste a student ID or user ID" aria-label="Student ID or user ID" />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />} Look up
          </Button>
        </form>
        {error && <FormAlert message={error} />}
        {busy && !result && <Loading label="Loading student…" />}
      </Panel>

      {result && <StudentProfileView result={result} onViewConsent={viewConsent} />}
    </>
  );
}

function StudentProfileView({ result, onViewConsent }: { result: Lookup; onViewConsent: (registrationId: string) => void }) {
  const student = result.student;
  const address = [student.collegeAddress, student.city, student.state, student.pincode].filter((part) => part?.trim()).join(", ");
  const department = [student.department, student.departmentOther].filter(Boolean).join(" · ");

  return (
    <div className="student-view">
      <section className="student-hero">
        <Avatar name={student.fullName} size="lg" />
        <div className="student-hero-main">
          <div className="student-hero-title">
            <h2>{student.fullName ?? "Student"}</h2>
            <StatusBadge status={student.registrationStatus} />
          </div>
          <p className="student-hero-sub">{[student.courseName, student.batchName].filter(Boolean).join(" · ") || "No internship selected"}</p>
          <ul className="student-hero-contact">
            {student.email && (
              <li>
                <Mail size={14} /> <a href={`mailto:${student.email}`}>{student.email}</a>
              </li>
            )}
            {student.mobileNo && (
              <li>
                <Phone size={14} /> <a href={`tel:${student.mobileNo}`}>{student.mobileNo}</a>
              </li>
            )}
          </ul>
        </div>
        <dl className="student-hero-ids">
          {student.id && (
            <div>
              <dt>Student ID</dt>
              <dd>
                <code>{student.id}</code> <CopyButton value={student.id} label="student ID" />
              </dd>
            </div>
          )}
          {student.registrationId && (
            <div>
              <dt>Registration ID</dt>
              <dd>
                <code>{student.registrationId}</code> <CopyButton value={student.registrationId} label="registration ID" />
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Where the student is in the process: consent, letter and WhatsApp group */}
      <div className="student-status-row">
        {!student.registrationId ? (
          <section className="student-card">
            <p className="admin-muted">This student has no internship registration.</p>
          </section>
        ) : (
          <>
            <StatusCard icon={<FileCheck2 size={16} />} title="Consent letter">
              {result.consent ? (
                result.consent.consentUploaded ? (
                  <>
                    <StatusBadge status={result.consent.consentStatus} />
                    {result.consent.rejectionReason && <p className="admin-muted">Reason: {result.consent.rejectionReason}</p>}
                    <Button type="button" className="button-outline" onClick={() => onViewConsent(student.registrationId!)}>
                      <Eye size={16} /> View file
                    </Button>
                  </>
                ) : (
                  <p className="admin-muted">Not uploaded yet.</p>
                )
              ) : (
                <p className="admin-muted">{result.notes.consent}</p>
              )}
            </StatusCard>

            <StatusCard icon={<FileText size={16} />} title="Acceptance letter">
              {result.letter ? (
                <>
                  <p className="student-strong">{result.letter.letterNumber}</p>
                  {result.letter.generatedAt && <p className="admin-muted">Issued {new Date(result.letter.generatedAt).toLocaleDateString("en-IN")}</p>}
                </>
              ) : (
                <p className="admin-muted">{result.notes.letter}</p>
              )}
            </StatusCard>

            <StatusCard icon={<MessageCircle size={16} />} title="WhatsApp group">
              {result.group ? (
                <>
                  <p className="student-strong">{result.group.groupName}</p>
                  <a className="admin-link-text" href={result.group.groupUrl} target="_blank" rel="noopener noreferrer">
                    Open group <ExternalLink size={12} />
                  </a>
                </>
              ) : (
                <p className="admin-muted">{result.notes.group}</p>
              )}
            </StatusCard>
          </>
        )}
      </div>

      <div className="student-info-grid">
        <InfoCard icon={<UserRound size={16} />} title="Personal">
          <Item label="Full name" value={student.fullName} />
          <Item label="Father's name" value={student.fatherName} />
          <Item label="Gender" value={student.gender ? GENDERS[student.gender] ?? student.gender : undefined} />
          <Item label="Mobile" value={student.mobileNo} />
          <Item label="Email" value={student.email} wide />
        </InfoCard>

        <InfoCard icon={<GraduationCap size={16} />} title="Academic">
          <Item label="Degree" value={student.degree} />
          <Item label="Department" value={department} />
          <Item label="Semester" value={student.semester ? String(student.semester) : undefined} />
          <Item label="Academic session" value={student.academicSession} />
          <Item label="Major subject" value={student.majorSubject} wide />
          <Item label="University registration no." value={student.registrationNumber} />
          <Item label="College roll no." value={student.collegeRollNumber} />
        </InfoCard>

        <InfoCard icon={<Building2 size={16} />} title="College">
          <Item label="College" value={student.collegeName && (student.collegeCode ? `${student.collegeName} (${student.collegeCode})` : student.collegeName)} wide />
          {student.universityName && <Item label="University" value={student.universityName} wide />}
          <Item label="Address" value={address} wide />
        </InfoCard>

        <InfoCard icon={<BookOpen size={16} />} title="Internship">
          <Item label="Course" value={student.courseName} />
          <Item label="Batch" value={student.batchName} />
          <Item label="Internship registration no." value={student.internshipRegistrationNumber} />
          <Item label="Status" value={student.registrationStatus ? <StatusBadge status={student.registrationStatus} /> : undefined} />
        </InfoCard>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="student-card">
      <h3>
        {icon} {title}
      </h3>
      <dl className="student-fields">{children}</dl>
    </section>
  );
}

function StatusCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="student-card">
      <h3>
        {icon} {title}
      </h3>
      <div className="student-status-body">{children}</div>
    </section>
  );
}

// A label/value pair; missing values show a dash so the layout does not shift between students
function Item({ label, value, wide }: { label: string; value?: ReactNode; wide?: boolean }) {
  const empty = value === undefined || value === null || value === "";
  return (
    <div className={wide ? "is-wide" : undefined}>
      <dt>{label}</dt>
      <dd className={empty ? "is-empty" : undefined}>{empty ? "—" : value}</dd>
    </div>
  );
}
