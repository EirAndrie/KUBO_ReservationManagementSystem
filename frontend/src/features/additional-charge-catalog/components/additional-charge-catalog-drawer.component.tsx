import React, { useEffect } from 'react';
import { Button, Drawer, Form, Input, InputNumber, Select, Switch } from 'antd';
import { label } from '@/lib/format';
import type { AdditionalChargeCatalogItem, ChargeType } from '../types/additional-charge-catalog.types';
import { CHARGE_TYPES } from '../types/additional-charge-catalog.types';

export interface CatalogDrawerValues {
  chargeType: ChargeType;
  name: string;
  description: string;
  unitPrice: number;
  isActive: boolean;
}

interface AdditionalChargeCatalogDrawerProps {
  open: boolean;
  item?: AdditionalChargeCatalogItem | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (values: CatalogDrawerValues) => Promise<void> | void;
}

/** Right-side form for adding or editing a catalog item while keeping the table in view. */
export const AdditionalChargeCatalogDrawer: React.FC<AdditionalChargeCatalogDrawerProps> = ({
  open,
  item,
  saving,
  onClose,
  onSubmit,
}) => {
  const [form] = Form.useForm<CatalogDrawerValues>();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      chargeType: item?.charge_type ?? 'Other',
      name: item?.name ?? '',
      description: item?.description ?? '',
      unitPrice: Number(item?.unit_price ?? 0),
      isActive: item?.is_active ?? true,
    });
  }, [form, item, open]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={440}
      destroyOnHidden
      title={
        <div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
            Additional charge catalog
          </div>
          <div>{item ? 'Edit item' : 'Add item'}</div>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={() => form.submit()}>
            {item ? 'Save changes' : 'Add item'}
          </Button>
        </div>
      }
    >
      <Form<CatalogDrawerValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={onSubmit}
        initialValues={{ chargeType: 'Other', isActive: true }}
      >
        <Form.Item
          name="name"
          label="Item name"
          rules={[
            { required: true, whitespace: true, message: 'Enter an item name.' },
            { max: 100, message: 'Use 100 characters or fewer.' },
          ]}
        >
          <Input maxLength={100} autoComplete="off" />
        </Form.Item>
        <Form.Item name="chargeType" label="Category" rules={[{ required: true, message: 'Choose a category.' }]}>
          <Select
            options={CHARGE_TYPES.map((chargeType) => ({ value: chargeType, label: label(chargeType) }))}
          />
        </Form.Item>
        <Form.Item
          name="description"
          label="Description"
          rules={[{ max: 255, message: 'Use 255 characters or fewer.' }]}
        >
          <Input.TextArea rows={3} maxLength={255} />
        </Form.Item>
        <Form.Item
          name="unitPrice"
          label="Default unit price"
          rules={[{ required: true, message: 'Enter a unit price.' }]}
        >
          <InputNumber<number>
            style={{ width: '100%' }}
            min={0}
            precision={2}
            prefix="₱"
            decimalSeparator="."
          />
        </Form.Item>
        <Form.Item name="isActive" label="Available to Staff" valuePropName="checked">
          <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
        </Form.Item>
      </Form>
    </Drawer>
  );
};
