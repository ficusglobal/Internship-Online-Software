import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownSelectorProps {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
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
  onBlur,
  onValueChange,
  options,
  placeholder,
  value,
}: DropdownSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
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
        disabled={disabled}
        onClick={toggle}
      >
        {selected?.label ?? placeholder ?? "Select an option"}
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="dropdown-menu" role="listbox" aria-label={ariaLabel}>
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
