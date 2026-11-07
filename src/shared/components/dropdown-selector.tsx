import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "../../lib/utils";
import "../../styles/dropdown-fit.css";

interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownSelectorProps {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  /** Opens the list as a fixed layer positioned from the trigger, so a scrolling or clipping parent (a card body with
   *  a sticky footer) can never hide it. It opens upwards when there is more room above. */
  floating?: boolean;
  onBlur?: () => void;
  onValueChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  value: string;
}

/** A shared non-native dropdown, matching the panel's university selector. */
export function DropdownSelector({
  ariaLabel,
  className,
  disabled = false,
  floating = false,
  onBlur,
  onValueChange,
  options,
  placeholder,
  value,
}: DropdownSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [placement, setPlacement] = useState<CSSProperties | undefined>();
  const selected = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) {
        setOpen(false);
        onBlur?.();
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [onBlur]);
  const place = useCallback(() => {
    const box = trigger.current?.getBoundingClientRect();
    if (!box) return;
    const gap = 6;
    const below = window.innerHeight - box.bottom - gap - 8;
    const above = box.top - gap - 8;
    const up = below < 240 && above > below;
    const room = Math.max(160, Math.min(352, up ? above : below));
    setPlacement({
      position: "fixed",
      left: box.left,
      width: box.width,
      right: "auto",
      maxHeight: room,
      zIndex: 1000,
      ...(up ? { top: "auto", bottom: window.innerHeight - box.top + gap } : { top: box.bottom + gap, bottom: "auto" }),
    });
  }, []);
  useLayoutEffect(() => {
    if (!floating || !open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [floating, open, place]);
  const choose = (nextValue: string) => {
    onValueChange(nextValue);
    setQuery("");
    setOpen(false);
    onBlur?.();
  };
  const toggle = () => {
    setOpen((current) => {
      if (current) setQuery("");
      return !current;
    });
  };
  return (
    <div
      className={cn(
        "dropdown-selector",
        className,
        open && "is-open",
        disabled && "is-disabled",
      )}
      ref={root}
    >
      <button
        type="button"
        className="dropdown-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={selected?.label}
        disabled={disabled}
        ref={trigger}
        onClick={toggle}
      >
        <span className={cn("dropdown-value", !selected && "is-placeholder")}>{selected?.label ?? placeholder ?? "Select an option"}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="dropdown-menu" role="listbox" aria-label={ariaLabel} style={floating ? placement ?? { visibility: "hidden" } : undefined}>
          <input
            className="dropdown-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${ariaLabel?.toLocaleLowerCase() ?? "options"}`}
            autoFocus
          />
          {filteredOptions.length ? (
            filteredOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? "selected" : ""}
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                {option.value === value && <Check size={15} />}
              </button>
            ))
          ) : (
            <p className="dropdown-empty">No matching options</p>
          )}
        </div>
      )}
    </div>
  );
}
