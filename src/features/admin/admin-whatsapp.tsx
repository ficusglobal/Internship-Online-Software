import { useEffect, useRef, useState, type FormEvent } from "react";
import { Mail, MailPlus } from "lucide-react";
import { adminApi, type AdminBatch, type AdminCollege, type AdminStudentRow, type WhatsappGroup } from "../../lib/admin-api";
import { useListView } from "../../lib/use-list-view";
import { DropdownSelector } from "../../shared/components/dropdown-selector";
import { ErrorState } from "../../shared/components/error-state";
import { Modal } from "../../shared/components/modal";
import { Pagination } from "../../shared/components/pagination";
import { PersonListSkeleton, TableSkeleton } from "../../shared/components/skeleton";
import { toast } from "../../shared/components/toast";
import { Input } from "../../shared/components/ui";
import {
  ActiveBadge,
  AddButton,
  Avatar,
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

// WhatsappGroupService.validateUrl: an invite link, no spaces, at most 1000 characters
const INVITE_PREFIX = "https://chat.whatsapp.com/";
const URL_MAX = 1000;

const batchLabel = (batch: AdminBatch) => (batch.course?.name ? `${batch.batchName} · ${batch.course.name}` : batch.batchName);

// SUPER_ADMIN: one WhatsApp group (invite link) per college and batch. Paid students get the link in their
// payment email, or later through "Email waiting students" once the group exists.
export function WhatsappSection() {
  const [colleges, setColleges] = useState<AdminCollege[]>([]);
  const [batches, setBatches] = useState<AdminBatch[]>([]);
  const [optionsError, setOptionsError] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [groups, setGroups] = useState<WhatsappGroup[] | null>(null);
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  // null = closed, {} = add, { group } = edit
  const [editor, setEditor] = useState<{ group?: WhatsappGroup } | null>(null);
  const rows = useRowAction();
  // The group whose link is about to be emailed, and whether to include students who already got it
  const [sender, setSender] = useState<{ group: WhatsappGroup; resend: boolean } | null>(null);
  const [optionsKey, setOptionsKey] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    Promise.all([adminApi.colleges(), adminApi.batches()])
      .then(([collegeList, batchList]) => {
        setColleges(byName(collegeList));
        setBatches(batchList);
      })
      .catch((err: unknown) => setOptionsError(describeError(err).message));
  }, [optionsKey]);

  useEffect(() => {
    const request = ++latest.current;
    setGroups(null);
    setListError("");
    adminApi
      .whatsappGroups({ collegeId: optionalNumber(collegeId), batchId: optionalNumber(batchId) })
      .then((list) => request === latest.current && setGroups(list))
      .catch((err: unknown) => request === latest.current && setListError(describeError(err).message));
  }, [collegeId, batchId, reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);
  const view = useListView(
    groups,
    (group) => [group.groupName, group.collegeName, group.collegeCode, group.batchName, group.courseName].filter(Boolean).join(" "),
    `${collegeId}|${batchId}`,
  );

  const toggle = (group: WhatsappGroup) => {
    const active = group.isActive !== false;
    void rows
      .run(`g${group.id}`, () => adminApi.updateWhatsappGroup(group.id, { isActive: !active }), active ? "Group deactivated." : "Group activated.")
      .then((ok) => ok && reload());
  };

  const remove = (group: WhatsappGroup) => {
    void rows
      .run(`g${group.id}`, () => adminApi.deleteWhatsappGroup(group.id), "WhatsApp group deleted.", deleteConfirm("WhatsApp group", group.groupName))
      .then((ok) => ok && reload());
  };

  return (
    <Panel
      title="WhatsApp groups"
      text="One group per college and batch. Only https://chat.whatsapp.com/ invite links are accepted."
      actions={<AddButton label="Add group" onClick={() => setEditor({})} />}
    >
      {optionsError && (
        <FormAlert
          message={`Some filters could not be loaded: ${optionsError}`}
          onRetry={() => {
            setOptionsError("");
            setOptionsKey((key) => key + 1);
          }}
        />
      )}
      <div className="admin-toolbar">
        <label>
          College
          <DropdownSelector ariaLabel="College" value={collegeId} onValueChange={setCollegeId} options={optionsOf(colleges, (college) => college.name, "All colleges")} />
        </label>
        <label>
          Batch
          <DropdownSelector ariaLabel="Batch" value={batchId} onValueChange={setBatchId} options={optionsOf(batches, batchLabel, "All batches")} />
        </label>
        <SearchInput value={view.query} onChange={view.setQuery} placeholder="Search groups" label="Search groups" />
      </div>

      {listError ? (
        <ErrorState title="Couldn't load WhatsApp groups" message={listError} onRetry={reload} />
      ) : groups === null ? (
        <TableSkeleton headers={["Group", "College", "Batch", "Status", "Actions"]} rows={6} rowHeight={84} label="Loading WhatsApp groups" />
      ) : groups.length === 0 ? (
        <EmptyState
          text={collegeId || batchId ? "No WhatsApp groups match these filters." : "No WhatsApp groups yet."}
          actionLabel="Add group"
          onAction={() => setEditor({})}
        />
      ) : view.rows && view.matches === 0 ? (
        <EmptyState text={`No groups match “${view.query.trim()}”.`} />
      ) : view.rows ? (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>College</th>
                  <th>Batch</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((group) => {
                  const active = group.isActive !== false;
                  const busy = rows.busyKey === `g${group.id}`;
                  return (
                    <tr key={group.id}>
                      <td>
                        {group.groupName}
                        {group.groupUrl.startsWith(INVITE_PREFIX) && (
                          <a className="admin-subtext admin-link-text" href={group.groupUrl} target="_blank" rel="noopener noreferrer">
                            {group.groupUrl}
                          </a>
                        )}
                      </td>
                      <td>
                        {group.collegeName ?? `College #${group.collegeId}`}
                        {group.collegeCode && <small className="admin-subtext">{group.collegeCode}</small>}
                      </td>
                      <td>
                        {group.batchName ?? `Batch #${group.batchId}`}
                        {group.courseName && <small className="admin-subtext">{group.courseName}</small>}
                      </td>
                      <td><ActiveBadge active={group.isActive} /></td>
                      <td>
                        <RowActions busy={busy} active={group.isActive} onEdit={() => setEditor({ group })} onToggle={() => toggle(group)} onDelete={() => remove(group)}>
                          <button
                            type="button"
                            className="admin-icon-button"
                            onClick={() => setSender({ group, resend: false })}
                            disabled={busy || !active}
                            title={active ? "Email the link to waiting students" : "Activate the group to email its link"}
                            aria-label="Email the link to waiting students"
                          >
                            <Mail size={15} />
                          </button>
                          <button
                            type="button"
                            className="admin-icon-button"
                            onClick={() => setSender({ group, resend: true })}
                            disabled={busy || !active}
                            title={active ? "Email the link again to all paid students" : "Activate the group to email its link"}
                            aria-label="Email the link again to all paid students"
                          >
                            <MailPlus size={15} />
                          </button>
                        </RowActions>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination {...view.pagination} noun="groups" />
        </>
      ) : null}

      {sender && <SendLinksModal group={sender.group} resend={sender.resend} onClose={() => setSender(null)} />}
      {editor && (
        <GroupModal
          group={editor.group}
          colleges={colleges}
          batches={batches}
          defaults={{ collegeId, batchId }}
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

interface GroupModalProps {
  group?: WhatsappGroup;
  colleges: AdminCollege[];
  batches: AdminBatch[];
  // The filters pre-fill a new group
  defaults: { collegeId: string; batchId: string };
  onClose: () => void;
  onSaved: () => void;
}

function GroupModal({ group, colleges, batches, defaults, onClose, onSaved }: GroupModalProps) {
  const editing = group !== undefined;
  const form = useAdminForm({
    collegeId: group ? String(group.collegeId) : defaults.collegeId,
    batchId: group ? String(group.batchId) : defaults.batchId,
    groupName: group?.groupName ?? "",
    groupUrl: group?.groupUrl ?? "",
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const v = form.values;
    const errors = requiredErrors(v, ["collegeId", "batchId", "groupName", "groupUrl"], {
      collegeId: "College",
      batchId: "Batch",
      groupName: "Group name",
      groupUrl: "Group link",
    });
    const url = v.groupUrl.trim();
    if (url && (!url.startsWith(INVITE_PREFIX) || url.length <= INVITE_PREFIX.length || /\s/.test(url) || url.length > URL_MAX)) {
      errors.groupUrl = `Paste a WhatsApp invite link like ${INVITE_PREFIX}XXXXXXXX`;
    }
    const body = { collegeId: Number(v.collegeId), batchId: Number(v.batchId), groupName: v.groupName.trim(), groupUrl: url };
    form.save(
      errors,
      () => (editing ? adminApi.updateWhatsappGroup(group.id, body) : adminApi.createWhatsappGroup({ ...body, isActive: true })),
      editing ? "WhatsApp group updated." : "WhatsApp group added.",
      onSaved,
    );
  };

  return (
    <FormModal title={editing ? `Edit ${group.groupName}` : "Add a WhatsApp group"} onClose={onClose} onSubmit={submit} busy={form.busy} formError={form.formError} submitLabel={editing ? "Save changes" : "Add group"}>
      <div className="admin-grid">
        <label>
          College *
          <DropdownSelector ariaLabel="College" value={form.values.collegeId} onValueChange={form.set("collegeId")} options={optionsOf(colleges, (college) => college.name)} placeholder="Select college" />
          <FieldMessage name="collegeId" fields={form.fields} />
        </label>
        <label>
          Batch *
          <DropdownSelector ariaLabel="Batch" value={form.values.batchId} onValueChange={form.set("batchId")} options={optionsOf(batches, batchLabel)} placeholder="Select batch" />
          <FieldMessage name="batchId" fields={form.fields} />
        </label>
        <label>
          Group name *
          <Input value={form.values.groupName} onChange={form.change("groupName")} />
          <FieldMessage name="groupName" fields={form.fields} />
        </label>
        <label>
          Invite link *
          <Input type="url" maxLength={URL_MAX} value={form.values.groupUrl} onChange={form.change("groupUrl")} placeholder={`${INVITE_PREFIX}…`} />
          <FieldMessage name="groupUrl" fields={form.fields} />
        </label>
      </div>
    </FormModal>
  );
}

// Shows who the link will be emailed to before anything is sent. The server's send-pending endpoint works on a whole
// group (every paid student of the college and batch, or only those who have not received it), not on single students,
// so the list is the exact audience.
function SendLinksModal({ group, resend, onClose }: { group: WhatsappGroup; resend: boolean; onClose: () => void }) {
  const [recipients, setRecipients] = useState<AdminStudentRow[] | null>(null);
  const [total, setTotal] = useState<number | undefined>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    adminApi
      .students({ collegeId: group.collegeId, batchId: group.batchId, status: "ENROLLED", page: 0, size: 100 })
      .then((page) => {
        if (!current) return;
        setRecipients(page.rows);
        setTotal(page.total);
      })
      .catch((err: unknown) => current && setError(describeError(err).message));
    return () => {
      current = false;
    };
  }, [group.collegeId, group.batchId]);

  const send = async () => {
    setBusy(true);
    try {
      const result = await adminApi.sendWhatsappLinks(group.id, resend);
      toast.success(result?.message ?? "Group link emailed.");
      onClose();
    } catch (err) {
      toast.error(describeError(err).message);
      setBusy(false);
    }
  };

  const count = total ?? recipients?.length;
  return (
    <Modal title={resend ? "Email the link to all paid students" : "Email the link to waiting students"} description={group.groupName} onClose={onClose}>
      <div className="ui-modal-body">
        <p className="admin-muted">
          {resend
            ? "Everyone below receives the link again, including students who already got it."
            : "Paid students below who have not received the link yet will get it. Students who already have it are skipped."}
        </p>
        {error && <FormAlert message={`Could not load the student list: ${error}`} />}
        {recipients === null && !error ? (
          <PersonListSkeleton rows={4} label="Loading students" />
        ) : recipients && recipients.length === 0 ? (
          <p className="admin-empty">No paid students in this college and batch yet.</p>
        ) : recipients ? (
          <ul className="admin-recipients">
            {recipients.map((row, index) => (
              <li key={row.registrationId ?? row.studentId ?? index}>
                <Avatar name={row.studentName} size="sm" />
                <span>
                  <strong>{row.studentName ?? "—"}</strong>
                  <small className="admin-subtext">{row.email ?? "No email"}</small>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {total !== undefined && recipients && total > recipients.length && <p className="admin-muted">Showing the first {recipients.length} of {total} paid students.</p>}
      </div>
      <div className="ui-modal-footer">
        <button type="button" className="button button-outline" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="button" onClick={() => void send()} disabled={busy || (recipients !== null && recipients.length === 0)} data-autofocus>
          {resend ? "Send to everyone" : "Send"}
          {count !== undefined ? ` (${count})` : ""}
        </button>
      </div>
    </Modal>
  );
}
