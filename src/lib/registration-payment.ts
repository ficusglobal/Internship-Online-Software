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
