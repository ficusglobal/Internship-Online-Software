import type { StudentDetails } from "./auth-api";

export type LetterDetails = Partial<StudentDetails>;

export const LETTER_WIDTH = 794;
export const LETTER_HEIGHT = 1123;

export function letterIssueDate(details: LetterDetails): Date {
  const raw = details.acceptanceDate ?? details.registrationDate;
  const date = raw ? new Date(raw) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

// DD-MM-YYYY, as printed on the letter.
export function formatLetterDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

// Shown until the backend has issued the letter number (after payment is confirmed)
export const PENDING_LETTER_NUMBER = "Pending";

// Issued by the backend, e.g. FG/<college code>/<session>/<serial>. Never generated in the browser.
export function buildLetterNumber(details: LetterDetails): string {
  return details.letterNumber || PENDING_LETTER_NUMBER;
}

export function verificationUrl(studentId: string): string {
  return `${window.location.origin}/student/acceptance-letter/${encodeURIComponent(studentId)}`;
}

// DD.MM.YYYY, as printed on the completion certificate. Accepts "YYYY-MM-DD" or an ISO timestamp.
export function formatCertificateDate(value?: string): string {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}.${month}.${year}` : "";
}

// Captures every page of the document (letter, then certificate) into one A4 PDF.
export async function downloadLetterPdf(container: HTMLElement, fileName: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const pages = Array.from(container.querySelectorAll<HTMLElement>("[data-letter-page]"));
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  for (const [index, page] of pages.entries()) {
    const canvas = await html2canvas(page, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      width: LETTER_WIDTH,
      height: LETTER_HEIGHT,
      windowWidth: Math.max(window.innerWidth, LETTER_WIDTH + 100),
      // The on-screen preview is scaled down to fit the viewport; capture it at full size.
      onclone: (doc) => {
        doc.querySelectorAll<HTMLElement>("[data-letter-scaler]").forEach((node) => {
          node.style.transform = "none";
          if (node.parentElement) {
            node.parentElement.style.height = "auto";
            node.parentElement.style.overflow = "visible";
          }
        });
      },
    });
    if (index > 0) pdf.addPage("a4", "portrait");
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297);
  }
  pdf.save(fileName);
}
