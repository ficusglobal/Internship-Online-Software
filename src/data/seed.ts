import type { College, InternshipTopic, MasterConfiguration, Payment, Student, University } from "../types";

export const seedStudents: Student[] = [
  { id: "STU-2024-041", name: "Ananya Sharma", email: "ananya.sharma@email.com", phone: "+91 98765 43210", university: "Delhi University", course: "Web Development", batch: "Summer 2024", avatar: "AS", attendance: 94, paymentStatus: "Paid", internshipStatus: "In progress", progress: 62, joinedOn: "12 Jun 2024", paidAmount: 4999 },
  { id: "STU-2024-042", name: "Arjun Mehta", email: "arjun.mehta@email.com", phone: "+91 98765 43211", university: "Mumbai University", course: "Data Analytics", batch: "Summer 2024", avatar: "AM", attendance: 88, paymentStatus: "Verification", internshipStatus: "Report review", progress: 84, joinedOn: "13 Jun 2024", paidAmount: 4999 },
  { id: "STU-2024-043", name: "Riya Verma", email: "riya.verma@email.com", phone: "+91 98765 43212", university: "Pune University", course: "UI/UX Design", batch: "Summer 2024", avatar: "RV", attendance: 96, paymentStatus: "Paid", internshipStatus: "Completed", progress: 100, joinedOn: "14 Jun 2024", paidAmount: 4999 },
  { id: "STU-2024-044", name: "Kabir Singh", email: "kabir.singh@email.com", phone: "+91 98765 43213", university: "Delhi University", course: "Web Development", batch: "Summer 2024", avatar: "KS", attendance: 76, paymentStatus: "Pending", internshipStatus: "In progress", progress: 38, joinedOn: "15 Jun 2024", paidAmount: 0 },
  { id: "STU-2024-045", name: "Meera Nair", email: "meera.nair@email.com", phone: "+91 98765 43214", university: "Bangalore University", course: "Data Analytics", batch: "Summer 2024", avatar: "MN", attendance: 91, paymentStatus: "Paid", internshipStatus: "In progress", progress: 56, joinedOn: "18 Jun 2024", paidAmount: 4999 }
];

export const seedPayments: Payment[] = [
  { id: "PAY-9812", studentId: "STU-2024-041", studentName: "Ananya Sharma", amount: 4999, mode: "Online", status: "Paid", date: "12 Jun 2024", reference: "UPI/235987412" },
  { id: "PAY-9813", studentId: "STU-2024-042", studentName: "Arjun Mehta", amount: 4999, mode: "Offline", status: "Verification", date: "13 Jun 2024", reference: "REC-1042" },
  { id: "PAY-9814", studentId: "STU-2024-043", studentName: "Riya Verma", amount: 4999, mode: "Online", status: "Paid", date: "14 Jun 2024", reference: "UPI/879123610" },
  { id: "PAY-9815", studentId: "STU-2024-044", studentName: "Kabir Singh", amount: 4999, mode: "Offline", status: "Pending", date: "15 Jun 2024", reference: "-" }
];

export const seedUniversities: University[] = [
  { id: "UNI-01", name: "Delhi University", city: "New Delhi", adminName: "Nisha Kapoor", adminEmail: "nisha@du.ac.in" },
  { id: "UNI-02", name: "Mumbai University", city: "Mumbai", adminName: "Rahul Desai", adminEmail: "rahul@mu.ac.in" }
];

export const seedColleges: College[] = [
  { id: "COL-01", universityId: "UNI-01", name: "Hansraj College", city: "New Delhi", contactName: "Aditi Bansal" },
  { id: "COL-02", universityId: "UNI-02", name: "K. J. Somaiya College", city: "Mumbai", contactName: "Vikram Shah" }
];

export const seedMasterConfigurations: MasterConfiguration[] = [
  { universityId: "UNI-01", collegeId: "COL-01", course: "Web Development", college: "Hansraj College", batch: "Summer 2024", admissionCenter: "North Delhi Center", courseStart: "2024-06-10", courseEnd: "2024-08-10", fee: 4999 },
  { universityId: "UNI-02", collegeId: "COL-02", course: "Data Analytics", college: "K. J. Somaiya College", batch: "Summer 2024", admissionCenter: "Mumbai Central", courseStart: "2024-06-17", courseEnd: "2024-08-17", fee: 5499 }
];

const course = (id: string, name: string): InternshipTopic["courses"][number] => ({ id, name, duration: "8 weeks", fee: 999, description: "Hands-on internship programme with guided learning.", whatsappGroupLink: "" });
export const seedInternshipTopics: InternshipTopic[] = [
  { id: "TOP-01", name: "Software", courses: [course("CRS-01", "Android App"), course("CRS-02", "Website Designing"), course("CRS-03", "ERP Development"), course("CRS-04", "Database Handling"), course("CRS-05", "MS Office"), course("CRS-06", "Tally")] },
  { id: "TOP-02", name: "Hardware/Networking", courses: [course("CRS-07", "CPU Assemble"), course("CRS-08", "Computer Repairing"), course("CRS-09", "Computer Networking")] },
  { id: "TOP-03", name: "Emerging Technology", courses: [course("CRS-10", "Artificial Intelligence"), course("CRS-11", "Machine Learning"), course("CRS-12", "Data Analysis"), course("CRS-13", "Virtual Relation")] },
  { id: "TOP-04", name: "Digitalization", courses: [course("CRS-14", "Content Creation (YouTube)"), course("CRS-15", "Instagram, Facebook Promotion"), course("CRS-16", "Fake News Analysis (Instagram)"), course("CRS-17", "Social Media Marketing")] },
];
