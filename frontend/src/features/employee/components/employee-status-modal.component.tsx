import React, { useState } from 'react';
import { Modal, Select, Alert, message } from 'antd';
import { SafetyCertificateOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useUpdateEmployee } from '../hooks/use-employee-mutations.hook';
import { EMPLOYEE_STATUS_OPTIONS, EMPLOYEE_POLICIES } from '../constants/employee.constants';
import type { Employee, EmployeeStatus } from '../types/employee.types';

export interface EmployeeStatusModalProps {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
  activeAdminCount?: number;
}

export const EmployeeStatusModal: React.FC<EmployeeStatusModalProps> = ({
  open,
  onClose,
  employee,
  activeAdminCount = 1,
}) => {
  const [statusSelection, setStatusSelection] = useState<{
    employeeId: string;
    status: EmployeeStatus;
  } | null>(null);
  const selectedStatus =
    employee && statusSelection?.employeeId === employee.employeeId
      ? statusSelection.status
      : employee?.status ?? 'Active';
  const updateMutation = useUpdateEmployee();

  const isAdmin = employee?.roleName?.toLowerCase().includes('admin');
  const isDeactivatingLastAdmin = isAdmin && employee?.status === 'Active' && selectedStatus !== 'Active' && activeAdminCount <= 1;

  const handleConfirm = async () => {
    if (!employee) return;

    if (isDeactivatingLastAdmin) {
      message.error('The last active administrator cannot be disabled or demoted.');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        employeeId: employee.employeeId,
        payload: { status: selectedStatus },
      });
      onClose();
    } catch {
      // Handled by hook
    }
  };

  if (!employee) return null;

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SafetyCertificateOutlined />
          Change Employment Status
        </span>
      }
      open={open}
      onCancel={onClose}
      onOk={handleConfirm}
      okText="Confirm Status Change"
      okButtonProps={{
        loading: updateMutation.isPending,
        disabled: isDeactivatingLastAdmin,
        danger: selectedStatus === 'Terminated' || selectedStatus === 'Suspended',
      }}
      destroyOnClose
      width={480}
    >
      <div style={{ padding: '8px 0' }}>
        <p style={{ fontSize: '0.88rem', color: '#334155', marginBottom: 12 }}>
          Modify account status for <strong>{employee.fullName}</strong> ({employee.username}):
        </p>

        {isDeactivatingLastAdmin && (
          <Alert
            type="error"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message="This administrator cannot be deactivated"
            description="The system requires at least one Active Administrator at all times to maintain administrative governance and audit access."
            style={{ marginBottom: 16 }}
          />
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
            Select New Status
          </label>
          <Select
            value={selectedStatus}
            onChange={(val) => employee && setStatusSelection({ employeeId: employee.employeeId, status: val })}
            options={EMPLOYEE_STATUS_OPTIONS}
            style={{ width: '100%' }}
            size="large"
          />
        </div>

        <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
          {EMPLOYEE_POLICIES.ACTIVE_STATUS}
        </p>
      </div>
    </Modal>
  );
};
