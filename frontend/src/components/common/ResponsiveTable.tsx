import React, { useLayoutEffect, useRef, useState } from 'react';
import { Button, Table } from 'antd';
import type { TableProps } from 'antd';
import styles from './common.module.css';
import { useIsPhone } from './useIsPhone';

type AnyColumn = {
  key?: React.Key;
  title?: unknown;
  dataIndex?: string | number | readonly (string | number)[];
  render?: (value: unknown, record: never, index: number) => React.ReactNode;
  align?: string;
  children?: unknown;
};

const ACTION_KEYS = new Set(['action', 'actions']);

function valueAt(record: unknown, dataIndex: AnyColumn['dataIndex']): unknown {
  if (dataIndex === undefined) return undefined;
  const path = Array.isArray(dataIndex) ? dataIndex : [dataIndex];
  return path.reduce<unknown>((acc, k) => (acc == null ? acc : (acc as Record<string | number, unknown>)[k]), record);
}

/**
 * antd `Table` when it fits; otherwise the same columns render as a stack of
 * cards so nobody has to scroll sideways.
 *
 * Cards are used on phones, and on any screen where the table needs more width
 * than its container has (for example a wide table beside the sidebar on a
 * small laptop). The width the table needed is remembered, so it switches back
 * once the container is wide enough again.
 *
 * Card layout, derived from the column definitions (no per-page markup):
 * - the first column is the card heading;
 * - a column keyed `action`/`actions` sits at the top right;
 * - every other column becomes a "label / value" cell in a two-column grid.
 *
 * Supports the table props the app uses: `columns`, `dataSource`, `rowKey`,
 * `onRow` click, `rowClassName` (`clickable-row` makes the card tappable),
 * `loading`, `locale.emptyText` and a `pagination.pageSize` (shown as "Show more").
 * Row selection is table-only.
 */
export function ResponsiveTable<T extends object>(props: TableProps<T>): React.ReactElement {
  const isPhone = useIsPhone();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [neededWidth, setNeededWidth] = useState<number | null>(null);
  const useCards = isPhone || (neededWidth !== null && containerWidth !== null && containerWidth < neededWidth);

  // Track the container width and, while the table is shown, the width it
  // needs. The table is observed too because antd can widen it after mount.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      setContainerWidth(el.clientWidth);
      const table = el.querySelector('table');
      if (!table) return;
      const needed = Math.ceil(table.getBoundingClientRect().width);
      if (needed > el.clientWidth + 1) setNeededWidth(needed);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const table = el.querySelector('table');
    if (table) ro.observe(table);
    return () => ro.disconnect();
  }, [useCards, props.dataSource, props.columns]);

  return (
    <div ref={wrapRef} className={styles.responsiveTable}>
      {useCards ? <CardList<T> {...props} /> : <Table<T> {...props} />}
    </div>
  );
}

function CardList<T extends object>({
  columns = [],
  dataSource = [],
  rowKey,
  onRow,
  rowClassName,
  loading,
  locale,
  pagination,
}: TableProps<T>): React.ReactElement {
  const pageSize = pagination && typeof pagination === 'object' ? pagination.pageSize : undefined;
  const [shown, setShown] = useState(pageSize ?? Infinity);

  const cols = (columns as AnyColumn[]).filter((c) => !c.children);
  const actionCol = cols.find((c) => c.key !== undefined && ACTION_KEYS.has(String(c.key)));
  const dataCols = cols.filter((c) => c !== actionCol);
  const [headCol, ...bodyCols] = dataCols;

  const keyOf = (record: T, index: number): React.Key => {
    if (typeof rowKey === 'function') return rowKey(record, index);
    if (rowKey) return String(record[rowKey as keyof T]);
    return index;
  };

  const cell = (col: AnyColumn, record: T, index: number): React.ReactNode => {
    const value = valueAt(record, col.dataIndex);
    const out = col.render ? col.render(value as never, record as never, index) : value;
    return (out as React.ReactNode) ?? <span className="muted">—</span>;
  };

  if (dataSource.length === 0) {
    const empty = locale?.emptyText;
    return <div className={styles.cardListEmpty}>{(typeof empty === 'function' ? empty() : empty) ?? 'No records.'}</div>;
  }

  const visible = dataSource.slice(0, shown);

  return (
    <div className={styles.cardList} aria-busy={Boolean(loading)} data-loading={loading ? 'true' : undefined}>
      {visible.map((record, index) => {
        const rowProps = onRow?.(record, index) ?? {};
        const extra = typeof rowClassName === 'function' ? rowClassName(record, index, 0) : rowClassName;
        const tappable = Boolean(rowProps.onClick) && String(extra ?? '').includes('clickable-row');
        return (
          <div
            key={keyOf(record, index)}
            className={`${styles.dataCard} ${tappable ? styles.dataCardTappable : ''}`}
            onClick={tappable ? rowProps.onClick : undefined}
            onKeyDown={
              tappable
                ? (e) => {
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      rowProps.onClick?.(e as unknown as React.MouseEvent<HTMLElement>);
                    }
                  }
                : undefined
            }
            role={tappable ? 'button' : undefined}
            tabIndex={tappable ? 0 : undefined}
          >
            <div className={styles.dataCardHead}>
              <div className={styles.dataCardTitle}>{headCol ? cell(headCol, record, index) : null}</div>
              {actionCol && (
                <div className={styles.dataCardAction} onClick={(e) => e.stopPropagation()}>
                  {cell(actionCol, record, index)}
                </div>
              )}
            </div>
            {bodyCols.length > 0 && (
              <dl className={styles.dataCardGrid}>
                {bodyCols.map((col, i) => (
                  <div key={col.key ?? i} className={styles.dataCardField}>
                    {typeof col.title === 'string' && col.title && <dt>{col.title}</dt>}
                    <dd>{cell(col, record, index)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        );
      })}
      {visible.length < dataSource.length && (
        <div className={styles.cardListMore}>
          <Button onClick={() => setShown((n) => n + (pageSize ?? 20))}>
            Show more ({dataSource.length - visible.length} left)
          </Button>
        </div>
      )}
    </div>
  );
}
