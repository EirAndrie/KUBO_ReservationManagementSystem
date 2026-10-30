# KUBO Reservation Management System: API Integration Guide

This document serves as the definitive reference for integrating the Vite + React + TypeScript frontend with the Node.js + Express backend REST API. It outlines our standard patterns for fetching data, typing responses, handling errors, and using React Query.

---

## 1. Environment Configuration

All backend API requests should use the base URL defined in the environment variables. The backend configures CORS via `FR_ORIGIN`, ensuring secure cross-origin requests.

Create or update your `.env` and `.env.development` files in the frontend root directory:

```env
# .env.development
VITE_API_BASE_URL=http://localhost:5000/api
VITE_APP_NAME="Kubo Reservation Management System"
```

```env
# .env.production
VITE_API_BASE_URL=https://api.kubosystem.com/api
```

---

## 2. API Client Setup

We use **Axios** as our HTTP client. A single, configured instance is exported and used across all API services. This instance includes interceptors for attaching auth tokens (if applicable), standardizing requests, and global error handling.

**`src/constants/api.constants.ts`**
```typescript
export const HTTP_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  SERVER_ERROR: 500,
} as const;

export const AUTH_TOKEN_KEY = 'access_token';
export const LOGIN_REDIRECT_PATH = '/login';
```

**`src/lib/api.ts`**
```typescript
import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';
import { HTTP_STATUS, AUTH_TOKEN_KEY, LOGIN_REDIRECT_PATH } from '@/constants/api.constants';
import { ApiErrorResponse } from '@/types/api.types';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // withCredentials: true, // Uncomment if using HttpOnly cookies for auth
});

// Request Interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response Interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data;
  },
  (error: AxiosError<ApiErrorResponse>) => {
    const status = error.response?.status;
    
    if (status === HTTP_STATUS.UNAUTHORIZED) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      window.location.href = LOGIN_REDIRECT_PATH;
    } else if (status === HTTP_STATUS.FORBIDDEN) {
      message.error('You do not have permission to perform this action.');
    } else if (status === HTTP_STATUS.SERVER_ERROR) {
      message.error('Server error. Please try again later.');
    }

    return Promise.reject(error.response?.data || error);
  }
);
```

---

## 3. TypeScript Types & Interfaces

We maintain strict typings for all models and API payloads to ensure end-to-end type safety.

### 3.1. Common & Pagination Types

**`src/types/api.types.ts`**
```typescript
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ApiErrorResponse {
  status: 'error';
  message: string;
  errors?: Record<string, string[]>;
}
```

### 3.2. Core Resource Models

**`src/types/models.types.ts`**
```typescript
// Shared timestamps
export interface BaseEntity {
  id: string; // UUID or string representation of ID
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

export interface Guest extends BaseEntity {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export interface RoomType extends BaseEntity {
  name: string;
  description: string;
  base_price: number;
  max_occupancy: number;
  amenities: string[];
}

export type RoomStatus = 'available' | 'occupied' | 'maintenance';

export interface Room extends BaseEntity {
  room_number: string;
  room_type_id: string;
  status: RoomStatus;
  floor: string;
  room_type?: RoomType;
}

export type ReservationStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';

export interface Reservation extends BaseEntity {
  guest_id: string;
  room_id: string;
  check_in: string;
  check_out: string;
  status: ReservationStatus;
  total_amount: number;
  
  guest?: Guest;
  room?: Room;
  payments?: Payment[];
  additional_charges?: AdditionalCharge[];
}

export type EmployeeRole = 'admin' | 'receptionist' | 'housekeeping' | 'manager';
export type EmployeeStatus = 'active' | 'inactive';

export interface Employee extends BaseEntity {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: EmployeeRole;
  status: EmployeeStatus;
}

export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'gcash';
export type PaymentStatus = 'pending' | 'completed' | 'refunded';

export interface Payment {
  id: string;
  reservation_id: string;
  amount: number;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
}

export interface AdditionalCharge {
  id: string;
  reservation_id: string;
  description: string;
  amount: number;
  charge_type: string;
  created_at: string;
}

export type AuditAction = 'create' | 'update' | 'delete';

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: AuditAction;
  performed_by: string;
  details: Record<string, any>;
  created_at: string;
}
```

---

## 4. Service Layer Pattern

The service layer is responsible for making the actual HTTP requests using `apiClient`. It keeps API endpoints centralized and abstracts API logic away from components and hooks.

**`src/services/guest.service.ts`**
```typescript
import { apiClient } from '@/lib/api';
import { Guest } from '@/types/models.types';
import { PaginatedResponse, PaginationParams } from '@/types/api.types';

export interface GetGuestsParams extends PaginationParams {
  // Additional guest-specific filters can go here
}

export type CreateGuestDto = Omit<Guest, 'id' | 'created_at' | 'updated_at'>;
export type UpdateGuestDto = Partial<CreateGuestDto>;

export const guestService = {
  getAll: async (params?: GetGuestsParams): Promise<PaginatedResponse<Guest>> => {
    return apiClient.get('/guests', { params });
  },

  getById: async (id: string): Promise<Guest> => {
    return apiClient.get(`/guests/${id}`);
  },

  create: async (data: CreateGuestDto): Promise<Guest> => {
    return apiClient.post('/guests', data);
  },

  update: async (id: string, data: UpdateGuestDto): Promise<Guest> => {
    return apiClient.patch(`/guests/${id}`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/guests/${id}`);
  },
};
```

---

## 5. Mutation Hooks & `useAppMutation`

To avoid scattered error handling and repetitive `onError` callbacks across the application, we wrap TanStack Query's `useMutation` with a custom `useAppMutation` hook.

**`src/hooks/api/useAppMutation.ts`**
```typescript
import { useMutation, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { message } from 'antd';
import { ApiErrorResponse } from '@/types/api.types';

/**
 * A wrapper around useMutation that automatically handles error notifications.
 * It takes standard mutation options but provides a default onError handler.
 */
export const useAppMutation = <
  TData = unknown,
  TError = ApiErrorResponse,
  TVariables = void,
  TContext = unknown
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData, TError, TVariables, TContext> => {
  return useMutation({
    ...options,
    onError: (error, variables, context) => {
      // Default error notification behavior
      const errorMsg = (error as any)?.message || 'An unexpected error occurred during the operation.';
      message.error(errorMsg);

      // Call the consumer's onError if provided
      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
  });
};
```

---

## 6. TanStack Query (React Query) Hooks

We use **TanStack Query (React Query)** to handle data fetching, caching, synchronization, and optimistic updates. Custom hooks encapsulate the query keys and service calls.

**`src/hooks/api/useGuests.ts`**
```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppMutation } from '@/hooks/api/useAppMutation';
import { guestService, GetGuestsParams, CreateGuestDto, UpdateGuestDto } from '@/services/guest.service';
import { message } from 'antd';

export const guestKeys = {
  all: ['guests'] as const,
  lists: () => [...guestKeys.all, 'list'] as const,
  list: (filters: GetGuestsParams) => [...guestKeys.lists(), filters] as const,
  details: () => [...guestKeys.all, 'detail'] as const,
  detail: (id: string) => [...guestKeys.details(), id] as const,
};

// --- Queries ---

export const useGuests = (params: GetGuestsParams) => {
  return useQuery({
    queryKey: guestKeys.list(params),
    queryFn: () => guestService.getAll(params),
    keepPreviousData: true,
  });
};

export const useGuest = (id: string) => {
  return useQuery({
    queryKey: guestKeys.detail(id),
    queryFn: () => guestService.getById(id),
    enabled: !!id,
  });
};

// --- Mutations ---

export const useCreateGuest = () => {
  const queryClient = useQueryClient();
  
  return useAppMutation({
    mutationFn: (data: CreateGuestDto) => guestService.create(data),
    onSuccess: () => {
      message.success('Guest created successfully');
      queryClient.invalidateQueries({ queryKey: guestKeys.lists() });
    }
    // No onError needed, useAppMutation handles it
  });
};

export const useUpdateGuest = () => {
  const queryClient = useQueryClient();
  
  return useAppMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGuestDto }) => 
      guestService.update(id, data),
    onSuccess: (updatedGuest) => {
      message.success('Guest updated successfully');
      queryClient.invalidateQueries({ queryKey: guestKeys.lists() });
      queryClient.setQueryData(guestKeys.detail(updatedGuest.id), updatedGuest);
    }
  });
};

export const useDeleteGuest = () => {
  const queryClient = useQueryClient();
  
  return useAppMutation({
    mutationFn: (id: string) => guestService.delete(id),
    onSuccess: () => {
      message.success('Guest deleted successfully');
      queryClient.invalidateQueries({ queryKey: guestKeys.lists() });
    }
  });
};
```

---

## 7. Error Handling

Error handling occurs at three levels:
1. **Global Interceptor (`@/lib/api`)**: Catches common HTTP errors (using constants like `HTTP_STATUS.UNAUTHORIZED`) and executes global actions like redirects or generic message notifications.
2. **Mutation Wrapper (`useAppMutation`)**: Replaces raw `useMutation` to automatically show backend validation error responses using `antd` without scattering `onError` boilerplate across files.
3. **Component Level**: For fine-grained control, forms can access the `error` object returned by React Query to display inline validation messages.

---

## 8. Example: Complete Guest Feature API Integration

Here is how a React component leverages the setup above to display a list of guests and handle creation using Ant Design components.

**`src/features/guests/GuestList.tsx`**
```tsx
import React, { useState } from 'react';
import { Table, Button, Input, Space, Popconfirm, Typography, Alert } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { useGuests, useCreateGuest, useDeleteGuest } from '@/hooks/api/useGuests';
import { Guest } from '@/types/models.types';

const { Title } = Typography;
const { Search } = Input;

export const GuestList: React.FC = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  
  // Queries
  const { data, isLoading, isError, error } = useGuests({ page, limit, search });
  
  // Mutations
  const createMutation = useCreateGuest();
  const deleteMutation = useDeleteGuest();

  const handleCreate = () => {
    createMutation.mutate({
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      phone: '+639123456789'
    });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleTableChange = (pagination: TablePaginationConfig) => {
    if (pagination.current) setPage(pagination.current);
    if (pagination.pageSize) setLimit(pagination.pageSize);
  };

  const columns: ColumnsType<Guest> = [
    {
      title: 'Name',
      key: 'name',
      render: (_, record) => `${record.first_name} ${record.last_name}`,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title="Delete the guest"
          description="Are you sure to delete this guest?"
          onConfirm={() => handleDelete(record.id)}
          okText="Yes"
          cancelText="No"
        >
          <Button danger type="link" loading={deleteMutation.isLoading && deleteMutation.variables === record.id}>
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ];

  if (isError) {
    return <Alert message="Error" description={(error as any)?.message} type="error" showIcon />;
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <Title level={2} style={{ margin: 0 }}>Guests</Title>
        <Button 
          type="primary"
          onClick={handleCreate}
          loading={createMutation.isLoading}
        >
          Add Dummy Guest
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Search 
          placeholder="Search guests..." 
          onSearch={(value) => {
            setSearch(value);
            setPage(1); // reset to first page on search
          }} 
          enterButton 
          allowClear
          style={{ width: 300 }}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={data?.data}
        rowKey="id"
        loading={isLoading}
        onChange={handleTableChange}
        pagination={{
          current: page,
          pageSize: limit,
          total: data?.meta.total || 0,
          showSizeChanger: true,
        }}
      />
    </div>
  );
};
```
