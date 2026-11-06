import React, { useEffect, useState } from 'react';
import { Button, Drawer, Form, Input, InputNumber } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Callout } from '@/components/common';
import { formatMoneyWhole, pluralize, toAmount } from '@/lib/format';
import { KUBO_TYPE_LIMITS } from '../constants/kubo-type.constants';
import type { CreateKuboTypeDTO, KuboType } from '../types/kubo-type.types';

export interface KuboTypeDrawerProps {
  open: boolean;
  /** The type being edited; null/undefined creates a new one. */
  kuboType?: KuboType | null;
  /** Active bookings that use this type (they keep their booked rate). */
  bookingsOnType?: number;
  isLoading?: boolean;
  /** Server error to show inline (e.g. a case-insensitive duplicate name). */
  serverError?: string | null;
  onClose: () => void;
  onSubmit: (values: CreateKuboTypeDTO) => Promise<void> | void;
}

interface FormValues {
  kuboTypeName: string;
  kuboTypeDescription?: string;
  kuboTypeCapacity: number;
  pricePerNight: number;
}

/**
 * Create or edit a kubo type in a right-side drawer. The rate field shows a
 * live impact note: the percentage change and that it applies to new
 * reservations only (existing bookings keep their rate, BR-020).
 */
export const KuboTypeDrawer: React.FC<KuboTypeDrawerProps> = ({
  open,
  kuboType,
  bookingsOnType = 0,
  isLoading,
  serverError,
  onClose,
  onSubmit,
}) => {
  const [form] = Form.useForm<FormValues>();
  const [rate, setRate] = useState<number | null>(null);
  const oldRate = kuboType ? toAmount(kuboType.price_per_night) : null;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (kuboType) {
      form.setFieldsValue({
        kuboTypeName: kuboType.type_name,
        kuboTypeDescription: kuboType.description ?? '',
        kuboTypeCapacity: kuboType.capacity,
        pricePerNight: toAmount(kuboType.price_per_night),
      });
    }
  }, [open, kuboType, form]);

  const current = rate ?? oldRate;
  const changed = oldRate !== null && current !== null && current !== oldRate;
  const pct = changed && oldRate ? ((current! - oldRate) / oldRate) * 100 : 0;

  const submit = async () => {
    const v = await form.validateFields();
    await onSubmit({
      kuboTypeName: v.kuboTypeName.trim(),
      kuboTypeCapacity: v.kuboTypeCapacity,
      pricePerNight: v.pricePerNight,
      kuboTypeDescription: v.kuboTypeDescription?.trim() || undefined,
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={420}
      destroyOnHidden
      afterOpenChange={(visible) => !visible && setRate(null)}
      title={
        <div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
            {kuboType ? 'Edit kubo type' : 'New kubo type'}
          </div>
          <div>{kuboType?.type_name ?? 'Kubo type'}</div>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="primary" loading={isLoading} onClick={submit}>
            {kuboType ? 'Save changes' : 'Create type'}
          </Button>
        </div>
      }
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="kuboTypeName"
          label="Name"
          rules={[
            { required: true, whitespace: true, message: 'Enter a name.' },
            { max: KUBO_TYPE_LIMITS.MAX_NAME_LENGTH },
          ]}
          validateStatus={serverError ? 'error' : undefined}
          help={serverError ?? undefined}
        >
          <Input maxLength={KUBO_TYPE_LIMITS.MAX_NAME_LENGTH} />
        </Form.Item>
        <Form.Item name="kuboTypeDescription" label="Description" rules={[{ max: KUBO_TYPE_LIMITS.MAX_DESCRIPTION_LENGTH }]}>
          <Input.TextArea rows={3} maxLength={KUBO_TYPE_LIMITS.MAX_DESCRIPTION_LENGTH} />
        </Form.Item>
        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item
            name="kuboTypeCapacity"
            label="Max guests"
            style={{ flex: 1 }}
            rules={[{ required: true, message: 'Enter a capacity.' }]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={KUBO_TYPE_LIMITS.MIN_CAPACITY}
              max={KUBO_TYPE_LIMITS.MAX_CAPACITY}
              precision={0}
            />
          </Form.Item>
          <Form.Item
            name="pricePerNight"
            label="Nightly rate"
            style={{ flex: 1 }}
            rules={[{ required: true, message: 'Enter a rate.' }]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              prefix="₱"
              min={KUBO_TYPE_LIMITS.MIN_PRICE}
              max={KUBO_TYPE_LIMITS.MAX_PRICE}
              precision={2}
              onChange={(v) => setRate(v ?? null)}
            />
          </Form.Item>
        </div>
      </Form>

      {kuboType ? (
        <Callout icon={<InfoCircleOutlined />}>
          {changed ? (
            <>
              Rate goes from <strong>{formatMoneyWhole(oldRate)}</strong> to <strong>{formatMoneyWhole(current)}</strong> (
              {pct > 0 ? '+' : ''}
              {pct.toFixed(1)}%). It applies to <strong>new reservations only</strong>.{' '}
              {bookingsOnType > 0 && `${pluralize(bookingsOnType, 'existing booking')} keep${bookingsOnType === 1 ? 's' : ''} ${formatMoneyWhole(oldRate)}.`}
            </>
          ) : (
            'Rate changes apply to new reservations only. Existing bookings keep their rate.'
          )}
        </Callout>
      ) : (
        <Callout icon={<InfoCircleOutlined />}>Names must be unique (case doesn't matter).</Callout>
      )}
    </Drawer>
  );
};
