import { formatCertificateDate } from "../../lib/acceptance-letter";

// The internship is over once its last day has passed (the end date itself still counts as a working day)
export function internshipIsOver(endDate?: string, now = new Date()): boolean {
  if (!endDate) return false;
  const end = new Date(`${endDate.slice(0, 10)}T23:59:59`);
  return !Number.isNaN(end.getTime()) && end.getTime() < now.getTime();
}

// Shown on the certificate card while the internship is still running
export const certificateAvailability = (endDate?: string) =>
  endDate ? `Available after your internship ends on ${formatCertificateDate(endDate)}` : "Available after your internship is over";
