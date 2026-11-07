import { useEffect, useRef, useState, type FormEvent } from "react";
import { adminApi, type AdminCollege, type AdminDistrict, type AdminUniversity } from "../../lib/admin-api";
import { useListView } from "../../lib/use-list-view";
import { DropdownSelector } from "../../shared/components/dropdown-selector";
import { ErrorState } from "../../shared/components/error-state";
import { Pagination } from "../../shared/components/pagination";
import { TableSkeleton } from "../../shared/components/skeleton";
import { Input } from "../../shared/components/ui";
import {
  ActiveBadge,
  AddButton,
  byName,
  deleteConfirm,
  describeError,
  EmptyState,
  FieldMessage,
  FormAlert,
  FormModal,
  Loading,
  optionalNumber,
  optionsOf,
  Panel,
  requiredErrors,
  RowActions,
  SearchInput,
  useAdminForm,
  useRowAction,
} from "./admin-ui";

// The college code is printed in the letter number FG/<code>/<session>/<serial>; the backend
// refuses to issue a letter for a code longer than 30 characters.
const COLLEGE_CODE_MAX = 30;

interface MasterProps {
  universities: AdminUniversity[];
  districts: AdminDistrict[];
}

// null = closed, {} = add, { college } = edit
type Editor = { college?: AdminCollege } | null;

export function CollegesSection({ universities, districts }: MasterProps) {
  const [universityId, setUniversityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [colleges, setColleges] = useState<AdminCollege[] | null>(null);
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [editor, setEditor] = useState<Editor>(null);
  const rows = useRowAction();
  const latest = useRef(0);

  useEffect(() => {
    const request = ++latest.current;
    setListError("");
    setColleges(null);
    adminApi
      .colleges({ universityId: optionalNumber(universityId), districtId: optionalNumber(districtId) })
      .then((list) => request === latest.current && setColleges(byName(list)))
      .catch((err: unknown) => request === latest.current && setListError(describeError(err).message));
  }, [universityId, districtId, reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);
  const view = useListView(
    colleges,
    (college) => [college.name, college.code, college.city, college.state, college.university?.name, college.district?.name].filter(Boolean).join(" "),
    `${universityId}|${districtId}`,
  );

  const toggle = (college: AdminCollege) => {
    const active = college.active !== false;
    void rows
      .run(`c${college.id}`, () => adminApi.college.update(college.id, { active: !active }), active ? "College deactivated." : "College activated.")
      .then((ok) => ok && reload());
  };

  const remove = (college: AdminCollege) => {
    void rows
      .run(`c${college.id}`, () => adminApi.college.remove(college.id), "College deleted.", deleteConfirm("college", college.name))
      .then((ok) => ok && reload());
  };

  return (
    <Panel
      title="Colleges"
      text="Inactive colleges are hidden from the registration form."
      actions={<AddButton label="Add college" onClick={() => setEditor({})} />}
    >
      <div className="admin-toolbar">
        <label>
          University
          <DropdownSelector ariaLabel="University" value={universityId} onValueChange={setUniversityId} options={optionsOf(universities, (item) => item.name, "All universities")} />
        </label>
        <label>
          District
          <DropdownSelector ariaLabel="District" value={districtId} onValueChange={setDistrictId} options={optionsOf(districts, (item) => item.name, "All districts")} />
        </label>
        <SearchInput value={view.query} onChange={view.setQuery} placeholder="Search colleges by name, code or city" label="Search colleges" />
      </div>

      {listError ? (
        <ErrorState title="Couldn't load colleges" message={listError} onRetry={reload} />
      ) : colleges === null ? (
        <TableSkeleton headers={["Name", "Code", "University / District", "City", "Status", "Actions"]} rows={10} label="Loading colleges" />
      ) : colleges.length === 0 ? (
        <EmptyState
          text={universityId || districtId ? "No colleges match these filters." : "No colleges yet."}
          actionLabel="Add college"
          onAction={() => setEditor({})}
        />
      ) : view.rows && view.matches === 0 ? (
        <EmptyState text={`No colleges match “${view.query.trim()}”.`} />
      ) : view.rows ? (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>University / District</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((college) => (
                  <tr key={college.id}>
                    <td>{college.name}</td>
                    <td className="admin-nowrap">
                      {college.code ?? <span className="admin-warning" title="Acceptance letters need a college code">No code</span>}
                    </td>
                    <td>
                      {college.university?.name ?? "—"}
                      <small className="admin-subtext">{college.district?.name ?? "—"}</small>
                    </td>
                    <td>{college.city || "—"}</td>
                    <td><ActiveBadge active={college.active} /></td>
                    <td>
                      <RowActions
                        busy={rows.busyKey === `c${college.id}`}
                        active={college.active}
                        onEdit={() => setEditor({ college })}
                        onToggle={() => toggle(college)}
                        onDelete={() => remove(college)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...view.pagination} noun="colleges" />
        </>
      ) : null}

      {editor && (
        <CollegeModal
          college={editor.college}
          universities={universities}
          districts={districts}
          // The filters pre-fill a new college
          defaults={{ universityId, districtId }}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            reload();
          }}
        />
      )}
    </Panel>
  );
}

interface CollegeModalProps extends MasterProps {
  college?: AdminCollege;
  defaults: { universityId: string; districtId: string };
  onClose: () => void;
  onSaved: () => void;
}

function CollegeModal({ college, universities, districts, defaults, onClose, onSaved }: CollegeModalProps) {
  const editing = college !== undefined;
  const form = useAdminForm({
    universityId: String(college?.university?.id ?? defaults.universityId),
    districtId: String(college?.district?.id ?? defaults.districtId),
    name: college?.name ?? "",
    code: college?.code ?? "",
    addressLine1: college?.addressLine1 ?? "",
    city: college?.city ?? "",
    state: college?.state ?? "",
    pincode: college?.pincode ?? "",
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const v = form.values;
    const errors = requiredErrors(v, ["name", "universityId", "districtId"], { name: "College name", universityId: "University", districtId: "District" });
    const code = v.code.trim();
    if (code.length > COLLEGE_CODE_MAX) errors.code = `College code can be at most ${COLLEGE_CODE_MAX} characters`;
    else if (code.includes("/")) errors.code = "College code cannot contain “/” (it is part of the letter number)";
    if (v.pincode.trim() && !/^\d{6}$/.test(v.pincode.trim())) errors.pincode = "Pincode must be 6 digits";
    const body = {
      universityId: Number(v.universityId),
      districtId: Number(v.districtId),
      name: v.name.trim(),
      addressLine1: v.addressLine1.trim(),
      city: v.city.trim(),
      state: v.state.trim(),
      pincode: v.pincode.trim(),
    };
    form.save(
      errors,
      () =>
        editing
          ? // Empty strings are sent so cleared fields are cleared (an empty code is stored as no code)
            adminApi.college.update(college.id, { ...body, code })
          : adminApi.college.create({
              ...body,
              code: code || undefined,
              addressLine1: body.addressLine1 || undefined,
              city: body.city || undefined,
              state: body.state || undefined,
              pincode: body.pincode || undefined,
            }),
      editing ? "College updated." : "College added.",
      onSaved,
    );
  };

  return (
    <FormModal
      title={editing ? `Edit ${college.name}` : "Add a college"}
      description={editing ? undefined : "Add the university and district first if they are not in the lists."}
      onClose={onClose}
      onSubmit={submit}
      busy={form.busy}
      formError={form.formError}
      submitLabel={editing ? "Save changes" : "Add college"}
    >
      <div className="admin-grid">
        <label>
          University *
          <DropdownSelector ariaLabel="University" value={form.values.universityId} onValueChange={form.set("universityId")} options={optionsOf(universities, (item) => item.name)} placeholder="Select university" />
          <FieldMessage name="universityId" fields={form.fields} />
        </label>
        <label>
          District *
          <DropdownSelector ariaLabel="District" value={form.values.districtId} onValueChange={form.set("districtId")} options={optionsOf(districts, (item) => item.name)} placeholder="Select district" />
          <FieldMessage name="districtId" fields={form.fields} />
        </label>
        <label>
          College name *
          <Input value={form.values.name} onChange={form.change("name")} />
          <FieldMessage name="name" fields={form.fields} />
        </label>
        <label>
          College code
          <Input value={form.values.code} maxLength={COLLEGE_CODE_MAX} onChange={form.change("code")} placeholder="Needed for acceptance letters" />
          <FieldMessage name="code" fields={form.fields} />
        </label>
        <label className="admin-span-2">
          Address
          <Input value={form.values.addressLine1} onChange={form.change("addressLine1")} />
          <FieldMessage name="addressLine1" fields={form.fields} />
        </label>
        <label>
          City
          <Input value={form.values.city} onChange={form.change("city")} />
        </label>
        <label>
          State
          <Input value={form.values.state} onChange={form.change("state")} />
        </label>
        <label>
          Pincode
          <Input inputMode="numeric" maxLength={6} value={form.values.pincode} onChange={form.change("pincode")} />
          <FieldMessage name="pincode" fields={form.fields} />
        </label>
      </div>
    </FormModal>
  );
}
