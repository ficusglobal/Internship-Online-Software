import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, authApi } from "../../lib/auth-api";

// Same rule as the backend: ten digits starting with 6, 7, 8 or 9
export const MOBILE_PATTERN = /^[6-9]\d{9}$/;

export type MobileStatus =
  | "idle" // fewer than 10 digits typed: nothing to check yet
  | "invalid" // 10 digits but not a valid Indian mobile number
  | "checking"
  | "available"
  | "taken" // already registered
  | "error"; // the check itself failed (the register call checks again, so this does not block)

export interface MobileCheck {
  status: MobileStatus;
  message: string;
}

const IDLE: MobileCheck = { status: "idle", message: "" };

// Answers the backend already gave this session, so editing and retyping a number does not ask again
const answers = new Map<string, MobileCheck>();

// Checks a mobile number against the backend (GET /auth/register/check) the moment 10 digits are typed.
// Typing more or fewer digits cancels the check in flight; a late answer for an old number is ignored.
export function useMobileAvailability(mobile: string): MobileCheck & { recheck: () => void } {
  const [check, setCheck] = useState<MobileCheck>(IDLE);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const request = ++latest.current;
    if (mobile.length !== 10) {
      setCheck(IDLE);
      return;
    }
    if (!MOBILE_PATTERN.test(mobile)) {
      setCheck({ status: "invalid", message: "Enter a valid mobile number starting with 6, 7, 8 or 9 / 6, 7, 8 या 9 से शुरू होने वाला नंबर" });
      return;
    }
    const known = answers.get(mobile);
    if (known) {
      setCheck(known);
      return;
    }
    setCheck({ status: "checking", message: "Checking this number… / नंबर जाँच रहे हैं…" });
    authApi
      .checkAvailability({ mobileNo: mobile })
      .then((result) => {
        if (request !== latest.current) return;
        const next: MobileCheck = result.mobileNoExists || !result.available
          ? { status: "taken", message: result.messages?.mobileNo ?? "This mobile number is already registered. Try signing in. / यह नंबर पहले से पंजीकृत है।" }
          : { status: "available", message: "This number is available / नंबर उपलब्ध है" };
        answers.set(mobile, next);
        setCheck(next);
      })
      .catch((error: unknown) => {
        if (request !== latest.current) return;
        // A 400 means the backend rejected the format itself; anything else is a failed check
        setCheck(
          error instanceof ApiError && error.status === 400
            ? { status: "invalid", message: error.message }
            : { status: "error", message: "Could not check this number right now. We will check again when you continue." },
        );
      });
  }, [mobile, attempt]);

  const recheck = useCallback(() => {
    answers.delete(mobile);
    setAttempt((value) => value + 1);
  }, [mobile]);

  return { ...check, recheck };
}
