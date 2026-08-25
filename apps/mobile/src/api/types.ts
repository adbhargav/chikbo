/** API-layer request/response shapes not covered by the shared DTOs. */
import type { UserRole } from '../types/shared';

export type { ApiOk, ApiErr, ApiResponse } from '../types/shared';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string | null;
  permissions?: string[];
}

export interface AuthSessionResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
}

export interface NotificationDto {
  id: string;
  title: string;
  body: string;
  type?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface ReturnRequestDto {
  id: string;
  orderId: string;
  orderItemId: string;
  status: string;
  reason: string;
  imageUrls: string[];
  adminNote?: string | null;
  createdAt: string;
}

export interface UploadedFileDto {
  url: string;
  size: number;
}

export interface ProductListParams {
  page?: number;
  pageSize?: number;
  category?: string;
  search?: string;
  /** Rupees, not paise (per API contract). */
  minPrice?: number;
  /** Rupees, not paise (per API contract). */
  maxPrice?: number;
  sizes?: string;
  colors?: string;
  inStock?: boolean;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'rating';
}
