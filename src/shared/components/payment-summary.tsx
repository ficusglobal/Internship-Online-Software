import { CheckCircle2, ShieldCheck } from "lucide-react";
import "../../styles/payment-summary.css";

export interface PaymentSummaryProps {
  name?: string;
  registrationNumber?: string;
  email?: string;
  mobile?: string;
  college?: string;
  course?: string;
  batch?: string;
  // "26 Oct 2026 – 30 Oct 2026"
  period?: string;
  // Unknown until the batch is loaded (the amount is then shown by Razorpay Checkout)
  amount?: number;
  // Set once the payment is confirmed
  paymentId?: string;
}

const initials = (name?: string) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "S";

const rupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

// The payment page of the registration: who is paying, for which course, and how much.
// Laptop: details in two columns beside the amount; tablet and phone: one column, the amount on its own card.
export function PaymentSummary({ name, registrationNumber, email, mobile, college, course, batch, period, amount, paymentId }: PaymentSummaryProps) {
  const rows: Array<[string, string | undefined]> = [
    ["Email", email],
    ["Mobile", mobile ? `+91 ${mobile}` : undefined],
    ["College", college],
    ["Course", course],
    ["Batch", batch],
    ["Duration", period],
  ];
  return (
    <div className="pay-wrap">
    <div className="pay-card">
      <div className="pay-main">
        <div className="pay-student">
          <span className="pay-avatar" aria-hidden="true">
            {initials(name)}
          </span>
          <div>
            <b>{name || "Student"}</b>
            {registrationNumber && <small>Registration no. {registrationNumber}</small>}
          </div>
        </div>
        <dl className="pay-details">
          {rows
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className={label === "College" || label === "Email" ? "is-wide" : ""}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>
      </div>

      <div className="pay-total">
        <span>{paymentId ? "Amount paid" : "Amount to pay"}</span>
        <b>{amount != null ? rupees(amount) : "—"}</b>
        {paymentId ? (
          <small className="pay-done">
            <CheckCircle2 size={14} /> Payment received · {paymentId}
          </small>
        ) : (
          <small>
            <ShieldCheck size={14} /> Secure payment via Razorpay · UPI, cards, net banking
          </small>
        )}
      </div>
    </div>
    </div>
  );
}
