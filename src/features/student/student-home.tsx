import { Award, BookOpen, CalendarCheck, FileText, GraduationCap, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { acceptanceLetterApi, ApiError, authApi, type AcceptanceLetter } from "../../lib/auth-api";
import { Button } from "../../shared/components/ui";
import "../../styles/student-home.css";

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
}

// Student landing page after sign-in. Only the acceptance letter is available for now;
// the other options are placeholders until those screens are built.
export function StudentHome({ name, onOpenLetter, onLogout }: StudentHomeProps) {
  const [status, setStatus] = useState<LetterStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
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
          setStatus({ letter, paid: ISSUED_STATUSES.has(student.registrationStatus ?? "") });
        }
      } catch {
        if (active) setFailed(true);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const letterMessage = () => {
    if (!status) return "Checking your acceptance letter…";
    if (status.letter) return `Your acceptance letter is issued. Letter No. ${status.letter.letterNumber}.`;
    if (status.paid) return "Your acceptance letter is being prepared. If it does not appear soon, contact support.";
    return "Your acceptance letter is not issued yet. It is issued after your internship fee is paid.";
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

        <div className={`student-home-status ${status?.letter ? "is-issued" : ""}`} role="status">
          {failed ? "We could not load your status. Please refresh the page." : letterMessage()}
        </div>

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
