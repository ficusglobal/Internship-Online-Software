import { useState } from "react";
import { CheckCheck, CreditCard, Edit3, Landmark, Trash2 } from "lucide-react";
import type { Payment } from "../types";
import { formatCurrency } from "../lib/utils";
import { Button, Card, Status } from "./ui";
import { Pagination } from "./pagination";

const pageSize = 3;
export function Payments({ payments, onMarkPaid }: { payments: Payment[]; onMarkPaid: (id: string) => void }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const total = payments.filter(p => p.status === "Paid").reduce((a,p) => a+p.amount,0);
  const pageCount = Math.max(1, Math.ceil(payments.length / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const displayedPayments = payments.slice((safePage - 1) * pageSize, safePage * pageSize);
  const toggleRow = (id: string) => setSelectedIds(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const togglePage = () => setSelectedIds(current => { const pageIds = displayedPayments.map(payment => payment.id); const allSelected = pageIds.every(id => current.has(id)); const next = new Set(current); pageIds.forEach(id => allSelected ? next.delete(id) : next.add(id)); return next; });
  return <div className="page-content"><div className="payment-stats"><Card><CreditCard/><span><small>Collected</small><h2>{formatCurrency(total)}</h2></span></Card><Card><Landmark/><span><small>Pending verification</small><h2>{payments.filter(p => p.status === "Verification").length}</h2></span></Card></div><Card className="activity-card reference-card"><div className="card-head"><div><h2>Payment management</h2><p>Verify offline payments and track all transactions</p></div><Button className="button-outline">Download report</Button></div><div className="table-wrap"><table className="pinned-table reference-table"><thead><tr><th className="pinned-start checkbox-cell"><input aria-label="Select all payments on this page" type="checkbox" checked={displayedPayments.length > 0 && displayedPayments.every(payment => selectedIds.has(payment.id))} onChange={togglePage}/></th><th>Transaction</th><th>Student</th><th>Amount</th><th>Mode</th><th>Date</th><th>Status</th><th className="pinned-end actions-head">Actions</th></tr></thead><tbody>{displayedPayments.map(p => <tr key={p.id} className={selectedIds.has(p.id) ? "is-selected" : ""}><td className="pinned-start checkbox-cell"><input aria-label={`Select ${p.id}`} type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleRow(p.id)}/></td><td><b>{p.id}</b><small>{p.reference}</small></td><td><b>{p.studentName}</b><small>{p.studentId}</small></td><td><b>{formatCurrency(p.amount)}</b></td><td>{p.mode}</td><td>{p.date}</td><td><Status>{p.status}</Status></td><td className="pinned-end row-actions">{p.status !== "Paid" ? <Button className="mini-button" onClick={() => onMarkPaid(p.id)}><CheckCheck size={14}/> Mark paid</Button> : <><button className="table-action danger" aria-label={`Delete ${p.id}`}><Trash2 size={15}/> Delete</button><button className="table-action"><Edit3 size={15}/> Edit</button></>}</td></tr>)}</tbody></table></div><Pagination currentPage={safePage} itemCount={payments.length} pageSize={pageSize} onPageChange={setCurrentPage}/></Card></div>;
}
