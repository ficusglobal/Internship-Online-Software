import { masterDataApi, request, type MasterDistrict, type MasterUniversity, type InternshipCourse, type InternshipBatch } from "./auth-api";
import { invalidate } from "./cache";

// Admin endpoints (backend /api/admin/**, SUPER_ADMIN only). They use the signed-in admin's
// token, which is stored by the sign-in screen. Read-only lists under /public/master are open.

export interface AdminUniversity extends MasterUniversity {
  isActive?: boolean;
}

export interface AdminDistrict extends MasterDistrict {}

export interface AdminCollege {
  id: number;
  name: string;
  code?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  pincode?: string;
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
}

// Shape of GET /admin/acceptance-letters
export interface AdminLetter {
  letterNumber: string;
  studentName?: string;
  studentRegistrationNumber?: string;
  collegeName?: string;
  collegeCode?: string;
  academicSession?: string;
  registrationStatus?: string;
  generatedAt?: string;
  studentId?: string;
}

// Writes clear the cached master-data lists they affect, so the next read sees the change
const post = <T>(path: string, body: unknown, affects: string[] = []) => {
  const result = request<T>(path, { method: "POST", body: JSON.stringify(body) }, true);
  return result.then((value) => {
    affects.forEach((prefix) => invalidate(prefix));
    return value;
  });
};

const get = <T>(path: string) => request<T>(path, undefined, true);

export const adminApi = {
  universities: () => masterDataApi.universities() as Promise<AdminUniversity[]>,
  createUniversity: (body: { name: string; code: string }) =>
    post<AdminUniversity>("/admin/master/universities", body, ["universities"]),

  districts: () => masterDataApi.districts() as Promise<AdminDistrict[]>,
  createDistrict: (body: { name: string }) => post<AdminDistrict>("/admin/master/districts", body, ["districts"]),

  colleges: (universityId: number, districtId: number) =>
    masterDataApi.colleges(universityId, districtId) as Promise<AdminCollege[]>,
  createCollege: (body: {
    universityId: number;
    districtId: number;
    name: string;
    code?: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    pincode?: string;
  }) => post<AdminCollege>("/admin/master/colleges", body, ["colleges:"]),

  courses: () => masterDataApi.courses() as Promise<AdminCourse[]>,
  createCourse: (body: {
    name: string;
    code: string;
    description?: string;
    theoryDurationHours?: number;
    practicalDurationHours?: number;
    reportPreparationHours?: number;
    totalDurationHours?: number;
  }) => post<AdminCourse>("/admin/master/courses", body, ["courses"]),

  batches: (courseId: number) => masterDataApi.batches(courseId) as Promise<AdminBatch[]>,
  createBatch: (body: {
    courseId: number;
    batchName: string;
    startDate: string;
    endDate: string;
    fee: number;
    maxStudents?: number;
  }) => post<AdminBatch>("/admin/master/batches", body, ["batches:"]),

  letters: (filters: { collegeCode?: string; academicSession?: string }) => {
    const params = new URLSearchParams();
    if (filters.collegeCode) params.set("collegeCode", filters.collegeCode);
    if (filters.academicSession) params.set("academicSession", filters.academicSession);
    const query = params.toString();
    return get<AdminLetter[]>(`/admin/acceptance-letters${query ? `?${query}` : ""}`);
  },

  // Creates another administrator. The response carries that new account's token, which the
  // dashboard deliberately ignores so the signed-in admin's session is not replaced.
  createAdministrator: (body: { fullName: string; email: string; mobileNo: string; password: string }) =>
    post<{ name: string; email: string; role: string }>("/admin/users/create", body),
};
