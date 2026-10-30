import { useEffect, useState, type FormEvent } from "react";
import { Eye, LoaderCircle, Search } from "lucide-react";
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
import { Button, Input } from "../../shared/components/ui";
import { describeError, FormAlert, Panel } from "./admin-ui";

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

// SUPER_ADMIN and UNIVERSITY_ADMIN: GET /student/{id} accepts a student id or a user id (the id in the
// letter's QR code is the student id). Consent, letter and group use the "owner or admin" endpoints.
// `initialId` comes from the URL (/admin/students/:studentId); `onLookup` puts a new search in the URL,
// so a lookup can be bookmarked, shared and reached with the back button.
export function StudentsSection({ initialId = "", onLookup }: { initialId?: string; onLookup?: (id: string) => void }) {
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

  const student = result?.student;
  const address = student ? [student.collegeAddress, student.city, student.state, student.pincode].filter((part) => part?.trim()).join(", ") : "";
  const details: Array<[string, string | undefined]> = student
    ? [
        ["Name", student.fullName],
        ["Father's name", student.fatherName],
        ["Gender", student.gender],
        ["Email", student.email],
        ["Mobile", student.mobileNo],
        ["College", student.collegeName && (student.collegeCode ? `${student.collegeName} (${student.collegeCode})` : student.collegeName)],
        ["College address", address],
        ["Degree", student.degree],
        ["Department", student.department],
        ["Academic session", student.academicSession],
        ["University registration no.", student.registrationNumber],
        ["College roll no.", student.collegeRollNumber],
        ["Course", student.courseName],
        ["Batch", student.batchName],
        ["Registration status", student.registrationStatus],
        ["Internship registration no.", student.internshipRegistrationNumber],
        ["Student ID", student.id],
        ["Registration ID", student.registrationId],
      ]
    : [];

  return (
    <Panel title="Student details" text="Look up a student by student ID (shown in the letter's QR code) or user ID.">
      <form className="admin-picker" onSubmit={submit}>
        <label>
          Student ID or user ID
          <Input value={id} onChange={(event) => setId(event.target.value)} placeholder="e.g. 3f2c…" />
        </label>
        <Button type="submit" className="button-outline" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />} Look up
        </Button>
      </form>
      {error && <FormAlert message={error} />}

      {result && student && (
        <>
          <dl className="admin-details">
            {details
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>

          {!student.registrationId ? (
            <p className="admin-muted">This student has no internship registration.</p>
          ) : (
            <div className="admin-two-col">
              <div className="admin-detail-card">
                <h3>Consent letter</h3>
                {result.consent ? (
                  result.consent.consentUploaded ? (
                    <>
                      <p>
                        <span className={`admin-badge consent-${result.consent.consentStatus?.toLowerCase()}`}>{result.consent.consentStatus}</span>
                      </p>
                      {result.consent.rejectionReason && <p className="admin-muted">Reason: {result.consent.rejectionReason}</p>}
                      <Button type="button" className="button-outline" onClick={() => viewConsent(student.registrationId!)}>
                        <Eye size={16} /> View file
                      </Button>
                    </>
                  ) : (
                    <p className="admin-muted">Not uploaded yet.</p>
                  )
                ) : (
                  <p className="admin-muted">{result.notes.consent}</p>
                )}
              </div>
              <div className="admin-detail-card">
                <h3>Acceptance letter</h3>
                {result.letter ? (
                  <p>
                    {result.letter.letterNumber}
                    {result.letter.generatedAt && (
                      <small className="admin-subtext">Issued {new Date(result.letter.generatedAt).toLocaleDateString("en-IN")}</small>
                    )}
                  </p>
                ) : (
                  <p className="admin-muted">{result.notes.letter}</p>
                )}
                <h3>WhatsApp group</h3>
                {result.group ? (
                  <p>
                    {result.group.groupName}
                    <small className="admin-subtext">{result.group.groupUrl}</small>
                  </p>
                ) : (
                  <p className="admin-muted">{result.notes.group}</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
