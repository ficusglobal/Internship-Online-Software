import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/utils";

interface PopoverRenderProps {
  close: () => void;
  open: boolean;
  toggle: () => void;
}

interface PopoverProps {
  children: (props: PopoverRenderProps) => ReactNode;
  className?: string;
  trigger: (props: PopoverRenderProps) => ReactNode;
}

/** A small reusable, click-triggered popover with outside-click and Escape handling. */
export function Popover({ children, className, trigger }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  const toggle = () => setOpen((value) => !value);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const props = { close, open, toggle };
  return <div className={cn("popover", className)} ref={rootRef}>{trigger(props)}{open && children(props)}</div>;
}
