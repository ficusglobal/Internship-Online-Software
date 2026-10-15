import { Globe, Globe2, Mail, MapPin, Phone } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import {
  buildLetterNumber,
  formatCertificateDate,
  formatLetterDate,
  letterIssueDate,
  LETTER_HEIGHT,
  LETTER_WIDTH,
  verificationUrl,
  type LetterDetails,
} from "../lib/acceptance-letter";
import "../acceptance-letter-format.css";
import signatureUrl from "../assets/signature.png";
import stampUrl from "../assets/stamp.png";

// Both waves live in one full-page SVG used as a background image: html2canvas
// renders background images reliably, unlike multiple inline SVGs.
const letterBackground = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${LETTER_WIDTH}" height="${LETTER_HEIGHT}" viewBox="0 0 794 1123">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#bfe2f6"/><stop offset="1" stop-color="#8fcbef"/></linearGradient></defs>
  <path d="M0 0H794V150C610 60 330 40 0 120Z" fill="url(#sky)"/>
  <path d="M0 108C300 32 590 44 794 136V168C590 78 300 70 0 140Z" fill="#f7941d"/>
  <g transform="translate(0 908) scale(1 0.768)">
    <path d="M0 110C300 220 560 150 794 30V280H0Z" fill="url(#sky)"/>
    <path d="M0 76C300 190 560 118 794 0V34C560 152 300 222 0 110Z" fill="#f7941d"/>
  </g>
</svg>`)}")`;

// Certificate artwork: blue top band with a red sweep, and a blue base with a red sweep
const certificateBackground = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${LETTER_WIDTH}" height="${LETTER_HEIGHT}" viewBox="0 0 794 1123">
  <defs><linearGradient id="cs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cfe9f8"/><stop offset="1" stop-color="#7fc0ea"/></linearGradient></defs>
  <path d="M0 0H794V84C600 14 300 6 0 60Z" fill="url(#cs)"/>
  <path d="M0 56C300 0 600 8 794 80V92C600 26 300 22 0 70Z" fill="#d7262e"/>
  <g transform="translate(0 1010) scale(1 0.7)">
    <path d="M0 40C260 0 560 60 794 0V193H0Z" fill="url(#cs)"/>
    <path d="M0 22C260 -8 560 46 794 2V20C560 66 260 16 0 40Z" fill="#d7262e"/>
  </g>
</svg>`)}")`;

const CRITERIA = [
  "Technical Knowledge & Application",
  "Quality of Work & Task Completion",
  "Initiative & Problem-Solving Ability",
  "Communication & Interpersonal Skills",
  "Punctuality, Discipline & Professional Conduct",
];

// A printed line with a value (filled in on screen and in the PDF)
function CertificateRow({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <div className="fg-cert-row">
      <span>{label}</span>
      <span className="fg-cert-value">{value ?? children ?? ""}</span>
    </div>
  );
}

interface AcceptanceLetterDocumentProps {
  details: LetterDetails;
  studentId: string;
}

// The letter and the completion certificate, each a fixed A4 canvas (794x1123px, 96dpi), so the
// PDF export matches the preview. The preview is scaled down to fit narrow screens.
export const AcceptanceLetterDocument = forwardRef<HTMLDivElement, AcceptanceLetterDocumentProps>(
  function AcceptanceLetterDocument({ details, studentId }, ref) {
    const frame = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
      const node = frame.current;
      if (!node) return;
      const observer = new ResizeObserver(([entry]) =>
        setScale(Math.min(1, entry.contentRect.width / LETTER_WIDTH)),
      );
      observer.observe(node);
      return () => observer.disconnect();
    }, []);

    const universityCode = details.universityCode || "LNMU";
    const issueDate = letterIssueDate(details);

    return (
      <div className="fg-letter-frame" ref={frame} style={{ height: LETTER_HEIGHT * 2 * scale }}>
        <div data-letter-scaler style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <div className="fg-letter-pages" ref={ref}>
            <section className="fg-letter" data-letter-page style={{ backgroundImage: letterBackground }}>
              <header className="fg-letter-brand">
                <span className="fg-letter-globe">
                  <span className="fg-letter-globe-leaf" />
                  <span className="fg-letter-globe-icon"><Globe2 size={46} strokeWidth={1.6} /></span>
                </span>
                <span>
                  <b>Ficus Global</b>
                  <small>Technology | Innovation | Solution</small>
                </span>
              </header>

              <h1>INTERNSHIP ACCEPTANCE LETTER</h1>

              <div className="fg-letter-meta">
                <span><b>Letter No.</b> <span className="fg-fill">{buildLetterNumber(details)}</span></span>
                <span><b>Date:</b> <span className="fg-fill">{formatLetterDate(issueDate)}</span></span>
              </div>

              <p className="fg-letter-to">To</p>
              <dl className="fg-letter-recipient">
                <dd className="fg-fill">{details.fullName?.toUpperCase()}</dd><dt>(Student Name)</dt>
                <dd className="fg-fill">{details.registrationNumber}</dd><dt>(Registration Number)</dt>
                <dd className="fg-fill fg-fill-small">{details.collegeName?.toUpperCase()}</dd><dt>(Institution)</dt>
              </dl>

              <p>Dear Candidate,</p>
              <p>
                We are pleased to accept your application and offer you internship at our organization. Our
                organizations satisfy all the requirements as provided in the "{universityCode} Internship
                Guidelines for Undergraduate Programmes".
              </p>
              <p>We appreciate your interest in our organization.</p>
              <p>Thank you.</p>

              <div className="fg-letter-sign">
                <div className="fg-letter-sign-block">
                  <div className="fg-letter-sign-art">
                    <img className="fg-letter-signature" src={signatureUrl} alt="" />
                    <img className="fg-letter-stamp" src={stampUrl} alt="" />
                  </div>
                  <p>Supervisor/Head IPO</p>
                  <p>(Signature and seal)</p>
                </div>
                {studentId && (
                  <div className="fg-letter-qr">
                    <QRCodeCanvas value={verificationUrl(studentId)} size={104} level="M" marginSize={1} />
                    <small>Scan to verify</small>
                  </div>
                )}
              </div>

              <footer className="fg-letter-footer">
                <div>
                  <span><MapPin size={14} /> C-6, Central Ashoka, Argora Ranchi Jharkhand, India</span>
                  <span><Mail size={14} /> info@ficusglobal.com</span>
                  <span><Globe size={14} /> www.ficusglobal.com</span>
                </div>
                <div>
                  <span><Phone size={14} /> +91-8051333007</span>
                  <span>+91-8102853485</span>
                </div>
              </footer>
            </section>

            <section className="fg-certificate" data-letter-page style={{ backgroundImage: certificateBackground }}>
              <p className="fg-cert-reg">Reg-No- UDYAM-JH-00026417</p>
              <div className="fg-cert-brand">
                <span className="fg-letter-globe">
                  <span className="fg-letter-globe-leaf" />
                  <span className="fg-letter-globe-icon"><Globe2 size={34} strokeWidth={1.6} /></span>
                </span>
                <span>
                  <span className="fg-cert-logo-text">Ficus Global</span>
                  <span className="fg-cert-tagline">Technology | Innovation | Solution</span>
                </span>
              </div>

              <h2>INTERNSHIP COMPLETION CERTIFICATE</h2>

              <CertificateRow label="Certificate No.:" />
              <CertificateRow label="This is to certify Mr./Mrs." value={details.fullName?.toUpperCase()} />
              <CertificateRow label="S/o or D/o Guardian's Name" value={details.fatherName} />
              <CertificateRow
                label="bearing University Registration/Enrolment No."
                value={details.registrationNumber}
              />
              <CertificateRow label="Name of the Institution" value={details.collegeName} />
              <div className="fg-cert-row">
                <span>Session</span>
                <span className="fg-cert-value fg-cert-value-short">{details.academicSession}</span>
                <span>with Major in Subject</span>
                <span className="fg-cert-value">{details.majorSubject}</span>
              </div>

              <p className="fg-cert-sentence">has successfully completed his/her internship with our organisation.</p>
              <div className="fg-cert-row">
                <span>Internship Duration From</span>
                <span className="fg-cert-value fg-cert-value-short">{formatCertificateDate(details.batchStartDate)}</span>
                <span>to</span>
                <span className="fg-cert-value fg-cert-value-short">{formatCertificateDate(details.batchEndDate)}</span>
              </div>
              <CertificateRow label="Total Hours Completed" value={details.totalDurationHours?.toString()} />

              <p className="fg-cert-assessment">Internship Performance Assessment</p>
              <CertificateRow label="During the internship the student worked on..." />
              <p className="fg-cert-sentence">
                Based on our observation and mentorship, we assess the student's performance as follows:
              </p>

              <table className="fg-cert-table">
                <thead>
                  <tr>
                    <th>S.No.</th>
                    <th>Assessment Criteria</th>
                    <th>Rating (Outstanding / Good / Satisfactory / Needs Improvement)</th>
                  </tr>
                </thead>
                <tbody>
                  {CRITERIA.map((criterion, index) => (
                    <tr key={criterion}>
                      <td>{index + 1}.</td>
                      <td>{criterion}</td>
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="fg-cert-sign">
                <b>Signature of IPO Supervisor/Head</b>
                <div>Name:</div>
                <div>Designation:</div>
                <div>Organization Seal:</div>
                <div>Date:</div>
                <div>Place:</div>
              </div>

              <footer className="fg-cert-footer">
                <div>
                  <span><MapPin size={13} /> C-6, Central Ashoka, Argora Ranchi Jharkhand, India</span>
                  <span><Mail size={13} /> ficusglobal18@gmail.com</span>
                  <span><Globe size={13} /> www.ficusglobal.com</span>
                </div>
                <div>
                  <span><Phone size={13} /> +91-8102853485</span>
                  <span>+91-7545994499</span>
                </div>
              </footer>
            </section>
          </div>
        </div>
      </div>
    );
  },
);
