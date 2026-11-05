import React from 'react'
import { cn } from '../../lib/utils'

export type TableProps = React.TableHTMLAttributes<HTMLTableElement>

export const Table: React.FC<TableProps> = ({ className, ...props }) => (
  <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
    <table className={cn('w-full text-left text-sm text-slate-600', className)} {...props} />
  </div>
)

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  ...props
}) => (
  <thead
    className={cn('bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500 tracking-wider', className)}
    {...props}
  />
)

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  ...props
}) => <tbody className={cn('divide-y divide-slate-100', className)} {...props} />

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  className,
  ...props
}) => (
  <tr
    className={cn('hover:bg-slate-50/70 transition-colors', className)}
    {...props}
  />
)

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  className,
  ...props
}) => <th className={cn('px-5 py-3.5', className)} {...props} />

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  className,
  ...props
}) => <td className={cn('px-5 py-4 align-middle text-slate-800', className)} {...props} />
