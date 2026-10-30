import { useEffect, useRef, useState } from "react";
import { Check, Eye, X } from "lucide-react";
import { adminApi } from "../../lib/admin-api";
import { consentApi, type ConsentStatus, type ConsentSummary } from "../../lib/auth-api";
import { openFile } from "../../lib/consent";
import { DropdownSelector } from "../../shared/components/dropdown-selector";
import { toast } from "../../shared/components/toast";
import { describeError, Empty, FormAlert, Loading, Panel, RowActions, useRowAction } from "./admin-ui";

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
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
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

  const view = (registrationId: string) => {
    openFile(() => consentApi.download(registrationId)).catch((err: unknown) => toast.error(describeError(err).message));
  };

  const approve = (item: ConsentSummary) => {
    void rows
      .run(item.registrationId, () => adminApi.reviewConsent(item.registrationId, { status: "APPROVED" }), "Consent letter approved.")
      .then((ok) => ok && reload());
  };

  const startReject = (item: ConsentSummary) => {
    setRejecting(item.registrationId);
    setReason("");
    setReasonError("");
  };

  const confirmReject = (item: ConsentSummary) => {
    const text = reason.trim();
    if (!text) {
      setReasonError("Give a reason, so the student knows what to correct");
      return;
    }
    if (text.length > REASON_MAX) {
      setReasonError(`The reason can be at most ${REASON_MAX} characters`);
      return;
    }
    void rows
      .run(item.registrationId, () => adminApi.reviewConsent(item.registrationId, { status: "REJECTED", reason: text }), "Consent letter rejected.")
      .then((ok) => {
        if (!ok) return;
        setRejecting(null);
        reload();
      });
  };

  return (
    <Panel title="Consent letters" text="Students upload a consent letter before paying. Approve it, or reject it with a reason the student will see.">
      <label className="admin-inline-label">
        Show
        <DropdownSelector
          ariaLabel="Status"
          value={status}
          onValueChange={(value) => setStatus(value as "" | ConsentStatus)}
          options={STATUS_FILTERS}
        />
      </label>

      {error && <FormAlert message={error} />}
      {items === null && !error ? (
        <Loading label="Loading consent letters…" />
      ) : items && items.length === 0 ? (
        <Empty text="No consent letters in this list." />
      ) : items ? (
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
              {items.map((item) => (
                <ConsentRow
                  key={item.registrationId}
                  item={item}
                  college={item.collegeId !== undefined ? names.colleges.get(item.collegeId) : undefined}
                  batch={item.batchId !== undefined ? names.batches.get(item.batchId) : undefined}
                  busy={rows.busyKey === item.registrationId}
                  rejecting={rejecting === item.registrationId}
                  reason={reason}
                  reasonError={reasonError}
                  onReason={(value) => {
                    setReason(value);
                    setReasonError("");
                  }}
                  onView={() => view(item.registrationId)}
                  onApprove={() => approve(item)}
                  onReject={() => startReject(item)}
                  onConfirmReject={() => confirmReject(item)}
                  onCancelReject={() => setRejecting(null)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Panel>
  );
}

interface ConsentRowProps {
  item: ConsentSummary;
  college?: string;
  batch?: string;
  busy: boolean;
  rejecting: boolean;
  reason: string;
  reasonError: string;
  onReason: (value: string) => void;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
  onConfirmReject: () => void;
  onCancelReject: () => void;
}

function ConsentRow({ item, college, batch, busy, rejecting, reason, reasonError, onReason, onView, onApprove, onReject, onConfirmReject, onCancelReject }: ConsentRowProps) {
  return (
    <>
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
          <span className={`admin-badge consent-${item.consentStatus?.toLowerCase()}`}>{item.consentStatus}</span>
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
      {rejecting && (
        <tr className="admin-subrow">
          <td colSpan={6}>
            <label className="admin-reject-form">
              Reason for rejection (shown to the student) *
              <textarea
                className="admin-textarea"
                rows={3}
                maxLength={REASON_MAX}
                value={reason}
                onChange={(event) => onReason(event.target.value)}
                placeholder="e.g. The letter is not signed by the principal"
              />
              <small className="admin-subtext">{reason.trim().length}/{REASON_MAX}</small>
              {reasonError && <small className="admin-field-error">{reasonError}</small>}
            </label>
            <div className="admin-form-buttons">
              <button type="button" className="button" onClick={onConfirmReject} disabled={busy}>
                Reject consent letter
              </button>
              <button type="button" className="button button-outline" onClick={onCancelReject} disabled={busy}>
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
