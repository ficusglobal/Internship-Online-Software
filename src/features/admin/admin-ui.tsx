import { useState, type ChangeEvent, type ReactNode } from "react";
import { LoaderCircle, Pencil, Power, Trash2 } from "lucide-react";
import { ApiError } from "../../lib/auth-api";
import { toast } from "../../shared/components/toast";

export type FieldErrors = Record<string, string>;

// Turns any thrown value into a message and the per-field errors the backend returned
export function describeError(err: unknown): { message: string; fields: FieldErrors } {
  if (err instanceof ApiError) return { message: err.message, fields: err.fieldErrors };
  return { message: err instanceof Error ? err.message : "Something went wrong. Please try again.", fields: {} };
}

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

  const run = async (key: string, action: () => Promise<unknown>, successMessage: string | ((result: unknown) => string), confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return false;
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

export function FormAlert({ message }: { message: string }) {
  return message ? (
    <p className="admin-alert" role="alert">
      {message}
    </p>
  ) : null;
}

export function Panel({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <section className="admin-panel">
      <header className="admin-panel-head">
        <h2>{title}</h2>
        {text && <p>{text}</p>}
      </header>
      {children}
    </section>
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

export function ActiveBadge({ active }: { active?: boolean }) {
  return <span className={`admin-badge ${active === false ? "is-off" : "is-on"}`}>{active === false ? "Inactive" : "Active"}</span>;
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

// Form footer: "Add"/"Save changes", plus "Cancel" while editing
export function FormButtons({ busy, editing, addLabel, onCancel, icon }: { busy: boolean; editing: boolean; addLabel: string; onCancel: () => void; icon: ReactNode }) {
  return (
    <div className="admin-form-buttons">
      <button type="submit" className="button" disabled={busy}>
        {busy ? <LoaderCircle className="spin" size={16} /> : icon} {editing ? "Save changes" : addLabel}
      </button>
      {editing && (
        <button type="button" className="button button-outline" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      )}
    </div>
  );
}
