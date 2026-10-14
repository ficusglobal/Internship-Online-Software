export type Theme = "light" | "dark";
export type PaymentStatus = "Paid" | "Pending" | "Verification";
export type InternshipStatus = "In progress" | "Report review" | "Completed";

export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  university: string;
  course: string;
  batch: string;
  avatar: string;
  attendance: number;
  paymentStatus: PaymentStatus;
  internshipStatus: InternshipStatus;
  progress: number;
  joinedOn: string;
  paidAmount: number;
}

export interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  mode: "Online" | "Offline";
  status: PaymentStatus;
  date: string;
  reference: string;
}

export interface AttendanceRecord { studentId: string; present: boolean; }

export interface University {
  id: string;
  name: string;
  city: string;
  adminName: string;
  adminEmail: string;
}

export interface College {
  id: string;
  universityId: string;
  name: string;
  city: string;
  contactName: string;
}

export interface MasterConfiguration {
  universityId: string;
  collegeId: string;
  course: string;
  college: string;
  batch: string;
  admissionCenter: string;
  courseStart: string;
  courseEnd: string;
  fee: number;
}

export interface InternshipCourse {
  id: string;
  name: string;
  duration: string;
  fee: number;
  description: string;
  whatsappGroupLink: string;
}

export interface InternshipTopic {
  id: string;
  name: string;
  courses: InternshipCourse[];
}
