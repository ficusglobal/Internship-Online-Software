export interface NavigationItem { id: "dashboard" | "students" | "attendance" | "payments" | "internships" | "courses" | "settings"; label: string; count?: string; }
export const navItems: NavigationItem[] = [
  { id: "dashboard", label: "Dashboard" }, { id: "students", label: "Students" }, { id: "attendance", label: "Attendance" },
  { id: "payments", label: "Payments", count: "3" }, { id: "internships", label: "Internships" }, { id: "courses", label: "Courses" }, { id: "settings", label: "University" }
];
