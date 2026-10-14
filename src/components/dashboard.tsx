import { ArrowUpRight, CheckCircle2, Clock3, FileCheck2, MoreHorizontal, Plus, UsersRound } from "lucide-react";
import type { Payment, Student } from "../types";
import { formatCurrency } from "../lib/utils";
import { Button, Card, Status } from "./ui";

interface DashboardProps { students: Student[]; payments: Payment[]; onView: (view: string) => void; }
const workflow = ["Registration", "Payment", "Group assigned", "Theory", "Practical", "Report", "Certificate"];
const chartMonths = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
const chartValues = [54, 69, 58, 86, 74, 92];

export function Dashboard({ students, payments, onView }: DashboardProps) {
  const paid = payments.filter((payment) => payment.status === "Paid").reduce((sum, payment) => sum + payment.amount, 0);
  const stats = [
    { label: "Total students", value: String(students.length * 48), trend: "+12.5%", icon: UsersRound, tint: "purple" },
    { label: "Active internships", value: String(students.filter((student) => student.internshipStatus !== "Completed").length * 19), trend: "+8.2%", icon: Clock3, tint: "blue" },
    { label: "Payments collected", value: formatCurrency(paid * 31), trend: "+18.4%", icon: CheckCircle2, tint: "green" },
    { label: "Certificates issued", value: "672", trend: "+6.9%", icon: FileCheck2, tint: "orange" },
  ];
  return <div className="page-content">
    <div className="stat-grid">{stats.map(({ label, value, trend, icon: Icon, tint }) => <Card className="stat-card" key={label}><span className={`stat-icon ${tint}`}><Icon size={20} /></span><div><p>{label}</p><h2>{value}</h2><small><ArrowUpRight size={13} />{trend} <span>vs last month</span></small></div></Card>)}</div>
    <div className="dashboard-grid"><Card className="revenue-card"><div className="card-head"><div><h2>Revenue overview</h2><p>Payment collections over time</p></div><span className="dashboard-period">Last 6 months</span></div><div className="revenue-total"><h2>{formatCurrency(paid * 31)}</h2><span><ArrowUpRight size={14} /> 18.4%</span></div><div className="chart"><div className="chart-grid">{chartMonths.map((month, index) => <div className="bar-set" key={month}><div className="bar muted" style={{ height: `${chartValues[index] - 16}%` }} /><div className="bar" style={{ height: `${chartValues[index]}%` }} /><small>{month}</small></div>)}</div></div></Card><Card className="progress-card"><div className="card-head"><div><h2>Internship progress</h2><p>Current batch completion</p></div><MoreHorizontal size={19} /></div><div className="donut"><div><b>68%</b><small>Average</small></div></div><div className="legend"><span><i className="dot purple" />On track <b>126</b></span><span><i className="dot yellow" />At risk <b>23</b></span><span><i className="dot gray" />Not started <b>11</b></span></div></Card></div>
    <Card className="activity-card"><div className="card-head"><div><h2>Recent students</h2><p>Latest registrations and updates</p></div><Button className="button-outline" onClick={() => onView("students")}>View all</Button></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Course & batch</th><th>Payment</th><th>Internship status</th><th>Progress</th><th /></tr></thead><tbody>{students.slice(0, 4).map((student) => <tr key={student.id}><td><div className="student-cell"><span className="avatar">{student.avatar}</span><span><b>{student.name}</b><small>{student.id}</small></span></div></td><td><b>{student.course}</b><small>{student.batch}</small></td><td><Status>{student.paymentStatus}</Status></td><td><span className="inline-status"><i className="dot purple" />{student.internshipStatus}</span></td><td><div className="progress"><span style={{ width: `${student.progress}%` }} /></div><small>{student.progress}%</small></td><td><button className="plain-button"><MoreHorizontal size={19} /></button></td></tr>)}</tbody></table></div></Card>
    <Card className="workflow-card"><div className="card-head"><div><h2>Internship workflow</h2><p>Track learner journey from registration to certificate</p></div><Button onClick={() => onView("internships")}><Plus size={16} /> Manage internships</Button></div><div className="workflow">{workflow.map((step, index) => <div className="workflow-step" key={step}><span className={index < 4 ? "complete" : ""}>{index < 4 ? <CheckCircle2 size={16} /> : index + 1}</span><b>{step}</b>{index < workflow.length - 1 && <i />}</div>)}</div></Card>
  </div>;
}
