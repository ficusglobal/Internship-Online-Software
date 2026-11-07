import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { emailVerificationApi, type MessageResult } from "../../lib/auth-api";
import { toast } from "../../shared/components/toast";
import { Button, Input } from "../../shared/components/ui";
import "../../styles/email-verification.css";

// Backend: app.otp.resend-cooldown-seconds
const RESEND_SECONDS = 60;

// The two endpoints behind the code box: send a code, then check it
export interface EmailOtpApi<Result> {
  sendCode: (email: string) => Promise<MessageResult>;
  verifyCode: (email: string, otp: string) => Promise<Result>;
}

interface EmailOtpProps<Result> {
  email: string;
  onVerified: (result: Result) => void;
  // True when a code was just sent, so resend starts on cooldown
  codeSent?: boolean;
  // Send the first code as soon as the box appears (once, even under React StrictMode)
  autoSend?: boolean;
  // Defaults to the existing-account endpoints (/auth/email/send-otp and /auth/email/verify-otp)
  api?: EmailOtpApi<Result>;
  // Called when sending a code is refused, so the owner can react (e.g. "this email is already registered")
  onSendFailed?: (error: unknown) => void;
}

// 6-digit email code. By default it verifies an existing account's email; the registration form passes
// `registrationEmailApi` to verify an email before the account exists.
// The existing-account send endpoint answers the same way whether or not a code went out (cooldown, hourly cap, already verified).
export function EmailOtp<Result = MessageResult>({
  email,
  onVerified,
  codeSent = false,
  autoSend = false,
  api = emailVerificationApi as unknown as EmailOtpApi<Result>,
  onSendFailed,
}: EmailOtpProps<Result>) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"" | "sending" | "verifying">("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(codeSent);
  const [resendIn, setResendIn] = useState(codeSent ? RESEND_SECONDS : 0);
  const autoSent = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const send = async () => {
    setBusy("sending");
    setError("");
    try {
      const result = await api.sendCode(email);
      setCode("");
      setSent(true);
      setResendIn(RESEND_SECONDS);
      toast.success(result.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send the code.";
      setError(message);
      toast.error(message);
      onSendFailed?.(err);
    } finally {
      setBusy("");
    }
  };

  useEffect(() => {
    if (!autoSend || codeSent || autoSent.current) return;
    autoSent.current = true;
    void send();
    // Only the first render may send; later sends are the resend button
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy("verifying");
    setError("");
    try {
      const result = await api.verifyCode(email, code);
      toast.success("Email verified successfully.");
      onVerified(result);
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
            enterKeyHint="done"
            onKeyDown={(event) => {
              // Enter checks the code; it must not submit the surrounding form (which would move to the next step)
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (code.length === 6 && busy === "") void verify();
            }}
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
