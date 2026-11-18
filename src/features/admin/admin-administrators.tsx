import { useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { adminApi } from "../../lib/admin-api";
import { Input, PasswordInput } from "../../shared/components/ui";
import { FieldMessage, FormModal, Panel, requiredErrors, useAdminForm } from "./admin-ui";

interface CreatedAdministrator {
  name: string;
  email: string;
}

// SUPER_ADMIN: creates logins for university administrators. The backend has no list endpoint, so the page
// only shows the accounts created since it was opened.
export function AdministratorsSection() {
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedAdministrator[]>([]);

  return (
    <Panel
      title="University administrators"
      text="A university administrator can look up students. Your own session is not changed when you create one."
      actions={
        <button type="button" className="button" onClick={() => setCreating(true)}>
          <UserPlus size={16} /> Create administrator
        </button>
      }
    >
      {created.length > 0 && (
        <>
          <h3>Created in this session</h3>
          <ul className="admin-created-list admin-list">
            {created.map((item) => (
              <li key={item.email}>
                {item.name} <small>{item.email}</small>
              </li>
            ))}
          </ul>
        </>
      )}
      {creating && (
        <AdministratorModal
          onClose={() => setCreating(false)}
          onCreated={(item) => {
            setCreating(false);
            setCreated((current) => [item, ...current]);
          }}
        />
      )}
    </Panel>
  );
}

function AdministratorModal({ onClose, onCreated }: { onClose: () => void; onCreated: (item: CreatedAdministrator) => void }) {
  const form = useAdminForm({ fullName: "", email: "", mobileNo: "", password: "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const v = form.values;
    const errors = requiredErrors(v, ["fullName", "email", "mobileNo", "password"], {
      fullName: "Full name",
      email: "Email",
      mobileNo: "Mobile number",
      password: "Password",
    });
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) errors.email = "Enter a valid email";
    if (v.mobileNo && !/^\d{10}$/.test(v.mobileNo.trim())) errors.mobileNo = "Enter a 10-digit mobile number";
    // BCrypt only uses the first 72 bytes (same limit as the password reset)
    if (v.password && (v.password.length < 8 || v.password.length > 72)) errors.password = "Use 8 to 72 characters";
    form.save(
      errors,
      () => adminApi.createAdministrator({ fullName: v.fullName.trim(), email: v.email.trim(), mobileNo: v.mobileNo.trim(), password: v.password }),
      "University administrator created.",
      () => onCreated({ name: v.fullName.trim(), email: v.email.trim() }),
    );
  };

  return (
    <FormModal title="Create university administrator" onClose={onClose} onSubmit={submit} busy={form.busy} formError={form.formError} submitLabel="Create administrator">
      <div className="admin-grid">
        <label>
          Full name *
          <Input value={form.values.fullName} onChange={form.change("fullName")} />
          <FieldMessage name="fullName" fields={form.fields} />
        </label>
        <label>
          Email *
          <Input type="email" value={form.values.email} onChange={form.change("email")} />
          <FieldMessage name="email" fields={form.fields} />
        </label>
        <label>
          Mobile number *
          <Input inputMode="numeric" maxLength={10} value={form.values.mobileNo} onChange={(event) => form.set("mobileNo")(event.target.value.replace(/\D/g, ""))} />
          <FieldMessage name="mobileNo" fields={form.fields} />
        </label>
        <label>
          Temporary password *
          <PasswordInput maxLength={72} autoComplete="new-password" value={form.values.password} onChange={form.change("password")} />
          <FieldMessage name="password" fields={form.fields} />
        </label>
      </div>
    </FormModal>
  );
}
