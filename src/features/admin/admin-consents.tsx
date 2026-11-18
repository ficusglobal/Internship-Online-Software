import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ExternalLink, FileSearch, LoaderCircle, RotateCcw, X } from "lucide-react";
import { adminApi } from "../../lib/admin-api";
import { consentApi, type ConsentStatus, type ConsentSummary } from "../../lib/auth-api";
import { useListView } from "../../lib/use-list-view";
import { DropdownSelector } from "../../shared/components/dropdown-selector";
import { ErrorState } from "../../shared/components/error-state";
import { Pagination } from "../../shared/components/pagination";
import { TableSkeleton } from "../../shared/components/skeleton";
import { toast } from "../../shared/components/toast";
import { describeError, EmptyState, Panel, SearchInput, StatusBadge } from "./admin-ui";
import "../../styles/admin-consent-review.css";

// ConsentReviewService: a rejection needs a reason of at most 500 characters
const REASON_MAX = 500;

const STATUS_FILTERS: Array<{ value: "" | ConsentStatus; label: string }> = [
  { value: "PENDING", label: "Waiting for review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "", label: "All" },
];

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString("en-IN") : "—");

// SUPER_ADMIN: consent letters uploaded by students (or their cyber cafe), with approve / reject.
// Only registrations with an uploaded file are listed by the backend.
export function ConsentsSection() {
  const [status, setStatus] = useState<"" | ConsentStatus>("PENDING");
  const [items, setItems] = useState<ConsentSummary[] | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [names, setNames] = useState<{ colleges: Map<number, string>; batches: Map<number, string> }>({
    colleges: new Map(),
    batches: new Map(),
  });
  // The consent letter open on the Review page (null = the list is shown)
  const [reviewing, setReviewing] = useState<ConsentSummary | null>(null);
  const latest = useRef(0);

  // College and batch names for the list (the consent summary only carries their ids)
  useEffect(() => {
    Promise.all([adminApi.colleges(), adminApi.batches()])
      .then(([colleges, batches]) =>
        setNames({
          colleges: new Map(colleges.map((college) => [college.id, college.name])),
          batches: new Map(batches.map((batch) => [batch.id, batch.course?.name ? `${batch.batchName} · ${batch.course.name}` : batch.batchName])),
        }),
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const request = ++latest.current;
    setItems(null);
    setError("");
    adminApi
      .consents(status || undefined)
      .then((list) => request === latest.current && setItems(list))
      .catch((err: unknown) => request === latest.current && setError(describeError(err).message));
  }, [status, reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);
  const view = useListView(
    items,
    (item) => [item.studentName, item.email, item.mobileNo, item.collegeId !== undefined ? names.colleges.get(item.collegeId) : "", item.batchId !== undefined ? names.batches.get(item.batchId) : ""].filter(Boolean).join(" "),
    status,
  );

  const namesOf = (item: ConsentSummary) => ({
    college: item.collegeId !== undefined ? names.colleges.get(item.collegeId) ?? `College #${item.collegeId}` : undefined,
    batch: item.batchId !== undefined ? names.batches.get(item.batchId) ?? `Batch #${item.batchId}` : undefined,
  });

  if (reviewing) {
    return (
      <ConsentReview
        item={reviewing}
        {...namesOf(reviewing)}
        onBack={() => setReviewing(null)}
        onReviewed={() => {
          setReviewing(null);
          reload();
        }}
      />
    );
  }

  return (
    <Panel title="Consent letters" text="Students upload a consent letter before paying. Open one to review it: approve it, or reject it with a reason the student will see.">
      <div className="admin-toolbar">
        <label>
          Show
          <DropdownSelector ariaLabel="Status" value={status} onValueChange={(value) => setStatus(value as "" | ConsentStatus)} options={STATUS_FILTERS} />
        </label>
        <SearchInput value={view.query} onChange={view.setQuery} placeholder="Search by student, email, mobile or college" label="Search consent letters" />
      </div>

      {error ? (
        <ErrorState title="Couldn't load consent letters" message={error} onRetry={reload} />
      ) : items === null ? (
        <TableSkeleton headers={["Student", "College / Batch", "Registration", "Consent", "Reviewed", "Actions"]} rows={6} rowHeight={72} label="Loading consent letters" />
      ) : items.length === 0 ? (
        <EmptyState text="No consent letters in this list." />
      ) : view.rows && view.matches === 0 ? (
        <EmptyState text={`No consent letters match “${view.query.trim()}”.`} />
      ) : view.rows ? (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>College / Batch</th>
                  <th>Registration</th>
                  <th>Consent</th>
                  <th>Reviewed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((item) => (
                  <ConsentRow
                    key={item.registrationId}
                    item={item}
                    {...namesOf(item)}
                    onReview={() => setReviewing(item)}
                  />
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

interface ConsentRowProps {
  item: ConsentSummary;
  college?: string;
  batch?: string;
  onReview: () => void;
}

function ConsentRow({ item, college, batch, onReview }: ConsentRowProps) {
  const rejected = item.consentStatus === "REJECTED";
  return (
    <tr>
      <td>
        {item.studentName ?? "—"}
        <small className="admin-subtext">{[item.email, item.mobileNo].filter(Boolean).join(" · ")}</small>
      </td>
      <td>
        {college ?? "—"}
        <small className="admin-subtext">{batch ?? ""}</small>
      </td>
      <td>{item.registrationStatus ?? "—"}</td>
      <td>
        <StatusBadge status={item.consentStatus} />
        {item.rejectionReason && <small className="admin-subtext">{item.rejectionReason}</small>}
      </td>
      <td>{formatDateTime(item.reviewedAt)}</td>
      <td>
        {/* One button: "Review" opens the Review page; a rejected letter is opened again with "Reverify" */}
        <button type="button" className={`button admin-review-button ${rejected ? "is-reverify" : ""}`} onClick={onReview}>
          {rejected ? <RotateCcw size={15} /> : <FileSearch size={15} />} {rejected ? "Reverify" : "Review"}
        </button>
      </td>
    </tr>
  );
}

interface ConsentReviewProps {
  item: ConsentSummary;
  college?: string;
  batch?: string;
  onBack: () => void;
  onReviewed: () => void;
}

// The Review page: the uploaded letter next to the student's details, with Approve and Reject.
function ConsentReview({ item, college, batch, onBack, onReviewed }: ConsentReviewProps) {
  const reverify = item.consentStatus === "REJECTED";
  const approved = item.consentStatus === "APPROVED";
  const [file, setFile] = useState<{ url: string; type: string } | null>(null);
  const [fileError, setFileError] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(item.rejectionReason ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "approving" | "rejecting">("");

  // The letter is loaded as a file and shown on the page (not in a new tab)
  useEffect(() => {
    let url = "";
    let active = true;
    setFile(null);
    setFileError("");
    consentApi
      .download(item.registrationId)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setFile({ url, type: blob.type });
      })
      .catch((err: unknown) => active && setFileError(describeError(err).message));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.registrationId, fileKey]);

  const approve = async () => {
    setBusy("approving");
    setError("");
    try {
      await adminApi.reviewConsent(item.registrationId, { status: "APPROVED" });
      toast.success("Consent letter approved.");
      onReviewed();
    } catch (err) {
      const message = describeError(err).message;
      setError(message);
      toast.error(message);
      setBusy("");
    }
  };

  const reject = async () => {
    const text = reason.trim();
    if (!text) return setError("Give a reason, so the student knows what to correct");
    if (text.length > REASON_MAX) return setError(`The reason can be at most ${REASON_MAX} characters`);
    setBusy("rejecting");
    setError("");
    try {
      await adminApi.reviewConsent(item.registrationId, { status: "REJECTED", reason: text });
      toast.success("Consent letter rejected.");
      onReviewed();
    } catch (err) {
      const message = describeError(err).message;
      setError(message);
      toast.error(message);
      setBusy("");
    }
  };

  const details: Array<[string, string | undefined]> = [
    ["Student", item.studentName],
    ["Email", item.email],
    ["Mobile", item.mobileNo],
    ["College", college],
    ["Batch", batch],
    ["Registration", item.registrationStatus],
    ["Last reviewed", item.reviewedAt ? formatDateTime(item.reviewedAt) : undefined],
  ];
  const isImage = file?.type.startsWith("image/");

  return (
    <Panel
      title={reverify ? "Reverify consent letter" : "Review consent letter"}
      text={reverify ? "This letter was rejected. Check the student's new upload, then approve it or reject it again." : "Check the letter, then approve it or reject it with a reason the student will see."}
      actions={
        <button type="button" className="button button-outline" onClick={onBack} disabled={busy !== ""}>
          <ArrowLeft size={16} /> Back to consent letters
        </button>
      }
    >
      <div className="admin-review">
        <section className="admin-review-file" aria-label="Uploaded consent letter">
          {fileError ? (
            <ErrorState title="Couldn't load the letter" message={fileError} onRetry={() => setFileKey((key) => key + 1)} />
          ) : !file ? (
            <div className="admin-review-loading" role="status" aria-busy="true">
              <LoaderCircle className="spin" size={22} /> Loading the letter…
            </div>
          ) : isImage ? (
            <img src={file.url} alt={`Consent letter of ${item.studentName ?? "the student"}`} />
          ) : (
            <iframe title="Consent letter" src={file.url} />
          )}
          {file && (
            <a className="admin-review-open" href={file.url} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Open in a new tab
            </a>
          )}
        </section>

        <aside className="admin-review-side">
          <div className="admin-review-card">
            <div className="admin-review-status">
              <span>Consent status</span>
              <StatusBadge status={item.consentStatus} />
            </div>
            {item.rejectionReason && (
              <p className="admin-review-reason">
                <b>Earlier rejection:</b> {item.rejectionReason}
              </p>
            )}
            <dl>
              {details
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
          </div>

          <div className="admin-review-card admin-review-decision">
            {error && (
              <p className="admin-review-error" role="alert">
                {error}
              </p>
            )}
            {rejecting ? (
              <label className="admin-reject-form">
                Reason for rejection *
                <textarea
                  className="admin-textarea"
                  rows={4}
                  maxLength={REASON_MAX}
                  value={reason}
                  autoFocus
                  onChange={(event) => {
                    setReason(event.target.value);
                    setError("");
                  }}
                  placeholder="e.g. The letter is not signed by the principal"
                />
                <small className="admin-subtext">
                  The student sees this reason. {reason.trim().length}/{REASON_MAX}
                </small>
              </label>
            ) : null}
            <div className="admin-review-actions">
              {rejecting ? (
                <>
                  <button type="button" className="button button-outline" onClick={() => { setRejecting(false); setError(""); }} disabled={busy !== ""}>
                    Cancel
                  </button>
                  <button type="button" className="button button-danger" onClick={() => void reject()} disabled={busy !== ""}>
                    {busy === "rejecting" ? <LoaderCircle className="spin" size={16} /> : <X size={16} />} Reject letter
                  </button>
                </>
              ) : (
                <>
                  {!approved && (
                    <button type="button" className="button admin-approve" onClick={() => void approve()} disabled={busy !== "" || !file}>
                      {busy === "approving" ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} Approve
                    </button>
                  )}
                  <button type="button" className="button button-outline admin-reject" onClick={() => setRejecting(true)} disabled={busy !== ""}>
                    <X size={16} /> {reverify ? "Reject again" : "Reject"}
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </Panel>
  );
}
