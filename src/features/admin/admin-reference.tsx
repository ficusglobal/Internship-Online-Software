import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { adminApi, isRecordActive, type AdminAcademicSession, type AdminMajorSubject } from "../../lib/admin-api";
import { useListView } from "../../lib/use-list-view";
import { Pagination } from "../../shared/components/pagination";
import { Input } from "../../shared/components/ui";
import {
  ActiveBadge,
  AddButton,
  deleteConfirm,
  describeError,
  EmptyState,
  FieldMessage,
  FormAlert,
  FormModal,
  Loading,
  Panel,
  requiredErrors,
  RowActions,
  SearchInput,
  useAdminForm,
  useRowAction,
} from "./admin-ui";

type Named = (AdminAcademicSession | AdminMajorSubject) & { id: number; name: string };

interface NamedListConfig<Item extends Named> {
  title: string;
  text: string;
  // "session" / "subject": used in headings and messages
  noun: string;
  nameLabel: string;
  placeholder: string;
  list: () => Promise<Item[]>;
  create: (body: { name: string; active: boolean }) => Promise<unknown>;
  update: (id: number, body: { name?: string; active?: boolean }) => Promise<unknown>;
  remove: (id: number) => Promise<unknown>;
  sort: (items: Item[]) => Item[];
  // Extra format check on the name; returns an error message or ""
  checkName?: (name: string) => string;
}

// One master list that is just a name and an active flag (academic sessions, major subjects):
// a searchable, paged table with edit / activate / delete, and an add / edit modal.
function NamedListPanel<Item extends Named>({ config }: { config: NamedListConfig<Item> }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  // null = closed, {} = add, { item } = edit
  const [editor, setEditor] = useState<{ item?: Item } | null>(null);
  const rows = useRowAction();
  const latest = useRef(0);
  // The config object is rebuilt on every render of the parent; the callbacks only need its latest value
  const configRef = useRef(config);
  configRef.current = config;
  const { noun } = config;
  const view = useListView(items, (item) => item.name);

  useEffect(() => {
    const request = ++latest.current;
    setError("");
    configRef.current
      .list()
      .then((list) => request === latest.current && setItems(configRef.current.sort(list)))
      .catch((err: unknown) => request === latest.current && setError(describeError(err).message));
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const toggle = (item: Item) => {
    const active = isRecordActive(item) !== false;
    void rows
      .run(`n${item.id}`, () => config.update(item.id, { active: !active }), active ? `Deactivated ${noun}.` : `Activated ${noun}.`)
      .then((ok) => ok && reload());
  };

  const remove = (item: Item) => {
    void rows
      .run(`n${item.id}`, () => config.remove(item.id), `Deleted ${noun}.`, deleteConfirm(noun, item.name))
      .then((ok) => ok && reload());
  };

  return (
    <Panel title={config.title} text={config.text} actions={<AddButton label={`Add ${noun}`} onClick={() => setEditor({})} />}>
      {error && <FormAlert message={error} />}
      {items === null && !error ? (
        <Loading label={`Loading ${config.title.toLowerCase()}…`} />
      ) : items && items.length === 0 ? (
        <EmptyState text={`No ${config.title.toLowerCase()} yet.`} actionLabel={`Add ${noun}`} onAction={() => setEditor({})} />
      ) : items ? (
        <>
          <div className="admin-toolbar">
            <SearchInput value={view.query} onChange={view.setQuery} placeholder={`Search ${config.title.toLowerCase()}`} label={`Search ${config.title.toLowerCase()}`} />
          </div>
          {view.matches === 0 ? (
            <EmptyState text={`No ${config.title.toLowerCase()} match “${view.query.trim()}”.`} />
          ) : (
            <>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.rows?.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td><ActiveBadge active={isRecordActive(item)} /></td>
                        <td>
                          <RowActions busy={rows.busyKey === `n${item.id}`} active={isRecordActive(item)} onEdit={() => setEditor({ item })} onToggle={() => toggle(item)} onDelete={() => remove(item)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination {...view.pagination} noun={config.title.toLowerCase()} />
            </>
          )}
        </>
      ) : null}

      {editor && (
        <NamedModal
          config={config}
          item={editor.item}
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

function NamedModal<Item extends Named>({ config, item, onClose, onSaved }: { config: NamedListConfig<Item>; item?: Item; onClose: () => void; onSaved: () => void }) {
  const editing = item !== undefined;
  const form = useAdminForm({ name: item?.name ?? "" });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = form.values.name.trim();
    const errors = requiredErrors(form.values, ["name"], { name: config.nameLabel });
    const formatError = name ? config.checkName?.(name) : "";
    if (formatError) errors.name = formatError;
    form.save(
      errors,
      () => (editing ? config.update(item.id, { name }) : config.create({ name, active: true })),
      editing ? `Updated ${config.noun}.` : `Added ${config.noun}.`,
      onSaved,
    );
  };

  return (
    <FormModal
      title={editing ? `Edit ${config.noun}` : `Add ${config.noun}`}
      size="sm"
      onClose={onClose}
      onSubmit={submit}
      busy={form.busy}
      formError={form.formError}
      submitLabel={editing ? "Save changes" : `Add ${config.noun}`}
    >
      <label>
        {config.nameLabel} *
        <Input value={form.values.name} onChange={form.change("name")} placeholder={config.placeholder} />
        <FieldMessage name="name" fields={form.fields} />
      </label>
    </FormModal>
  );
}

// Names look like 2023-2027 (the backend rejects anything else)
const SESSION_NAME = /^(\d{4})-(\d{4})$/;

const sessionConfig: NamedListConfig<AdminAcademicSession> = {
  title: "Academic sessions",
  text: "Shown in the registration form and printed on acceptance letters. Inactive sessions are hidden from the form.",
  noun: "session",
  nameLabel: "Session name",
  placeholder: "e.g. 2023-2027",
  list: adminApi.academicSessions,
  create: adminApi.academicSession.create,
  update: adminApi.academicSession.update,
  remove: adminApi.academicSession.remove,
  // Newest first
  sort: (items) => [...items].sort((a, b) => b.name.localeCompare(a.name)),
  checkName: (name) => {
    const match = SESSION_NAME.exec(name);
    if (!match) return "Use the format 2023-2027";
    return Number(match[2]) < Number(match[1]) ? "The end year cannot be before the start year" : "";
  },
};

const subjectConfig: NamedListConfig<AdminMajorSubject> = {
  title: "Major subjects",
  text: "Shown in the registration form and printed on acceptance letters. Inactive subjects are hidden from the form.",
  noun: "subject",
  nameLabel: "Subject name",
  placeholder: "e.g. Computer Science",
  list: adminApi.majorSubjects,
  create: adminApi.majorSubject.create,
  update: adminApi.majorSubject.update,
  remove: adminApi.majorSubject.remove,
  sort: (items) => [...items].sort((a, b) => a.name.localeCompare(b.name)),
};

export function AcademicSessionsSection() {
  return <NamedListPanel config={sessionConfig} />;
}

export function MajorSubjectsSection() {
  return <NamedListPanel config={subjectConfig} />;
}
