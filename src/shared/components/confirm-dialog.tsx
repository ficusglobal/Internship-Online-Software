import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "./modal";

export interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  // Destructive actions get a red confirm button
  danger?: boolean;
}

type Opener = (options: ConfirmOptions, resolve: (confirmed: boolean) => void) => void;

let opener: Opener | null = null;

// Asks the user to confirm and resolves true / false. Needs one <ConfirmHost /> mounted;
// without it (e.g. a screen rendered on its own) it falls back to the browser's confirm box.
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (!opener) return Promise.resolve(window.confirm(typeof options.message === "string" ? options.message : options.title ?? "Are you sure?"));
  const open = opener;
  return new Promise((resolve) => open(options, resolve));
}

export function ConfirmHost() {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (confirmed: boolean) => void } | null>(null);

  useEffect(() => {
    opener = (options, resolve) => setPending({ options, resolve });
    return () => {
      opener = null;
    };
  }, []);

  if (!pending) return null;
  const { options, resolve } = pending;
  const answer = (confirmed: boolean) => {
    setPending(null);
    resolve(confirmed);
  };

  return (
    <Modal title={options.title ?? "Please confirm"} size="sm" onClose={() => answer(false)}>
      <div className="ui-modal-body">
        <p className="confirm-message">{options.message}</p>
      </div>
      <div className="ui-modal-footer">
        <button type="button" className="button button-outline" onClick={() => answer(false)}>
          Cancel
        </button>
        <button type="button" className={`button ${options.danger ? "button-danger" : ""}`} onClick={() => answer(true)} data-autofocus>
          {options.confirmLabel ?? "Confirm"}
        </button>
      </div>
    </Modal>
  );
}
