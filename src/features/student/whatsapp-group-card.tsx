import { MessageCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, whatsappGroupApi, type StudentGroup } from "../../lib/auth-api";
import { Skeleton } from "../../shared/components/skeleton";
import { Card } from "../../shared/components/ui";

// The backend only stores https://chat.whatsapp.com/ invite links; anything else is not rendered as a link
const INVITE_PREFIX = "https://chat.whatsapp.com/";

interface WhatsappGroupCardProps {
  registrationId: string;
  authToken?: string;
}

// Group link of a paid registration. 404 means the admin has not created the group yet
// (the student is emailed when it is); 400 means the payment is not confirmed.
export function WhatsappGroupCard({ registrationId, authToken }: WhatsappGroupCardProps) {
  const [group, setGroup] = useState<StudentGroup | null>(null);
  const [message, setMessage] = useState("");
  // Only a real failure (not "no group yet") can be retried
  const [retryable, setRetryable] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setGroup(null);
    setMessage("");
    setRetryable(false);
    whatsappGroupApi
      .forRegistration(registrationId, authToken)
      .then((result) => active && setGroup(result))
      .catch((error: unknown) => {
        if (!active) return;
        setRetryable(!(error instanceof ApiError && error.status === 404));
        setMessage(
          error instanceof ApiError && error.status === 404
            ? "Your WhatsApp group is not ready yet. The link will be emailed to you. / ग्रुप लिंक ईमेल से भेजा जाएगा।"
            : error instanceof Error
              ? error.message
              : "Unable to load the WhatsApp group.",
        );
      });
    return () => {
      active = false;
    };
  }, [registrationId, authToken, reloadKey]);

  const safeUrl = group?.groupUrl?.startsWith(INVITE_PREFIX) ? group.groupUrl : "";

  return (
    <Card className="info-card whatsapp-group-card">
      <h3>WhatsApp group / व्हाट्सऐप ग्रुप</h3>
      {group ? (
        <>
          <p>{group.groupName}</p>
          {safeUrl ? (
            <a className="button whatsapp-group-link" href={safeUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} /> Join group / ग्रुप से जुड़ें
            </a>
          ) : (
            <small>The group link is not valid. Please contact support.</small>
          )}
        </>
      ) : message ? (
        <>
          <small>{message}</small>
          {retryable && (
            <button type="button" className="button button-outline" onClick={() => setReloadKey((key) => key + 1)}>
              <RefreshCw size={14} /> Try again
            </button>
          )}
        </>
      ) : (
        <div role="status" aria-busy="true">
          <Skeleton height={16} width="70%" />
          <Skeleton height={40} width={170} radius={10} style={{ marginTop: 12 }} />
        </div>
      )}
    </Card>
  );
}
