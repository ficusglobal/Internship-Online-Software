import { paymentApi } from "./auth-api";
import { collectPayment, type PaymentRequest } from "./payment";

// A payment Razorpay has confirmed, kept until the backend has verified its signature.
export interface ConfirmedPayment {
  registrationId: string;
  orderId: string;
  paymentId: string;
  signature: string;
}

type CheckoutInput = Omit<PaymentRequest, "amount" | "orderId" | "keyId"> & {
  registrationId: string;
  authToken?: string;
};

// 1. Backend creates the Razorpay order for this registration, 2. Checkout opens with that order.
// Throws PaymentCancelledError when the student closes Checkout.
export async function checkoutRegistration({ registrationId, authToken, ...checkout }: CheckoutInput): Promise<ConfirmedPayment> {
  const order = await paymentApi.createOrder(registrationId, authToken);
  const result = await collectPayment({
    ...checkout,
    amount: order.amount,
    orderId: order.orderId,
    keyId: order.razorpayKeyId,
  });
  if (!result.signature) {
    throw new Error("Payment gateway did not return a signature. Please try again.");
  }
  return {
    registrationId,
    orderId: result.orderId ?? order.orderId,
    paymentId: result.paymentId,
    signature: result.signature,
  };
}

// 3. Backend checks the signature and marks the registration ENROLLED.
export async function confirmRegistrationPayment(payment: ConfirmedPayment, authToken?: string): Promise<void> {
  const result = await paymentApi.verify(
    {
      registrationId: payment.registrationId,
      razorpayOrderId: payment.orderId,
      razorpayPaymentId: payment.paymentId,
      razorpaySignature: payment.signature,
    },
    authToken,
  );
  if (!result.verified) {
    throw new Error(result.message || "Payment could not be verified. Please contact support.");
  }
}

export interface PaymentStudent {
  fullName?: string;
  registrationNumber?: string;
  collegeName?: string;
  courseName?: string;
  batchName?: string;
  mobileNo?: string;
  email?: string;
}

// What Razorpay Checkout shows under "Ficus Global" and keeps with the payment: it already shows the payer's
// mobile number and email (prefill), so the student's own details go in the description and the notes.
export function describePayment(student: PaymentStudent): { title: string; description: string; notes: Record<string, string> } {
  const clean = (value?: string) => (value ?? "").trim();
  // Name, email and mobile first: they are what the payer must recognise in the dialog
  const description = [
    clean(student.fullName),
    clean(student.email),
    clean(student.mobileNo) && `+91 ${clean(student.mobileNo)}`,
    clean(student.registrationNumber) && `Reg. ${clean(student.registrationNumber)}`,
    clean(student.courseName) || "Internship",
    clean(student.batchName),
  ]
    .filter(Boolean)
    .join(" · ");
  // Razorpay notes: at most 15 keys and 256 characters per value
  const notes: Record<string, string> = {};
  const add = (key: string, value?: string) => {
    if (clean(value)) notes[key] = clean(value).slice(0, 250);
  };
  add("student", student.fullName);
  add("registrationNumber", student.registrationNumber);
  add("college", student.collegeName);
  add("course", student.courseName);
  add("batch", student.batchName);
  add("mobile", student.mobileNo);
  add("email", student.email);
  // Checkout prints this heading large in its left panel (the description is not shown by every Checkout layout)
  const first = clean(student.fullName);
  const title = first ? `${first} · Ficus Global` : "Ficus Global";
  return { title, description, notes };
}
