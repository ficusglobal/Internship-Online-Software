import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Eye, X } from "lucide-react";
import { adminApi } from "../../lib/admin-api";
import { consentApi, type ConsentStatus, type ConsentSummary } from "../../lib/auth-api";
import { openFile } from "../../lib/consent";
import { useListView } from "../../lib/use-list-view";
import { DropdownSelector } from "../../shared/components/dropdown-selector";
import { Pagination } from "../../shared/components/pagination";
import { toast } from "../../shared/components/toast";
import { describeError, EmptyState, FormAlert, FormModal, Loading, Panel, RowActions, SearchInput, StatusBadge, useRowAction } from "./admin-ui";

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
  const [rejecting, setRejecting] = useState<ConsentSummary | null>(null);
  const rows = useRowAction();
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

  const openConsentFile = (registrationId: string) => {
    openFile(() => consentApi.download(registrationId)).catch((err: unknown) => toast.error(describeError(err).message));
  };

  const approve = (item: ConsentSummary) => {
    void rows
      .run(item.registrationId, () => adminApi.reviewConsent(item.registrationId, { status: "APPROVED" }), "Consent letter approved.")
      .then((ok) => ok && reload());
  };

  return (
    <Panel title="Consent letters" text="Students upload a consent letter before paying. Approve it, or reject it with a reason the student will see.">
      <div className="admin-toolbar">
        <label>
          Show
          <DropdownSelector ariaLabel="Status" value={status} onValueChange={(value) => setStatus(value as "" | ConsentStatus)} options={STATUS_FILTERS} />
        </label>
        <SearchInput value={view.query} onChange={view.setQuery} placeholder="Search by student, email, mobile or college" label="Search consent letters" />
      </div>

      {error && <FormAlert message={error} />}
      {items === null && !error ? (
        <Loading label="Loading consent letters…" />
      ) : items && items.length === 0 ? (
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
                    college={item.collegeId !== undefined ? names.colleges.get(item.collegeId) : undefined}
                    batch={item.batchId !== undefined ? names.batches.get(item.batchId) : undefined}
                    busy={rows.busyKey === item.registrationId}
                    onView={() => openConsentFile(item.registrationId)}
                    onApprove={() => approve(item)}
                    onReject={() => setRejecting(item)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...view.pagination} noun="letters" />
        </>
      ) : null}

      {rejecting && (
        <RejectModal
          item={rejecting}
          onClose={() => setRejecting(null)}
          onRejected={() => {
            setRejecting(null);
            reload();
          }}
        />
      )}
    </Panel>
  );
}

interface ConsentRowProps {
  item: ConsentSummary;
  college?: string;
  batch?: string;
  busy: boolean;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
}

function ConsentRow({ item, college, batch, busy, onView, onApprove, onReject }: ConsentRowProps) {
  return (
    <tr>
      <td>
        {item.studentName ?? "—"}
        <small className="admin-subtext">{[item.email, item.mobileNo].filter(Boolean).join(" · ")}</small>
      </td>
      <td>
        {college ?? (item.collegeId !== undefined ? `College #${item.collegeId}` : "—")}
        <small className="admin-subtext">{batch ?? (item.batchId !== undefined ? `Batch #${item.batchId}` : "")}</small>
      </td>
      <td>{item.registrationStatus ?? "—"}</td>
      <td>
        <StatusBadge status={item.consentStatus} />
        {item.rejectionReason && <small className="admin-subtext">{item.rejectionReason}</small>}
      </td>
      <td>{formatDateTime(item.reviewedAt)}</td>
      <td>
        <RowActions busy={busy}>
          <button type="button" className="admin-icon-button" onClick={onView} disabled={busy} title="View file" aria-label="View file">
            <Eye size={15} />
          </button>
          {item.consentStatus !== "APPROVED" && (
            <button type="button" className="admin-icon-button is-ok" onClick={onApprove} disabled={busy} title="Approve" aria-label="Approve">
              <Check size={15} />
            </button>
          )}
          {item.consentStatus !== "REJECTED" && (
            <button type="button" className="admin-icon-button is-danger" onClick={onReject} disabled={busy} title="Reject" aria-label="Reject">
              <X size={15} />
            </button>
          )}
        </RowActions>
      </td>
    </tr>
  );
}

// Rejecting needs a reason the student will see
function RejectModal({ item, onClose, onRejected }: { item: ConsentSummary; onClose: () => void; onRejected: () => void }) {
  const [reason, setReason] = useState(item.rejectionReason ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = reason.trim();
    if (!text) return setError("Give a reason, so the student knows what to correct");
    if (text.length > REASON_MAX) return setError(`The reason can be at most ${REASON_MAX} characters`);
    setBusy(true);
    setError("");
    try {
      await adminApi.reviewConsent(item.registrationId, { status: "REJECTED", reason: text });
      toast.success("Consent letter rejected.");
      onRejected();
    } catch (err) {
      const message = describeError(err).message;
      setError(message);
      toast.error(message);
      setBusy(false);
    }
  };

  return (
    <FormModal
      title="Reject consent letter"
      description={item.studentName ? `For ${item.studentName}. The student sees this reason.` : "The student sees this reason."}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      busy={busy}
      formError={error}
      submitLabel="Reject consent letter"
    >
      <label className="admin-reject-form">
        Reason for rejection *
        <textarea
          className="admin-textarea"
          rows={4}
          maxLength={REASON_MAX}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setError("");
          }}
          placeholder="e.g. The letter is not signed by the principal"
        />
        <small className="admin-subtext">{reason.trim().length}/{REASON_MAX}</small>
      </label>
    </FormModal>
  );
}
