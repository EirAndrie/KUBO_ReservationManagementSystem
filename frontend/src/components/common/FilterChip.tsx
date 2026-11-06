import { Dropdown } from 'antd';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import styles from './common.module.css';

export interface FilterChipProps<V extends string> {
  /** Field name, e.g. "Status". */
  name: string;
  value?: V;
  options: Array<{ value: V; label: string }>;
  onChange: (value: V | undefined) => void;
}

/**
 * Add-on filter: shows `+ Status` until a value is chosen, then `Status: X ×`.
 * Opening it lists the options; the × clears the filter.
 */
export function FilterChip<V extends string>({ name, value, options, onChange }: FilterChipProps<V>) {
  const current = options.find((o) => o.value === value);
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        selectable: true,
        selectedKeys: value ? [value] : [],
        items: options.map((o) => ({ key: o.value, label: o.label })),
        onClick: ({ key }) => onChange(key as V),
      }}
    >
      <button type="button" className={`${styles.chip} ${current ? styles.chipActive : ''}`}>
        {current ? (
          <>
            {name}: {current.label}
            <span
              role="button"
              tabIndex={0}
              aria-label={`Clear ${name} filter`}
              className={styles.chipClear}
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(undefined);
                }
              }}
            >
              <CloseOutlined />
            </span>
          </>
        ) : (
          <>
            <PlusOutlined style={{ fontSize: 10 }} /> {name}
          </>
        )}
      </button>
    </Dropdown>
  );
}
