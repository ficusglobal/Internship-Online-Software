import { useEffect, useRef, useState, type FormEvent } from "react";
import { Mail, MailPlus, Plus } from "lucide-react";
import { adminApi, type AdminBatch, type AdminCollege, type WhatsappGroup } from "../../lib/admin-api";
import { DropdownSelector } from "../../shared/components/dropdown-selector";
import { Input } from "../../shared/components/ui";
import {
  ActiveBadge,
  byName,
  describeError,
  Empty,
  FieldMessage,
  FormAlert,
  FormButtons,
  Loading,
  optionalNumber,
  optionsOf,
  Panel,
  requiredErrors,
  RowActions,
  useAdminForm,
  useRowAction,
} from "./admin-ui";

// WhatsappGroupService.validateUrl: an invite link, no spaces, at most 1000 characters
const INVITE_PREFIX = "https://chat.whatsapp.com/";
const URL_MAX = 1000;

const emptyGroup = { collegeId: "", batchId: "", groupName: "", groupUrl: "" };

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
  const [editingId, setEditingId] = useState<number | null>(null);
  const form = useAdminForm(emptyGroup);
  const rows = useRowAction();
  const formRef = useRef<HTMLFormElement>(null);
  const latest = useRef(0);

  useEffect(() => {
    Promise.all([adminApi.colleges(), adminApi.batches()])
      .then(([collegeList, batchList]) => {
        setColleges(byName(collegeList));
        setBatches(batchList);
      })
      .catch((err: unknown) => setOptionsError(describeError(err).message));
  }, []);

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

  const cancelEdit = () => {
    setEditingId(null);
    form.reset();
  };

  const startEdit = (group: WhatsappGroup) => {
    setEditingId(group.id);
    form.load({
      collegeId: String(group.collegeId),
      batchId: String(group.batchId),
      groupName: group.groupName,
      groupUrl: group.groupUrl,
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const adding = editingId === null;
    const v = {
      ...form.values,
      collegeId: form.values.collegeId || (adding ? collegeId : ""),
      batchId: form.values.batchId || (adding ? batchId : ""),
    };
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
      () => (editingId === null ? adminApi.createWhatsappGroup({ ...body, isActive: true }) : adminApi.updateWhatsappGroup(editingId, body)),
      editingId === null ? "WhatsApp group added." : "WhatsApp group updated.",
      () => {
        setEditingId(null);
        reload();
      },
    );
  };

  const toggle = (group: WhatsappGroup) => {
    const active = group.isActive !== false;
    void rows
      .run(`g${group.id}`, () => adminApi.updateWhatsappGroup(group.id, { isActive: !active }), active ? "Group deactivated." : "Group activated.")
      .then((ok) => ok && reload());
  };

  const remove = (group: WhatsappGroup) => {
    void rows
      .run(`g${group.id}`, () => adminApi.deleteWhatsappGroup(group.id), "WhatsApp group deleted.", `Delete the group “${group.groupName}”? This cannot be undone.`)
      .then((ok) => {
        if (!ok) return;
        if (editingId === group.id) cancelEdit();
        reload();
      });
  };

  const send = (group: WhatsappGroup, resend: boolean) => {
    void rows.run(
      `g${group.id}`,
      () => adminApi.sendWhatsappLinks(group.id, resend),
      (result) => (result as { message?: string })?.message ?? "Group link emailed.",
      resend
        ? `Email the link of “${group.groupName}” again to ALL paid students of this college and batch?`
        : `Email the link of “${group.groupName}” to paid students who have not received it yet?`,
    );
  };

  return (
    <Panel title="WhatsApp groups" text="One group per college and batch. Only https://chat.whatsapp.com/ invite links are accepted.">
      {optionsError && <FormAlert message={optionsError} />}
      <div className="admin-picker">
        <label>
          College
          <DropdownSelector
            ariaLabel="College"
            value={collegeId}
            onValueChange={setCollegeId}
            options={optionsOf(colleges, (college) => college.name, "All colleges")}
          />
        </label>
        <label>
          Batch
          <DropdownSelector
            ariaLabel="Batch"
            value={batchId}
            onValueChange={setBatchId}
            options={optionsOf(batches, batchLabel, "All batches")}
          />
        </label>
      </div>

      {listError && <FormAlert message={listError} />}
      {groups === null && !listError ? (
        <Loading label="Loading groups…" />
      ) : groups && groups.length === 0 ? (
        <Empty text="No WhatsApp groups match these filters." />
      ) : groups ? (
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
              {groups.map((group) => {
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
                      <RowActions busy={busy} active={group.isActive} onEdit={() => startEdit(group)} onToggle={() => toggle(group)} onDelete={() => remove(group)}>
                        <button
                          type="button"
                          className="admin-icon-button"
                          onClick={() => send(group, false)}
                          disabled={busy || !active}
                          title={active ? "Email the link to waiting students" : "Activate the group to email its link"}
                          aria-label="Email the link to waiting students"
                        >
                          <Mail size={15} />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-button"
                          onClick={() => send(group, true)}
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
      ) : null}

      <form ref={formRef} className="admin-form" onSubmit={submit} noValidate>
        <h3>{editingId === null ? "Add a WhatsApp group" : "Edit WhatsApp group"}</h3>
        <FormAlert message={form.formError} />
        <div className="admin-grid">
          <label>
            College *
            <DropdownSelector
              ariaLabel="College"
              value={form.values.collegeId || (editingId === null ? collegeId : "")}
              onValueChange={form.set("collegeId")}
              options={optionsOf(colleges, (college) => college.name)}
              placeholder="Select college"
            />
            <FieldMessage name="collegeId" fields={form.fields} />
          </label>
          <label>
            Batch *
            <DropdownSelector
              ariaLabel="Batch"
              value={form.values.batchId || (editingId === null ? batchId : "")}
              onValueChange={form.set("batchId")}
              options={optionsOf(batches, batchLabel)}
              placeholder="Select batch"
            />
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
        <FormButtons busy={form.busy} editing={editingId !== null} addLabel="Add group" onCancel={cancelEdit} icon={<Plus size={16} />} />
      </form>
    </Panel>
  );
}
