import React, { useState, useCallback, useRef } from 'react';
import { Select, Spin } from 'antd';
import { SearchOutlined, UserOutlined, IdcardOutlined } from '@ant-design/icons';
import { guestService } from '../services/guest.service';
import { ID_TYPE_LABEL_MAP } from '../constants/guest.constants';
import type { Guest } from '../types/guest.types';
import styles from './guest-search-select.module.css';

const { Option } = Select;

export interface GuestSearchSelectProps {
  /** Currently selected guest UUID */
  value?: string;
  /** Called with the full Guest entity when a selection is made */
  onChange?: (guestId: string, guest: Guest) => void;
  /** Disables the control */
  disabled?: boolean;
  /** Placeholder copy */
  placeholder?: string;
  /** Called when the user explicitly requests creating a new guest */
  onRegisterNew?: () => void;
  /** aria-label for screen readers */
  ariaLabel?: string;
}

/**
 * Async debounced guest search Select component.
 *
 * Implements BR-013: Staff must search for an existing guest before creating
 * a new reservation, to prevent duplicate records.
 *
 * Behaviour:
 * - 350ms debounced query against GET /api/guests?search=...
 * - Shows name, email, and ID type badge in each option.
 * - "Register New Guest" bottom action when no results are found.
 * - Minimum 2 characters before triggering a remote search.
 * - WCAG 2.2: Keyboard navigable, 48px option height (> 24px target), aria-label.
 */
export const GuestSearchSelect: React.FC<GuestSearchSelectProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = 'Search by name, email, or phone...',
  onRegisterNew,
  ariaLabel = 'Search for existing guest',
}) => {
  const [options, setOptions] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((term: string) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!term || term.trim().length < 2) {
      setOptions([]);
      setSearched(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      setSearched(true);
      try {
        const results = await guestService.search(term.trim(), 10);
        setOptions(results);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, []);

  const handleChange = (guestId: string) => {
    const guest = options.find((g) => g.guest_id === guestId);
    if (guest && onChange) {
      onChange(guestId, guest);
    }
  };

  const notFoundContent = loading ? (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <Spin size="small" />
      <span style={{ marginLeft: 8, color: '#6b7280', fontSize: '0.85rem' }}>Searching guests...</span>
    </div>
  ) : searched ? (
    <div className={styles.emptyOption}>
      <div>No existing guests match your search.</div>
      {onRegisterNew && (
        <div style={{ marginTop: 6 }}>
          <span
            className={styles.registerLink}
            role="button"
            tabIndex={0}
            onClick={onRegisterNew}
            onKeyDown={(e) => e.key === 'Enter' && onRegisterNew?.()}
            aria-label="Register a new guest"
          >
            Register New Guest
          </span>
        </div>
      )}
    </div>
  ) : (
    <div className={styles.emptyOption}>
      Type at least 2 characters to search for an existing guest (BR-013).
    </div>
  );

  return (
    <Select
      className={styles.selectWrapper}
      showSearch
      filterOption={false}
      value={value}
      onSearch={handleSearch}
      onChange={handleChange}
      notFoundContent={notFoundContent}
      loading={loading}
      disabled={disabled}
      placeholder={
        <span>
          <SearchOutlined style={{ color: '#9ca3af', marginRight: 6 }} aria-hidden="true" />
          {placeholder}
        </span>
      }
      allowClear
      onClear={() => {
        setOptions([]);
        setSearched(false);
      }}
      aria-label={ariaLabel}
      listHeight={320}
      dropdownStyle={{ minWidth: 420 }}
    >
      {options.map((guest) => (
        <Option key={guest.guest_id} value={guest.guest_id}>
          <div className={styles.optionItem}>
            <span className={styles.optionName}>
              <UserOutlined
                style={{ color: '#9ca3af', marginRight: 6, fontSize: '0.8rem' }}
                aria-hidden="true"
              />
              {guest.first_name} {guest.last_name}
            </span>
            <span className={styles.optionMeta}>
              <span>{guest.email}</span>
              <span aria-hidden="true">·</span>
              <span>{guest.phone}</span>
              <span className={styles.optionIdBadge}>
                <IdcardOutlined style={{ fontSize: '0.7rem' }} aria-hidden="true" />
                {ID_TYPE_LABEL_MAP[guest.valid_id_type]}
              </span>
            </span>
          </div>
        </Option>
      ))}
    </Select>
  );
};
