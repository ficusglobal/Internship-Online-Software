import { BookOpen, Building2, CalendarCheck, CreditCard, FileCheck2, FileText, GraduationCap, Landmark, LayoutDashboard, Library, LogOut, type LucideIcon, Menu, MessageCircle, Settings, ShieldCheck, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { adminApi, type AdminDistrict, type AdminUniversity } from "../../lib/admin-api";
import type { AccountRole } from "../../lib/session";
import { paths } from "../../lib/routes";
import { AdministratorsSection } from "./admin-administrators";
import { CollegesSection } from "./admin-colleges";
import { CoursesSection } from "./admin-courses";
import { LettersSection } from "./admin-letters";
import { MastersSection } from "./admin-masters";
import { ConsentsSection } from "./admin-consents";
import { Overview } from "./admin-overview";
import { AcademicSessionsSection, MajorSubjectsSection } from "./admin-reference";
import { StudentListPanel } from "./admin-student-list";
import { StudentsSection } from "./admin-students";
import { WhatsappSection } from "./admin-whatsapp";
import { Avatar, byName, describeError } from "./admin-ui";
import { ConfirmHost } from "../../shared/components/confirm-dialog";
import { Button } from "../../shared/components/ui";
import "../../styles/admin-dashboard.css";
import "../../styles/admin-crud.css";
import "../../styles/admin-theme.css";

type Section = "overview" | "students" | "consents" | "colleges" | "courses" | "masters" | "reference" | "whatsapp" | "letters" | "administrators";

interface SectionConfig {
  id: Section;
  label: string;
  icon: LucideIcon;
  superAdminOnly: boolean;
  // The sidebar heading it is listed under
  group: string;
}

// The backend allows /api/admin/** to SUPER_ADMIN only. A UNIVERSITY_ADMIN is an admin for the
// student endpoints (profile, consent file, letter, group) and nothing else, so it only gets Students.
const SECTIONS: SectionConfig[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, superAdminOnly: true, group: "" },
  { id: "students", label: "Students", icon: Users, superAdminOnly: false, group: "People" },
  { id: "consents", label: "Consent letters", icon: FileCheck2, superAdminOnly: true, group: "People" },
  { id: "letters", label: "Acceptance letters", icon: FileText, superAdminOnly: true, group: "People" },
  { id: "colleges", label: "Colleges", icon: Building2, superAdminOnly: true, group: "Academics" },
  { id: "courses", label: "Courses & batches", icon: BookOpen, superAdminOnly: true, group: "Academics" },
  { id: "masters", label: "Universities & districts", icon: Landmark, superAdminOnly: true, group: "Academics" },
  { id: "reference", label: "Sessions & subjects", icon: Library, superAdminOnly: true, group: "Academics" },
  { id: "whatsapp", label: "WhatsApp groups", icon: MessageCircle, superAdminOnly: true, group: "Communication" },
  { id: "administrators", label: "Administrators", icon: ShieldCheck, superAdminOnly: true, group: "Access" },
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
  const current = sections.find((item) => item.id === params.section);
  const section = current?.id;
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

  // Opening a section starts at the top of the page, and the phone menu closes
  const choose = (next: string) => {
    navigate(paths.adminSection(next));
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  const openStudent = (id: string) => navigate(paths.adminStudent(id));

  const invalidPath = !section || (params.studentId !== undefined && section !== "students");

  if (invalidPath) return <Navigate to={paths.adminSection(defaultSection)} replace />;

  // Sidebar headings, in order, each with its visible items
  const groups = sections.reduce<Array<{ heading: string; items: SectionConfig[] }>>((list, item) => {
    const existing = list.find((entry) => entry.heading === item.group);
    if (existing) existing.items.push(item);
    else list.push({ heading: item.group, items: [item] });
    return list;
  }, []);

  return (
    <div className="admin-app admin-scope">
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
          <span>Ficus Global</span>
          <small>{superAdmin ? "Admin" : "University admin"}</small>
        </div>
        <div className="admin-topbar-user">
          <div className="admin-user-chip">
            <Avatar name={name} size="sm" />
            <span className="admin-user-text">
              <strong>{name}</strong>
              <small>{superAdmin ? "Super admin" : "University admin"}</small>
            </span>
          </div>
          <Button className="button-outline admin-logout" onClick={onLogout}>
            <LogOut size={16} /> <span>Logout</span>
          </Button>
        </div>
      </header>

      <div className="admin-body">
        {menuOpen && <button type="button" className="admin-nav-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
        <nav className={`admin-nav ${menuOpen ? "is-open" : ""}`} aria-label="Admin sections">
          {groups.map((group) => (
            <div className="admin-nav-group" key={group.heading || "top"}>
              {group.heading && <p className="admin-nav-heading">{group.heading}</p>}
              {group.items.map((item) => {
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
            </div>
          ))}
          <div className="admin-nav-group">
            <p className="admin-nav-heading">Coming soon</p>
            {UNAVAILABLE.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.label} type="button" className="admin-nav-item" disabled title="Not available yet">
                  <Icon size={18} /> {item.label}
                </button>
              );
            })}
          </div>
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

          {section === "students" && (
            <>
              {/* The list is /admin/students (SUPER_ADMIN only); a university admin only has the lookup */}
              {superAdmin && !studentId && <StudentListPanel universities={universities} onOpen={openStudent} />}
              <StudentsSection initialId={studentId} onLookup={openStudent} onBack={superAdmin ? () => choose("students") : undefined} />
            </>
          )}
          {superAdmin && (
            <>
              {section === "overview" && <Overview name={name} universities={universities} districts={districts} onNavigate={choose} onOpenStudent={openStudent} />}
              {section === "consents" && <ConsentsSection />}
              {section === "colleges" && <CollegesSection universities={universities} districts={districts} />}
              {section === "courses" && <CoursesSection />}
              {section === "masters" && (
                <MastersSection universities={universities} districts={districts} onChanged={() => setMasterKey((key) => key + 1)} />
              )}
              {section === "reference" && (
                <>
                  <AcademicSessionsSection />
                  <MajorSubjectsSection />
                </>
              )}
              {section === "whatsapp" && <WhatsappSection />}
              {section === "letters" && <LettersSection onOpenStudent={openStudent} />}
              {section === "administrators" && <AdministratorsSection />}
            </>
          )}
        </main>
      </div>
      <ConfirmHost />
    </div>
  );
}
