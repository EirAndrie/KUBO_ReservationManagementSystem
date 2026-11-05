import React, { useState } from 'react';
import { Modal, Table, Button, Form, Input, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { TeamOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRoles } from '../hooks/use-employees.hook';
import { useCreateRole, useDeleteRole } from '../hooks/use-employee-mutations.hook';
import { EMPLOYEE_POLICIES } from '../constants/employee.constants';
import type { Role } from '../types/employee.types';

export interface RoleModalProps {
  open: boolean;
  onClose: () => void;
}

export const RoleModal: React.FC<RoleModalProps> = ({ open, onClose }) => {
  const { data: roles = [], isLoading } = useRoles();
  const createMutation = useCreateRole();
  const deleteMutation = useDeleteRole();

  const [isAddingRole, setIsAddingRole] = useState(false);
  const [form] = Form.useForm<{ roleName: string; description: string }>();

  const handleCreateRole = async () => {
    try {
      const values = await form.validateFields();
      await createMutation.mutateAsync(values);
      form.resetFields();
      setIsAddingRole(false);
    } catch {
      // Handled
    }
  };

  const columns: ColumnsType<Role> = [
    {
      title: 'Role Name',
      dataIndex: 'roleName',
      key: 'roleName',
      width: 160,
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Action',
      key: 'action',
      width: 90,
      align: 'right',
      render: (_, record) => {
        const isCore = ['administrator', 'staff'].includes(record.roleName.toLowerCase());
        if (isCore) return <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>System</span>;

        return (
          <Popconfirm
            title="Delete Role"
            description="Are you sure? Roles with assigned employees cannot be removed (BR-008)."
            onConfirm={() => deleteMutation.mutate(record.roleId)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        );
      },
    },
  ];

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TeamOutlined />
          Operational Role Management (BR-001, BR-008)
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
      destroyOnClose
      width={680}
    >
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Resort roles dictate permissions between Administrator and Staff (BR-005).
          </span>
          {!isAddingRole && (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setIsAddingRole(true)}
              style={{ background: '#0284c7', borderColor: '#0284c7' }}
            >
              Add Role
            </Button>
          )}
        </div>

        {isAddingRole && (
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '0.88rem', color: '#1e293b' }}>
              Define New Operational Role
            </h4>
            <Form form={form} layout="vertical">
              <Form.Item
                name="roleName"
                label="Role Title"
                rules={[
                  { required: true, message: 'Role title is required.' },
                  { max: 50, message: 'Max 50 characters.' },
                ]}
              >
                <Input placeholder="e.g. Housekeeping Lead" />
              </Form.Item>
              <Form.Item
                name="description"
                label="Role Description"
                rules={[
                  { required: true, message: 'Role description is required.' },
                  { max: 255, message: 'Max 255 characters.' },
                ]}
              >
                <Input.TextArea rows={2} placeholder="Explain duties and scope of responsibility" />
              </Form.Item>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button size="small" onClick={() => setIsAddingRole(false)}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  size="small"
                  onClick={handleCreateRole}
                  loading={createMutation.isPending}
                  style={{ background: '#0284c7', borderColor: '#0284c7' }}
                >
                  Save Role
                </Button>
              </div>
            </Form>
          </div>
        )}

        <Table<Role>
          dataSource={roles}
          columns={columns}
          rowKey="roleId"
          loading={isLoading}
          pagination={false}
          size="small"
        />

        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 16, marginBottom: 0 }}>
          {EMPLOYEE_POLICIES.ROLE_PROTECTION}
        </p>
      </div>
    </Modal>
  );
};
