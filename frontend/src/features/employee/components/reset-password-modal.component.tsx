import React from 'react';
import { Modal, Input, Form } from 'antd';
import { KeyOutlined, LockOutlined } from '@ant-design/icons';
import { useResetPassword } from '../hooks/use-employee-mutations.hook';
import { EMPLOYEE_POLICIES } from '../constants/employee.constants';
import type { Employee } from '../types/employee.types';

export interface ResetPasswordModalProps {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  open,
  onClose,
  employee,
}) => {
  const [form] = Form.useForm<{ password: string }>();
  const resetMutation = useResetPassword();

  const handleConfirm = async () => {
    if (!employee) return;
    try {
      const values = await form.validateFields();
      await resetMutation.mutateAsync({
        employeeId: employee.employeeId,
        password: values.password,
      });
      form.resetFields();
      onClose();
    } catch {
      // Handled by validation
    }
  };

  if (!employee) return null;

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <KeyOutlined />
          Reset Staff Password
        </span>
      }
      open={open}
      onCancel={onClose}
      onOk={handleConfirm}
      okText="Reset password"
      okButtonProps={{ loading: resetMutation.isPending }}
      destroyOnClose
      width={460}
    >
      <div style={{ padding: '8px 0' }}>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-text)', marginBottom: 16 }}>
          Set a new temporary password for <strong>{employee.fullName}</strong> ({employee.username}):
        </p>

        <Form form={form} layout="vertical">
          <Form.Item
            name="password"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter a new password.' },
              { min: 6, max: 12, message: 'Passwords are 6 to 12 characters.' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--color-muted)' }} />}
              placeholder="6-12 characters"
              size="large"
            />
          </Form.Item>
        </Form>

        <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: 0 }}>
          {EMPLOYEE_POLICIES.CREDENTIALS}
        </p>
      </div>
    </Modal>
  );
};
