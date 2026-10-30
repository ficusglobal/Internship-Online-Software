import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { emailVerificationApi } from "../../lib/auth-api";
import { toast } from "../../shared/components/toast";
import { Button, Input } from "../../shared/components/ui";
import "../../styles/email-verification.css";

// Backend: app.otp.resend-cooldown-seconds
const RESEND_SECONDS = 60;

interface EmailOtpProps {
  email: string;
  onVerified: () => void;
  // True when a code was just sent (the backend emails one on registration), so resend starts on cooldown
  codeSent?: boolean;
}

// 6-digit email code for an existing account: POST /auth/email/send-otp, then /auth/email/verify-otp.
// The send endpoint answers the same way whether or not a code went out (cooldown, hourly cap, already verified).
export function EmailOtp({ email, onVerified, codeSent = false }: EmailOtpProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"" | "sending" | "verifying">("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(codeSent);
  const [resendIn, setResendIn] = useState(codeSent ? RESEND_SECONDS : 0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const send = async () => {
    setBusy("sending");
    setError("");
    try {
      const result = await emailVerificationApi.sendCode(email);
      setCode("");
      setSent(true);
      setResendIn(RESEND_SECONDS);
      toast.success(result.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send the code.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy("verifying");
    setError("");
    try {
      await emailVerificationApi.verifyCode(email, code);
      toast.success("Email verified successfully.");
      onVerified();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to verify the code.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <div className="email-otp-box">
        <div className="email-verify-row">
          <Input
            name="emailOtp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="6-digit code / 6 अंकों का कोड"
            aria-label="Email verification code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <Button type="button" disabled={busy !== "" || code.length !== 6} onClick={() => void verify()}>
            {busy === "verifying" && <LoaderCircle className="spin" size={16} />}
            Verify OTP / OTP सत्यापित करें
          </Button>
        </div>
        {error && <small className="field-error">{error}</small>}
      </div>
      <div className="registration-actions">
        <Button
          type="button"
          className="button-outline"
          disabled={busy !== "" || resendIn > 0}
          onClick={() => void send()}
        >
          {busy === "sending" && <LoaderCircle className="spin" size={16} />}
          {resendIn > 0
            ? `Resend code in ${resendIn}s`
            : sent
              ? "Resend code / कोड फिर से भेजें"
              : "Send code / कोड भेजें"}
        </Button>
      </div>
    </>
  );
}
