import { CreditCard, Download, GraduationCap, Home, LoaderCircle, LogOut, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Card } from "../../shared/components/ui";
import { toast } from "../../shared/components/toast";
import { AcceptanceLetterDocument } from "./acceptance-letter-document";
import {
  acceptanceLetterApi,
  ApiError,
  authApi,
  type AcceptanceLetter as IssuedLetter,
} from "../../lib/auth-api";
import { buildLetterNumber, downloadLetterPdf, type LetterDetails } from "../../lib/acceptance-letter";
import { PaymentCancelledError } from "../../lib/payment";
import { checkoutRegistration, confirmRegistrationPayment } from "../../lib/registration-payment";
import { formatCurrency } from "../../lib/utils";
import "../../styles/letter-number.css";

interface AcceptanceLetterProps {
  studentName?: string;
  // Token of the student whose letter is shown. Defaults to the signed-in
  // session; a cyber cafe passes the newly registered student's token.
  authToken?: string;
  // Details captured during registration, used until/unless the API responds.
  fallbackDetails?: LetterDetails;
  onLogout: () => void;
  onContinue?: () => void;
  onRegisterAnother?: () => void;
}

// The letter is issued by the backend once payment is confirmed (ENROLLED or later)
const ISSUED_STATUSES = new Set(["ENROLLED", "IN_PROGRESS", "COMPLETED"]);

// Returns the issued letter, or null while the registration is not paid yet.
// A paid registration whose letter has not been issued yet gets it now (idempotent on the backend).
// When issuing fails, the reason is returned so the page can show it.
async function loadLetter(
  details: LetterDetails,
  authToken?: string,
): Promise<{ letter: IssuedLetter | null; issueError: string }> {
  try {
    return { letter: await acceptanceLetterApi.getMine(authToken), issueError: "" };
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
  }
  if (!details.registrationId || !ISSUED_STATUSES.has(details.registrationStatus ?? "")) {
    return { letter: null, issueError: "" };
  }
  try {
    return { letter: await acceptanceLetterApi.generate(details.registrationId, authToken), issueError: "" };
  } catch (err) {
    return { letter: null, issueError: err instanceof Error ? err.message : "Unknown error" };
  }
}

const formatIssueDate = (value?: string) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
};

export function AcceptanceLetter({
  studentName,
  authToken,
  fallbackDetails,
  onLogout,
  onContinue,
  onRegisterAnother,
}: AcceptanceLetterProps) {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<LetterDetails | null>(null);
  const [letter, setLetter] = useState<IssuedLetter | null>(null);
  const [issueError, setIssueError] = useState("");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [paying, setPaying] = useState(false);
  const letterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const student = await authApi.getStudentDetails(authToken);
        const merged: LetterDetails = { ...fallbackDetails, ...student };
        if (!active) return;
        setDetails(merged);
        const issued = await loadLetter(merged, authToken);
        if (active) {
          setLetter(issued.letter);
          setIssueError(issued.issueError);
        }
      } catch (err: unknown) {
        if (!active) return;
        if (fallbackDetails) {
          setDetails(fallbackDetails);
          return;
        }
        const message = err instanceof Error ? err.message : "Unable to load student details";
        setError(message);
        toast.error(message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [authToken, fallbackDetails]);

  const studentId = details?.id || (authToken ? "" : localStorage.getItem("userId")) || "";
  // The issued letter carries the internship period and hours, which the certificate page needs
  const letterDetails: LetterDetails = {
    ...details,
    id: studentId,
    fullName: details?.fullName || studentName,
    fatherName: letter?.fatherName ?? details?.fatherName,
    registrationNumber: letter?.studentRegistrationNumber ?? details?.registrationNumber,
    collegeName: letter?.collegeName ?? details?.collegeName,
    academicSession: letter?.academicSession ?? details?.academicSession,
    majorSubject: letter?.majorSubject ?? details?.majorSubject,
    batchStartDate: letter?.batchStartDate,
    batchEndDate: letter?.batchEndDate,
    totalDurationHours: letter?.totalDurationHours,
    letterNumber: letter?.letterNumber,
    acceptanceDate: letter?.generatedAt ?? details?.acceptanceDate,
  };
  const issueDate = formatIssueDate(letter?.generatedAt);
  const needsPayment = Boolean(details?.registrationId) && !letter && !ISSUED_STATUSES.has(details?.registrationStatus ?? "");

  // Pays the registration from this page (used when the student left the form before paying)
  const payNow = async () => {
    if (!details?.registrationId) return;
    const token = authToken ?? localStorage.getItem("authToken") ?? undefined;
    setPaying(true);
    try {
      const payment = await checkoutRegistration({
        registrationId: details.registrationId,
        authToken: token,
        description: `${details.courseName ?? "Internship"} · ${details.batchName ?? ""}`,
        customer: {
          name: details.fullName ?? "",
          email: details.email ?? "",
          contact: details.mobileNo ?? "",
        },
        notes: { registrationNumber: details.registrationNumber ?? "" },
      });
      await confirmRegistrationPayment(payment, token);
      const issued = await acceptanceLetterApi.generate(details.registrationId, token);
      setLetter(issued);
      setDetails({ ...details, registrationStatus: "ENROLLED", paymentStatus: "PAID", paymentId: payment.paymentId });
      toast.success("Payment received. Your acceptance letter is ready.");
    } catch (err) {
      if (err instanceof PaymentCancelledError) {
        toast.error("Payment cancelled. You can pay again from this page.");
      } else {
        toast.error(err instanceof Error ? err.message : "Payment could not be completed.");
      }
    } finally {
      setPaying(false);
    }
  };

  const handleDownload = async () => {
    // Explain instead of silently doing nothing when there is no letter to download yet
    if (!letter) {
      toast.error("Your acceptance letter is issued after the fee is paid. Complete the payment to download it.");
      return;
    }
    if (!letterRef.current) {
      toast.error("The letter is still loading. Please try again.");
      return;
    }
    setDownloading(true);
    try {
      const fileName = `Acceptance-Letter-${buildLetterNumber(letterDetails).replace(/\//g, "-")}.pdf`;
      await downloadLetterPdf(letterRef.current, fileName);
      toast.success("Acceptance letter downloaded successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to download the acceptance letter.");
    } finally {
      setDownloading(false);
    }
  };

  const header = (
    <header className="acceptance-letter-header">
      <div className="acceptance-letter-brand">
        <span className="brand-mark">
          <GraduationCap size={20} />
        </span>
        Ficus Global
      </div>
      <div className="acceptance-letter-actions">
        <Button className="button-outline" onClick={onLogout}>
          <LogOut size={16} /> Logout
        </Button>
        {onRegisterAnother && (
          <Button onClick={onRegisterAnother}>
            <UserPlus size={16} /> Register another student
          </Button>
        )}
        {onContinue && (
          <Button onClick={onContinue}>
            <Home size={16} /> Home
          </Button>
        )}
      </div>
    </header>
  );

  if (loading || error) {
    return (
      <main className="acceptance-letter-page">
        {header}
        <div className="acceptance-letter-loading">
          {loading ? (
            <>
              <div className="spinner" />
              <p>Loading your acceptance letter...</p>
            </>
          ) : (
            <p className="error-message">{error}</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="acceptance-letter-page">
      {header}
      <section className="acceptance-letter-content fg-letter-layout">
        <div className="fg-letter-column">
          <div className="fg-letter-toolbar">
            <div>
              <h1>Acceptance Letter</h1>
              <p>
                {letter
                  ? `Letter No. ${letter.letterNumber}. Download your internship acceptance letter below.`
                  : "Your acceptance letter is issued once the internship fee is paid."}
              </p>
            </div>
            <Button onClick={() => void handleDownload()} disabled={downloading}>
              {downloading ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
              {downloading ? "Preparing PDF…" : "Download PDF"}
            </Button>
          </div>
          <AcceptanceLetterDocument ref={letterRef} details={letterDetails} studentId={studentId} />
        </div>

        <div className="acceptance-letter-info">
          <Card className="info-card letter-number-card">
            <h3>Letter Number / पत्र संख्या</h3>
            <p
              className={letter ? "letter-number" : "letter-number letter-number-pending"}
              aria-live="polite"
            >
              {buildLetterNumber(letterDetails)}
            </p>
            {letter ? (
              issueDate && <small>Issued on {issueDate}</small>
            ) : (
              <small>Not issued yet. It appears here after payment is confirmed.</small>
            )}
            {!letter && issueError && (
              <small className="letter-issue-error" role="alert">
                The letter could not be issued yet ({issueError}). Please contact support with your registration number.
              </small>
            )}
          </Card>

          {needsPayment && (
            <Card className="info-card letter-payment-card">
              <h3>Complete payment / भुगतान पूरा करें</h3>
              <p>
                Your registration is saved. Pay the internship fee to finish registration and receive your
                acceptance letter.
              </p>
              <Button onClick={() => void payNow()} disabled={paying}>
                {paying ? <LoaderCircle className="spin" size={16} /> : <CreditCard size={16} />}
                {paying
                  ? "Processing…"
                  : details?.fee != null
                    ? `Pay ${formatCurrency(details.fee)}`
                    : "Pay now"}
              </Button>
            </Card>
          )}

          <Card className="info-card">
            <h3>Student Details</h3>
            <ul>
              <li><strong>Name:</strong> {letterDetails.fullName}</li>
              <li><strong>Email:</strong> {details?.email}</li>
              <li><strong>Mobile:</strong> {details?.mobileNo}</li>
              <li><strong>University:</strong> {details?.universityName}</li>
              <li><strong>College:</strong> {details?.collegeName}</li>
              <li><strong>Course:</strong> {details?.courseName}</li>
              <li><strong>Batch:</strong> {details?.batchName}</li>
              <li><strong>Registration No:</strong> {details?.registrationNumber}</li>
              <li><strong>Roll No:</strong> {details?.collegeRollNumber}</li>
            </ul>
          </Card>
          <Card className="info-card">
            <h3>Payment</h3>
            <ul>
              <li><strong>Amount:</strong> {details?.fee != null ? formatCurrency(details.fee) : "N/A"}</li>
              {details?.paymentStatus && <li><strong>Status:</strong> {details.paymentStatus}</li>}
              {details?.registrationStatus && <li><strong>Registration:</strong> {details.registrationStatus}</li>}
              {details?.paymentId && <li><strong>Payment ID:</strong> {details.paymentId}</li>}
            </ul>
          </Card>
        </div>
      </section>
    </main>
  );
}
