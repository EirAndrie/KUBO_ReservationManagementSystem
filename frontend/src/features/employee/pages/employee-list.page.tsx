import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { App, Button, Form, Input, Modal, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  LockOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/features/auth';
import {
  Avatar,
  EmptyState,
  ErrorState,
  FilterChip,
  ListSkeleton,
  PageHeader,
  RowMenu,
  Section,
  StatusBadge,
  TabLabel,
  TwoLine,
} from '@/components/common';
import type { RowMenuItem } from '@/components/common';
import { formatDate, label } from '@/lib/format';
import { useEmployees, useRoles } from '../hooks/use-employees.hook';
import {
  useCreateRole,
  useDeleteEmployee,
  useDeleteRole,
  useUpdateEmployee,
  useUpdateRole,
} from '../hooks/use-employee-mutations.hook';
import { EmployeeFormModal } from '../components/employee-form-modal.component';
import { ResetPasswordModal } from '../components/reset-password-modal.component';
import { EMPLOYEE_POLICIES } from '../constants/employee.constants';
import { EMPLOYEE_STATUSES } from '../types/employee.types';
import type { Employee, EmployeeStatus, Role } from '../types/employee.types';
import styles from './employee-list.module.css';

type Tab = 'members' | 'roles';

/** Create/edit form for the Roles tab. */
const RoleFormModal: React.FC<{ role: Role | null | undefined; onClose: () => void }> = ({ role, onClose }) => {
  const [form] = Form.useForm<{ roleName: string; description: string }>();
  const create = useCreateRole();
  const update = useUpdateRole();
  const open = role !== undefined;

  const submit = async () => {
    const v = await form.validateFields();
    try {
      if (role) await update.mutateAsync({ roleId: role.roleId, payload: v });
      else await create.mutateAsync(v);
      onClose();
    } catch {
      // Server message shown by the mutation toast.
    }
  };

  return (
    <Modal
      open={open}
      title={role ? `Edit ${role.roleName}` : 'New role'}
      okText={role ? 'Save changes' : 'Create role'}
      okButtonProps={{ loading: create.isPending || update.isPending }}
      onOk={submit}
      onCancel={onClose}
      destroyOnHidden
      afterOpenChange={(visible) => visible && form.setFieldsValue({ roleName: role?.roleName ?? '', description: role?.description ?? '' })}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="roleName" label="Name" rules={[{ required: true, whitespace: true, message: 'Enter a role name.' }]}>
          <Input maxLength={50} />
        </Form.Item>
        <Form.Item name="description" label="Description" rules={[{ required: true, whitespace: true, message: 'Describe the role.' }]}>
          <Input.TextArea rows={3} maxLength={255} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

/**
 * Employees (Administrator). Members and Roles are tabs on one page. Every
 * member action lives in `⋯`; "Suspend access" is separated and red. The
 * last active Administrator can't be demoted, suspended or deleted, so those
 * items are disabled with the reason as a tooltip.
 */
export const EmployeeListPage: React.FC = () => {
  const { modal } = App.useApp();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'members';
  const roleFilter = params.get('role') || undefined;
  const statusFilter = (params.get('status') as EmployeeStatus) || undefined;
  const [search, setSearch] = useState('');

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const employees = useEmployees();
  const roles = useRoles();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const deleteRole = useDeleteRole();

  const [form, setForm] = useState<{ employee: Employee | null } | null>(null);
  const [resetFor, setResetFor] = useState<Employee | null>(null);
  const [roleForm, setRoleForm] = useState<Role | null | undefined>(undefined);

  const all = useMemo(() => employees.data ?? [], [employees.data]);
  const activeAdmins = all.filter((e) => e.roleName === 'Administrator' && e.status === 'Active');
  const isLastAdmin = (e: Employee) => e.roleName === 'Administrator' && e.status === 'Active' && activeAdmins.length <= 1;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (e) =>
        (!roleFilter || e.roleName === roleFilter) &&
        (!statusFilter || e.status === statusFilter) &&
        (!q || e.fullName.toLowerCase().includes(q) || e.username.toLowerCase().includes(q)),
    );
  }, [all, search, roleFilter, statusFilter]);

  const roleCounts = useMemo(() => {
    const m = new Map<string, number>();
    all.forEach((e) => e.roleName && m.set(e.roleName, (m.get(e.roleName) ?? 0) + 1));
    return m;
  }, [all]);

  const setStatus = (e: Employee, status: EmployeeStatus, title: string, content: string, danger = false) =>
    modal.confirm({
      title,
      content,
      okText: title.replace(/\?$/, ''),
      okButtonProps: { danger },
      onOk: () => updateEmployee.mutateAsync({ employeeId: e.employeeId, payload: { status } }),
    });

  const lastAdminReason = EMPLOYEE_POLICIES.LAST_ADMIN_PROTECTION;

  const menuFor = (e: Employee): RowMenuItem[] => {
    const last = isLastAdmin(e);
    const items: RowMenuItem[] = [
      { key: 'edit', label: 'Edit details', icon: <EditOutlined />, onClick: () => setForm({ employee: e }) },
      {
        key: 'role',
        label: 'Change role',
        icon: <SafetyCertificateOutlined />,
        disabled: last,
        reason: lastAdminReason,
        onClick: () => setForm({ employee: e }),
      },
      { key: 'reset', label: 'Reset password', icon: <KeyOutlined />, onClick: () => setResetFor(e) },
    ];
    if (e.status === 'OnLeave' || e.status === 'Suspended' || e.status === 'Inactive') {
      items.push({
        key: 'activate',
        label: e.status === 'OnLeave' ? 'Mark back from leave' : 'Restore access',
        icon: <UnlockOutlined />,
        onClick: () => setStatus(e, 'Active', `Restore access for ${e.fullName}?`, `${e.fullName} will be able to sign in again.`),
      });
    }
    if (e.status === 'Active') {
      items.push({
        key: 'leave',
        label: 'Set on leave',
        icon: <ClockCircleOutlined />,
        disabled: last,
        reason: lastAdminReason,
        onClick: () => setStatus(e, 'OnLeave', `Set ${e.fullName} on leave?`, 'They can’t sign in until they are marked back.'),
      });
    }
    items.push({ key: 'd', divider: true });
    if (e.status !== 'Suspended') {
      items.push({
        key: 'suspend',
        label: 'Suspend access',
        icon: <LockOutlined />,
        danger: true,
        disabled: last,
        reason: lastAdminReason,
        onClick: () =>
          setStatus(e, 'Suspended', `Suspend access for ${e.fullName}?`, `${e.fullName} will be signed out of new sessions and can’t sign in.`, true),
      });
    }
    items.push({
      key: 'delete',
      label: 'Delete account',
      icon: <DeleteOutlined />,
      danger: true,
      disabled: last || e.employeeId === user?.employeeId,
      reason: last ? lastAdminReason : 'You can’t delete your own account.',
      onClick: () =>
        modal.confirm({
          title: `Delete ${e.fullName}?`,
          content: `${EMPLOYEE_POLICIES.NO_DELETE_WITH_REFERENCES} This can’t be undone.`,
          okText: 'Delete account',
          okButtonProps: { danger: true },
          onOk: () => deleteEmployee.mutateAsync(e.employeeId),
        }),
    });
    return items;
  };

  const memberColumns: ColumnsType<Employee> = [
    {
      title: 'Name',
      render: (_, e) => (
        <span className={styles.person}>
          <Avatar name={e.fullName} />
          <TwoLine
            primary={
              <>
                {e.fullName}
                {e.employeeId === user?.employeeId && <span className="muted"> (you)</span>}
              </>
            }
            secondary={`@${e.username}`}
          />
        </span>
      ),
    },
    {
      title: 'Role',
      width: 180,
      render: (_, e) => (
        <span className={styles.roleTag}>
          {e.roleName === 'Administrator' && <SafetyCertificateOutlined aria-hidden="true" />}
          {e.roleName ?? '—'}
        </span>
      ),
    },
    { title: 'Status', width: 150, render: (_, e) => <StatusBadge status={e.status} /> },
    { title: 'Added', width: 140, render: (_, e) => <span className="tabular">{formatDate(e.createdAt)}</span> },
    { key: 'menu', width: 48, align: 'center', render: (_, e) => <RowMenu items={menuFor(e)} label={`Actions for ${e.fullName}`} /> },
  ];

  const roleColumns: ColumnsType<Role> = [
    { title: 'Role', render: (_, r) => <TwoLine primary={r.roleName} secondary={r.description} /> },
    { title: 'Members', width: 120, align: 'right', render: (_, r) => <span className="tabular">{roleCounts.get(r.roleName) ?? 0}</span> },
    {
      key: 'menu',
      width: 48,
      align: 'center',
      render: (_, r) => {
        const used = (roleCounts.get(r.roleName) ?? 0) > 0;
        return (
          <RowMenu
            label={`Actions for ${r.roleName}`}
            items={[
              { key: 'edit', label: 'Edit role', icon: <EditOutlined />, onClick: () => setRoleForm(r) },
              { key: 'd', divider: true },
              {
                key: 'delete',
                label: 'Delete role',
                icon: <DeleteOutlined />,
                danger: true,
                disabled: used,
                reason: EMPLOYEE_POLICIES.ROLE_PROTECTION,
                onClick: () =>
                  modal.confirm({
                    title: `Delete the ${r.roleName} role?`,
                    content: 'No employees have this role. It is removed permanently.',
                    okText: 'Delete role',
                    okButtonProps: { danger: true },
                    onOk: () => deleteRole.mutateAsync(r.roleId),
                  }),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        description="People who can sign in to the reservation system."
        action={
          tab === 'members' ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setForm({ employee: null })}>
              Add employee
            </Button>
          ) : (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setRoleForm(null)}>
              Add role
            </Button>
          )
        }
      />

      <Tabs
        activeKey={tab}
        onChange={(k) => set({ tab: k === 'members' ? undefined : k })}
        items={[
          { key: 'members', label: <TabLabel text="Members" count={all.length} active={tab === 'members'} /> },
          { key: 'roles', label: <TabLabel text="Roles" count={roles.data?.length} active={tab === 'roles'} /> },
        ]}
      />

      {tab === 'members' ? (
        <>
          <div className={styles.toolbar}>
            <Input
              allowClear
              prefix={<SearchOutlined className="muted" />}
              placeholder="Search name or username"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 260 }}
              aria-label="Search employees"
            />
            <FilterChip<string>
              name="Role"
              value={roleFilter}
              options={(roles.data ?? []).map((r) => ({ value: r.roleName, label: r.roleName }))}
              onChange={(v) => set({ role: v })}
            />
            <FilterChip<EmployeeStatus>
              name="Status"
              value={statusFilter}
              options={EMPLOYEE_STATUSES.map((s) => ({ value: s, label: label(s) }))}
              onChange={(v) => set({ status: v })}
            />
          </div>
          <Section flush>
            {employees.isLoading ? (
              <ListSkeleton rows={6} />
            ) : employees.isError ? (
              <ErrorState error={employees.error} onRetry={() => employees.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState title="No employees match" description="Clear the filters to see everyone." />
            ) : (
              <Table<Employee> rowKey="employeeId" columns={memberColumns} dataSource={rows} pagination={false} size="middle" />
            )}
          </Section>
        </>
      ) : (
        <Section flush>
          {roles.isLoading ? (
            <ListSkeleton rows={3} />
          ) : roles.isError ? (
            <ErrorState error={roles.error} onRetry={() => roles.refetch()} />
          ) : (
            <Table<Role> rowKey="roleId" columns={roleColumns} dataSource={roles.data} pagination={false} size="middle" />
          )}
        </Section>
      )}

      <EmployeeFormModal
        open={Boolean(form)}
        employee={form?.employee}
        activeAdminCount={activeAdmins.length}
        onClose={() => setForm(null)}
      />
      <ResetPasswordModal open={Boolean(resetFor)} employee={resetFor} onClose={() => setResetFor(null)} />
      <RoleFormModal role={roleForm} onClose={() => setRoleForm(undefined)} />
    </div>
  );
};
