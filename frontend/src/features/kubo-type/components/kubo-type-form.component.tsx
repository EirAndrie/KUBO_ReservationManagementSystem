import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Alert, Button } from 'antd';
import {
  InfoCircleOutlined,
  DollarOutlined,
  TeamOutlined,
  AppstoreAddOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { KuboType, CreateKuboTypeDTO } from '../types/kubo-type.types';
import { KUBO_TYPE_LIMITS, KUBO_TYPE_POLICIES } from '../constants/kubo-type.constants';
import styles from './kubo-type-form.module.css';

const { TextArea } = Input;

export interface KuboTypeFormProps {
  /** Controls modal visibility */
  open: boolean;
  /** Existing KuboType when in edit mode; null or undefined for creation */
  initialData?: KuboType | null;
  /** Submission state indicating an asynchronous mutation is running */
  isLoading?: boolean;
  /** Dismissal callback */
  onCancel: () => void;
  /** Form submission callback providing validated DTO */
  onSubmit: (values: CreateKuboTypeDTO) => Promise<void> | void;
}

interface FormValues {
  kuboTypeName: string;
  kuboTypeCapacity: number;
  pricePerNight: number;
  kuboTypeDescription?: string;
}

/**
 * Modal form for creating or updating a Kubo Type definition and its nightly rate.
 *
 * Implements:
 * - BR-016: Capacity > 0 and standard rates >= 0.
 * - BR-020: Clear notice regarding rate adjustments applying only to future reservations.
 * - BR-048: Standard monetary precision (max 2 decimal places).
 * - Zero emoji policy: Icons exclusively sourced from @ant-design/icons.
 * - Strict inline field validation with informative error messages.
 */
export const KuboTypeForm: React.FC<KuboTypeFormProps> = ({
  open,
  initialData,
  isLoading = false,
  onCancel,
  onSubmit,
}) => {
  const [form] = Form.useForm<FormValues>();
  const isEditing = Boolean(initialData);

  useEffect(() => {
    if (open) {
      if (initialData) {
        form.setFieldsValue({
          kuboTypeName: initialData.type_name,
          kuboTypeCapacity: initialData.capacity,
          pricePerNight: Number(initialData.price_per_night),
          kuboTypeDescription: initialData.description ?? '',
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, initialData, form]);

  const handleFinish = async (values: FormValues) => {
    const payload: CreateKuboTypeDTO = {
      kuboTypeName: values.kuboTypeName.trim(),
      kuboTypeCapacity: values.kuboTypeCapacity,
      pricePerNight: Number(values.pricePerNight),
      kuboTypeDescription: values.kuboTypeDescription?.trim() || undefined,
    };
    await onSubmit(payload);
  };

  return (
    <Modal
      open={open}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
          {isEditing ? (
            <EditOutlined style={{ color: '#3d97bd' }} aria-hidden="true" />
          ) : (
            <AppstoreAddOutlined style={{ color: '#3d97bd' }} aria-hidden="true" />
          )}
          <span>{isEditing ? `Edit Kubo Type: ${initialData?.type_name}` : 'Create New Kubo Type'}</span>
        </div>
      }
      onCancel={onCancel}
      footer={null}
      destroyOnClose
      className={styles.formModal}
      maskClosable={!isLoading}
    >
      <div style={{ marginTop: 16 }}>
        {isEditing && (
          <Alert
            className={styles.noticeAlert}
            message="Nightly Rate Policy (BR-020)"
            description={KUBO_TYPE_POLICIES.RATE_CHANGE_NOTICE}
            type="info"
            showIcon
            icon={<InfoCircleOutlined aria-hidden="true" />}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          requiredMark="optional"
          initialValues={{
            kuboTypeCapacity: 2,
            pricePerNight: 1500,
          }}
        >
          <Form.Item
            name="kuboTypeName"
            label="Kubo Category Name"
            rules={[
              { required: true, message: 'Please enter a unique kubo category name.' },
              { max: KUBO_TYPE_LIMITS.MAX_NAME_LENGTH, message: `Name cannot exceed ${KUBO_TYPE_LIMITS.MAX_NAME_LENGTH} characters.` },
              {
                validator: (_, value) => {
                  if (value && typeof value === 'string' && !value.trim()) {
                    return Promise.reject(new Error('Category name cannot consist of whitespace only.'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input
              placeholder="e.g., Deluxe Villa, Family Cottage, Ocean View"
              maxLength={KUBO_TYPE_LIMITS.MAX_NAME_LENGTH}
              showCount
              disabled={isLoading}
              autoFocus
            />
          </Form.Item>

          <div className={styles.formGrid}>
            <Form.Item
              name="kuboTypeCapacity"
              label="Max Guest Capacity"
              rules={[
                { required: true, message: 'Please specify the maximum guest capacity.' },
                {
                  type: 'number',
                  min: KUBO_TYPE_LIMITS.MIN_CAPACITY,
                  message: `Capacity must be at least ${KUBO_TYPE_LIMITS.MIN_CAPACITY} guest (BR-016).`,
                },
                {
                  type: 'number',
                  max: KUBO_TYPE_LIMITS.MAX_CAPACITY,
                  message: `Capacity cannot exceed ${KUBO_TYPE_LIMITS.MAX_CAPACITY} guests.`,
                },
                {
                  validator: (_, value) => {
                    if (value !== undefined && value !== null && !Number.isInteger(value)) {
                      return Promise.reject(new Error('Capacity must be a whole number.'));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
              extra={<span className={styles.helperText}>Maximum standard sleeping capacity.</span>}
            >
              <InputNumber
                className={styles.numberInput}
                prefix={<TeamOutlined style={{ color: '#9ca3af' }} aria-hidden="true" />}
                min={KUBO_TYPE_LIMITS.MIN_CAPACITY}
                max={KUBO_TYPE_LIMITS.MAX_CAPACITY}
                precision={0}
                placeholder="2"
                disabled={isLoading}
              />
            </Form.Item>

            <Form.Item
              name="pricePerNight"
              label="Standard Rate (PHP / Night)"
              rules={[
                { required: true, message: 'Please enter a standard nightly rate.' },
                {
                  type: 'number',
                  min: KUBO_TYPE_LIMITS.MIN_PRICE,
                  message: 'Price per night cannot be negative (BR-016).',
                },
                {
                  type: 'number',
                  max: KUBO_TYPE_LIMITS.MAX_PRICE,
                  message: `Price cannot exceed ${KUBO_TYPE_LIMITS.MAX_PRICE.toLocaleString()}.`,
                },
                {
                  validator: (_, value) => {
                    if (value === undefined || value === null) {
                      return Promise.resolve();
                    }
                    const stringVal = value.toString();
                    const decimalPart = stringVal.split('.')[1];
                    if (decimalPart && decimalPart.length > 2) {
                      return Promise.reject(new Error('Rate cannot exceed 2 decimal places (BR-048).'));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
              extra={<span className={styles.helperText}>Base rate used for new reservations.</span>}
            >
              <InputNumber<number>
                className={styles.currencyInput}
                prefix={<DollarOutlined style={{ color: '#9ca3af' }} aria-hidden="true" />}
                min={0}
                step={50}
                precision={2}
                formatter={(val) => (val ? `₱ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '₱ ')}
                parser={(val) => (val ? Number(val.replace(/₱\s?|(,*)/g, '')) : 0)}
                placeholder="1,500.00"
                disabled={isLoading}
              />
            </Form.Item>
          </div>

          <Form.Item
            name="kuboTypeDescription"
            label="Description & Amenities"
            rules={[
              {
                max: KUBO_TYPE_LIMITS.MAX_DESCRIPTION_LENGTH,
                message: `Description cannot exceed ${KUBO_TYPE_LIMITS.MAX_DESCRIPTION_LENGTH} characters.`,
              },
            ]}
          >
            <TextArea
              rows={3}
              placeholder="Describe distinguishing features, bed configuration, scenic views, or included amenities..."
              maxLength={KUBO_TYPE_LIMITS.MAX_DESCRIPTION_LENGTH}
              showCount
              disabled={isLoading}
            />
          </Form.Item>

          <div className={styles.modalFooter}>
            <Button onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={isLoading}>
              {isEditing ? 'Save Changes' : 'Create Kubo Type'}
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
};
