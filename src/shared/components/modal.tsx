import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "../../styles/modal.css";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Open modals, topmost last: only the topmost one reacts to Escape / Tab (a confirm dialog can sit on a form)
const stack: symbol[] = [];
let scrollLocks = 0;

function lockScroll() {
  if (scrollLocks++ === 0) document.body.style.overflow = "hidden";
}

function unlockScroll() {
  if (--scrollLocks === 0) document.body.style.overflow = "";
}

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  // Forms keep what was typed, so clicking outside does not close them unless asked to
  dismissOnBackdrop?: boolean;
}

// An accessible dialog: rendered in a portal, closes with Escape or the X, keeps Tab inside,
// locks the page scroll, focuses the first field and gives focus back when it closes.
// Mount it only while it should be open: that also gives every opening a fresh form.
export function Modal({ title, description, onClose, children, size = "md", dismissOnBackdrop = false }: ModalProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const id = Symbol("modal");
    stack.push(id);
    const previous = document.activeElement as HTMLElement | null;
    lockScroll();

    // First field of the body, otherwise the dialog itself (never the close button)
    const first = panel.current?.querySelector<HTMLElement>(".ui-modal-content input:not([disabled]),.ui-modal-content textarea:not([disabled]),.ui-modal-content [data-autofocus]");
    (first ?? panel.current)?.focus();
    // A long prefilled value should show from its start, not scroll to its end
    if (first instanceof HTMLInputElement && /^(text|search|email|url|tel|)$/.test(first.type)) first.setSelectionRange(0, 0);

    const onKey = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === firstItem || active === panel.current)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(id), 1);
      unlockScroll();
      previous?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className="ui-modal-backdrop admin-scope"
      onMouseDown={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div ref={panel} className={`ui-modal-panel ui-modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="ui-modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="ui-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="ui-modal-content">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
