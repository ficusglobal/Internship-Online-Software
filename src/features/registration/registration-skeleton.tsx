import { Skeleton } from "../../shared/components/skeleton";
import "../../styles/registration-flow.css";

// The registration card while its code (and the form's lists) load: same fixed size, heading, stepper, fields and
// footer, so the page does not shift when the real form replaces it.
export function RegistrationSkeleton() {
  return (
    <div className="reg-card" role="status" aria-busy="true" aria-label="Loading registration">
      <header className="reg-head">
        <div style={{ flex: 1 }}>
          <Skeleton width={210} height={24} />
          <Skeleton width="70%" height={14} style={{ marginTop: 10 }} />
        </div>
      </header>
      <div className="reg-stepper">
        <div className="reg-stepper-summary" style={{ display: "none" }} />
        <ol className="reg-stepper-list">
          {Array.from({ length: 7 }, (_, index) => (
            <li key={index} className="reg-step">
              <span className="reg-step-button">
                <Skeleton width={32} height={32} radius="full" />
                <Skeleton width={44} height={10} className="reg-step-label" />
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="reg-body">
        <Skeleton width={200} height={20} style={{ marginBottom: 18 }} />
        <div className="reg-fields">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="reg-field" key={index}>
              <Skeleton width="45%" height={13} />
              <Skeleton height={46} radius={12} />
            </div>
          ))}
        </div>
      </div>
      <footer className="reg-foot">
        <Skeleton width={120} height={46} radius={12} />
        <Skeleton width={190} height={46} radius={12} />
      </footer>
    </div>
  );
}
