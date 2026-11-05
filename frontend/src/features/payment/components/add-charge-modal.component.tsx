import { useCallback, useEffect } from 'react';
import {
  Modal,
  Form,
  InputNumber,
  Select,
  Input,
  Alert,
} from 'antd';
import {
  PlusCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useAddCharge } from '../hooks/use-payment-mutations.hook';
import {
  CHARGE_TYPE_OPTIONS,
  PAYMENT_POLICIES,
} from '../constants/payment.constants';
import type { AdditionalChargeType } from '../types/payment.types';
import styles from './add-charge-modal.module.css';

export interface AddChargeModalProps {
  open: boolean;
  onClose: () => void;
  reservationId: string;
  employeeId?: string;
}

interface ChargeFormValues {
  additionalChargeType: AdditionalChargeType;
  additionalChargeAmount: number;
  additionalChargeDescription: string;
}

/**
 * Modal form to post an incidental / additional charge to a reservation.
 *
 * Business rules enforced:
 * - Charge type must be a valid enum entry (BR-044).
 * - Amount must be non-negative with at most 2 decimal places (BR-048).
 * - Settled charges are append-only; no edits or deletions (BR-046).
 */
export function AddChargeModal({
  open,
  onClose,
  reservationId,
  employeeId,
}: AddChargeModalProps) {
  const [form] = Form.useForm<ChargeFormValues>();
  const addCharge = useAddCharge();

  // Reset form state when modal opens
  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();

      await addCharge.mutateAsync({
        reservationId,
        employeeId: employeeId || '',
        additionalChargeType: values.additionalChargeType,
        additionalChargeAmount: values.additionalChargeAmount,
        additionalChargeDescription: values.additionalChargeDescription,
      });

      form.resetFields();
      onClose();
    } catch {
      // Form validation or mutation error handled by useAppMutation
    }
  }, [form, addCharge, reservationId, employeeId, onClose]);

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlusCircleOutlined aria-hidden="true" />
          Add Extra Charge
        </span>
      }
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Post Charge"
      okButtonProps={{
        loading: addCharge.isPending,
        style: { background: '#d97706', borderColor: '#d97706' },
      }}
      cancelButtonProps={{ disabled: addCharge.isPending }}
      destroyOnClose
      width={520}
    >
      <div className={styles.modalContent}>
        <Alert
          className={styles.appendOnlyNotice}
          type="info"
          showIcon
          icon={<InfoCircleOutlined aria-hidden="true" />}
          message="Append-Only Financial Record (BR-046)"
          description="Once posted, charges cannot be edited or deleted. Corrections must be made via supplementary charges or administrative adjustments."
        />

        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
        >
          <Form.Item
            name="additionalChargeType"
            label="Charge Type"
            rules={[{ required: true, message: 'Select the type of incidental charge.' }]}
          >
            <Select
              options={CHARGE_TYPE_OPTIONS}
              placeholder="Select charge category"
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            name="additionalChargeAmount"
            label="Charge Amount (PHP)"
            rules={[
              { required: true, message: 'Enter the charge amount.' },
              {
                type: 'number',
                min: 0,
                message: 'Amount must be non-negative (BR-048).',
              },
              {
                validator: (_, value) => {
                  if (value !== undefined && value !== null && Number(Number(value).toFixed(2)) !== Number(value)) {
                    return Promise.reject(new Error('Amount cannot exceed 2 decimal places (BR-048).'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={0}
              step={0.01}
              precision={2}
              placeholder="0.00"
              prefix={<span style={{ color: '#94a3b8' }}>PHP</span>}
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="additionalChargeDescription"
            label="Description"
            rules={[{ required: true, message: 'Provide a description for the charge.' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Describe the charge (e.g., '2 extra mattresses for 3 nights', 'Broken window pane in Kubo 5')"
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>

        <p className={styles.policyNote}>
          {PAYMENT_POLICIES.APPEND_ONLY_CHARGES}
        </p>
      </div>
    </Modal>
  );
}
