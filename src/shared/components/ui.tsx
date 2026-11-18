import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Button({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={cn("button", className)} {...props}>{children}</button>; }
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={cn("input", className)} {...props} />; }
/** Password box that is hidden by default, with a button to show / hide it. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-field">
      <input ref={ref} className={cn("input", className)} {...props} type={visible ? "text" : "password"} />
      <button type="button" className="password-toggle" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} title={visible ? "Hide password" : "Show password"}>
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </span>
  );
});
export function Card({ children, className }: { children: ReactNode; className?: string }) { return <section className={cn("card", className)}>{children}</section>; }
export function Status({ children }: { children: string }) { return <span className={cn("status", `status-${children.toLowerCase().replace(" ", "-")}`)}>{children}</span>; }
