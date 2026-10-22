import { Building2, GraduationCap, LogOut } from "lucide-react";
import { useState } from "react";
import { AcceptanceLetter } from "../letter/acceptance-letter";
import { StudentRegistrationForm } from "../registration/student-registration-form";
import { toast } from "../../shared/components/toast";
import { Button } from "../../shared/components/ui";
import type { StudentDetails } from "../../lib/auth-api";

interface CyberCafeWorkspaceProps {
  onLogout: () => void;
}

interface RegisteredStudent {
  token: string;
  snapshot: Partial<StudentDetails>;
}

// Signed-in cyber cafe registers students with the same form + payment flow a
// student uses, then gets that student's acceptance letter to download/print.
export function CyberCafeWorkspace({ onLogout }: CyberCafeWorkspaceProps) {
  const [registered, setRegistered] = useState<RegisteredStudent | null>(null);
  const [formKey, setFormKey] = useState(0);

  if (registered) {
    return (
      <AcceptanceLetter
        authToken={registered.token}
        fallbackDetails={registered.snapshot}
        onLogout={onLogout}
        onRegisterAnother={() => {
          setRegistered(null);
          setFormKey((key) => key + 1);
        }}
      />
    );
  }

  return (
    <main className="acceptance-letter-page">
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
        </div>
      </header>
      <section className="cafe-workspace">
        <div className="auth-card cafe-workspace-card">
          <div className="auth-card-heading">
            <span className="auth-eyebrow">
              <Building2 size={14} /> CYBER CAFE · STUDENT REGISTRATION
            </span>
            <h2>Register a student</h2>
            <p>
              Fill in the student's details, collect the internship fee, and download their acceptance
              letter once registration completes.
            </p>
          </div>
          <StudentRegistrationForm
            key={formKey}
            mode="cyber-cafe"
            onComplete={(response, message, snapshot) => {
              toast.success(message);
              setRegistered({ token: response.token, snapshot });
            }}
          />
        </div>
      </section>
    </main>
  );
}
