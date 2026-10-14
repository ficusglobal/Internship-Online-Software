import { useState } from "react";
import { Download, Edit3, Filter, Plus, Search, Trash2 } from "lucide-react";
import type { Student } from "../types";
import { Button, Card, Input, Status } from "./ui";
import { Pagination } from "./pagination";

interface StudentsProps { students: Student[]; onEdit: (student: Student) => void; }
const pageSize = 3;
export function Students({ students, onEdit }: StudentsProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pageCount = Math.max(1, Math.ceil(students.length / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const displayedStudents = students.slice((safePage - 1) * pageSize, safePage * pageSize);
  const toggleRow = (id: string) => setSelectedIds(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const togglePage = () => setSelectedIds(current => { const pageIds = displayedStudents.map(student => student.id); const allSelected = pageIds.every(id => current.has(id)); const next = new Set(current); pageIds.forEach(id => allSelected ? next.delete(id) : next.add(id)); return next; });
  return <div className="page-content"><div className="toolbar"><label className="search wide"><Search size={18}/><Input placeholder="Search students by name, ID or email" /></label><Button className="button-outline"><Filter size={16}/> Filter</Button><Button className="button-outline"><Download size={16}/> Export</Button><Button><Plus size={16}/> Add student</Button></div><Card className="activity-card reference-card"><div className="card-head"><div><h2>All students</h2><p>{students.length} students across active internship batches</p></div></div><div className="table-wrap"><table className="pinned-table reference-table"><thead><tr><th className="pinned-start checkbox-cell"><input aria-label="Select all students on this page" type="checkbox" checked={displayedStudents.length > 0 && displayedStudents.every(student => selectedIds.has(student.id))} onChange={togglePage}/></th><th>Student ID</th><th>Student</th><th>University & course</th><th>Attendance</th><th>Payment</th><th>Internship status</th><th className="pinned-end actions-head">Actions</th></tr></thead><tbody>{displayedStudents.map(s => <tr key={s.id} className={selectedIds.has(s.id) ? "is-selected" : ""}><td className="pinned-start checkbox-cell"><input aria-label={`Select ${s.name}`} type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleRow(s.id)}/></td><td><b>{s.id}</b><small>Joined {s.joinedOn}</small></td><td><div className="student-cell"><span className="avatar">{s.avatar}</span><span><b>{s.name}</b><small>{s.email}</small></span></div></td><td><b>{s.university}</b><small>{s.course}</small></td><td><b>{s.attendance}%</b><div className="progress compact"><span style={{width: `${s.attendance}%`}}/></div></td><td><Status>{s.paymentStatus}</Status></td><td><span className="inline-status"><i className="dot purple"/>{s.internshipStatus}</span></td><td className="pinned-end row-actions"><button className="table-action danger" aria-label={`Remove ${s.name}`}><Trash2 size={15}/> Delete</button><button className="table-action" onClick={() => onEdit(s)}><Edit3 size={15}/> Edit</button></td></tr>)}</tbody></table></div><Pagination currentPage={safePage} itemCount={students.length} pageSize={pageSize} onPageChange={setCurrentPage}/></Card></div>;
}
