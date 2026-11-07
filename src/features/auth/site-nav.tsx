import { Building2, Check, ChevronDown, GraduationCap, Home, LogIn, type LucideIcon, Mail, Moon, ShieldCheck, Sparkles, Sun, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { paths } from "../../lib/routes";
import { preload } from "../../lib/screens";
import { Popover } from "../../shared/components/popover";
import type { Theme } from "../../types";
import "../../styles/site-nav.css";

type Role = "admin" | "student" | "cyber-cafe";
export type NavPage = "home" | "features" | "contact";

interface SiteNavProps {
  role: Role;
  // The public page being shown (highlights its link); null on sign-in and registration screens
  page: NavPage | null;
  // Highlights the Student login / Student registration button
  action?: "login" | "register" | null;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const LINKS: Array<{ page: NavPage; label: string; path: string; icon: LucideIcon }> = [
  { page: "home", label: "Home", path: paths.home, icon: Home },
  { page: "features", label: "Features", path: paths.features, icon: Sparkles },
  { page: "contact", label: "Contact", path: paths.contact, icon: Mail },
];

const ROLES: Array<{ role: Role; label: string; hint: string; icon: LucideIcon; path: string }> = [
  { role: "student", label: "Student", hint: "विद्यार्थी", icon: GraduationCap, path: paths.register },
  { role: "admin", label: "Administrator", hint: "Manage programmes", icon: ShieldCheck, path: paths.adminLogin },
  { role: "cyber-cafe", label: "Cyber Cafe", hint: "Register students", icon: Building2, path: paths.cafeRegister },
];

// The top bar of every public and sign-in screen: brand, the public pages, the role menu, the theme switch and the
// two student actions (Student login / Student registration). On tablets and phones the public pages move to a
// tab bar at the bottom of the screen and the buttons get compact.
export function SiteNav({ role, page, action = null, theme, setTheme }: SiteNavProps) {
  const navigate = useNavigate();
  const current = ROLES.find((item) => item.role === role) ?? ROLES[0];
  const CurrentIcon = current.icon;

  return (
    <>
      <header className="site-nav">
        <div className="site-nav-inner">
          <a
            className="site-brand"
            href={paths.home}
            onClick={(event) => {
              event.preventDefault();
              navigate(paths.home);
            }}
            aria-label="Ficus Global home"
          >
            <span className="brand-mark">
              <GraduationCap size={20} />
            </span>
            <span className="site-brand-name">Ficus Global</span>
          </a>

          <nav className="site-links" aria-label="Public pages">
            {LINKS.map(({ page: target, label, path }) => (
              <button key={target} type="button" className={page === target ? "is-active" : ""} aria-current={page === target ? "page" : undefined} onClick={() => navigate(path)}>
                {label}
              </button>
            ))}
          </nav>

          <div className="site-actions">
            <Popover
              className="site-role"
              trigger={({ open, toggle }) => (
                <button type="button" className="site-icon-button site-role-button" aria-label="Choose Student, Administrator, or Cyber Cafe" aria-expanded={open} aria-haspopup="menu" onClick={toggle}>
                  <CurrentIcon size={17} />
                  <span className="site-role-label">{current.label}</span>
                  <ChevronDown size={14} className="site-role-chevron" />
                </button>
              )}
            >
              {({ close }) => (
                <div className="site-menu" role="menu">
                  <p>Continue as</p>
                  {ROLES.map(({ role: target, label, hint, icon: Icon, path }) => (
                    <button
                      key={target}
                      type="button"
                      role="menuitem"
                      className={role === target ? "is-selected" : ""}
                      onClick={() => {
                        navigate(path);
                        close();
                      }}
                    >
                      <Icon size={16} />
                      <span>
                        <b>{label}</b>
                        <small>{hint}</small>
                      </span>
                      {role === target && <Check size={15} />}
                    </button>
                  ))}
                </div>
              )}
            </Popover>

            <button type="button" className="site-icon-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}>
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>

            <span className="site-divider" aria-hidden="true" />

            <button type="button" className={`site-button site-login ${action === "login" ? "is-active" : ""}`} onClick={() => navigate(paths.login)}>
              <LogIn size={16} />
              <span>
                <span className="site-long">Student login</span>
                <span className="site-short">Login</span>
              </span>
            </button>
            <button
              type="button"
              className={`site-button site-register ${action === "register" ? "is-active" : ""}`}
              onClick={() => navigate(paths.register)}
              onPointerEnter={() => preload("registration")}
              onFocus={() => preload("registration")}
            >
              <UserPlus size={16} />
              <span>
                <span className="site-long">Student registration</span>
                <span className="site-short">Register</span>
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Tablets and phones: the public pages as a tab bar */}
      {page && (
        <nav className="site-tabs" aria-label="Public pages">
          {LINKS.map(({ page: target, label, path, icon: Icon }) => (
            <button key={target} type="button" className={page === target ? "is-active" : ""} aria-current={page === target ? "page" : undefined} onClick={() => navigate(path)}>
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
