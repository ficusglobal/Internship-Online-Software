import { Check } from "lucide-react";

export interface StepInfo {
  label: string;
  // Longer wording for the "Step 3 of 7" line on narrow screens
  title: string;
}

interface RegistrationStepperProps {
  steps: StepInfo[];
  // 0-based index of the step being shown
  current: number;
  // Steps up to here can be opened again (the user has already been through them)
  reached: number;
  // Set once the account exists: earlier steps can no longer be edited
  locked: boolean;
  onSelect: (index: number) => void;
}

// The progress bar of the registration: numbered circles joined by a line that fills as steps are completed.
// On wide screens every step is labelled; on phones only the current step is, with "Step 3 of 7" above.
// Completed steps are buttons that go back to that step (until the account is created).
export function RegistrationStepper({ steps, current, reached, locked, onSelect }: RegistrationStepperProps) {
  const percent = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 0;
  return (
    <nav className="reg-stepper" aria-label="Registration progress">
      <p className="reg-stepper-summary">
        <b>
          Step {current + 1} of {steps.length}
        </b>
        <span>{steps[current].title}</span>
      </p>
      <div className="reg-stepper-track" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      <ol className="reg-stepper-list">
        {steps.map((step, index) => {
          const state = index < current ? "done" : index === current ? "active" : "todo";
          const clickable = !locked && index < current && index <= reached;
          const marker = state === "done" ? <Check size={14} strokeWidth={3} /> : index + 1;
          return (
            <li key={step.label} className={`reg-step is-${state}`}>
              {clickable ? (
                <button type="button" className="reg-step-button" onClick={() => onSelect(index)} aria-label={`Go back to step ${index + 1}: ${step.title}`}>
                  <span className="reg-step-dot">{marker}</span>
                  <span className="reg-step-label">{step.label}</span>
                </button>
              ) : (
                <span className="reg-step-button" aria-current={state === "active" ? "step" : undefined}>
                  <span className="reg-step-dot">{marker}</span>
                  <span className="reg-step-label">{step.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
