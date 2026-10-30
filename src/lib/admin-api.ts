import { request, type ConsentStatus, type ConsentSummary, type InternshipCourse, type InternshipBatch } from "./auth-api";
import { invalidate } from "./cache";

// Admin endpoints (backend /api/admin/**, SUPER_ADMIN only). They use the signed-in admin's
// token, which is stored by the sign-in screen. Lists here come from /api/admin/master, which
// (unlike the public dropdowns) include inactive records.
//
// JSON names follow the backend entities: University and College expose `active`,
// InternshipCourse, InternshipBatch and WhatsApp groups expose `isActive`.
// Updates are partial: a field that is left out (undefined) is not changed.

export interface AdminUniversity {
  id: number;
  name: string;
  code: string;
  active?: boolean;
}

export interface AdminDistrict {
  id: number;
  name: string;
}

export interface AdminCollege {
  id: number;
  name: string;
  code?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  active?: boolean;
  university?: { id: number; name: string; code?: string };
  district?: { id: number; name: string };
}

export interface AdminCourse extends InternshipCourse {
  theoryDurationHours?: number;
  practicalDurationHours?: number;
  reportPreparationHours?: number;
  totalDurationHours?: number;
  isActive?: boolean;
}

export interface AdminBatch extends InternshipBatch {
  maxStudents?: number;
  isActive?: boolean;
  course?: AdminCourse;
}

// Shape of GET /admin/acceptance-letters
export interface AdminLetter {
  letterNumber: string;
  registrationId?: string;
  studentName?: string;
  studentRegistrationNumber?: string;
  collegeName?: string;
  collegeCode?: string;
  academicSession?: string;
  registrationStatus?: string;
  generatedAt?: string;
  studentId?: string;
}

export interface WhatsappGroup {
  id: number;
  collegeId: number;
  collegeName?: string;
  collegeCode?: string;
  batchId: number;
  batchName?: string;
  courseName?: string;
  groupName: string;
  groupUrl: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UniversityInput {
  name?: string;
  code?: string;
  active?: boolean;
}

export interface CollegeInput {
  universityId?: number;
  districtId?: number;
  name?: string;
  code?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  active?: boolean;
}

export interface CourseInput {
  name?: string;
  code?: string;
  description?: string;
  theoryDurationHours?: number;
  practicalDurationHours?: number;
  reportPreparationHours?: number;
  totalDurationHours?: number;
  isActive?: boolean;
}

export interface BatchCreateInput {
  courseId: number;
  batchName: string;
  startDate: string;
  endDate: string;
  fee: number;
  maxStudents?: number;
}

export interface BatchUpdateInput {
  courseId?: number;
  batchName?: string;
  startDate?: string;
  endDate?: string;
  fee?: number;
  maxStudents?: number;
  status?: string;
  isActive?: boolean;
}

export interface WhatsappGroupInput {
  collegeId?: number;
  batchId?: number;
  groupName?: string;
  groupUrl?: string;
  isActive?: boolean;
}

// Public dropdown caches each write makes stale (see lib/cache.ts). A college embeds its university
// and district, and a batch embeds its course, so renaming those also clears the lists that embed them.
const AFFECTS = {
  universities: ["universities", "colleges:"],
  districts: ["districts", "colleges:"],
  colleges: ["colleges:"],
  courses: ["courses", "batches:"],
  batches: ["batches:"],
};

type MasterType = keyof typeof AFFECTS;

// Writes clear the cached public lists they affect, so the next read sees the change
function write<T>(method: "POST" | "PUT" | "DELETE", path: string, body?: unknown, affects: string[] = []): Promise<T> {
  return request<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, true).then(
    (value) => {
      affects.forEach((prefix) => invalidate(prefix));
      return value;
    },
  );
}

const get = <T>(path: string) => request<T>(path, undefined, true);

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

// list / create / update / delete for one master table
function master<Item, Create, Update = Create>(type: MasterType) {
  const base = `/admin/master/${type}`;
  return {
    create: (body: Create) => write<Item>("POST", base, body, AFFECTS[type]),
    update: (id: number, body: Update) => write<Item>("PUT", `${base}/${id}`, body, AFFECTS[type]),
    remove: (id: number) => write<{ message: string }>("DELETE", `${base}/${id}`, undefined, AFFECTS[type]),
  };
}

export const adminApi = {
  universities: () => get<AdminUniversity[]>("/admin/master/universities"),
  university: master<AdminUniversity, UniversityInput>("universities"),

  districts: () => get<AdminDistrict[]>("/admin/master/districts"),
  district: master<AdminDistrict, { name: string }>("districts"),

  // Both filters are optional
  colleges: (filters: { universityId?: number; districtId?: number } = {}) =>
    get<AdminCollege[]>(`/admin/master/colleges${query(filters)}`),
  college: master<AdminCollege, CollegeInput>("colleges"),

  courses: () => get<AdminCourse[]>("/admin/master/courses"),
  course: master<AdminCourse, CourseInput>("courses"),

  batches: (courseId?: number) => get<AdminBatch[]>(`/admin/master/batches${query({ courseId })}`),
  batch: master<AdminBatch, BatchCreateInput, BatchUpdateInput>("batches"),

  letters: (filters: { collegeCode?: string; academicSession?: string }) =>
    get<AdminLetter[]>(`/admin/acceptance-letters${query(filters)}`),

  // Only registrations that have uploaded a consent letter are listed
  consents: (status?: ConsentStatus) => get<ConsentSummary[]>(`/admin/consents${query({ status })}`),
  reviewConsent: (registrationId: string, body: { status: "APPROVED" | "REJECTED"; reason?: string }) =>
    write<ConsentSummary>("PUT", `/admin/registrations/${encodeURIComponent(registrationId)}/consent`, body),

  whatsappGroups: (filters: { collegeId?: number; batchId?: number } = {}) =>
    get<WhatsappGroup[]>(`/admin/whatsapp-groups${query(filters)}`),
  createWhatsappGroup: (body: WhatsappGroupInput) => write<WhatsappGroup>("POST", "/admin/whatsapp-groups", body),
  updateWhatsappGroup: (id: number, body: WhatsappGroupInput) =>
    write<WhatsappGroup>("PUT", `/admin/whatsapp-groups/${id}`, body),
  deleteWhatsappGroup: (id: number) => write<{ message: string }>("DELETE", `/admin/whatsapp-groups/${id}`),
  // Emails the link to paid students of the group's college and batch; `resend` includes those already sent
  sendWhatsappLinks: (id: number, resend: boolean) =>
    write<{ message: string }>("POST", `/admin/whatsapp-groups/${id}/send-pending${query({ resend: String(resend) })}`),

  // Creates another administrator. The response carries that new account's token, which the
  // dashboard deliberately ignores so the signed-in admin's session is not replaced.
  createAdministrator: (body: { fullName: string; email: string; mobileNo: string; password: string }) =>
    write<{ name: string; email: string; role: string }>("POST", "/admin/users/create", body),
};
