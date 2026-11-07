import { useCallback, useEffect, useRef, useState } from "react";
import {
  masterDataApi,
  type InternshipBatch,
  type InternshipCourse,
  type MasterAcademicSession,
  type MasterCollege,
  type MasterDegree,
  type MasterDepartment,
  type MasterDistrict,
  type MasterMajorSubject,
  type MasterUniversity,
} from "../../lib/auth-api";

const byName = <T extends { name: string }>(items: T[]) => [...items].sort((a, b) => a.name.localeCompare(b.name));

const messageOf = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

// Every list the registration form offers, loaded from the public master-data API. The lists that depend on a
// choice (colleges on university + district, batches on course, departments and semesters on degree) are loaded by
// their loader; each loader ignores a slow answer that arrives after the user already changed their choice.
// (The shared lists are cached for a few minutes in lib/cache.ts.)
export function useRegistrationOptions() {
  const [universities, setUniversities] = useState<MasterUniversity[]>([]);
  const [districts, setDistricts] = useState<MasterDistrict[]>([]);
  const [courses, setCourses] = useState<InternshipCourse[]>([]);
  const [degrees, setDegrees] = useState<MasterDegree[]>([]);
  const [sessions, setSessions] = useState<MasterAcademicSession[]>([]);
  const [subjects, setSubjects] = useState<MasterMajorSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [colleges, setColleges] = useState<MasterCollege[]>([]);
  const [collegesLoading, setCollegesLoading] = useState(false);
  const [collegeError, setCollegeError] = useState("");

  const [batches, setBatches] = useState<InternshipBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchError, setBatchError] = useState("");

  const [departments, setDepartments] = useState<MasterDepartment[]>([]);
  const [semesters, setSemesters] = useState<number[]>([]);
  const [degreeLoading, setDegreeLoading] = useState(false);
  const [degreeError, setDegreeError] = useState("");

  const masterRequest = useRef(0);
  const collegeRequest = useRef(0);
  const batchRequest = useRef(0);
  const degreeRequest = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++masterRequest.current;
    setLoading(true);
    setError("");
    try {
      const [u, d, c, deg, s, m] = await Promise.all([
        masterDataApi.universities(),
        masterDataApi.districts(),
        masterDataApi.courses(),
        masterDataApi.degrees(),
        masterDataApi.academicSessions(),
        masterDataApi.majorSubjects(),
      ]);
      if (requestId !== masterRequest.current) return;
      setUniversities(byName(u));
      setDistricts(byName(d));
      setCourses(byName(c));
      setDegrees(deg);
      // Newest session first; inactive ones are not offered
      setSessions(s.filter((item) => item.isActive !== false).sort((a, b) => b.name.localeCompare(a.name)));
      setSubjects(byName(m.filter((item) => item.isActive !== false)));
      if (!u.length || !d.length || !c.length || !deg.length || !s.length || !m.length) {
        setError("Registration setup is incomplete. Ask an administrator to add at least one university, district, internship course, academic session and major subject, then retry.");
      }
    } catch (err) {
      if (requestId === masterRequest.current) setError(messageOf(err, "Unable to load registration options."));
    } finally {
      if (requestId === masterRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadColleges = useCallback(async (universityId: string, districtId: string) => {
    const requestId = ++collegeRequest.current;
    setColleges([]);
    setCollegeError("");
    if (!universityId || !districtId) {
      setCollegesLoading(false);
      return;
    }
    setCollegesLoading(true);
    try {
      const list = await masterDataApi.colleges(Number(universityId), Number(districtId));
      if (requestId === collegeRequest.current) setColleges(byName(list));
    } catch (err) {
      if (requestId === collegeRequest.current) setCollegeError(messageOf(err, "Unable to load colleges."));
    } finally {
      if (requestId === collegeRequest.current) setCollegesLoading(false);
    }
  }, []);

  const loadBatches = useCallback(async (courseId: string) => {
    const requestId = ++batchRequest.current;
    setBatches([]);
    setBatchError("");
    if (!courseId) {
      setBatchesLoading(false);
      return;
    }
    setBatchesLoading(true);
    try {
      const list = await masterDataApi.batches(Number(courseId));
      if (requestId === batchRequest.current) setBatches(list);
    } catch (err) {
      if (requestId === batchRequest.current) setBatchError(messageOf(err, "Unable to load batches."));
    } finally {
      if (requestId === batchRequest.current) setBatchesLoading(false);
    }
  }, []);

  // Departments and semesters depend on the degree (UG: 1-8, PG: 1-4)
  const loadDegreeOptions = useCallback(async (degree: string) => {
    const requestId = ++degreeRequest.current;
    setDepartments([]);
    setSemesters([]);
    setDegreeError("");
    if (!degree) {
      setDegreeLoading(false);
      return;
    }
    setDegreeLoading(true);
    try {
      const [nextDepartments, nextSemesters] = await Promise.all([masterDataApi.departments(degree), masterDataApi.semesters(degree)]);
      if (requestId !== degreeRequest.current) return;
      setDepartments(nextDepartments);
      setSemesters(nextSemesters);
    } catch (err) {
      if (requestId === degreeRequest.current) setDegreeError(messageOf(err, "Unable to load departments and semesters."));
    } finally {
      if (requestId === degreeRequest.current) setDegreeLoading(false);
    }
  }, []);

  return {
    universities,
    districts,
    courses,
    degrees,
    sessions,
    subjects,
    loading,
    error,
    reload,
    colleges,
    collegesLoading,
    collegeError,
    loadColleges,
    batches,
    batchesLoading,
    batchError,
    loadBatches,
    departments,
    semesters,
    degreeLoading,
    degreeError,
    loadDegreeOptions,
  };
}

export type RegistrationOptions = ReturnType<typeof useRegistrationOptions>;
