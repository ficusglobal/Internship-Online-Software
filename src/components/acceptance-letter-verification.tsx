import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "./ui";
import { ApiError, authApi, type StudentDetails } from "../lib/auth-api";

interface AcceptanceLetterVerificationProps {
  studentId: string;
}

type VerificationResult =
  | { status: "loading" }
  | { status: "done"; verified: boolean; student?: Partial<StudentDetails>; reason?: string }
  | { status: "error"; message: string };

export function AcceptanceLetterVerification({ studentId }: AcceptanceLetterVerificationProps) {
  const [result, setResult] = useState<VerificationResult>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setResult({ status: "loading" });
    authApi
      .getStudentById(studentId)
      .then((student) => {
        if (!active) return;
        // Accept an explicit `verified` flag, otherwise a returned student record counts as valid.
        const verified = student?.verified ?? Boolean(student?.id || student?.fullName);
        setResult({ status: "done", verified, student: student ?? undefined });
      })
      .catch((err: unknown) => {
        if (!active) return;
        // 401/403 means the API refused an anonymous check, not that the letter is fake.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setResult({ status: "error", message: "The verification service is not publicly accessible right now. Please try again later." });
        } else if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          setResult({ status: "done", verified: false, reason: err.message });
        } else {
          setResult({ status: "error", message: err instanceof Error ? err.message : "Unable to verify student" });
        }
      });
    return () => {
      active = false;
    };
  }, [studentId]);

  if (result.status === "loading") {
    return (
      <main className="verification-page">
        <div className="verification-container">
          <div className="verification-loading">
            <LoaderCircle className="spin" size={48} />
            <p>Verifying acceptance letter...</p>
          </div>
        </div>
      </main>
    );
  }

  if (result.status === "error") {
    return (
      <main className="verification-page">
        <div className="verification-container">
          <Card className="verification-card verification-error">
            <XCircle size={64} className="error-icon" />
            <h1>Verification unavailable</h1>
            <p>{result.message}</p>
          </Card>
        </div>
      </main>
    );
  }

  const { verified, student, reason } = result;
  return (
    <main className="verification-page">
      <div className="verification-container">
        <Card className={`verification-card ${verified ? "verification-success" : "verification-error"}`}>
          {verified ? <CheckCircle2 size={64} className="success-icon" /> : <XCircle size={64} className="error-icon" />}
          <span className={`verification-result ${verified ? "is-true" : "is-false"}`}>{verified ? "TRUE" : "FALSE"}</span>
          <h1>{verified ? "Acceptance Letter Verified" : "Acceptance Letter Not Verified"}</h1>
          <p>
            {verified
              ? "This acceptance letter was issued by Ficus Global and is valid."
              : "No valid acceptance letter was found for this QR code."}
          </p>
          <div className="verification-details">
            <p><strong>Student ID:</strong> {studentId}</p>
            {verified && student?.fullName && <p><strong>Name:</strong> {student.fullName}</p>}
            {verified && student?.registrationNumber && <p><strong>Registration No:</strong> {student.registrationNumber}</p>}
            {verified && student?.collegeName && <p><strong>Institution:</strong> {student.collegeName}</p>}
            {!verified && reason && <p><strong>Reason:</strong> {reason}</p>}
            <p><strong>Checked on:</strong> {new Date().toLocaleDateString("en-IN")}</p>
          </div>
        </Card>
      </div>
    </main>
  );
}
