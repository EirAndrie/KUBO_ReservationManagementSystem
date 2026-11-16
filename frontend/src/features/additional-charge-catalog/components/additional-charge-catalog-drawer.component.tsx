import React, { useEffect } from 'react';
import { Button, Drawer, Form, Input, InputNumber, Select, Switch } from 'antd';
import { label } from '@/lib/format';
import type { AdditionalChargeCatalogItem, ChargeType } from '../types/additional-charge-catalog.types';
import { CHARGE_TYPES } from '../types/additional-charge-catalog.types';
import {
  CATALOG_DESCRIPTION_MAX,
  CATALOG_DESCRIPTION_PATTERN,
  CATALOG_NAME_MAX,
  CATALOG_NAME_PATTERN,
  CATALOG_UNIT_PRICE_MAX,
  CATALOG_UNIT_PRICE_MIN,
  hasAtLeastTwoLetters,
} from '../constants/additional-charge-catalog.constants';

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

/** Item names are labels, not identifiers: letters are required, blanks pass the required rule. */
function validateCatalogName(value?: string) {
  const text = (value ?? '').trim();
  if (!text) return Promise.resolve();
  if (!CATALOG_NAME_PATTERN.test(text)) {
    return Promise.reject(new Error('Use letters, numbers, spaces, and common punctuation only.'));
  }
  if (!hasAtLeastTwoLetters(text)) {
    return Promise.reject(new Error('Item name must include at least two letters.'));
  }
  return Promise.resolve();
}

/** Descriptions are optional; a supplied description must be readable text, not numbers/symbols. */
function validateCatalogDescription(value?: string) {
  const text = (value ?? '').trim();
  if (!text) return Promise.resolve();
  if (!CATALOG_DESCRIPTION_PATTERN.test(text)) {
    return Promise.reject(new Error('Use letters, numbers, spaces, and standard punctuation only.'));
  }
  if (!hasAtLeastTwoLetters(text)) {
    return Promise.reject(new Error('Description must include at least two letters.'));
  }
  return Promise.resolve();
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
      unitPrice: item ? Number(item.unit_price) : undefined,
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
            { max: CATALOG_NAME_MAX, message: `Use ${CATALOG_NAME_MAX} characters or fewer.` },
            { validator: (_, value?: string) => validateCatalogName(value) },
          ]}
          extra="A readable label such as “Extra Bed” or “Airport Transfer”. Numeric-only names are rejected."
        >
          <Input maxLength={CATALOG_NAME_MAX} autoComplete="off" />
        </Form.Item>
        <Form.Item name="chargeType" label="Category" rules={[{ required: true, message: 'Choose a category.' }]}>
          <Select
            options={CHARGE_TYPES.map((chargeType) => ({ value: chargeType, label: label(chargeType) }))}
          />
        </Form.Item>
        <Form.Item
          name="description"
          label="Description"
          rules={[
            { max: CATALOG_DESCRIPTION_MAX, message: `Use ${CATALOG_DESCRIPTION_MAX} characters or fewer.` },
            { validator: (_, value?: string) => validateCatalogDescription(value) },
          ]}
          extra="Optional. Use a short, readable explanation; numeric-only descriptions are rejected."
        >
          <Input.TextArea rows={3} maxLength={CATALOG_DESCRIPTION_MAX} />
        </Form.Item>
        <Form.Item
          name="unitPrice"
          label="Default unit price"
          rules={[
            { required: true, message: 'Enter a unit price.' },
            { type: 'number', min: CATALOG_UNIT_PRICE_MIN, message: 'Price must be greater than zero.' },
            {
              type: 'number',
              max: CATALOG_UNIT_PRICE_MAX,
              message: 'Price cannot exceed ₱800,000.00.',
            },
          ]}
          extra="Must be greater than ₱0.00 and no more than ₱800,000.00. Prices above ₱10,000.00 need confirmation."
        >
          <InputNumber<number>
            style={{ width: '100%' }}
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
