import { createContext, useContext, useEffect } from 'react';

/** Lets a detail page name the last breadcrumb (e.g. a reference code or guest name). */
export const BreadcrumbContext = createContext<(label: string | null) => void>(() => {});

export function useBreadcrumbLabel(label: string | null | undefined): void {
  const set = useContext(BreadcrumbContext);
  useEffect(() => {
    set(label ?? null);
    return () => set(null);
  }, [label, set]);
}
