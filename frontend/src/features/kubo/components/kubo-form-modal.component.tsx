import React, { useEffect } from 'react';
import { Modal, Form, Input, Select } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { useCreateKubo, useUpdateKubo } from '../hooks/use-kubo-mutations.hook';
import { useKuboTypes } from '@/features/kubo-type';
import { KUBO_STATUS_OPTIONS, KUBO_POLICIES } from '../constants/kubo.constants';
import type { Kubo, KuboStatus } from '../types/kubo.types';

export interface KuboFormModalProps {
  open: boolean;
  onClose: () => void;
  kubo?: Kubo | null;
}

interface FormValues {
  kuboNumber: string;
  kuboTypeId: string;
  status?: KuboStatus;
}

export const KuboFormModal: React.FC<KuboFormModalProps> = ({ open, onClose, kubo }) => {
  const [form] = Form.useForm<FormValues>();
  const isEditing = Boolean(kubo);

  const { data: kuboTypes = [] } = useKuboTypes();
  const createMutation = useCreateKubo();
  const updateMutation = useUpdateKubo();

  const isPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (open) {
      if (kubo) {
        form.setFieldsValue({
          kuboNumber: kubo.kuboNumber,
          kuboTypeId: kubo.kuboTypeId,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          status: 'Available',
          kuboTypeId: kuboTypes.length > 0 ? kuboTypes[0].kubo_type_id : undefined,
        });
      }
    }
  }, [open, kubo, form, kuboTypes]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (isEditing && kubo) {
        await updateMutation.mutateAsync({
          kuboId: kubo.kuboId,
          payload: {
            kuboNumber: values.kuboNumber,
            kuboTypeId: values.kuboTypeId,
          },
        });
      } else {
        await createMutation.mutateAsync({
          kuboNumber: values.kuboNumber,
          kuboTypeId: values.kuboTypeId,
          status: values.status,
        });
      }

      form.resetFields();
      onClose();
    } catch {
      // Handled
    }
  };

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HomeOutlined />
          {isEditing ? `Edit Cottage: ${kubo?.kuboNumber}` : 'Register New Kubo Unit'}
        </span>
      }
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={isEditing ? 'Save changes' : 'Add kubo'}
      okButtonProps={{
        loading: isPending,
        style: { background: 'var(--color-primary)', borderColor: 'var(--color-primary)' },
      }}
      cancelButtonProps={{ disabled: isPending }}
      destroyOnClose
      width={500}
    >
      <div style={{ padding: '8px 0' }}>
        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
          initialValues={{ status: 'Available' }}
        >
          <Form.Item
            name="kuboNumber"
            label="Cottage Identifier / Room Number"
            rules={[
              { required: true, message: 'Cottage identifier is required.' },
              { max: 20, message: 'Cannot exceed 20 characters.' },
            ]}
          >
            <Input placeholder="e.g. Kubo 01 or Villa A" size="large" />
          </Form.Item>

          <Form.Item
            name="kuboTypeId"
            label="Cottage Category & Base Rate"
            rules={[{ required: true, message: 'Choose a kubo type.' }]}
          >
            <Select
              placeholder="Select cottage category"
              size="large"
              options={kuboTypes.map((kt) => ({
                value: kt.kubo_type_id,
                label: `${kt.type_name} (Capacity: ${kt.capacity} | ₱${Number(kt.price_per_night).toLocaleString()}/night)`,
              }))}
            />
          </Form.Item>

          {!isEditing && (
            <Form.Item name="status" label="Initial Unit Status">
              <Select options={KUBO_STATUS_OPTIONS} size="large" />
            </Form.Item>
          )}
        </Form>

        <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: '12px 0 0' }}>
          {KUBO_POLICIES.UNIT_SPECIFICATION}
        </p>
      </div>
    </Modal>
  );
};
