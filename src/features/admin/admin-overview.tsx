import { AlertTriangle, ArrowRight, BadgeCheck, Building2, Clock, FileCheck2, FileText, type LucideIcon, Users } from "lucide-react";
import { adminApi, type AdminDistrict, type AdminUniversity } from "../../lib/admin-api";
import { useAsync, type AsyncState } from "../../lib/use-async";
import { ErrorState } from "../../shared/components/error-state";
import { Skeleton, SkeletonRegion } from "../../shared/components/skeleton";
import { Avatar, StatusBadge } from "./admin-ui";

interface OverviewProps {
  name: string;
  universities: AdminUniversity[];
  districts: AdminDistrict[];
  // The dashboard loads universities and districts itself; until then (or if that failed) their counts are unknown
  mastersLoading: boolean;
  mastersError: string;
  onReloadMasters: () => void;
  onNavigate: (section: string) => void;
  onOpenStudent: (studentId: string) => void;
}

const number = new Intl.NumberFormat("en-IN");
const show = (value?: number) => (value === undefined ? "—" : number.format(value));

// Counts and lists come from separate requests; the helpers below turn one into its display value
const total = (page: { total?: number }) => page.total;

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

interface KpiProps {
  icon: LucideIcon;
  tone: "brand" | "ok" | "warn" | "info";
  label: string;
  state: AsyncState<number>;
  hint: string;
  onClick: () => void;
}

// A figure that opens its section. While loading it holds the number's exact height (no jump when it arrives);
// if its request failed it says so and a click retries instead of navigating.
function Kpi({ icon: Icon, tone, label, state, hint, onClick }: KpiProps) {
  const failed = Boolean(state.error);
  return (
    <button type="button" className={`ov-kpi is-${tone} ${failed ? "has-error" : ""}`} onClick={failed ? state.reload : onClick} title={failed ? state.error : undefined}>
      <span className="ov-kpi-icon">
        <Icon size={20} />
      </span>
      <span className="ov-kpi-body">
        <span className="ov-kpi-label">{label}</span>
        {state.loading && state.data === undefined ? <Skeleton width={64} height={32} radius={8} className="ov-kpi-skeleton" /> : <strong className={failed ? "is-loading" : undefined}>{show(state.data)}</strong>}
        <small>{failed ? "Couldn't load. Retry" : hint}</small>
      </span>
      <ArrowRight size={16} className="ov-kpi-arrow" />
    </button>
  );
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

// SUPER_ADMIN landing page: what needs attention, how registrations are doing, and shortcuts into each area.
// Every number is fetched on its own, so a failed request leaves one dash instead of breaking the page.
export function Overview({ name, universities, districts, mastersLoading, mastersError, onReloadMasters, onNavigate, onOpenStudent }: OverviewProps) {
  // Page size 1: only the total is wanted
  const students = useAsync(() => adminApi.students({ size: 1 }).then(total) as Promise<number>);
  const enrolled = useAsync(() => adminApi.students({ status: "ENROLLED", size: 1 }).then(total) as Promise<number>);
  const registered = useAsync(() => adminApi.students({ status: "REGISTERED", size: 1 }).then(total) as Promise<number>);
  const consents = useAsync(() => adminApi.consents("PENDING").then((list) => list.length));
  const letters = useAsync(() => adminApi.letters({}).then((list) => list.length));
  const colleges = useAsync(() => adminApi.colleges());
  const courses = useAsync(() => adminApi.courses().then((list) => list.length));
  const sessions = useAsync(() => adminApi.academicSessions().then((list) => list.length));
  const subjects = useAsync(() => adminApi.majorSubjects().then((list) => list.length));
  const recent = useAsync(() =>
    adminApi.students({ size: 100 }).then((page) => [...page.rows].sort((a, b) => (b.registeredAt ?? "").localeCompare(a.registeredAt ?? "")).slice(0, 6)),
  );

  const all = [students, enrolled, registered, consents, letters, colleges, courses, sessions, subjects, recent] as Array<AsyncState<unknown>>;
  const failed = all.filter((state) => state.error);
  const retryFailed = () => failed.forEach((state) => state.reload());

  const firstName = name.trim().split(/\s+/)[0] || "there";
  const known = (enrolled.data ?? 0) + (registered.data ?? 0);
  const paidShare = known > 0 ? Math.round(((enrolled.data ?? 0) / known) * 100) : 0;
  const withoutCode = colleges.data?.filter((college) => !college.code?.trim() && college.active !== false).length ?? 0;

  const attention: Array<{ text: string; count: number; section: string }> = [];
  if (consents.data) attention.push({ text: plural(consents.data, "consent letter is waiting for review", "consent letters are waiting for review"), count: consents.data, section: "consents" });
  if (registered.data) attention.push({ text: plural(registered.data, "student has not paid yet", "students have not paid yet"), count: registered.data, section: "students" });
  if (withoutCode) attention.push({ text: plural(withoutCode, "active college has no code (letters cannot be issued)", "active colleges have no code (letters cannot be issued)"), count: withoutCode, section: "colleges" });

  // Shaped like a request's state so the Setup rows treat all counts the same way
  const mastersState: AsyncState<unknown> = { data: undefined, loading: mastersLoading, error: mastersError, reload: onReloadMasters };
  const setup: Array<{ label: string; state?: AsyncState<unknown>; value?: number; section: string }> = [
    { label: "Universities", state: mastersState, value: universities.length, section: "masters" },
    { label: "Districts", state: mastersState, value: districts.length, section: "masters" },
    { label: "Colleges", state: colleges, value: colleges.data?.length, section: "colleges" },
    { label: "Courses", state: courses, value: courses.data, section: "courses" },
    { label: "Academic sessions", state: sessions, value: sessions.data, section: "reference" },
    { label: "Major subjects", state: subjects, value: subjects.data, section: "reference" },
  ];

  const attentionLoading = (consents.loading && consents.data === undefined) || (registered.loading && registered.data === undefined) || (colleges.loading && colleges.data === undefined);
  const attentionError = consents.error || registered.error || colleges.error;
  const progressLoading = (enrolled.loading && enrolled.data === undefined) || (registered.loading && registered.data === undefined);
  const progressError = enrolled.error || registered.error;

  return (
    <div className="ov">
      <header className="ov-hero">
        <div>
          <p className="ov-eyebrow">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h2>
            {greeting()}, {firstName}
          </h2>
          <p>Here is how registrations are going and what needs your attention.</p>
        </div>
        <div className="ov-hero-actions">
          <button type="button" className="button" onClick={() => onNavigate("consents")}>
            <FileCheck2 size={16} /> Review consent letters
          </button>
          <button type="button" className="button button-outline" onClick={() => onNavigate("students")}>
            <Users size={16} /> All students
          </button>
        </div>
      </header>

      {/* One banner for any failed request; each failed figure also says so itself */}
      {failed.length > 0 && (
        <ErrorState
          compact
          title={`${failed.length} ${plural(failed.length, "figure", "figures")} could not be loaded`}
          message={failed[0].error}
          onRetry={retryFailed}
        />
      )}

      <div className="ov-kpis">
        <Kpi icon={Users} tone="brand" label="Total students" state={students} hint="All registrations" onClick={() => onNavigate("students")} />
        <Kpi icon={BadgeCheck} tone="ok" label="Enrolled" state={enrolled} hint="Payment received" onClick={() => onNavigate("students")} />
        <Kpi icon={Clock} tone="warn" label="Payment pending" state={registered} hint="Registered, not paid" onClick={() => onNavigate("students")} />
        <Kpi icon={FileText} tone="info" label="Letters issued" state={letters} hint="Acceptance letters" onClick={() => onNavigate("letters")} />
      </div>

      <div className="ov-grid">
        <div className="ov-main">
          <section className="ov-card">
            <header className="ov-card-head">
              <h3>Registration progress</h3>
              <span className="ov-card-note">{known > 0 && !progressError ? `${paidShare}% paid` : ""}</span>
            </header>
            {progressError ? (
              <ErrorState
                compact
                title="Couldn't load registration progress"
                message={progressError}
                onRetry={() => {
                  enrolled.reload();
                  registered.reload();
                }}
              />
            ) : progressLoading ? (
              <SkeletonRegion label="Loading registration progress" className="ov-progress-skeleton">
                <Skeleton height={12} radius={999} />
                <Skeleton height={18} width="55%" />
              </SkeletonRegion>
            ) : (
              <>
                <div className="ov-bar" role="img" aria-label={`${enrolled.data ?? 0} enrolled, ${registered.data ?? 0} payment pending`}>
                  <span className="ov-bar-ok" style={{ width: `${known > 0 ? ((enrolled.data ?? 0) / known) * 100 : 0}%` }} />
                  <span className="ov-bar-warn" style={{ width: `${known > 0 ? ((registered.data ?? 0) / known) * 100 : 0}%` }} />
                </div>
                <ul className="ov-legend">
                  <li>
                    <i className="is-ok" /> Enrolled <b>{show(enrolled.data)}</b>
                  </li>
                  <li>
                    <i className="is-warn" /> Payment pending <b>{show(registered.data)}</b>
                  </li>
                </ul>
              </>
            )}
          </section>

          <section className="ov-card">
            <header className="ov-card-head">
              <h3>Recent registrations</h3>
              <button type="button" className="admin-link" onClick={() => onNavigate("students")}>
                View all
              </button>
            </header>
            {recent.error ? (
              <ErrorState compact title="Couldn't load recent registrations" message={recent.error} onRetry={recent.reload} />
            ) : recent.data === undefined ? (
              <SkeletonRegion label="Loading recent registrations" className="ov-recent ov-recent-skeleton">
                {Array.from({ length: 6 }, (_, index) => (
                  <div className="ov-recent-skeleton-row" key={index}>
                    <Skeleton width={32} height={32} radius="full" />
                    <span className="ov-recent-main">
                      <Skeleton width="42%" height={14} />
                      <Skeleton width="70%" height={12} style={{ marginTop: 6 }} />
                    </span>
                    <Skeleton width={96} height={22} radius={999} />
                  </div>
                ))}
              </SkeletonRegion>
            ) : recent.data.length === 0 ? (
              <p className="admin-muted">No registrations yet.</p>
            ) : (
              <ul className="ov-recent">
                {recent.data.map((row, index) => (
                  <li key={row.registrationId ?? row.studentId ?? index}>
                    <button type="button" onClick={() => row.studentId && onOpenStudent(row.studentId)} disabled={!row.studentId}>
                      <Avatar name={row.studentName} size="sm" />
                      <span className="ov-recent-main">
                        <strong>{row.studentName ?? "—"}</strong>
                        <small>{[row.courseName, row.collegeName].filter(Boolean).join(" · ") || "—"}</small>
                      </span>
                      <span className="ov-recent-meta">
                        <StatusBadge status={row.registrationStatus} />
                        <small>{formatDate(row.registeredAt)}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="ov-side">
          <section className="ov-card">
            <header className="ov-card-head">
              <h3>Needs attention</h3>
            </header>
            {attentionError ? (
              <ErrorState
                compact
                title="Couldn't check what needs attention"
                message={attentionError}
                onRetry={() => {
                  consents.reload();
                  registered.reload();
                  colleges.reload();
                }}
              />
            ) : attentionLoading ? (
              <SkeletonRegion label="Checking what needs attention" className="ov-attention-skeleton">
                <Skeleton height={42} radius={10} />
                <Skeleton height={42} radius={10} />
              </SkeletonRegion>
            ) : attention.length === 0 ? (
              <p className="ov-clear">
                <BadgeCheck size={18} /> You are all caught up.
              </p>
            ) : (
              <ul className="ov-attention">
                {attention.map((item) => (
                  <li key={item.text}>
                    <button type="button" onClick={() => onNavigate(item.section)}>
                      <AlertTriangle size={16} />
                      <span>
                        <b>{number.format(item.count)}</b> {item.text}
                      </span>
                      <ArrowRight size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ov-card">
            <header className="ov-card-head">
              <h3>
                <Building2 size={16} /> Setup
              </h3>
            </header>
            <ul className="ov-setup">
              {setup.map((item) => (
                <li key={item.label}>
                  <button type="button" onClick={() => (item.state?.error ? item.state.reload() : onNavigate(item.section))} title={item.state?.error || undefined}>
                    <span>{item.label}</span>
                    {item.state?.loading && (item.state === mastersState || item.value === undefined) ? <Skeleton width={28} height={16} /> : item.state?.error ? <b className="ov-setup-error">Retry</b> : <b>{show(item.value)}</b>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
