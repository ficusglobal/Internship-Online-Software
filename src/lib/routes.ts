import type { SessionRole } from "./session";

// Every URL of the app. Hosting must rewrite unknown paths to index.html (SPA fallback).
export const paths = {
  home: "/",
  features: "/features",
  contact: "/contact",
  register: "/register",
  login: "/login",
  forgotPassword: "/forgot-password",
  adminLogin: "/admin/login",
  cafeLogin: "/cyber-cafe/login",
  cafeRegister: "/cyber-cafe/register",
  studentHome: "/student",
  studentLetter: "/student/acceptance-letter",
  // Public QR verification page; the QR code printed on every letter points here
  verifyLetter: (studentId: string) => `/student/acceptance-letter/${encodeURIComponent(studentId)}`,
  cafe: "/cyber-cafe",
  admin: "/admin",
  adminSection: (section: string) => `/admin/${section}`,
  adminStudent: (studentId: string) => `/admin/students/${encodeURIComponent(studentId)}`,
};

export const homeFor = (role: SessionRole) =>
  role === "student" ? paths.studentHome : role === "cyber-cafe" ? paths.cafe : paths.admin;

export const loginFor = (role: SessionRole) =>
  role === "student" ? paths.login : role === "cyber-cafe" ? paths.cafeLogin : paths.adminLogin;

// After sign-in, return to the page that asked for it only if it belongs to the signed-in role
export function allowedReturn(role: SessionRole, from?: string): string | null {
  if (!from) return null;
  const prefix = homeFor(role);
  return from === prefix || from.startsWith(`${prefix}/`) ? from : null;
}
