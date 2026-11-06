import { useEffect, useMemo, useState } from 'react';
import { Modal, Form, InputNumber, Select, Input, Segmented } from 'antd';
import { useChargeCatalog } from '../hooks/use-payments.hook';
import { useApplyCatalogCharge, useCreateChargeRequest } from '../hooks/use-payment-mutations.hook';
import { formatMoney } from '@/lib/format';
import { Callout } from '@/components/common';

export interface AddChargeModalProps {
  open: boolean;
  onClose: () => void;
  reservationId: string;
}

type Mode = 'catalog' | 'custom';

interface ChargeFormValues {
  catalogId?: string;
  quantity: number;
  description?: string;
  proposedUnitAmount?: number;
}

/**
 * Adds a charge to a reservation in one of two ways:
 * - From the price list: applies an active catalog item right away.
 * - Custom: sends a request that an Administrator approves before it is billed.
 *   Pending requests do not change the balance.
 */
export function AddChargeModal({ open, onClose, reservationId }: AddChargeModalProps) {
  const [form] = Form.useForm<ChargeFormValues>();
  const [mode, setMode] = useState<Mode>('catalog');
  const catalog = useChargeCatalog(open);
  const apply = useApplyCatalogCharge();
  const request = useCreateChargeRequest();
  const pending = apply.isPending || request.isPending;

  const active = useMemo(() => (catalog.data ?? []).filter((c) => c.is_active), [catalog.data]);
  const catalogId = Form.useWatch('catalogId', form);
  const quantity = Form.useWatch('quantity', form) ?? 1;
  const selected = active.find((c) => c.catalog_id === catalogId);

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({ quantity: 1 });
    }
  }, [open, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (mode === 'catalog') {
        await apply.mutateAsync({ reservationId, catalogId: values.catalogId!, quantity: values.quantity });
      } else {
        await request.mutateAsync({
          reservationId,
          description: values.description!.trim(),
          quantity: values.quantity,
          proposedUnitAmount: values.proposedUnitAmount!,
        });
      }
      onClose();
    } catch {
      // Server message shown by the mutation toast.
    }
  };

  return (
    <Modal
      title="Add charge"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={mode === 'catalog' ? 'Add charge' : 'Send for approval'}
      okButtonProps={{ loading: pending }}
      cancelButtonProps={{ disabled: pending }}
      afterOpenChange={(visible) => !visible && setMode('catalog')}
      destroyOnHidden
      width={480}
    >
      <Segmented<Mode>
        block
        value={mode}
        onChange={(v) => {
          setMode(v);
          form.setFieldsValue({ quantity: 1 });
        }}
        options={[
          { label: 'From price list', value: 'catalog' },
          { label: 'Custom charge', value: 'custom' },
        ]}
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical" requiredMark={false}>
        {mode === 'catalog' ? (
          <>
            <Form.Item name="catalogId" label="Item" rules={[{ required: true, message: 'Choose an item.' }]}>
              <Select
                loading={catalog.isLoading}
                showSearch
                optionFilterProp="label"
                placeholder="Choose from the price list"
                options={active.map((c) => ({ value: c.catalog_id, label: `${c.name} · ${formatMoney(c.unit_price)}` }))}
              />
            </Form.Item>
            <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
              <InputNumber<number> min={1} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            {selected && (
              <Callout>
                Total {formatMoney(selected.unit_price * quantity)}. It is billed right away.
              </Callout>
            )}
          </>
        ) : (
          <>
            <Form.Item
              name="description"
              label="Description"
              rules={[{ required: true, whitespace: true, message: 'Describe the charge.' }]}
            >
              <Input maxLength={255} placeholder="e.g. Bonfire setup" />
            </Form.Item>
            <div style={{ display: 'flex', gap: 12 }}>
              <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]} style={{ flex: 1 }}>
                <InputNumber<number> min={1} precision={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="proposedUnitAmount"
                label="Unit price"
                rules={[{ required: true, message: 'Enter a price.' }]}
                style={{ flex: 1 }}
              >
                <InputNumber<number> min={0} step={0.01} precision={2} prefix="₱" style={{ width: '100%' }} />
              </Form.Item>
            </div>
            <Callout tone="warn">
              Custom charges need an administrator's approval. They are not billed until approved.
            </Callout>
          </>
        )}
      </Form>
    </Modal>
  );
}
