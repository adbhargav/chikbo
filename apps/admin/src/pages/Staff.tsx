import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Permission } from '@chikbo/shared';
import { api, errorMessage } from '../lib/api';
import type { StaffRoleRow, StaffUserRow } from '../lib/types';
import { formatDate, humanize } from '../lib/format';
import { PermissionGate, useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { EmptyState, ErrorState, PageHead, Switch, TableSkeleton } from '../components/ui';

interface RolesResponse {
  roles: StaffRoleRow[];
  allPermissions: Permission[];
}

interface RoleForm {
  id?: string;
  name: string;
  description: string;
  permissions: Permission[];
}

interface InviteForm {
  name: string;
  email: string;
  password: string;
  staffRoleId: string;
}

function groupPermissions(all: Permission[]): [string, Permission[]][] {
  const groups = new Map<string, Permission[]>();
  for (const p of all) {
    const area = p.split('.')[0] ?? 'other';
    const list = groups.get(area) ?? [];
    list.push(p);
    groups.set(area, list);
  }
  return [...groups.entries()];
}

function RoleEditor({
  role,
  allPermissions,
  onClose,
}: {
  role: StaffRoleRow | null;
  allPermissions: Permission[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RoleForm>({
    id: role?.id,
    name: role?.name ?? '',
    description: role?.description ?? '',
    permissions: role?.permissions ?? [],
  });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (state: RoleForm) => {
      const body = {
        name: state.name.trim(),
        description: state.description.trim() || undefined,
        permissions: state.permissions,
      };
      return state.id
        ? api<StaffRoleRow>(`/admin/roles/${state.id}`, { method: 'PATCH', body })
        : api<StaffRoleRow>('/admin/roles', { method: 'POST', body });
    },
    onSuccess: (_d, state) => {
      toast(state.id ? 'Role saved' : 'Role created', 'success');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const togglePermission = (p: Permission) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p)
        ? f.permissions.filter((x) => x !== p)
        : [...f.permissions, p],
    }));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.name.trim().length < 2) return setError('Role name must be at least 2 characters');
    if (form.permissions.length === 0) return setError('Grant at least one permission');
    save.mutate(form);
  };

  return (
    <Modal
      wide
      title={role ? `Edit role · ${role.name}` : 'New role'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : role ? 'Save role' : 'Create role'}
          </button>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-row cols-2">
          <div className="field">
            <label htmlFor="r-name">Name</label>
            <input
              id="r-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Operations Manager"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="r-desc">Description</label>
            <input
              id="r-desc"
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Runs day-to-day fulfilment"
            />
          </div>
        </div>
        <div className="field">
          <label>Permissions ({form.permissions.length} granted)</label>
          <div className="perm-groups">
            {groupPermissions(allPermissions).map(([area, perms]) => (
              <div className="perm-group" key={area}>
                <h4>{humanize(area)}</h4>
                {perms.map((p) => (
                  <label className="checkbox" key={p}>
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(p)}
                      onChange={() => togglePermission(p)}
                    />
                    {humanize(p.split('.')[1] ?? p)}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

function InviteDialog({ roles, onClose }: { roles: StaffRoleRow[]; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<InviteForm>({ name: '', email: '', password: '', staffRoleId: '' });
  const [error, setError] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: (state: InviteForm) => api<StaffUserRow>('/admin/staff', { method: 'POST', body: state }),
    onSuccess: (u) => {
      toast(`${u.name} added to the team`, 'success');
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.name.trim().length < 2) return setError('Name must be at least 2 characters');
    if (form.password.length < 8 || !/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password)) {
      return setError('Password must be 8+ characters with a letter and a number');
    }
    if (!form.staffRoleId) return setError('Pick a role');
    invite.mutate({ ...form, name: form.name.trim(), email: form.email.trim() });
  };

  return (
    <Modal
      title="Invite staff"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={invite.isPending}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={invite.isPending}>
            {invite.isPending ? 'Adding…' : 'Add staff member'}
          </button>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="i-name">Name</label>
          <input
            id="i-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="i-email">Email</label>
          <input
            id="i-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="them@chikbo.in"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="i-password">Temporary password</label>
          <input
            id="i-password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
          />
          <span className="hint">At least 8 characters with a letter and a number.</span>
        </div>
        <div className="field">
          <label htmlFor="i-role">Role</label>
          <select
            id="i-role"
            value={form.staffRoleId}
            onChange={(e) => setForm((f) => ({ ...f, staffRoleId: e.target.value }))}
            required
          >
            <option value="">Choose…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  );
}

export function Staff() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleEditing, setRoleEditing] = useState<StaffRoleRow | null | 'new'>(null);

  const roles = useQuery({
    queryKey: ['roles'],
    queryFn: () => api<RolesResponse>('/admin/roles'),
  });
  const staff = useQuery({
    queryKey: ['staff'],
    queryFn: () => api<StaffUserRow[]>('/admin/staff'),
  });

  const patchStaff = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { staffRoleId?: string; isActive?: boolean } }) =>
      api<StaffUserRow>(`/admin/staff/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast('Staff member updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const roleList = useMemo(() => roles.data?.roles ?? [], [roles.data]);

  return (
    <main className="page">
      <PageHead
        overline="People"
        title="Staff & Roles"
        sub="Who holds the keys, and which doors they open."
        actions={
          <PermissionGate permission="staff.write">
            <>
              <button className="btn btn-secondary" onClick={() => setRoleEditing('new')}>
                + New role
              </button>
              <button className="btn btn-primary" onClick={() => setInviteOpen(true)} disabled={roleList.length === 0}>
                + Invite staff
              </button>
            </>
          </PermissionGate>
        }
      />

      {staff.isError ? (
        <ErrorState error={staff.error} onRetry={() => staff.refetch()} />
      ) : (
        <div className="table-wrap" style={{ marginBottom: 24 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Active</th>
                <th>Joined</th>
              </tr>
            </thead>
            {staff.isPending ? (
              <TableSkeleton cols={5} rows={5} />
            ) : staff.data.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={5}>
                    <EmptyState title="No staff yet" />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {staff.data.map((s) => {
                  const isSuper = s.role === 'SUPER_ADMIN';
                  const isSelf = s.id === user?.id;
                  return (
                    <tr key={s.id}>
                      <td className="primary">
                        {s.name}
                        {isSelf && (
                          <span className="muted" style={{ fontSize: 12 }}>
                            {' '}
                            (you)
                          </span>
                        )}
                      </td>
                      <td className="muted">{s.email}</td>
                      <td>
                        {isSuper ? (
                          <span className="role-chip">Super Admin</span>
                        ) : (
                          <PermissionGate
                            permission="staff.write"
                            fallback={<span className="role-chip">{s.staffRole?.name ?? 'Staff'}</span>}
                          >
                            <select
                              aria-label={`Role for ${s.name}`}
                              value={s.staffRole?.id ?? ''}
                              style={{ width: 200 }}
                              onChange={(e) =>
                                e.target.value && patchStaff.mutate({ id: s.id, body: { staffRoleId: e.target.value } })
                              }
                            >
                              <option value="" disabled>
                                No role
                              </option>
                              {roleList.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </PermissionGate>
                        )}
                      </td>
                      <td>
                        <PermissionGate
                          permission="staff.write"
                          fallback={<span className="muted">{s.isActive ? 'Yes' : 'No'}</span>}
                        >
                          <Switch
                            checked={s.isActive}
                            disabled={patchStaff.isPending || isSelf}
                            label={`Toggle ${s.name} active`}
                            onChange={(next) => patchStaff.mutate({ id: s.id, body: { isActive: next } })}
                          />
                        </PermissionGate>
                      </td>
                      <td className="muted">{formatDate(s.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
      )}

      <h2 style={{ fontSize: 19, marginBottom: 12 }}>Roles</h2>
      {roles.isError ? (
        <ErrorState error={roles.error} onRetry={() => roles.refetch()} />
      ) : roles.isPending ? (
        <div className="skel" style={{ height: 120 }} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Description</th>
                <th className="num">Permissions</th>
                <th className="num">Members</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {roleList.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState title="No roles yet" message="Create a role before inviting staff." />
                  </td>
                </tr>
              ) : (
                roleList.map((r) => (
                  <tr key={r.id}>
                    <td className="primary">{r.name}</td>
                    <td className="muted">{r.description ?? '—'}</td>
                    <td className="num">{r.permissions.length}</td>
                    <td className="num">{r._count?.users ?? 0}</td>
                    <td style={{ textAlign: 'right' }}>
                      <PermissionGate permission="staff.write">
                        <button className="btn btn-ghost btn-sm" onClick={() => setRoleEditing(r)}>
                          Edit permissions
                        </button>
                      </PermissionGate>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {inviteOpen && <InviteDialog roles={roleList} onClose={() => setInviteOpen(false)} />}
      {roleEditing !== null && roles.data && (
        <RoleEditor
          role={roleEditing === 'new' ? null : roleEditing}
          allPermissions={roles.data.allPermissions}
          onClose={() => setRoleEditing(null)}
        />
      )}
    </main>
  );
}
