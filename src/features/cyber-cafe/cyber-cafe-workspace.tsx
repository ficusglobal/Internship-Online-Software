import { GraduationCap, LogOut } from "lucide-react";
import { useState } from "react";
import { AcceptanceLetter } from "../letter/acceptance-letter";
import { StudentRegistrationForm } from "../registration/student-registration-form";
import "../../styles/registration-flow.css";
import "../../styles/cafe.css";
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
    <main className="acceptance-letter-page cafe-page">
      <header className="acceptance-letter-header">
        <div className="acceptance-letter-brand">
          <span className="brand-mark">
            <GraduationCap size={20} />
          </span>
          Ficus Global
          <span className="cafe-badge">Cyber cafe workspace</span>
        </div>
        <div className="acceptance-letter-actions">
          <Button className="button-outline" onClick={onLogout}>
            <LogOut size={16} /> Logout
          </Button>
        </div>
      </header>
      {/* The registration card brings its own heading, stepper and buttons */}
      <section className="cafe-workspace reg-stage">
        <StudentRegistrationForm
          key={formKey}
          mode="cyber-cafe"
          onComplete={(response, message, snapshot) => {
            toast.success(message);
            setRegistered({ token: response.token, snapshot });
          }}
        />
      </section>
    </main>
  );
}
