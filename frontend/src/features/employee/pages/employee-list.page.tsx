import { useState, useMemo, useCallback } from 'react';
import {
  Typography,
  Button,
  Table,
  Tag,
  Select,
  Input,
  Space,
  Popconfirm,
  Dropdown,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
  TeamOutlined,
  UserAddOutlined,
  SafetyCertificateOutlined,
  KeyOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  CrownOutlined,
  ClearOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useEmployees, useRoles } from '../hooks/use-employees.hook';
import { useDeleteEmployee } from '../hooks/use-employee-mutations.hook';
import { EmployeeFormModal } from '../components/employee-form-modal.component';
import { EmployeeStatusModal } from '../components/employee-status-modal.component';
import { ResetPasswordModal } from '../components/reset-password-modal.component';
import { RoleModal } from '../components/role-modal.component';
import {
  EMPLOYEE_STATUS_TAGS,
  EMPLOYEE_STATUS_OPTIONS,
} from '../constants/employee.constants';
import type { Employee, EmployeeFilterParams, EmployeeStatus } from '../types/employee.types';
import styles from './employee-list.module.css';

const { Title, Paragraph } = Typography;

export function EmployeeListPage() {
  const [filters, setFilters] = useState<EmployeeFilterParams>({});
  const { data: employees = [], isLoading } = useEmployees(filters);
  const { data: roles = [] } = useRoles();
  const deleteMutation = useDeleteEmployee();

  // Modals
  const [isFormModalOpen, setFormModalOpen] = useState(false);
  const [isStatusModalOpen, setStatusModalOpen] = useState(false);
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  const [isRoleModalOpen, setRoleModalOpen] = useState(false);

  // Selected Employee for operations
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Derive counts
  const activeAdminCount = useMemo(() => {
    return employees.filter(
      (e) => e.status === 'Active' && e.roleName?.toLowerCase().includes('admin')
    ).length;
  }, [employees]);

  const summary = useMemo(() => {
    let active = 0;
    let onLeave = 0;
    let suspended = 0;

    for (const e of employees) {
      if (e.status === 'Active') active++;
      else if (e.status === 'OnLeave') onLeave++;
      else if (e.status === 'Suspended') suspended++;
    }

    return {
      total: employees.length,
      active,
      onLeave,
      suspended,
      activeAdminCount,
    };
  }, [employees, activeAdminCount]);

  // Modal Triggers
  const handleOpenCreate = () => {
    setSelectedEmployee(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormModalOpen(true);
  };

  const handleOpenStatus = (employee: Employee) => {
    setSelectedEmployee(employee);
    setStatusModalOpen(true);
  };

  const handleOpenPassword = (employee: Employee) => {
    setSelectedEmployee(employee);
    setPasswordModalOpen(true);
  };

  // Filter Handlers
  const handleSearchChange = useCallback((text: string) => {
    setFilters((prev) => ({ ...prev, search: text || undefined }));
  }, []);

  const handleRoleChange = useCallback((role: string | undefined) => {
    setFilters((prev) => ({ ...prev, role }));
  }, []);

  const handleStatusChange = useCallback((status: EmployeeStatus | undefined) => {
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const hasActiveFilters = Boolean(filters.search || filters.role || filters.status);

  // Table Columns
  const columns: ColumnsType<Employee> = useMemo(
    () => [
      {
        title: 'Employee Name',
        key: 'name',
        render: (_, record) => {
          const isAdmin = record.roleName?.toLowerCase().includes('admin');
          return (
            <Space>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#e0f2fe',
                  color: '#0284c7',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {isAdmin ? <CrownOutlined /> : <UserOutlined />}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#1e293b' }}>
                  {record.fullName}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  @{record.username}
                </div>
              </div>
            </Space>
          );
        },
      },
      {
        title: 'Assigned Role',
        dataIndex: 'roleName',
        key: 'roleName',
        width: 170,
        render: (roleName: string | undefined) => {
          const name = roleName || 'Staff';
          const isAdmin = name.toLowerCase().includes('admin');
          return (
            <Tag color="blue">
              {isAdmin ? <CrownOutlined style={{ marginRight: 4 }} /> : null}
              {name}
            </Tag>
          );
        },
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 140,
        render: (status: EmployeeStatus) => {
          const tagConfig = EMPLOYEE_STATUS_TAGS[status] || { color: 'default' };
          return <Tag color={tagConfig.color}>{status}</Tag>;
        },
      },
      {
        title: 'Created Date',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 140,
        render: (date: string | undefined) =>
          date ? dayjs(date).format('MMM D, YYYY') : '--',
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 130,
        align: 'right',
        render: (_, record) => {
          const isAdmin = record.roleName?.toLowerCase().includes('admin');
          const isOnlyAdmin = isAdmin && activeAdminCount <= 1 && record.status === 'Active';

          const menuItems: MenuProps['items'] = [
            {
              key: 'edit',
              icon: <EditOutlined />,
              label: 'Edit Details',
              onClick: () => handleOpenEdit(record),
            },
            {
              key: 'status',
              icon: <SafetyCertificateOutlined />,
              label: 'Change Status',
              onClick: () => handleOpenStatus(record),
            },
            {
              key: 'password',
              icon: <KeyOutlined />,
              label: 'Reset Password',
              onClick: () => handleOpenPassword(record),
            },
          ];

          return (
            <Space size="small">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenEdit(record)}
              />
              <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                <Button type="text" size="small" icon={<MoreOutlined />} />
              </Dropdown>
              <Popconfirm
                title="Delete Account"
                description={
                  isOnlyAdmin
                    ? 'AT LEAST ONE ACTIVE ADMINISTRATOR (BR-006): Cannot delete the sole active admin.'
                    : 'Accounts with historical records cannot be deleted; mark Terminated instead (BR-007).'
                }
                onConfirm={() => deleteMutation.mutate(record.employeeId)}
                okText="Delete"
                cancelText="Cancel"
                disabled={isOnlyAdmin}
                okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
              >
                <Button
                  type="text"
                  danger
                  size="small"
                  disabled={isOnlyAdmin}
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            </Space>
          );
        },
      },
    ],
    [activeAdminCount, deleteMutation]
  );

  return (
    <main className={styles.pageContainer} aria-label="Staff and Role Administration">
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <Title level={2} className={styles.pageTitle}>
            <TeamOutlined style={{ marginRight: 8 }} />
            Staff & Role Management
          </Title>
          <Paragraph className={styles.pageDescription}>
            Manage staff credentials, operational role assignments, and enforce security policies (BR-001–BR-008).
          </Paragraph>
        </div>
        <div className={styles.headerActions}>
          <Button
            icon={<SafetyCertificateOutlined />}
            onClick={() => setRoleModalOpen(true)}
          >
            Manage Roles
          </Button>
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={handleOpenCreate}
            style={{ background: '#0284c7', borderColor: '#0284c7' }}
          >
            Register Employee
          </Button>
        </div>
      </div>

      {/* Summary KPI Counters */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Workforce</div>
          <div className={styles.statValue}>{summary.total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active Staff</div>
          <div className={styles.statValue} style={{ color: '#16a34a' }}>
            {summary.active}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>On Leave / Suspended</div>
          <div className={styles.statValue} style={{ color: '#d97706' }}>
            {summary.onLeave + summary.suspended}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active Administrators</div>
          <div className={styles.statValue} style={{ color: '#0284c7' }}>
            {summary.activeAdminCount} / 1 Allowed
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterItem} style={{ flex: 1, minWidth: 220 }}>
          <label className={styles.filterLabel}>Search Personnel</label>
          <Input.Search
            placeholder="Search by name or username"
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            allowClear
          />
        </div>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Filter by Role</label>
          <Select
            allowClear
            placeholder="All Roles"
            options={roles.map((r) => ({ value: r.roleName, label: r.roleName }))}
            value={filters.role}
            onChange={handleRoleChange}
            style={{ width: '100%' }}
          />
        </div>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Filter by Status</label>
          <Select
            allowClear
            placeholder="All Statuses"
            options={EMPLOYEE_STATUS_OPTIONS}
            value={filters.status}
            onChange={handleStatusChange}
            style={{ width: '100%' }}
          />
        </div>
        {hasActiveFilters && (
          <div className={styles.filterClear}>
            <Button icon={<ClearOutlined />} onClick={clearFilters} size="small">
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className={styles.tableContainer}>
        <Table<Employee>
          dataSource={employees}
          columns={columns}
          rowKey="employeeId"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          size="middle"
        />
      </div>

      {/* Modals */}
      <EmployeeFormModal
        open={isFormModalOpen}
        onClose={() => setFormModalOpen(false)}
        employee={selectedEmployee}
        activeAdminCount={activeAdminCount}
      />

      <EmployeeStatusModal
        open={isStatusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        employee={selectedEmployee}
        activeAdminCount={activeAdminCount}
      />

      <ResetPasswordModal
        open={isPasswordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        employee={selectedEmployee}
      />

      <RoleModal
        open={isRoleModalOpen}
        onClose={() => setRoleModalOpen(false)}
      />
    </main>
  );
}
