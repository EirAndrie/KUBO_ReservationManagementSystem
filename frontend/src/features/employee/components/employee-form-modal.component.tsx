import React, { useEffect, useMemo } from 'react';
import { Modal, Form, Input, Select, Alert, Row, Col } from 'antd';
import { UserOutlined, LockOutlined, CrownOutlined } from '@ant-design/icons';
import { useCreateEmployee, useUpdateEmployee } from '../hooks/use-employee-mutations.hook';
import { useRoles } from '../hooks/use-employees.hook';
import { EMPLOYEE_STATUS_OPTIONS, EMPLOYEE_POLICIES } from '../constants/employee.constants';
import type { Employee, EmployeeStatus } from '../types/employee.types';
import styles from './employee-form-modal.module.css';

export interface EmployeeFormModalProps {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
  activeAdminCount?: number;
}

interface FormValues {
  firstName: string;
  lastName: string;
  username: string;
  password?: string;
  roleId: string;
  status: EmployeeStatus;
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  open,
  onClose,
  employee,
  activeAdminCount = 0,
}) => {
  const [form] = Form.useForm<FormValues>();
  const isEditing = Boolean(employee);

  const { data: roles = [] } = useRoles();
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();

  const isPending = createMutation.isPending || updateMutation.isPending;

  const selectedRoleId = Form.useWatch('roleId', form);
  const selectedStatus = Form.useWatch('status', form);

  const isAssigningAdmin = useMemo(() => {
    const role = roles.find((r) => r.roleId === selectedRoleId);
    return role?.roleName?.toLowerCase().includes('admin');
  }, [roles, selectedRoleId]);

  const showSecondAdminWarning = useMemo(() => {
    if (isEditing && employee?.roleName?.toLowerCase().includes('admin')) {
      return false; // Already this admin
    }
    return Boolean(isAssigningAdmin && selectedStatus === 'Active' && activeAdminCount >= 1);
  }, [isEditing, employee, isAssigningAdmin, selectedStatus, activeAdminCount]);

  useEffect(() => {
    if (open) {
      if (employee) {
        form.setFieldsValue({
          firstName: employee.firstName,
          lastName: employee.lastName,
          username: employee.username,
          roleId: employee.roleId,
          status: employee.status,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          status: 'Active',
          roleId: roles.length > 0 ? roles[0].roleId : undefined,
        });
      }
    }
  }, [open, employee, form, roles]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (isEditing && employee) {
        await updateMutation.mutateAsync({
          employeeId: employee.employeeId,
          payload: {
            firstName: values.firstName,
            lastName: values.lastName,
            roleId: values.roleId,
            status: values.status,
          },
        });
      } else {
        await createMutation.mutateAsync({
          firstName: values.firstName,
          lastName: values.lastName,
          username: values.username,
          password: values.password || '',
          roleId: values.roleId,
          status: values.status,
        });
      }

      form.resetFields();
      onClose();
    } catch {
      // Handled by validation and mutation hooks
    }
  };

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserOutlined />
          {isEditing ? `Edit Staff: ${employee?.fullName}` : 'Register New Employee Account'}
        </span>
      }
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={isEditing ? 'Save changes' : 'Add employee'}
      okButtonProps={{
        loading: isPending,
        style: { background: 'var(--color-primary)', borderColor: 'var(--color-primary)' },
      }}
      cancelButtonProps={{ disabled: isPending }}
      destroyOnClose
      width={600}
    >
      <div className={styles.modalContent}>
        {showSecondAdminWarning && (
          <Alert
            type="warning"
            showIcon
            icon={<CrownOutlined />}
            message="Only one active administrator"
            description="The system operational policy allows at most one Active Administrator. Designating another Active Administrator requires owner authorization."
            className={styles.adminNotice}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
          initialValues={{ status: 'Active' }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[{ required: true, message: 'First name is required.' }]}
              >
                <Input placeholder="e.g. Maria" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[{ required: true, message: 'Last name is required.' }]}
              >
                <Input placeholder="e.g. Santos" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label="Username"
                rules={[
                  { required: true, message: 'Username is required.' },
                  { min: 3, message: 'Username must be at least 3 characters.' },
                  { pattern: /^[a-zA-Z0-9_.-]+$/, message: 'Username can only contain letters, numbers, and .-_' },
                ]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: 'var(--color-muted)' }} />}
                  placeholder="e.g. msantos"
                  disabled={isEditing}
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              {!isEditing ? (
                <Form.Item
                  name="password"
                  label="Password (6-12 Characters)"
                  rules={[
                    { required: true, message: 'Enter a password.' },
                    { min: 6, max: 12, message: 'Passwords are 6 to 12 characters.' },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: 'var(--color-muted)' }} />}
                    placeholder="6-12 alphanumeric"
                    size="large"
                  />
                </Form.Item>
              ) : (
                <Form.Item label="Password Management">
                  <Input disabled placeholder="Use 'Reset Password' action" size="large" />
                </Form.Item>
              )}
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="roleId"
                label="Assigned Operational Role"
                rules={[{ required: true, message: 'Choose a role.' }]}
              >
                <Select
                  placeholder="Select role"
                  size="large"
                  options={roles.map((r) => ({
                    value: r.roleId,
                    label: `${r.roleName} - ${r.description}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="Employment Status"
                rules={[{ required: true, message: 'Choose a status.' }]}
              >
                <Select
                  options={EMPLOYEE_STATUS_OPTIONS}
                  size="large"
                  placeholder="Select status"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <div className={styles.policyNote}>
          {EMPLOYEE_POLICIES.ONE_ROLE} {EMPLOYEE_POLICIES.ACTIVE_STATUS}
        </div>
      </div>
    </Modal>
  );
};
