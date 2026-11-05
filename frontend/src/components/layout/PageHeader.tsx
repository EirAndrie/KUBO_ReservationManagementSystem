import React from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  action,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 24,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#0f172a',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              fontSize: '0.875rem',
              color: '#64748b',
              margin: '4px 0 0 0',
            }}
          >
            {description}
          </p>
        )}
      </div>
      {action && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {action}
        </div>
      )}
    </div>
  );
};
