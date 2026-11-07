import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Check, Copy, LoaderCircle, Pencil, Plus, Power, Search, Trash2, X } from "lucide-react";
import { ApiError } from "../../lib/auth-api";
import { confirmAction, type ConfirmOptions } from "../../shared/components/confirm-dialog";
import { Modal } from "../../shared/components/modal";
import { toast } from "../../shared/components/toast";

export type FieldErrors = Record<string, string>;

// Turns any thrown value into a message and the per-field errors the backend returned
export function describeError(err: unknown): { message: string; fields: FieldErrors } {
  if (err instanceof ApiError) return { message: err.message, fields: err.fieldErrors };
  return { message: err instanceof Error ? err.message : "Something went wrong. Please try again.", fields: {} };
}

// Confirmation for deleting a record
export const deleteConfirm = (noun: string, name: string): ConfirmOptions => ({
  title: `Delete ${noun}?`,
  message: `“${name}” will be permanently deleted. This cannot be undone. If it is in use, deactivate it instead.`,
  confirmLabel: "Delete",
  danger: true,
});

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

export const byName = <T extends { name: string }>(items: T[]) => [...items].sort((a, b) => a.name.localeCompare(b.name));

// Options for a DropdownSelector: an optional "" entry (e.g. "All colleges") first, then one per record
export const optionsOf = <T extends { id: number | string }>(items: T[], label: (item: T) => string, empty?: string) => [
  ...(empty ? [{ value: "", label: empty }] : []),
  ...items.map((item) => ({ value: String(item.id), label: label(item) })),
];

// "" -> undefined, otherwise a number (callers validate the text first)
export const optionalNumber = (value: string) => (value.trim() ? Number(value) : undefined);

// Shared state for one form: values, per-field errors, a form-level error and a busy flag
export function useAdminForm<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  // Sets one value and clears its field error (used directly by DropdownSelector)
  const set = (key: keyof T) => (value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFields((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  const change = (key: keyof T) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key)(event.target.value);

  // Fills the form (e.g. with a record to edit) and clears old errors
  const load = (next: T) => {
    setValues(next);
    setFields({});
    setFormError("");
  };

  const reset = () => load(initial);

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

  return { values, setValues, fields, formError, busy, change, set, save, load, reset };
}

// Row-level actions (toggle active, delete, send): one at a time, with a confirmation for destructive ones
export function useRowAction() {
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<unknown>, successMessage: string | ((result: unknown) => string), confirm?: string | ConfirmOptions) => {
    if (confirm && !(await confirmAction(typeof confirm === "string" ? { message: confirm } : confirm))) return false;
    setBusyKey(key);
    try {
      const result = await action();
      toast.success(typeof successMessage === "function" ? successMessage(result) : successMessage);
      return true;
    } catch (err) {
      toast.error(describeError(err).message);
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  return { busyKey, run };
}

export function FieldMessage({ name, fields }: { name: string; fields: FieldErrors }) {
  return fields[name] ? <small className="admin-field-error">{fields[name]}</small> : null;
}

// An error line. With `onRetry` it also offers "Try again" (used when a dropdown's options failed to load).
export function FormAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return message ? (
    <p className="admin-alert" role="alert">
      {message}
      {onRetry && (
        <>
          {" "}
          <button type="button" className="admin-link" onClick={onRetry}>
            Try again
          </button>
        </>
      )}
    </p>
  ) : null;
}

// `actions` sits at the right of the heading (e.g. the "Add …" button)
export function Panel({ title, text, actions, children }: { title: string; text?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="admin-panel">
      <header className="admin-panel-head">
        <div>
          <h2>{title}</h2>
          {text && <p>{text}</p>}
        </div>
        {actions && <div className="admin-panel-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

// The primary "Add …" button that opens a create modal
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="button" onClick={onClick}>
      <Plus size={16} /> {label}
    </button>
  );
}

// Nothing to show: says why, and (when there is no search) offers to create the first record
export function EmptyState({ text, actionLabel, onAction }: { text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="admin-empty">
      <p>{text}</p>
      {actionLabel && onAction && (
        <span className="admin-empty-action">
          <AddButton label={actionLabel} onClick={onAction} />
        </span>
      )}
    </div>
  );
}

// Search box above a table (the filtering itself is useListView)
export function SearchInput({ value, onChange, placeholder = "Search…", label = "Search" }: { value: string; onChange: (value: string) => void; placeholder?: string; label?: string }) {
  return (
    <div className="admin-search">
      <Search size={16} />
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} />
      {value && (
        <button type="button" className="admin-search-clear" onClick={() => onChange("")} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

interface FormModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  busy: boolean;
  formError: string;
  submitLabel: string;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

// A modal holding one form: the fields scroll, Cancel / Save stay at the bottom, errors show at the top.
// Mount it only while open, so every opening starts from the record's current values.
export function FormModal({ title, description, onClose, onSubmit, busy, formError, submitLabel, size = "md", children }: FormModalProps) {
  return (
    <Modal title={title} description={description} onClose={onClose} size={size}>
      <form className="admin-form ui-modal-form" onSubmit={onSubmit} noValidate>
        <div className="ui-modal-body">
          <FormAlert message={formError} />
          {children}
        </div>
        <div className="ui-modal-footer">
          <button type="button" className="button button-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="button" disabled={busy}>
            {busy && <LoaderCircle className="spin" size={16} />} {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <p className="admin-muted" role="status">
      <LoaderCircle className="spin" size={16} /> {label}
    </p>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="admin-muted">{text}</p>;
}

// "Ada Lovelace" -> "AL" (avatar text)
export const initialsOf = (name?: string) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

export function Avatar({ name, size = "md" }: { name?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`admin-avatar admin-avatar-${size}`} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}

// ENROLLED / PAID / APPROVED are green, REGISTERED / PENDING amber, REJECTED / FAILED red
const STATUS_TONE: Record<string, string> = {
  ENROLLED: "ok",
  IN_PROGRESS: "ok",
  COMPLETED: "ok",
  PAID: "ok",
  APPROVED: "ok",
  REGISTERED: "warn",
  PENDING: "warn",
  REJECTED: "bad",
  FAILED: "bad",
};

const STATUS_LABEL: Record<string, string> = { REGISTERED: "Payment pending", IN_PROGRESS: "In progress" };

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="admin-muted-text">—</span>;
  const label = STATUS_LABEL[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return <span className={`admin-pill is-${STATUS_TONE[status] ?? "neutral"}`}>{label}</span>;
}

// Copies a value (an id) to the clipboard, with a short "copied" tick
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error("Could not copy. Select the text and copy it instead."));
  };
  return (
    <button type="button" className="admin-copy" onClick={copy} aria-label={`Copy ${label}`} title={`Copy ${label}`}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

export function ActiveBadge({ active }: { active?: boolean }) {
  return <span className={`admin-pill ${active === false ? "is-bad" : "is-ok"}`}>{active === false ? "Inactive" : "Active"}</span>;
}

interface RowActionsProps {
  busy: boolean;
  onEdit?: () => void;
  // Omit for records without an active flag (districts)
  active?: boolean;
  onToggle?: () => void;
  onDelete?: () => void;
  children?: ReactNode;
}

export function RowActions({ busy, onEdit, active, onToggle, onDelete, children }: RowActionsProps) {
  return (
    <div className="admin-row-actions">
      {onEdit && (
        <button type="button" className="admin-icon-button" onClick={onEdit} disabled={busy} title="Edit" aria-label="Edit">
          <Pencil size={15} />
        </button>
      )}
      {onToggle && (
        <button
          type="button"
          className="admin-icon-button"
          onClick={onToggle}
          disabled={busy}
          title={active === false ? "Activate" : "Deactivate"}
          aria-label={active === false ? "Activate" : "Deactivate"}
        >
          <Power size={15} />
        </button>
      )}
      {onDelete && (
        <button type="button" className="admin-icon-button is-danger" onClick={onDelete} disabled={busy} title="Delete" aria-label="Delete">
          <Trash2 size={15} />
        </button>
      )}
      {children}
      {busy && <LoaderCircle className="spin" size={15} />}
    </div>
  );
}
