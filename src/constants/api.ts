export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://internshipwale.com/api";

// Razorpay key id (public) — same account as the backend's razorpay.key.id.
// The key secret and webhook secret live only on the backend; never add them here.
export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID ?? "rzp_test_Td9wQnOjLMAsLD";
