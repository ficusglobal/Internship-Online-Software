import { BookOpen, Building2, CalendarCheck, CreditCard, FileCheck2, FileText, GraduationCap, Landmark, LayoutDashboard, LogOut, Menu, MessageCircle, Settings, ShieldCheck, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { adminApi, type AdminDistrict, type AdminUniversity } from "../../lib/admin-api";
import type { AccountRole } from "../../lib/session";
import { paths } from "../../lib/routes";
import { AdministratorsSection, CollegesSection, CoursesSection, describeError, LettersSection, MastersSection } from "./admin-sections";
import { ConsentsSection } from "./admin-consents";
import { StudentsSection } from "./admin-students";
import { WhatsappSection } from "./admin-whatsapp";
import { byName } from "./admin-ui";
import { Button } from "../../shared/components/ui";
import "../../styles/admin-dashboard.css";
import "../../styles/admin-crud.css";

type Section = "overview" | "students" | "consents" | "colleges" | "courses" | "masters" | "whatsapp" | "letters" | "administrators";

// The backend allows /api/admin/** to SUPER_ADMIN only. A UNIVERSITY_ADMIN is an admin for the
// student endpoints (profile, consent file, letter, group) and nothing else, so it only gets Students.
const SECTIONS: Array<{ id: Section; label: string; icon: typeof LayoutDashboard; superAdminOnly: boolean }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, superAdminOnly: true },
  { id: "students", label: "Students", icon: Users, superAdminOnly: false },
  { id: "consents", label: "Consent letters", icon: FileCheck2, superAdminOnly: true },
  { id: "colleges", label: "Colleges", icon: Building2, superAdminOnly: true },
  { id: "courses", label: "Courses & batches", icon: BookOpen, superAdminOnly: true },
  { id: "masters", label: "Universities & districts", icon: Landmark, superAdminOnly: true },
  { id: "whatsapp", label: "WhatsApp groups", icon: MessageCircle, superAdminOnly: true },
  { id: "letters", label: "Acceptance letters", icon: FileText, superAdminOnly: true },
  { id: "administrators", label: "Administrators", icon: ShieldCheck, superAdminOnly: true },
];

// Parts of the dashboard whose backend APIs are not ready yet. They are shown but disabled.
const UNAVAILABLE = [
  { label: "Attendance", icon: CalendarCheck },
  { label: "Payments", icon: CreditCard },
  { label: "Internships", icon: GraduationCap },
  { label: "Settings", icon: Settings },
];

interface AdminDashboardProps {
  name: string;
  accountRole?: AccountRole;
  onLogout: () => void;
}

// Route: /admin/:section, and /admin/students/:studentId to open a student directly
export function AdminDashboard({ name, accountRole, onLogout }: AdminDashboardProps) {
  const superAdmin = accountRole === "SUPER_ADMIN";
  const sections = SECTIONS.filter((item) => superAdmin || !item.superAdminOnly);
  const navigate = useNavigate();
  const params = useParams();
  const defaultSection: Section = superAdmin ? "overview" : "students";
  // Unknown sections, and sections this role may not open, fall back to the role's first section
  const section = sections.find((item) => item.id === params.section)?.id;
  const studentId = section === "students" ? params.studentId ?? "" : "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [universities, setUniversities] = useState<AdminUniversity[]>([]);
  const [districts, setDistricts] = useState<AdminDistrict[]>([]);
  const [loadError, setLoadError] = useState("");
  const [masterKey, setMasterKey] = useState(0);

  // Universities and districts feed several sections, so they are loaded once here (SUPER_ADMIN only)
  const loadMasters = useCallback(() => {
    if (!superAdmin) return;
    setLoadError("");
    Promise.all([adminApi.universities(), adminApi.districts()])
      .then(([uni, dist]) => {
        setUniversities(byName(uni));
        setDistricts(byName(dist));
      })
      .catch((err: unknown) => setLoadError(describeError(err).message));
  }, [superAdmin]);

  useEffect(() => {
    loadMasters();
  }, [loadMasters, masterKey]);

  const choose = (next: Section) => {
    navigate(paths.adminSection(next));
    setMenuOpen(false);
  };

  const openStudent = (id: string) => navigate(paths.adminStudent(id));

  const invalidPath = !section || (params.studentId !== undefined && section !== "students");

  if (invalidPath) return <Navigate to={paths.adminSection(defaultSection)} replace />;

  return (
    <div className="admin-app">
      <header className="admin-topbar">
        <button
          type="button"
          className="admin-menu-button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="admin-brand">
          <span className="brand-mark">
            <GraduationCap size={18} />
          </span>
          Ficus Global <small>{superAdmin ? "Admin" : "University admin"}</small>
        </div>
        <div className="admin-topbar-user">
          <span className="admin-user-name">{name}</span>
          <Button className="button-outline admin-logout" onClick={onLogout}>
            <LogOut size={16} /> <span>Logout</span>
          </Button>
        </div>
      </header>

      <div className="admin-body">
        <nav className={`admin-nav ${menuOpen ? "is-open" : ""}`} aria-label="Admin sections">
          {sections.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`admin-nav-item ${section === item.id ? "active" : ""}`}
                aria-current={section === item.id ? "page" : undefined}
                onClick={() => choose(item.id)}
              >
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
          <p className="admin-nav-heading">Coming soon</p>
          {UNAVAILABLE.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} type="button" className="admin-nav-item" disabled title="Not available yet">
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
        </nav>

        <main className="admin-main">
          {loadError && (
            <p className="admin-alert" role="alert">
              {loadError}{" "}
              <button type="button" className="admin-link" onClick={() => setMasterKey((key) => key + 1)}>
                Try again
              </button>
            </p>
          )}

          {section === "students" && <StudentsSection initialId={studentId} onLookup={openStudent} />}
          {superAdmin && (
            <>
              {section === "overview" && <Overview universities={universities.length} districts={districts.length} />}
              {section === "consents" && <ConsentsSection />}
              {section === "colleges" && <CollegesSection universities={universities} districts={districts} />}
              {section === "courses" && <CoursesSection />}
              {section === "masters" && (
                <MastersSection universities={universities} districts={districts} onChanged={() => setMasterKey((key) => key + 1)} />
              )}
              {section === "whatsapp" && <WhatsappSection />}
              {section === "letters" && <LettersSection onOpenStudent={openStudent} />}
              {section === "administrators" && <AdministratorsSection />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Overview({ universities, districts }: { universities: number; districts: number }) {
  const [letters, setLetters] = useState<number | null>(null);
  const [courses, setCourses] = useState<number | null>(null);
  const [pendingConsents, setPendingConsents] = useState<number | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const request = ++latest.current;
    adminApi.courses().then((list) => request === latest.current && setCourses(list.length)).catch(() => setCourses(null));
    adminApi.letters({}).then((list) => request === latest.current && setLetters(list.length)).catch(() => setLetters(null));
    adminApi
      .consents("PENDING")
      .then((list) => request === latest.current && setPendingConsents(list.length))
      .catch(() => setPendingConsents(null));
  }, []);

  const stats = [
    { label: "Universities", value: universities },
    { label: "Districts", value: districts },
    { label: "Courses", value: courses },
    { label: "Letters issued", value: letters },
    { label: "Consents to review", value: pendingConsents },
  ];

  return (
    <section className="admin-panel">
      <header className="admin-panel-head">
        <h2>Overview</h2>
        <p>Live counts from the server. Choose a section on the left to add or review records.</p>
      </header>
      <div className="admin-stats">
        {stats.map((stat) => (
          <div className="admin-stat" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value ?? "—"}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
