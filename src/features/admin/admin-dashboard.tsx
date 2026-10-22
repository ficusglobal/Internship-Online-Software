import { BookOpen, Building2, CalendarCheck, CreditCard, FileText, GraduationCap, Landmark, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, type AdminDistrict, type AdminUniversity } from "../../lib/admin-api";
import { AdministratorsSection, CollegesSection, CoursesSection, describeError, LettersSection, MastersSection } from "./admin-sections";
import { Button } from "../../shared/components/ui";
import "../../styles/admin-dashboard.css";

type Section = "overview" | "colleges" | "courses" | "masters" | "letters" | "administrators";

const SECTIONS: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "colleges", label: "Colleges", icon: Building2 },
  { id: "courses", label: "Courses & batches", icon: BookOpen },
  { id: "masters", label: "Universities & districts", icon: Landmark },
  { id: "letters", label: "Acceptance letters", icon: FileText },
  { id: "administrators", label: "Administrators", icon: ShieldCheck },
];

// Parts of the dashboard whose backend APIs are not ready yet. They are shown but disabled.
const UNAVAILABLE = [
  { label: "Students", icon: Users },
  { label: "Attendance", icon: CalendarCheck },
  { label: "Payments", icon: CreditCard },
  { label: "Internships", icon: GraduationCap },
  { label: "Settings", icon: Settings },
];

interface AdminDashboardProps {
  name: string;
  onLogout: () => void;
}

export function AdminDashboard({ name, onLogout }: AdminDashboardProps) {
  const [section, setSection] = useState<Section>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [universities, setUniversities] = useState<AdminUniversity[]>([]);
  const [districts, setDistricts] = useState<AdminDistrict[]>([]);
  const [loadError, setLoadError] = useState("");
  const [masterKey, setMasterKey] = useState(0);

  // Universities and districts feed several sections, so they are loaded once here
  const loadMasters = useCallback(() => {
    setLoadError("");
    Promise.all([adminApi.universities(), adminApi.districts()])
      .then(([uni, dist]) => {
        setUniversities(uni);
        setDistricts(dist);
      })
      .catch((err: unknown) => setLoadError(describeError(err).message));
  }, []);

  useEffect(() => {
    loadMasters();
  }, [loadMasters, masterKey]);

  const choose = (next: Section) => {
    setSection(next);
    setMenuOpen(false);
  };

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
          Ficus Global <small>Admin</small>
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
          {SECTIONS.map((item) => {
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

          {section === "overview" && <Overview universities={universities.length} districts={districts.length} />}
          {section === "colleges" && <CollegesSection universities={universities} districts={districts} />}
          {section === "courses" && <CoursesSection />}
          {section === "masters" && (
            <MastersSection universities={universities} districts={districts} onChanged={() => setMasterKey((key) => key + 1)} />
          )}
          {section === "letters" && <LettersSection />}
          {section === "administrators" && <AdministratorsSection />}
        </main>
      </div>
    </div>
  );
}

function Overview({ universities, districts }: { universities: number; districts: number }) {
  const [letters, setLetters] = useState<number | null>(null);
  const [courses, setCourses] = useState<number | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const request = ++latest.current;
    adminApi.courses().then((list) => request === latest.current && setCourses(list.length)).catch(() => setCourses(null));
    adminApi.letters({}).then((list) => request === latest.current && setLetters(list.length)).catch(() => setLetters(null));
  }, []);

  const stats = [
    { label: "Universities", value: universities },
    { label: "Districts", value: districts },
    { label: "Courses", value: courses },
    { label: "Letters issued", value: letters },
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
