import { RAZORPAY_KEY_ID } from "../constants/api";

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

interface RazorpayFailureResponse {
  error?: { description?: string };
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: "INR";
  name: string;
  description: string;
  order_id?: string;
  prefill: { name: string; email: string; contact: string };
  notes?: Record<string, string>;
  theme: { color: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal: { ondismiss: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", callback: (response: RazorpayFailureResponse) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export interface PaymentRequest {
  amount: number;
  description: string;
  customer: { name: string; email: string; contact: string };
  notes?: Record<string, string>;
  // Set once the backend creates Razorpay orders; without it checkout runs in
  // order-less test mode.
  orderId?: string;
  // Key id returned with the order, so checkout always uses the backend's account
  keyId?: string;
}

export interface PaymentResult {
  paymentId: string;
  orderId?: string;
  signature?: string;
  amount: number;
}

export class PaymentCancelledError extends Error {
  constructor() {
    super("Payment was cancelled.");
  }
}

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise: Promise<void> | null = null;

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      script.remove();
      reject(new Error("Unable to load the payment gateway. Check your internet connection and try again."));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export async function collectPayment(request: PaymentRequest): Promise<PaymentResult> {
  await loadCheckout();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Payment gateway is unavailable. Please try again.");

  return new Promise<PaymentResult>((resolve, reject) => {
    const checkout = new Razorpay({
      key: request.keyId ?? RAZORPAY_KEY_ID,
      amount: Math.round(request.amount * 100),
      currency: "INR",
      name: "Ficus Global",
      description: request.description,
      order_id: request.orderId,
      prefill: request.customer,
      notes: request.notes,
      theme: { color: "#1f7fc4" },
      handler: (response) =>
        resolve({
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
          amount: request.amount,
        }),
      modal: { ondismiss: () => reject(new PaymentCancelledError()) },
    });
    // A failed attempt keeps the modal open so the payer can retry; the promise
    // settles on success or when the modal is dismissed.
    checkout.on("payment.failed", (response) =>
      console.warn("Razorpay payment attempt failed", response.error?.description),
    );
    checkout.open();
  });
}
