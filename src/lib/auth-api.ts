import { API_BASE_URL } from "../constants/api";
import { cached } from "./cache";

export interface AuthResponse {
  token: string;
  userId: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "UNIVERSITY_ADMIN" | "STUDENT" | "CYBER_CAFE";
}

export interface StudentDetails {
  id: string;
  fullName: string;
  fatherName: string;
  mobileNo: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  email: string;
  collegeId: number;
  degree: string;
  department: string;
  academicSession: string;
  majorSubject: string;
  registrationNumber: string;
  collegeRollNumber: string;
  batchId: number;
  courseId: number;
  universityName?: string;
  collegeName?: string;
  courseName?: string;
  batchName?: string;
  fee?: number;
  paymentStatus?: string;
  paymentId?: string;
  registrationDate?: string;
  universityCode?: string;
  collegeCode?: string;
  courseCode?: string;
  // Issued by the backend once the registration is paid (see AcceptanceLetterResponse)
  letterNumber?: string;
  acceptanceDate?: string;
  registrationId?: string;
  registrationStatus?: string;
  // Internship period and hours, shown on the completion certificate
  batchStartDate?: string;
  batchEndDate?: string;
  totalDurationHours?: number;
}

// Shape actually returned by GET /student/me and GET /student/{id}
// (id accepts either the auth userId or the studentId; unknown id -> 400).
interface StudentApiResponse extends Partial<
  Omit<StudentDetails, "id" | "fullName" | "registrationNumber">
> {
  studentId?: string;
  studentName?: string;
  studentRegistrationNumber?: string;
  id?: string;
  fullName?: string;
  registrationNumber?: string;
  verified?: boolean;
}

function toStudentDetails(
  raw: StudentApiResponse | null,
): Partial<StudentDetails> & { verified?: boolean } {
  const { studentId, studentName, studentRegistrationNumber, ...rest } =
    raw ?? {};
  return {
    ...rest,
    id: studentId ?? rest.id,
    fullName: studentName ?? rest.fullName,
    registrationNumber: studentRegistrationNumber ?? rest.registrationNumber,
  };
}

// Shape of GET /acceptance-letters/me and POST /acceptance-letters/registrations/{id}
export interface AcceptanceLetter {
  letterNumber: string;
  sequenceNumber?: number;
  generatedAt?: string;
  registrationId?: string;
  studentId?: string;
  registrationStatus?: string;
  studentName?: string;
  fatherName?: string;
  studentRegistrationNumber?: string;
  collegeName?: string;
  academicSession?: string;
  majorSubject?: string;
  batchStartDate?: string;
  batchEndDate?: string;
  totalDurationHours?: number;
}

export interface StudentRegistrationPayload {
  fullName: string;
  fatherName: string;
  collegeId: number;
  batchId: number;
  email: string;
  mobileNo: string;
  password: string;
  confirmPassword: string;
  registrationNumber: string;
  collegeRollNumber: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  degree: string;
  department: string;
  academicSession: string;
  majorSubject: string;
  termsAccepted: boolean;
  registeredVia: "SELF" | "CYBER_CAFE";
}

export interface CyberCafeRegistrationPayload {
  shopName: string;
  ownerName: string;
  address: string;
  email: string;
  mobileNo: string;
  password: string;
  confirmPassword: string;
}

// POST /payment/create-order
export interface CreateOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  razorpayKeyId: string;
  receiptNumber: string;
  registrationId: string;
}

// POST /payment/verify
export interface PaymentVerificationResponse {
  status: "SUCCESS" | "FAILED" | "ERROR";
  verified: boolean;
  message: string;
}

export interface MasterUniversity {
  id: number;
  name: string;
  code: string;
}

export interface MasterDistrict {
  id: number;
  name: string;
}

export interface MasterCollege {
  id: number;
  name: string;
  code?: string;
  city?: string;
}

export interface InternshipCourse {
  id: number;
  name: string;
  code: string;
  description?: string;
}

export interface InternshipBatch {
  id: number;
  batchName: string;
  startDate?: string;
  endDate?: string;
  registrationEndDate?: string;
  fee: number;
  status: string;
  course?: InternshipCourse;
}

interface ApiErrorPayload {
  message?: string;
  validationErrors?: Record<string, string>;
}

interface MessageResult {
  message: string;
}

export class ApiError extends Error {
  // Per-field messages from the backend's validation response (field name -> message)
  readonly fieldErrors: Record<string, string>;

  constructor(
    message: string,
    readonly status: number,
    fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

// Auth is opt-in: public endpoints (login, registration, master data) never
// send a token. `auth: true` uses the stored session token; a string uses that token.
export async function request<T>(
  path: string,
  init?: RequestInit,
  auth: boolean | string = false,
): Promise<T> {
  const token =
    typeof auth === "string"
      ? auth
      : auth
        ? localStorage.getItem("authToken")
        : null;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as
    | ApiErrorPayload
    | T
    | null;
  if (!response.ok) {
    const apiError = payload as ApiErrorPayload | null;
    const validationMessage = apiError?.validationErrors
      ? Object.values(apiError.validationErrors)[0]
      : undefined;
    throw new ApiError(
      validationMessage ??
        apiError?.message ??
        "Unable to complete your request. Please try again.",
      response.status,
      apiError?.validationErrors ?? {},
    );
  }
  return payload as T;
}

const post = <T>(path: string, body: unknown, auth?: boolean | string) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) }, auth);

export const authApi = {
  login: (emailOrMobile: string, password: string) =>
    post<AuthResponse>("/auth/login", { emailOrMobile, password }),
  // Pass `useStoredSession` only when a cyber cafe registers a student: the backend
  // links the registration to the signed-in cafe from the bearer token.
  registerStudent: (
    payload: StudentRegistrationPayload,
    useStoredSession = false,
  ) => post<AuthResponse>("/auth/register/student", payload, useStoredSession),
  registerCyberCafe: (payload: CyberCafeRegistrationPayload) =>
    post<AuthResponse>("/auth/register/cybercafe", payload),
  // `authToken` lets a cyber cafe load a freshly registered student's details
  // with that student's token without replacing the cafe's own session.
  getStudentDetails: (authToken?: string) =>
    request<StudentApiResponse>(
      "/student/me",
      undefined,
      authToken ?? true,
    ).then(toStudentDetails),
  getStudentById: (studentId: string) =>
    request<StudentApiResponse>(
      `/student/${encodeURIComponent(studentId)}`,
      undefined,
      true,
    ).then(toStudentDetails),
};

// Email verification for the account that was just registered (step 4 of the registration form).
// The backend sends the code when the account is created; these endpoints are public.
export const emailVerificationApi = {
  sendCode: (email: string) =>
    post<MessageResult>("/auth/email/send-otp", { email }),
  verifyCode: (email: string, otp: string) =>
    post<MessageResult>("/auth/email/verify-otp", { email, otp }),
};

// Forgot password: request a code, then reset with code + new password in one call.
export const passwordResetApi = {
  requestCode: (email: string) =>
    post<MessageResult>("/auth/password/forgot", { email }),
  reset: (payload: {
    email: string;
    otp: string;
    newPassword: string;
    confirmPassword: string;
  }) => post<MessageResult>("/auth/password/reset", payload),
};

// Razorpay order flow: the registration must exist before an order can be created.
export const paymentApi = {
  createOrder: (registrationId: string, authToken?: string) =>
    post<CreateOrderResponse>(
      "/payment/create-order",
      { registrationId },
      authToken ?? true,
    ),
  verify: (
    payload: {
      registrationId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
    authToken?: string,
  ) =>
    post<PaymentVerificationResponse>(
      "/payment/verify",
      payload,
      authToken ?? true,
    ),
};

export const acceptanceLetterApi = {
  // 404 until the registration is paid and the letter has been issued
  getMine: (authToken?: string) =>
    request<AcceptanceLetter>(
      "/acceptance-letters/me",
      undefined,
      authToken ?? true,
    ),
  generate: (registrationId: string, authToken?: string) =>
    request<AcceptanceLetter>(
      `/acceptance-letters/registrations/${encodeURIComponent(registrationId)}`,
      { method: "POST" },
      authToken ?? true,
    ),
};

// Public master data is cached (see lib/cache.ts); callers always get fresh-enough lists without
// repeating the request on every screen.
export const masterDataApi = {
  universities: () =>
    cached("universities", () => request<MasterUniversity[]>("/public/master/universities")),
  districts: () => cached("districts", () => request<MasterDistrict[]>("/public/master/districts")),
  colleges: (universityId: number, districtId: number) =>
    cached(`colleges:${universityId}:${districtId}`, () =>
      request<MasterCollege[]>(
        `/public/master/colleges?universityId=${encodeURIComponent(universityId)}&districtId=${encodeURIComponent(districtId)}`,
      ),
    ),
  courses: () => cached("courses", () => request<InternshipCourse[]>("/public/master/courses")),
  batches: (courseId: number) =>
    cached(`batches:${courseId}`, () =>
      request<InternshipBatch[]>(`/public/master/batches?courseId=${encodeURIComponent(courseId)}`),
    ),
};
