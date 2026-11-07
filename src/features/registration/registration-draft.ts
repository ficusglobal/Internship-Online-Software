// The registration form is kept in sessionStorage, so a reload (or an accidental refresh) does not lose what was typed.
// It lives only in this tab and is removed when the registration completes or the student starts over.
// Passwords and the terms checkbox are never stored: they are asked again at the Review step.
const PREFIX = "ficus.registration.draft.v1:";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface RegistrationDraft<Values, Session, Proof, Payment> {
  savedAt: number;
  values: Values;
  step: number;
  reached: number;
  session: Session | null;
  emailProof: Proof | null;
  payment: Payment | null;
}

const keyOf = (scope: string) => `${PREFIX}${scope}`;

export function loadDraft<D extends { savedAt: number }>(scope: string): D | null {
  try {
    const raw = window.sessionStorage.getItem(keyOf(scope));
    if (!raw) return null;
    const draft = JSON.parse(raw) as D;
    if (!draft || typeof draft.savedAt !== "number" || Date.now() - draft.savedAt > MAX_AGE_MS) {
      clearDraft(scope);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveDraft(scope: string, draft: object) {
  try {
    window.sessionStorage.setItem(keyOf(scope), JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // Storage is full or blocked (private window): the form works the same, it just is not remembered
  }
}

export function clearDraft(scope: string) {
  try {
    window.sessionStorage.removeItem(keyOf(scope));
  } catch {
    // nothing to clear
  }
}
