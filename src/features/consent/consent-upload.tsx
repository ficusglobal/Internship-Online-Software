import { CheckCircle2, CircleAlert, Clock, Eye, FileUp, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { consentApi, type ConsentSummary } from "../../lib/auth-api";
import { CONSENT_ACCEPT, CONSENT_MAX_MB, checkConsentFile, openFile } from "../../lib/consent";
import { toast } from "../../shared/components/toast";
import { Button } from "../../shared/components/ui";
import "../../styles/consent.css";

interface ConsentUploadProps {
  registrationId: string;
  // Token of the student (a cyber cafe passes the registered student's token); defaults to the session
  authToken?: string;
  onChange?: (summary: ConsentSummary) => void;
}

// Upload, status and preview of a registration's consent letter. Used in the registration form
// (before payment) and on the acceptance letter page. A new upload resets the review to PENDING;
// an approved letter cannot be replaced by the student (the backend refuses it).
export function ConsentUpload({ registrationId, authToken, onChange }: ConsentUploadProps) {
  const [summary, setSummary] = useState<ConsentSummary | null>(null);
  const [loadError, setLoadError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState<"" | "uploading" | "opening">("");
  const [reloadKey, setReloadKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let active = true;
    setLoadError("");
    consentApi
      .status(registrationId, authToken)
      .then((result) => {
        if (!active) return;
        setSummary(result);
        onChangeRef.current?.(result);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Unable to load the consent status.");
      });
    return () => {
      active = false;
    };
  }, [registrationId, authToken, reloadKey]);

  const choose = async (next: File | undefined) => {
    setFile(null);
    setFileError("");
    if (!next) return;
    const problem = await checkConsentFile(next);
    if (problem) {
      setFileError(problem);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(next);
  };

  const upload = async () => {
    if (!file) return;
    setBusy("uploading");
    setFileError("");
    try {
      const result = await consentApi.upload(registrationId, file, authToken);
      setSummary(result);
      onChange?.(result);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      toast.success("Consent letter uploaded. / सहमति पत्र अपलोड हो गया।");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload the consent letter.";
      setFileError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  };

  const view = async () => {
    setBusy("opening");
    try {
      await openFile(() => consentApi.download(registrationId, authToken));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open the consent letter.");
    } finally {
      setBusy("");
    }
  };

  if (loadError) {
    return (
      <div className="consent-box">
        <p className="registration-status registration-status-error" role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            <RefreshCw size={14} /> Retry
          </button>
        </p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="consent-box">
        <p className="registration-status" role="status">
          <LoaderCircle className="spin" size={16} /> Checking the consent letter… / जाँच हो रही है…
        </p>
      </div>
    );
  }

  const uploaded = Boolean(summary.consentUploaded);
  const approved = uploaded && summary.consentStatus === "APPROVED";
  const rejected = uploaded && summary.consentStatus === "REJECTED";
  const cancelled = summary.registrationStatus === "CANCELLED";

  return (
    <div className="consent-box">
      <div className={`consent-state consent-state-${!uploaded ? "missing" : summary.consentStatus?.toLowerCase()}`} role="status">
        {!uploaded ? (
          <>
            <FileUp size={16} /> Not uploaded yet / अभी अपलोड नहीं हुआ
          </>
        ) : approved ? (
          <>
            <CheckCircle2 size={16} /> Approved / स्वीकृत
          </>
        ) : rejected ? (
          <>
            <CircleAlert size={16} /> Rejected. Please upload a corrected letter. / अस्वीकृत, सही पत्र फिर से अपलोड करें।
          </>
        ) : (
          <>
            <Clock size={16} /> Uploaded, waiting for review / अपलोड हो गया, समीक्षा बाकी है
          </>
        )}
      </div>
      {rejected && summary.rejectionReason && (
        <p className="consent-reason">
          <b>Reason / कारण:</b> {summary.rejectionReason}
        </p>
      )}

      {uploaded && (
        <Button type="button" className="button-outline consent-view" disabled={busy !== ""} onClick={() => void view()}>
          {busy === "opening" ? <LoaderCircle className="spin" size={16} /> : <Eye size={16} />} View uploaded letter
        </Button>
      )}

      {!approved && !cancelled && (
        <div className="consent-picker">
          <label>
            {uploaded ? "Replace the consent letter / सहमति पत्र बदलें" : "Consent letter / सहमति पत्र"}
            <input
              ref={inputRef}
              type="file"
              accept={CONSENT_ACCEPT}
              disabled={busy !== ""}
              onChange={(event) => void choose(event.target.files?.[0])}
            />
          </label>
          <small className="consent-hint">
            PDF, JPG or PNG, up to {CONSENT_MAX_MB} MB. / PDF, JPG या PNG, अधिकतम {CONSENT_MAX_MB} MB।
          </small>
          {fileError && <small className="field-error">{fileError}</small>}
          <Button type="button" disabled={!file || busy !== ""} onClick={() => void upload()}>
            {busy === "uploading" ? <LoaderCircle className="spin" size={16} /> : <FileUp size={16} />}
            {busy === "uploading" ? "Uploading…" : "Upload / अपलोड करें"}
          </Button>
        </div>
      )}
    </div>
  );
}
