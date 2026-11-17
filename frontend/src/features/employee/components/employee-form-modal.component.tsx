import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Row, Col } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { formatRoleLabel } from '@/features/auth';
import { useCreateEmployee, useUpdateEmployee } from '../hooks/use-employee-mutations.hook';
import { useRoles } from '../hooks/use-employees.hook';
import { EMPLOYEE_STATUS_OPTIONS, EMPLOYEE_POLICIES, EMPLOYEE_NAME_REGEX, EMPLOYEE_LIMITS } from '../constants/employee.constants';
import type { Employee, EmployeeStatus } from '../types/employee.types';
import styles from './employee-form-modal.module.css';

export interface EmployeeFormModalProps {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
}

interface FormValues {
  firstName: string;
  lastName: string;
  username: string;
  password?: string;
  roleId: string;
  status: EmployeeStatus;
}

/**
 * Shared First/Last Name validator for employee registration and edits.
 * Rejects whitespace-only entries, digits, and unsupported symbols.
 */
function validateEmployeeName(label: string) {
  return (_: unknown, value?: string) => {
    if (value == null || value === '') return Promise.resolve();
    const text = value.trim();
    if (!text) {
      return Promise.reject(new Error(`${label} cannot consist of whitespace only.`));
    }
    return EMPLOYEE_NAME_REGEX.test(text)
      ? Promise.resolve()
      : Promise.reject(
          new Error(`${label} may contain only letters, spaces, hyphens, apostrophes, and periods.`),
        );
  };
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  open,
  onClose,
  employee,
}) => {
  const [form] = Form.useForm<FormValues>();
  const isEditing = Boolean(employee);

  const { data: roles = [] } = useRoles();
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();

  const isPending = createMutation.isPending || updateMutation.isPending;


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
                rules={[
                  { required: true, message: 'First name is required.' },
                  { max: EMPLOYEE_LIMITS.MAX_FIRST_NAME, message: `Cannot exceed ${EMPLOYEE_LIMITS.MAX_FIRST_NAME} characters.` },
                  { validator: validateEmployeeName('First name') },
                ]}
              >
                <Input placeholder="e.g. Maria" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[
                  { required: true, message: 'Last name is required.' },
                  { max: EMPLOYEE_LIMITS.MAX_LAST_NAME, message: `Cannot exceed ${EMPLOYEE_LIMITS.MAX_LAST_NAME} characters.` },
                  { validator: validateEmployeeName('Last name') },
                ]}
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
                    label: `${formatRoleLabel(r.roleName)} - ${r.description}`,
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
