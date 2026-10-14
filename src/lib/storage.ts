import { seedColleges, seedInternshipTopics, seedMasterConfigurations, seedPayments, seedStudents, seedUniversities } from "../data/seed";
import type { College, InternshipTopic, MasterConfiguration, Payment, Student, University } from "../types";

const keys = { students: "interntrack_students", payments: "interntrack_payments", universities: "interntrack_universities", colleges: "interntrack_colleges", masterConfigurations: "interntrack_master_configurations", internshipTopics: "ficus_global_internship_topics" } as const;

function read<T>(key: string, fallback: T): T { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
export const storage = {
  students: () => read<Student[]>(keys.students, seedStudents),
  payments: () => read<Payment[]>(keys.payments, seedPayments),
  universities: () => read<University[]>(keys.universities, seedUniversities),
  colleges: () => read<College[]>(keys.colleges, seedColleges),
  masterConfigurations: () => read<MasterConfiguration[]>(keys.masterConfigurations, seedMasterConfigurations),
  internshipTopics: () => read<InternshipTopic[]>(keys.internshipTopics, seedInternshipTopics),
  saveStudents: (students: Student[]) => localStorage.setItem(keys.students, JSON.stringify(students)),
  savePayments: (payments: Payment[]) => localStorage.setItem(keys.payments, JSON.stringify(payments)),
  saveUniversities: (universities: University[]) => localStorage.setItem(keys.universities, JSON.stringify(universities)),
  saveColleges: (colleges: College[]) => localStorage.setItem(keys.colleges, JSON.stringify(colleges)),
  saveMasterConfigurations: (configs: MasterConfiguration[]) => localStorage.setItem(keys.masterConfigurations, JSON.stringify(configs)),
  saveInternshipTopics: (topics: InternshipTopic[]) => localStorage.setItem(keys.internshipTopics, JSON.stringify(topics)),
  initialize: () => { if (!localStorage.getItem(keys.students)) storage.saveStudents(seedStudents); if (!localStorage.getItem(keys.payments)) storage.savePayments(seedPayments); if (!localStorage.getItem(keys.universities)) storage.saveUniversities(seedUniversities); if (!localStorage.getItem(keys.colleges)) storage.saveColleges(seedColleges); if (!localStorage.getItem(keys.masterConfigurations)) storage.saveMasterConfigurations(seedMasterConfigurations); if (!localStorage.getItem(keys.internshipTopics)) storage.saveInternshipTopics(seedInternshipTopics); }
};
