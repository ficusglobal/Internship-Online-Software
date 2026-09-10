import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import "../toast.css";

export type ToastType = "success" | "error";
export interface ToastItem { id: number; type: ToastType; message: string; }

let nextId = 0;
const listeners = new Set<(toast: ToastItem) => void>();

export const toast = {
  success: (message: string) => emit("success", message),
  error: (message: string) => emit("error", message),
};

function emit(type: ToastType, message: string) {
  const item = { id: ++nextId, type, message };
  listeners.forEach((listener) => listener(item));
}

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const add = (item: ToastItem) => {
      setItems((current) => [...current.slice(-3), item]);
      window.setTimeout(() => setItems((current) => current.filter(({ id }) => id !== item.id)), 5000);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);

  return <div className="toast-viewport" aria-live="polite" aria-atomic="true">
    {items.map((item) => <div className={`toast toast-${item.type}`} key={item.id} role={item.type === "error" ? "alert" : "status"}>
      {item.type === "success" ? <CheckCircle2 size={19} /> : <CircleAlert size={19} />}
      <span>{item.message}</span>
      <button type="button" aria-label="Dismiss notification" onClick={() => setItems((current) => current.filter(({ id }) => id !== item.id))}><X size={16} /></button>
    </div>)}
  </div>;
}
