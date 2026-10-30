import type { ConsentSummary } from "./auth-api";

// Mirrors the backend rules (FileStorageService): PDF, JPG or PNG, at most 5 MB (app.upload.max-size-mb),
// with the type decided by the file's first bytes rather than its name. The backend checks again.
export const CONSENT_MAX_MB = 5;
export const CONSENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

const SIGNATURES: number[][] = [
  [0x25, 0x50, 0x44, 0x46], // %PDF
  [0xff, 0xd8, 0xff], // JPEG
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG
];

// Returns an error message, or "" when the file can be uploaded
export async function checkConsentFile(file: File): Promise<string> {
  if (file.size === 0) return "The selected file is empty. / चुनी गई फ़ाइल खाली है।";
  if (file.size > CONSENT_MAX_MB * 1024 * 1024) {
    return `The file is too large. Maximum size is ${CONSENT_MAX_MB} MB. / फ़ाइल ${CONSENT_MAX_MB} MB से बड़ी है।`;
  }
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const known = SIGNATURES.some((signature) => signature.every((byte, index) => head[index] === byte));
  return known ? "" : "Only PDF, JPG or PNG files are allowed. / केवल PDF, JPG या PNG फ़ाइल।";
}

// Payment opens once a consent letter is uploaded and was not rejected (PaymentService.createOrder)
export function consentReady(summary: ConsentSummary | null | undefined): boolean {
  return Boolean(summary?.consentUploaded) && summary?.consentStatus !== "REJECTED";
}

// Opens a downloaded file in a new tab. The tab is opened before the download starts, because
// browsers block pop-ups that are not opened directly from the click.
export async function openFile(load: () => Promise<Blob>): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const url = URL.createObjectURL(await load());
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      // Pop-up blocked: save the file instead of leaving the app
      const link = document.createElement("a");
      link.href = url;
      link.download = "consent-letter";
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
