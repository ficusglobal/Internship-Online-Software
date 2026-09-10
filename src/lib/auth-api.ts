const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api"
).replace(/\/$/, "");

export interface AuthResponse {
  token: string;
  userId: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "UNIVERSITY_ADMIN" | "STUDENT" | "CYBER_CAFE";
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
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
    throw new Error(
      validationMessage ??
        apiError?.message ??
        "Unable to complete your request. Please try again.",
    );
  }
  return payload as T;
}

export const authApi = {
  login: (emailOrMobile: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ emailOrMobile, password }),
    }),
  registerStudent: (payload: StudentRegistrationPayload) =>
    request<AuthResponse>("/auth/register/student", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  registerCyberCafe: (payload: CyberCafeRegistrationPayload) =>
    request<AuthResponse>("/auth/register/cybercafe", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export const masterDataApi = {
  universities: () =>
    request<MasterUniversity[]>("/public/master/universities"),
  districts: () => request<MasterDistrict[]>("/public/master/districts"),
  colleges: (universityId: number, districtId: number) =>
    request<MasterCollege[]>(
      `/public/master/colleges?universityId=${encodeURIComponent(universityId)}&districtId=${encodeURIComponent(districtId)}`,
    ),
  courses: () => request<InternshipCourse[]>("/public/master/courses"),
  batches: (courseId: number) =>
    request<InternshipBatch[]>(
      `/public/master/batches?courseId=${encodeURIComponent(courseId)}`,
    ),
};
