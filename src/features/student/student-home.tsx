import { Award, BookOpen, CalendarCheck, FileText, GraduationCap, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { acceptanceLetterApi, ApiError, authApi, type AcceptanceLetter, type StudentDetails } from "../../lib/auth-api";
import { ErrorState } from "../../shared/components/error-state";
import { Skeleton, SkeletonRegion } from "../../shared/components/skeleton";
import { Button } from "../../shared/components/ui";
import "../../styles/student-home.css";
import "../../styles/consent.css";

interface StudentHomeProps {
  name: string;
  onOpenLetter: () => void;
  onLogout: () => void;
}

// The letter is issued once the fee is paid (ENROLLED or later)
const ISSUED_STATUSES = new Set(["ENROLLED", "IN_PROGRESS", "COMPLETED"]);

interface LetterStatus {
  letter: AcceptanceLetter | null;
  paid: boolean;
  student: Partial<StudentDetails>;
}

const GENDER_LABELS: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

// Student landing page after sign-in. Only the acceptance letter is available for now;
// the other options are placeholders until those screens are built.
export function StudentHome({ name, onOpenLetter, onLogout }: StudentHomeProps) {
  const [status, setStatus] = useState<LetterStatus | null>(null);
  // The failure message (empty = none); "Try again" runs the load again
  const [failed, setFailed] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setFailed("");
    setStatus(null);
    const load = async () => {
      try {
        const student = await authApi.getStudentDetails();
        let letter: AcceptanceLetter | null = null;
        try {
          letter = await acceptanceLetterApi.getMine();
        } catch (err) {
          if (!(err instanceof ApiError) || err.status !== 404) throw err;
        }
        if (active) {
          setStatus({ letter, paid: ISSUED_STATUSES.has(student.registrationStatus ?? ""), student });
        }
      } catch (err) {
        if (active) setFailed(err instanceof Error && err.message ? err.message : "We could not load your details.");
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const letterMessage = () => {
    if (!status) return "Checking your acceptance letter…";
    if (status.letter) return `Your acceptance letter is issued. Letter No. ${status.letter.letterNumber}.`;
    if (status.paid) return "Your acceptance letter is being prepared. If it does not appear soon, contact support.";
    if (status.student.registrationStatus === "CANCELLED") return "Your registration is cancelled. Please contact support.";
    return "Your acceptance letter is not issued yet. Open it below to upload your consent letter and pay the internship fee.";
  };

  const options = [
    { title: "Acceptance letter", icon: FileText, action: onOpenLetter, text: "View and download your letter" },
    { title: "Download certificate", icon: Award, action: undefined, text: "Available after completion" },
    { title: "View course", icon: BookOpen, action: undefined, text: "Your course details" },
    { title: "View attendance", icon: CalendarCheck, action: undefined, text: "Your attendance record" },
  ];

  return (
    <main className="student-home">
      <header className="student-home-header">
        <div className="student-home-brand">
          <span className="brand-mark">
            <GraduationCap size={20} />
          </span>
          Ficus Global
        </div>
        <Button className="button-outline" onClick={onLogout}>
          <LogOut size={16} /> Logout
        </Button>
      </header>

      <section className="student-home-body">
        <div className="student-home-welcome">
          <h1>Welcome, {name}</h1>
          <p>Choose what you want to open. Your details will appear here.</p>
        </div>

        {failed ? (
          <ErrorState title="We could not load your details" message={failed} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <div className={`student-home-status ${status?.letter ? "is-issued" : ""}`} role="status">
            {status ? letterMessage() : <Skeleton height={16} width="60%" />}
          </div>
        )}

        {status ? <StudentProfile student={status.student} /> : !failed && <StudentProfileSkeleton />}

        <div className="student-home-grid">
          {options.map((option) => {
            const Icon = option.icon;
            const available = Boolean(option.action);
            return (
              <button
                key={option.title}
                type="button"
                className={`student-home-card ${available ? "" : "is-soon"}`}
                onClick={option.action}
                disabled={!available}
              >
                <span className="student-home-card-icon">
                  <Icon size={22} />
                </span>
                <span className="student-home-card-title">{option.title}</span>
                <span className="student-home-card-text">{option.text}</span>
                {!available && <span className="student-home-soon">Coming soon</span>}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

// Profile from GET /student/me: personal, academic, college and internship details
function StudentProfile({ student }: { student: Partial<StudentDetails> }) {
  const address = [student.collegeAddress, student.city, student.state, student.pincode]
    .filter((part) => part?.trim())
    .join(", ");
  const rows: Array<[string, string | undefined]> = [
    ["Name / नाम", student.fullName],
    ["Father's name / पिता का नाम", student.fatherName],
    ["Gender / लिंग", student.gender ? GENDER_LABELS[student.gender] ?? student.gender : undefined],
    ["Email / ईमेल", student.email],
    ["Mobile / मोबाइल", student.mobileNo],
    ["College / कॉलेज", student.collegeName && (student.collegeCode ? `${student.collegeName} (${student.collegeCode})` : student.collegeName)],
    ["College address / पता", address],
    ["Degree / डिग्री", student.degree],
    ["Department / विभाग", [student.department, student.departmentOther].filter(Boolean).join(" · ") || undefined],
    ["Semester / सेमेस्टर", student.semester ? String(student.semester) : undefined],
    ["Academic session / सत्र", student.academicSession],
    ["Major subject / मुख्य विषय", student.majorSubject],
    ["University registration no.", student.registrationNumber],
    ["College roll no.", student.collegeRollNumber],
    ["Course / कोर्स", student.courseName],
    ["Batch / बैच", student.batchName],
    ["Internship registration no.", student.internshipRegistrationNumber],
    ["Registration status / स्थिति", student.registrationStatus],
  ];
  return (
    <section className="student-profile" aria-label="My details">
      <h2>My details / मेरी जानकारी</h2>
      <dl>
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

// Same card as StudentProfile: heading, then label/value rows
function StudentProfileSkeleton() {
  return (
    <SkeletonRegion label="Loading your details" className="student-profile">
      <Skeleton width={180} height={22} />
      <dl>
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index}>
            <Skeleton width="40%" height={12} />
            <Skeleton width="75%" height={16} style={{ marginTop: 8 }} />
          </div>
        ))}
      </dl>
    </SkeletonRegion>
  );
}
