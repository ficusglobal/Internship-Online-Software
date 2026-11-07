import { useState, type FormEvent } from "react";
import { adminApi, type AdminDistrict, type AdminUniversity } from "../../lib/admin-api";
import { useListView } from "../../lib/use-list-view";
import { ErrorState } from "../../shared/components/error-state";
import { Pagination } from "../../shared/components/pagination";
import { TableSkeleton } from "../../shared/components/skeleton";
import { Input } from "../../shared/components/ui";
import {
  ActiveBadge,
  AddButton,
  deleteConfirm,
  EmptyState,
  FieldMessage,
  FormModal,
  Panel,
  requiredErrors,
  RowActions,
  SearchInput,
  useAdminForm,
  useRowAction,
} from "./admin-ui";

interface MasterProps {
  universities: AdminUniversity[];
  districts: AdminDistrict[];
  // Reloads the universities and districts the dashboard shares between sections
  onChanged: () => void;
  // The dashboard loads both lists once; until then (or if that failed) there is nothing to list yet
  loading: boolean;
  error: string;
}

export function MastersSection({ universities, districts, onChanged, loading, error }: MasterProps) {
  if (error) {
    return (
      <Panel title="Universities and districts">
        <ErrorState title="Couldn't load universities and districts" message={error} onRetry={onChanged} />
      </Panel>
    );
  }
  return (
    <>
      <UniversitiesPanel universities={universities} loading={loading} onChanged={onChanged} />
      <DistrictsPanel districts={districts} loading={loading} onChanged={onChanged} />
    </>
  );
}

function UniversitiesPanel({ universities, loading, onChanged }: { universities: AdminUniversity[]; loading: boolean; onChanged: () => void }) {
  // null = closed, {} = add, { item } = edit
  const [editor, setEditor] = useState<{ item?: AdminUniversity } | null>(null);
  const rows = useRowAction();
  const view = useListView(universities, (item) => `${item.name} ${item.code}`);

  const toggle = (item: AdminUniversity) => {
    const active = item.active !== false;
    void rows
      .run(`u${item.id}`, () => adminApi.university.update(item.id, { active: !active }), active ? "University deactivated." : "University activated.")
      .then((ok) => ok && onChanged());
  };

  const remove = (item: AdminUniversity) => {
    void rows
      .run(`u${item.id}`, () => adminApi.university.remove(item.id), "University deleted.", deleteConfirm("university", item.name))
      .then((ok) => ok && onChanged());
  };

  return (
    <Panel
      title="Universities"
      text="Colleges are added under a university and a district. Inactive universities are hidden from the registration form."
      actions={<AddButton label="Add university" onClick={() => setEditor({})} />}
    >
      {loading ? (
        <TableSkeleton headers={["Name", "Code", "Status", "Actions"]} rows={4} rowHeight={56} toolbar label="Loading universities" />
      ) : universities.length === 0 ? (
        <EmptyState text="No universities yet." actionLabel="Add university" onAction={() => setEditor({})} />
      ) : (
        <>
          <div className="admin-toolbar">
            <SearchInput value={view.query} onChange={view.setQuery} placeholder="Search universities by name or code" label="Search universities" />
          </div>
          {view.matches === 0 ? (
            <EmptyState text={`No universities match “${view.query.trim()}”.`} />
          ) : (
            <>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.rows?.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td className="admin-nowrap">{item.code}</td>
                        <td><ActiveBadge active={item.active} /></td>
                        <td>
                          <RowActions busy={rows.busyKey === `u${item.id}`} active={item.active} onEdit={() => setEditor({ item })} onToggle={() => toggle(item)} onDelete={() => remove(item)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...view.pagination} noun="universities" />
            </>
          )}
        </>
      )}

      {editor && (
        <UniversityModal
          item={editor.item}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            onChanged();
          }}
        />
      )}
    </Panel>
  );
}

function UniversityModal({ item, onClose, onSaved }: { item?: AdminUniversity; onClose: () => void; onSaved: () => void }) {
  const editing = item !== undefined;
  const form = useAdminForm({ name: item?.name ?? "", code: item?.code ?? "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const body = { name: form.values.name.trim(), code: form.values.code.trim() };
    form.save(
      requiredErrors(form.values, ["name", "code"], { name: "University name", code: "University code" }),
      () => (editing ? adminApi.university.update(item.id, body) : adminApi.university.create(body)),
      editing ? "University updated." : "University added.",
      onSaved,
    );
  };

  return (
    <FormModal title={editing ? `Edit ${item.name}` : "Add a university"} size="sm" onClose={onClose} onSubmit={submit} busy={form.busy} formError={form.formError} submitLabel={editing ? "Save changes" : "Add university"}>
      <label>
        University name *
        <Input value={form.values.name} onChange={form.change("name")} />
        <FieldMessage name="name" fields={form.fields} />
      </label>
      <label>
        University code *
        <Input value={form.values.code} onChange={form.change("code")} />
        <FieldMessage name="code" fields={form.fields} />
      </label>
    </FormModal>
  );
}

function DistrictsPanel({ districts, loading, onChanged }: { districts: AdminDistrict[]; loading: boolean; onChanged: () => void }) {
  const [editor, setEditor] = useState<{ item?: AdminDistrict } | null>(null);
  const rows = useRowAction();
  const view = useListView(districts, (item) => item.name);

  const remove = (item: AdminDistrict) => {
    void rows
      .run(`d${item.id}`, () => adminApi.district.remove(item.id), "District deleted.", deleteConfirm("district", item.name))
      .then((ok) => ok && onChanged());
  };

  return (
    <Panel title="Districts" text="Districts group colleges for the registration form." actions={<AddButton label="Add district" onClick={() => setEditor({})} />}>
      {loading ? (
        <TableSkeleton headers={["Name", "Actions"]} rows={10} rowHeight={56} toolbar label="Loading districts" />
      ) : districts.length === 0 ? (
        <EmptyState text="No districts yet." actionLabel="Add district" onAction={() => setEditor({})} />
      ) : (
        <>
          <div className="admin-toolbar">
            <SearchInput value={view.query} onChange={view.setQuery} placeholder="Search districts" label="Search districts" />
          </div>
          {view.matches === 0 ? (
            <EmptyState text={`No districts match “${view.query.trim()}”.`} />
          ) : (
            <>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.rows?.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>
                          <RowActions busy={rows.busyKey === `d${item.id}`} onEdit={() => setEditor({ item })} onDelete={() => remove(item)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...view.pagination} noun="districts" />
            </>
          )}
        </>
      )}

      {editor && (
        <DistrictModal
          item={editor.item}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            onChanged();
          }}
        />
      )}
    </Panel>
  );
}

function DistrictModal({ item, onClose, onSaved }: { item?: AdminDistrict; onClose: () => void; onSaved: () => void }) {
  const editing = item !== undefined;
  const form = useAdminForm({ name: item?.name ?? "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const body = { name: form.values.name.trim() };
    form.save(
      requiredErrors(form.values, ["name"], { name: "District name" }),
      () => (editing ? adminApi.district.update(item.id, body) : adminApi.district.create(body)),
      editing ? "District updated." : "District added.",
      onSaved,
    );
  };

  return (
    <FormModal title={editing ? `Edit ${item.name}` : "Add a district"} size="sm" onClose={onClose} onSubmit={submit} busy={form.busy} formError={form.formError} submitLabel={editing ? "Save changes" : "Add district"}>
      <label>
        District name *
        <Input value={form.values.name} onChange={form.change("name")} />
        <FieldMessage name="name" fields={form.fields} />
      </label>
    </FormModal>
  );
}
