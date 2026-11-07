import { RefreshCw, TriangleAlert, WifiOff } from "lucide-react";
import { cn } from "../../lib/utils";
import "../../styles/skeleton.css";

interface ErrorStateProps {
  // "Couldn't load colleges"
  title: string;
  // The reason, as the API reported it
  message: string;
  onRetry?: () => void;
  // Smaller, for inside a card
  compact?: boolean;
  className?: string;
}

// Shown when a request fails: what failed, why, and a Retry button. It reserves roughly the height of the
// content it replaces, so a failure does not make the page jump either.
export function ErrorState({ title, message, onRetry, compact = false, className }: ErrorStateProps) {
  // status 0 messages come from api's "Cannot reach the server" (offline, CORS, dropped connection)
  const offline = /cannot reach the server|network|failed to fetch/i.test(message);
  const Icon = offline ? WifiOff : TriangleAlert;
  return (
    <div className={cn("error-state", compact && "is-compact", className)} role="alert">
      <span className="error-state-icon">
        <Icon size={compact ? 18 : 22} />
      </span>
      <div className="error-state-text">
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button type="button" className="button button-outline error-state-retry" onClick={onRetry}>
          <RefreshCw size={14} /> Try again
        </button>
      )}
    </div>
  );
}
