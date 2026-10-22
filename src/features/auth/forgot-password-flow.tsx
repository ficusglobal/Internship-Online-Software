import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { passwordResetApi } from "../../lib/auth-api";
import { toast } from "../../shared/components/toast";
import { Button, Input } from "../../shared/components/ui";
import "../../styles/email-verification.css";

type Stage = "email" | "reset";

const RESEND_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ForgotPasswordFlowProps {
  onBack: () => void;
  onDone: () => void;
}

// Forgot password for students. Step 1 sends the code to the email. Step 2 takes the code,
// the new password and its confirmation on one page and resets the password with a single API call.
export function ForgotPasswordFlow({
  onBack,
  onDone,
}: ForgotPasswordFlowProps) {
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  const address = email.trim();

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(
      () => setResendIn((seconds) => seconds - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  // Runs one request, showing its error inline and in a toast
  const runRequest = async (request: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await request();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async () => {
    await passwordResetApi.requestCode(address);
    setCode("");
    setResendIn(RESEND_SECONDS);
    setStage("reset");
    toast.success(
      "If an account exists for this email, a 6-digit code has been sent.",
    );
  };

  const resetPassword = async () => {
    const result = await passwordResetApi.reset({
      email: address,
      otp: code,
      newPassword,
      confirmPassword,
    });
    toast.success(result.message);
    onDone();
  };

  const onEmailSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(address)) {
      setError("Enter a valid email address.");
      return;
    }
    void runRequest(sendCode);
  };

  const onResetSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    void runRequest(resetPassword);
  };

  const resend = () => {
    void runRequest(async () => {
      await passwordResetApi.requestCode(address);
      setCode("");
      setResendIn(RESEND_SECONDS);
      toast.success("A new code has been requested.");
    });
  };

  return (
    <div className="forgot-password">
      <div className="forgot-password-steps" aria-label="Password reset steps">
        <span className={stage === "email" ? "active" : "complete"}>
          {stage === "reset" && <CheckCircle2 size={14} />} 1. Email
        </span>
        <span className={stage === "reset" ? "active" : ""}>
          2. Code &amp; new password
        </span>
      </div>

      {stage === "email" && (
        <form className="auth-form" onSubmit={onEmailSubmit} noValidate>
          <label>
            Registered email / पंजीकृत ईमेल
            <div className="auth-input">
              <Mail size={17} />
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </label>
          {error && (
            <p className="auth-api-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy && <LoaderCircle className="spin" size={16} />}
            Send code / कोड भेजें <ArrowRight size={16} />
          </Button>
        </form>
      )}

      {stage === "reset" && (
        <form className="auth-form" onSubmit={onResetSubmit} noValidate>
          <p className="registration-step-copy">
            Enter the 6-digit code sent to {address} (valid for 10 minutes), then
            choose a new password. / {address} पर भेजा गया 6 अंकों का कोड दर्ज करें
            और नया पासवर्ड चुनें।
          </p>
          <label>
            Verification code / सत्यापन कोड
            <div className="auth-input">
              <LockKeyhole size={17} />
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="6-digit code"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </div>
          </label>
          <label>
            New password / नया पासवर्ड
            <div className="auth-input">
              <LockKeyhole size={17} />
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
          </label>
          <label>
            Confirm new password / नए पासवर्ड की पुष्टि करें
            <div className="auth-input">
              <LockKeyhole size={17} />
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </label>
          {error && (
            <p className="auth-api-error" role="alert">
              {error}
            </p>
          )}
          <div className="forgot-password-actions">
            <Button
              type="button"
              className="button-outline"
              onClick={() => {
                setError("");
                setStage("email");
              }}
              disabled={busy}
            >
              Change email
            </Button>
            <Button
              type="button"
              className="button-outline"
              onClick={resend}
              disabled={busy || resendIn > 0}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={16} />}
              Reset password / पासवर्ड रीसेट करें <ArrowRight size={16} />
            </Button>
          </div>
        </form>
      )}

      <button type="button" className="auth-role-switch" onClick={onBack}>
        Back to sign in / साइन इन पर वापस जाएं
      </button>
    </div>
  );
}
