import { Download, LoaderCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { downloadLetterPdf, type LetterDetails } from "../../lib/acceptance-letter";
import type { AcceptanceLetter, StudentDetails } from "../../lib/auth-api";
import { Modal } from "../../shared/components/modal";
import { toast } from "../../shared/components/toast";
import { Button } from "../../shared/components/ui";
import { AcceptanceLetterDocument } from "../letter/acceptance-letter-document";
import "../../styles/letter-number.css";

interface StudentCertificateProps {
  student: Partial<StudentDetails>;
  letter: AcceptanceLetter;
  onClose: () => void;
}

// The completion certificate, shown in the student panel (never on the acceptance letter page).
export default function StudentCertificate({ student, letter, onClose }: StudentCertificateProps) {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const details = useMemo<LetterDetails>(
    () => ({
      ...student,
      fullName: student.fullName || letter.studentName,
      fatherName: letter.fatherName ?? student.fatherName,
      registrationNumber: letter.studentRegistrationNumber ?? student.registrationNumber,
      collegeName: letter.collegeName ?? student.collegeName,
      academicSession: letter.academicSession ?? student.academicSession,
      majorSubject: letter.majorSubject ?? student.majorSubject,
      batchStartDate: letter.batchStartDate,
      batchEndDate: letter.batchEndDate,
      totalDurationHours: letter.totalDurationHours,
    }),
    [student, letter],
  );

  const download = async () => {
    if (!certificateRef.current) return;
    setDownloading(true);
    try {
      await downloadLetterPdf(certificateRef.current, `Internship-Certificate-${(details.fullName ?? "student").replace(/\s+/g, "-")}.pdf`);
      toast.success("Certificate downloaded successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to download the certificate.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal title="Internship completion certificate" description="Your certificate is ready to download." onClose={onClose} size="lg" dismissOnBackdrop>
      <div className="ui-modal-body">
        <AcceptanceLetterDocument ref={certificateRef} details={details} studentId={student.id ?? ""} page="certificate" />
      </div>
      <div className="ui-modal-footer">
        <Button className="button-outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={() => void download()} disabled={downloading}>
          {downloading ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
          {downloading ? "Preparing PDF…" : "Download PDF"}
        </Button>
      </div>
    </Modal>
  );
}
