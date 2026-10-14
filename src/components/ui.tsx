import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/utils";

export function Button({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={cn("button", className)} {...props}>{children}</button>; }
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={cn("input", className)} {...props} />; }
export function Card({ children, className }: { children: ReactNode; className?: string }) { return <section className={cn("card", className)}>{children}</section>; }
export function Status({ children }: { children: string }) { return <span className={cn("status", `status-${children.toLowerCase().replace(" ", "-")}`)}>{children}</span>; }
