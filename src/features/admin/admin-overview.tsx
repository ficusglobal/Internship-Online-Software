import { AlertTriangle, ArrowRight, BadgeCheck, Building2, Clock, FileCheck2, FileText, type LucideIcon, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { adminApi, type AdminDistrict, type AdminStudentRow, type AdminUniversity } from "../../lib/admin-api";
import { Avatar, StatusBadge } from "./admin-ui";

interface OverviewData {
  total?: number;
  enrolled?: number;
  registered?: number;
  consents?: number;
  letters?: number;
  colleges?: number;
  collegesWithoutCode?: number;
  courses?: number;
  sessions?: number;
  subjects?: number;
  recent?: AdminStudentRow[];
}

interface OverviewProps {
  name: string;
  universities: AdminUniversity[];
  districts: AdminDistrict[];
  onNavigate: (section: string) => void;
  onOpenStudent: (studentId: string) => void;
}

const number = new Intl.NumberFormat("en-IN");
const show = (value?: number) => (value === undefined ? "—" : number.format(value));

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

interface KpiProps {
  icon: LucideIcon;
  tone: "brand" | "ok" | "warn" | "info";
  label: string;
  value?: number;
  hint: string;
  onClick: () => void;
}

function Kpi({ icon: Icon, tone, label, value, hint, onClick }: KpiProps) {
  return (
    <button type="button" className={`ov-kpi is-${tone}`} onClick={onClick}>
      <span className="ov-kpi-icon">
        <Icon size={20} />
      </span>
      <span className="ov-kpi-body">
        <span className="ov-kpi-label">{label}</span>
        <strong className={value === undefined ? "is-loading" : undefined}>{show(value)}</strong>
        <small>{hint}</small>
      </span>
      <ArrowRight size={16} className="ov-kpi-arrow" />
    </button>
  );
}

// SUPER_ADMIN landing page: what needs attention, how registrations are doing, and shortcuts into each area.
// Every number is fetched on its own, so a failed request leaves one dash instead of breaking the page.
export function Overview({ name, universities, districts, onNavigate, onOpenStudent }: OverviewProps) {
  const [data, setData] = useState<OverviewData>({});

  useEffect(() => {
    let current = true;
    const put = (patch: OverviewData) => current && setData((previous) => ({ ...previous, ...patch }));
    const ignore = () => undefined;

    // Page size 1: only the total is wanted
    adminApi.students({ size: 1 }).then((page) => put({ total: page.total })).catch(ignore);
    adminApi.students({ status: "ENROLLED", size: 1 }).then((page) => put({ enrolled: page.total })).catch(ignore);
    adminApi.students({ status: "REGISTERED", size: 1 }).then((page) => put({ registered: page.total })).catch(ignore);
    adminApi
      .students({ size: 100 })
      .then((page) => {
        const latest = [...page.rows].sort((a, b) => (b.registeredAt ?? "").localeCompare(a.registeredAt ?? "")).slice(0, 6);
        put({ recent: latest });
      })
      .catch(ignore);
    adminApi.consents("PENDING").then((list) => put({ consents: list.length })).catch(ignore);
    adminApi.letters({}).then((list) => put({ letters: list.length })).catch(ignore);
    adminApi
      .colleges()
      .then((list) => put({ colleges: list.length, collegesWithoutCode: list.filter((college) => !college.code?.trim() && college.active !== false).length }))
      .catch(ignore);
    adminApi.courses().then((list) => put({ courses: list.length })).catch(ignore);
    adminApi.academicSessions().then((list) => put({ sessions: list.length })).catch(ignore);
    adminApi.majorSubjects().then((list) => put({ subjects: list.length })).catch(ignore);
    return () => {
      current = false;
    };
  }, []);

  const firstName = name.trim().split(/\s+/)[0] || "there";
  const known = (data.enrolled ?? 0) + (data.registered ?? 0);
  const paidShare = known > 0 ? Math.round(((data.enrolled ?? 0) / known) * 100) : 0;

  const attention: Array<{ text: string; count: number; section: string }> = [];
  const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);
  if (data.consents) attention.push({ text: plural(data.consents, "consent letter is waiting for review", "consent letters are waiting for review"), count: data.consents, section: "consents" });
  if (data.registered) attention.push({ text: plural(data.registered, "student has not paid yet", "students have not paid yet"), count: data.registered, section: "students" });
  if (data.collegesWithoutCode) attention.push({ text: plural(data.collegesWithoutCode, "active college has no code (letters cannot be issued)", "active colleges have no code (letters cannot be issued)"), count: data.collegesWithoutCode, section: "colleges" });

  const setup: Array<{ label: string; value?: number; section: string }> = [
    { label: "Universities", value: universities.length, section: "masters" },
    { label: "Districts", value: districts.length, section: "masters" },
    { label: "Colleges", value: data.colleges, section: "colleges" },
    { label: "Courses", value: data.courses, section: "courses" },
    { label: "Academic sessions", value: data.sessions, section: "reference" },
    { label: "Major subjects", value: data.subjects, section: "reference" },
  ];

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

      <div className="ov-kpis">
        <Kpi icon={Users} tone="brand" label="Total students" value={data.total} hint="All registrations" onClick={() => onNavigate("students")} />
        <Kpi icon={BadgeCheck} tone="ok" label="Enrolled" value={data.enrolled} hint="Payment received" onClick={() => onNavigate("students")} />
        <Kpi icon={Clock} tone="warn" label="Payment pending" value={data.registered} hint="Registered, not paid" onClick={() => onNavigate("students")} />
        <Kpi icon={FileText} tone="info" label="Letters issued" value={data.letters} hint="Acceptance letters" onClick={() => onNavigate("letters")} />
      </div>

      <div className="ov-grid">
        <div className="ov-main">
          <section className="ov-card">
            <header className="ov-card-head">
              <h3>Registration progress</h3>
              <span className="ov-card-note">{known > 0 ? `${paidShare}% paid` : ""}</span>
            </header>
            <div className="ov-bar" role="img" aria-label={`${data.enrolled ?? 0} enrolled, ${data.registered ?? 0} payment pending`}>
              <span className="ov-bar-ok" style={{ width: `${known > 0 ? ((data.enrolled ?? 0) / known) * 100 : 0}%` }} />
              <span className="ov-bar-warn" style={{ width: `${known > 0 ? ((data.registered ?? 0) / known) * 100 : 0}%` }} />
            </div>
            <ul className="ov-legend">
              <li>
                <i className="is-ok" /> Enrolled <b>{show(data.enrolled)}</b>
              </li>
              <li>
                <i className="is-warn" /> Payment pending <b>{show(data.registered)}</b>
              </li>
            </ul>
          </section>

          <section className="ov-card">
            <header className="ov-card-head">
              <h3>Recent registrations</h3>
              <button type="button" className="admin-link" onClick={() => onNavigate("students")}>
                View all
              </button>
            </header>
            {data.recent === undefined ? (
              <p className="admin-muted">Loading…</p>
            ) : data.recent.length === 0 ? (
              <p className="admin-muted">No registrations yet.</p>
            ) : (
              <ul className="ov-recent">
                {data.recent.map((row, index) => (
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
            {attention.length === 0 ? (
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
                  <button type="button" onClick={() => onNavigate(item.section)}>
                    <span>{item.label}</span>
                    <b>{show(item.value)}</b>
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
