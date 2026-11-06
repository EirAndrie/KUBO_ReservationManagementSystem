import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Alert, Button } from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  IdcardOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  EditOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import type { Guest, CreateGuestDTO, UpdateGuestDTO, ValidIdType } from '../types/guest.types';
import {
  PHILIPPINE_PHONE_REGEX,
  GUEST_LIMITS,
  ID_TYPE_OPTIONS,
  GUEST_POLICIES,
} from '../constants/guest.constants';
import styles from './guest-form.module.css';

export interface GuestFormProps {
  /** Controls modal display */
  open: boolean;
  /** Existing guest entity when modifying, or undefined/null for new registration */
  initialData?: Guest | null;
  /** Loading flag during asynchronous mutation */
  isLoading?: boolean;
  /** Modal dismissal handler */
  onCancel: () => void;
  /** Submission handler providing validated DTO */
  onSubmit: (values: CreateGuestDTO | UpdateGuestDTO) => Promise<void> | void;
}

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  validIdType: ValidIdType;
  idNumber: string;
  addressLine1?: string;
  city?: string;
  stateProvince?: string;
  zipPostalCode?: string;
  country?: string;
}

/**
 * Guest Registration and Profile Modification Form Modal.
 *
 * Implements:
 * - BR-009: Strict required identification and contact attributes.
 * - BR-010: Valid unique email formatting.
 * - BR-011: Supported ID types and unique ID pair.
 * - BR-012: Strict Philippine contact format (09XXXXXXXXX or +639XXXXXXXXX).
 * - BR-013: Transparent guest reuse notice.
 * - WCAG 2.2 AA: Controls with min-height >= 38px (>= 24x24px target size) and uniform baseline alignment.
 * - Zero Emoji Policy: Icons exclusively from @ant-design/icons.
 */
export const GuestForm: React.FC<GuestFormProps> = ({
  open,
  initialData,
  isLoading = false,
  onCancel,
  onSubmit,
}) => {
  const [form] = Form.useForm<FormValues>();
  const isEditing = Boolean(initialData);

  useEffect(() => {
    if (open) {
      if (initialData) {
        form.setFieldsValue({
          firstName: initialData.first_name,
          lastName: initialData.last_name,
          email: initialData.email,
          phone: initialData.phone,
          validIdType: initialData.valid_id_type,
          idNumber: initialData.id_number,
          addressLine1: initialData.address_line_1 ?? '',
          city: initialData.city ?? '',
          stateProvince: initialData.state_province ?? '',
          zipPostalCode: initialData.zip_postal_code ?? '',
          country: initialData.country ?? 'Philippines',
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, initialData, form]);

  const handleFinish = async (values: FormValues) => {
    const payload: CreateGuestDTO = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim(),
      validIdType: values.validIdType,
      idNumber: values.idNumber.trim(),
      addressLine1: values.addressLine1?.trim() || undefined,
      city: values.city?.trim() || undefined,
      stateProvince: values.stateProvince?.trim() || undefined,
      zipPostalCode: values.zipPostalCode?.trim() || undefined,
      country: values.country?.trim() || undefined,
    };
    await onSubmit(payload);
  };

  return (
    <Modal
      open={open}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
          {isEditing ? (
            <EditOutlined style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
          ) : (
            <UserAddOutlined style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
          )}
          <span>
            {isEditing
              ? `Edit ${initialData?.first_name} ${initialData?.last_name}`
              : 'Register guest'}
          </span>
        </div>
      }
      onCancel={onCancel}
      footer={null}
      destroyOnClose
      className={styles.formModal}
      maskClosable={!isLoading}
    >
      <div style={{ marginTop: 12 }}>
        {!isEditing && (
          <Alert
            className={styles.noticeAlert}
            message="Existing guests are reused"
            description={GUEST_POLICIES.REUSE_NOTICE}
            type="info"
            showIcon
            icon={<InfoCircleOutlined aria-hidden="true" />}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          requiredMark="optional"
          initialValues={{
            country: 'Philippines',
            validIdType: 'NationalID',
          }}
        >
          {/* Section 1: Primary Identity */}
          <div className={styles.sectionHeader}>
            <UserOutlined aria-hidden="true" />
            <span>Identity & Contact</span>
          </div>

          <div className={styles.formGridTwoCols}>
            <Form.Item
              name="firstName"
              label="First Name"
              rules={[
                { required: true, message: 'First name is required.' },
                {
                  max: GUEST_LIMITS.MAX_FIRST_NAME,
                  message: `Cannot exceed ${GUEST_LIMITS.MAX_FIRST_NAME} characters.`,
                },
                {
                  validator: (_, val) =>
                    val && typeof val === 'string' && !val.trim()
                      ? Promise.reject(new Error('First name cannot consist of whitespace only.'))
                      : Promise.resolve(),
                },
              ]}
            >
              <Input
                className={styles.standardInput}
                placeholder="e.g., Juan"
                maxLength={GUEST_LIMITS.MAX_FIRST_NAME}
                disabled={isLoading}
                autoFocus
              />
            </Form.Item>

            <Form.Item
              name="lastName"
              label="Last Name"
              rules={[
                { required: true, message: 'Last name is required.' },
                {
                  max: GUEST_LIMITS.MAX_LAST_NAME,
                  message: `Cannot exceed ${GUEST_LIMITS.MAX_LAST_NAME} characters.`,
                },
                {
                  validator: (_, val) =>
                    val && typeof val === 'string' && !val.trim()
                      ? Promise.reject(new Error('Last name cannot consist of whitespace only.'))
                      : Promise.resolve(),
                },
              ]}
            >
              <Input
                className={styles.standardInput}
                placeholder="e.g., Dela Cruz"
                maxLength={GUEST_LIMITS.MAX_LAST_NAME}
                disabled={isLoading}
              />
            </Form.Item>
          </div>

          <div className={styles.formGridTwoCols}>
            <Form.Item
              name="email"
              label="Email Address"
              rules={[
                { required: true, message: 'Enter an email address.' },
                { type: 'email', message: 'Please enter a valid email format.' },
                {
                  max: GUEST_LIMITS.MAX_EMAIL,
                  message: `Cannot exceed ${GUEST_LIMITS.MAX_EMAIL} characters.`,
                },
              ]}
              extra={<span className={styles.helperText}>Used for reservation confirmation and duplicate checking.</span>}
            >
              <Input
                className={styles.standardInput}
                prefix={<MailOutlined style={{ color: 'var(--color-muted)' }} aria-hidden="true" />}
                placeholder="guest@example.ph"
                disabled={isLoading}
                maxLength={GUEST_LIMITS.MAX_EMAIL}
              />
            </Form.Item>

            <Form.Item
              name="phone"
              label="Contact Phone Number"
              rules={[
                { required: true, message: 'Enter a phone number.' },
                {
                  pattern: PHILIPPINE_PHONE_REGEX,
                  message: 'Use 09XXXXXXXXX or +639XXXXXXXXX.',
                },
              ]}
              extra={<span className={styles.helperText}>Format: 09171234567 or +639171234567.</span>}
            >
              <Input
                className={styles.standardInput}
                prefix={<PhoneOutlined style={{ color: 'var(--color-muted)' }} aria-hidden="true" />}
                placeholder="09171234567"
                disabled={isLoading}
              />
            </Form.Item>
          </div>

          {/* Section 2: Identification */}
          <div className={styles.sectionHeader}>
            <IdcardOutlined aria-hidden="true" />
            <span>Government ID</span>
          </div>

          <div className={styles.formGridTwoCols}>
            <Form.Item
              name="validIdType"
              label="Valid ID Type"
              rules={[{ required: true, message: 'Please select a supported ID type.' }]}
            >
              <Select
                className={styles.standardInput}
                options={ID_TYPE_OPTIONS}
                placeholder="Select ID type..."
                disabled={isLoading}
              />
            </Form.Item>

            <Form.Item
              name="idNumber"
              label="ID Number"
              rules={[
                { required: true, message: 'ID number is required.' },
                {
                  max: GUEST_LIMITS.MAX_ID_NUMBER,
                  message: `Cannot exceed ${GUEST_LIMITS.MAX_ID_NUMBER} characters.`,
                },
                {
                  validator: (_, val) =>
                    val && typeof val === 'string' && !val.trim()
                      ? Promise.reject(new Error('ID number cannot consist of whitespace only.'))
                      : Promise.resolve(),
                },
              ]}
            >
              <Input
                className={styles.standardInput}
                prefix={<IdcardOutlined style={{ color: 'var(--color-muted)' }} aria-hidden="true" />}
                placeholder="e.g., 1234-5678-9012"
                maxLength={GUEST_LIMITS.MAX_ID_NUMBER}
                disabled={isLoading}
              />
            </Form.Item>
          </div>

          {/* Section 3: Optional Address */}
          <div className={styles.sectionHeader}>
            <EnvironmentOutlined aria-hidden="true" />
            <span>Address (Optional)</span>
          </div>

          <Form.Item
            name="addressLine1"
            label="Street Address / Barangay"
            rules={[
              {
                max: GUEST_LIMITS.MAX_ADDRESS,
                message: `Address cannot exceed ${GUEST_LIMITS.MAX_ADDRESS} characters.`,
              },
            ]}
          >
            <Input
              className={styles.standardInput}
              placeholder="House/Unit No., Street Name, Barangay"
              maxLength={GUEST_LIMITS.MAX_ADDRESS}
              disabled={isLoading}
            />
          </Form.Item>

          <div className={styles.formGridThreeCols}>
            <Form.Item
              name="city"
              label="City / Municipality"
              rules={[
                {
                  max: GUEST_LIMITS.MAX_CITY,
                  message: `City cannot exceed ${GUEST_LIMITS.MAX_CITY} characters.`,
                },
              ]}
            >
              <Input
                className={styles.standardInput}
                placeholder="e.g., Cebu City"
                maxLength={GUEST_LIMITS.MAX_CITY}
                disabled={isLoading}
              />
            </Form.Item>

            <Form.Item
              name="stateProvince"
              label="Province / Region"
              rules={[
                {
                  max: GUEST_LIMITS.MAX_STATE,
                  message: `Province cannot exceed ${GUEST_LIMITS.MAX_STATE} characters.`,
                },
              ]}
            >
              <Input
                className={styles.standardInput}
                placeholder="e.g., Cebu"
                maxLength={GUEST_LIMITS.MAX_STATE}
                disabled={isLoading}
              />
            </Form.Item>

            <Form.Item
              name="zipPostalCode"
              label="Postal Code"
              rules={[
                {
                  max: GUEST_LIMITS.MAX_ZIP,
                  message: `Postal code cannot exceed ${GUEST_LIMITS.MAX_ZIP} characters.`,
                },
              ]}
            >
              <Input
                className={styles.standardInput}
                placeholder="e.g., 6000"
                maxLength={GUEST_LIMITS.MAX_ZIP}
                disabled={isLoading}
              />
            </Form.Item>
          </div>

          <Form.Item
            name="country"
            label="Country"
            rules={[
              {
                max: GUEST_LIMITS.MAX_COUNTRY,
                message: `Country cannot exceed ${GUEST_LIMITS.MAX_COUNTRY} characters.`,
              },
            ]}
          >
            <Input
              className={styles.standardInput}
              placeholder="e.g., Philippines"
              maxLength={GUEST_LIMITS.MAX_COUNTRY}
              disabled={isLoading}
            />
          </Form.Item>

          <div className={styles.modalFooter}>
            <Button onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={isLoading}>
              {isEditing ? 'Save changes' : 'Register guest'}
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
};
