import React, { useState } from 'react';
import { App, Button, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckOutlined, DeleteOutlined, EditOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import { EmptyState, ErrorState, ListSkeleton, PageHeader, RowMenu, Section, StatusBadge } from '@/components/common';
import { label } from '@/lib/format';
import { useAdditionalChargeCatalog } from '../hooks/use-additional-charge-catalog.hook';
import {
  useCreateCatalogItem,
  useDeleteCatalogItem,
  useUpdateCatalogItem,
} from '../hooks/use-additional-charge-catalog-mutations.hook';
import { AdditionalChargeCatalogDrawer, type CatalogDrawerValues } from '../components/additional-charge-catalog-drawer.component';
import type { AdditionalChargeCatalogItem } from '../types/additional-charge-catalog.types';
import styles from './additional-charge-catalog.module.css';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function usageCount(item: AdditionalChargeCatalogItem): number {
  return Number(item.usage_count) || 0;
}

/** Administrator catalog management with usage-aware actions and a context-preserving drawer. */
export const AdditionalChargeCatalogPage: React.FC = () => {
  const { modal } = App.useApp();
  const catalog = useAdditionalChargeCatalog();
  const createItem = useCreateCatalogItem();
  const updateItem = useUpdateCatalogItem();
  const deleteItem = useDeleteCatalogItem();
  const [drawerItem, setDrawerItem] = useState<AdditionalChargeCatalogItem | null | undefined>();

  const closeDrawer = () => setDrawerItem(undefined);

  const saveItem = async (values: CatalogDrawerValues) => {
    const name = values.name.trim();
    const description = values.description.trim();
    if (drawerItem) {
      await updateItem.mutateAsync({
        catalogId: drawerItem.catalog_id,
        payload: {
          chargeType: values.chargeType,
          name,
          description: description || null,
          unitPrice: values.unitPrice,
          isActive: values.isActive,
        },
      });
    } else {
      await createItem.mutateAsync({
        chargeType: values.chargeType,
        name,
        description: description || undefined,
        unitPrice: values.unitPrice,
        isActive: values.isActive,
      });
    }
    closeDrawer();
  };

  const toggleActive = (item: AdditionalChargeCatalogItem) => {
    const activating = !item.is_active;
    modal.confirm({
      title: `${activating ? 'Activate' : 'Deactivate'} “${item.name}”?`,
      content: activating
        ? 'Staff will be able to add this item to reservations again.'
        : 'Staff will no longer be able to add this item. Existing charges keep their recorded price.',
      okText: activating ? 'Activate item' : 'Deactivate item',
      okButtonProps: activating ? undefined : { danger: true },
      onOk: () => updateItem.mutateAsync({ catalogId: item.catalog_id, payload: { isActive: activating } }),
    });
  };

  const confirmDelete = (item: AdditionalChargeCatalogItem) => {
    modal.confirm({
      title: `Delete “${item.name}”?`,
      content: 'This item has not been used and will be removed from the catalog.',
      okText: 'Delete item',
      okButtonProps: { danger: true },
      onOk: () => deleteItem.mutateAsync(item.catalog_id),
    });
  };

  const columns: ColumnsType<AdditionalChargeCatalogItem> = [
    {
      title: 'Item name',
      dataIndex: 'name',
      render: (_, item) => <span className={styles.itemName}>{item.name}</span>,
    },
    {
      title: 'Category / description',
      render: (_, item) => (
        <div className={styles.categoryCell}>
          <span className={styles.category}>{label(item.charge_type)}</span>
          {item.description && <span className={styles.description}>{item.description}</span>}
        </div>
      ),
    },
    {
      title: 'Unit price',
      dataIndex: 'unit_price',
      align: 'right',
      width: 150,
      render: (value: string) => <span className="tabular">{peso.format(Number(value))}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      width: 130,
      render: (_, item) => <StatusBadge status={item.is_active ? 'Active' : 'Inactive'} />,
    },
    {
      key: 'actions',
      width: 48,
      align: 'center',
      render: (_, item) => (
        <RowMenu
          label={`Actions for ${item.name}`}
          items={[
            {
              key: 'edit',
              label: 'Edit item',
              icon: <EditOutlined />,
              onClick: () => setDrawerItem(item),
            },
            {
              key: 'toggle-active',
              label: item.is_active ? 'Deactivate item' : 'Activate item',
              icon: item.is_active ? <StopOutlined /> : <CheckOutlined />,
              onClick: () => toggleActive(item),
            },
            { key: 'delete-divider', divider: true },
            {
              key: 'delete',
              label: 'Delete item',
              icon: <DeleteOutlined />,
              danger: true,
              disabled: usageCount(item) > 0,
              reason: 'This item has been used. Deactivate it instead.',
              onClick: () => confirmDelete(item),
            },
          ]}
        />
      ),
    },
  ];

  const saving = createItem.isPending || updateItem.isPending;

  return (
    <div>
      <PageHeader
        title="Additional charge catalog"
        description="Manage the standard charges Staff can add to a reservation. Used items stay in the catalog and can be deactivated."
        action={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerItem(null)}>
            Add item
          </Button>
        }
      />
      <Section flush>
        {catalog.isLoading ? (
          <ListSkeleton rows={6} />
        ) : catalog.isError ? (
          <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />
        ) : (catalog.data ?? []).length === 0 ? (
          <EmptyState
            title="No catalog items yet"
            description="Add a standard charge so Staff can select it when recording reservation charges."
          />
        ) : (
          <Table<AdditionalChargeCatalogItem>
            className={styles.table}
            rowKey="catalog_id"
            columns={columns}
            dataSource={catalog.data}
            pagination={false}
            size="middle"
            onRow={(item) => ({ onClick: () => setDrawerItem(item), className: 'clickable-row' })}
          />
        )}
      </Section>
      <AdditionalChargeCatalogDrawer
        open={drawerItem !== undefined}
        item={drawerItem}
        saving={saving}
        onClose={closeDrawer}
        onSubmit={saveItem}
      />
    </div>
  );
};
