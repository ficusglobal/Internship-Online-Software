import { X } from "lucide-react";
import { Form, Formik } from "formik";
import type { Student } from "../types";
import { Button, Input } from "./ui";

export function StudentForm({ student, onClose, onSave }: { student: Student; onClose: () => void; onSave: (student: Student) => void }) { return <div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={onClose}><X size={19}/></button><h2>Edit student</h2><p>Update registration details and internship assignment.</p><Formik initialValues={student} onSubmit={(values) => { onSave(values); onClose(); }}>{({ values, handleChange }) => <Form><div className="form-grid">{(["name","email","phone","university","course","batch"] as const).map(field => <label key={field}>{field.replace(/\b\w/g, c => c.toUpperCase())}<Input name={field} value={values[field]} onChange={handleChange}/></label>)}</div><div className="form-actions"><Button type="button" className="button-outline" onClick={onClose}>Cancel</Button><Button type="submit">Save changes</Button></div></Form>}</Formik></div></div>; }
