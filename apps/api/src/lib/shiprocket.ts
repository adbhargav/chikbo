/**
 * Shiprocket API client (https://apidocs.shiprocket.in).
 * Auth: POST /v1/external/auth/login -> Bearer token (valid ~10 days);
 * the client caches the token and re-authenticates on 401.
 * All calls are server-side only — credentials never leave the API.
 */
import axios, { AxiosError, type AxiosInstance } from 'axios';
import { env } from '../config/env';
import { logger } from './logger';
import { ApiError } from '../middleware/error';

const BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

export interface ShiprocketOrderItem {
  name: string;
  sku: string;
  units: number;
  selling_price: number; // rupees
}

export interface CreateShipmentInput {
  orderNumber: string;
  orderDate: Date;
  billing: {
    name: string;
    phone: string;
    address: string;
    address2?: string;
    city: string;
    state: string;
    pincode: string;
    email: string;
  };
  items: ShiprocketOrderItem[];
  subTotalRupees: number;
  weightKg: number;
  dimensionsCm?: { length: number; breadth: number; height: number };
}

export interface CreateShipmentResult {
  shiprocketOrderId: string;
  shiprocketShipmentId: string;
}

export interface ServiceabilityResult {
  serviceable: boolean;
  /** Fastest courier estimate in days, when the API reports one. */
  etaDays: number | null;
  courierName: string | null;
  courierCount: number;
}

/** Chikbo's pickup warehouse (Rikab gunj, Hyderabad) — origin for rate/ETA checks. */
export const WAREHOUSE_PINCODE = '500002';

class ShiprocketClient {
  private http: AxiosInstance;
  private token: string | null = null;
  private tokenFetchedAt = 0;

  constructor() {
    this.http = axios.create({ baseURL: BASE_URL, timeout: 20_000 });
  }

  get isConfigured(): boolean {
    return Boolean(env.SHIPROCKET_EMAIL && env.SHIPROCKET_PASSWORD);
  }

  private async authenticate(): Promise<string> {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: env.SHIPROCKET_EMAIL,
      password: env.SHIPROCKET_PASSWORD,
    });
    this.token = res.data.token as string;
    this.tokenFetchedAt = Date.now();
    return this.token;
  }

  private async getToken(): Promise<string> {
    // Tokens last ~10 days; refresh after 8.
    if (this.token && Date.now() - this.tokenFetchedAt < 8 * 24 * 3600 * 1000) return this.token;
    return this.authenticate();
  }

  private async request<T>(method: 'get' | 'post', path: string, data?: unknown): Promise<T> {
    if (!this.isConfigured) {
      throw ApiError.unprocessable(
        'SHIPPING_UNAVAILABLE',
        'Shiprocket is not connected yet. Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD to the API server settings to create shipments.',
      );
    }
    const doCall = async (token: string) =>
      this.http.request<T>({ method, url: path, data, headers: { Authorization: `Bearer ${token}` } });
    try {
      const res = await doCall(await this.getToken());
      return res.data;
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 401) {
        const res = await doCall(await this.authenticate());
        return res.data;
      }
      logger.error({ err: err instanceof AxiosError ? err.response?.data : err, path }, 'Shiprocket API error');
      throw err;
    }
  }

  /** Create an adhoc order in Shiprocket (prepaid). */
  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const dims = input.dimensionsCm ?? { length: 30, breadth: 25, height: 5 };
    const data = await this.request<{ order_id: number | string; shipment_id: number | string }>(
      'post',
      '/orders/create/adhoc',
      {
        order_id: input.orderNumber,
        order_date: input.orderDate.toISOString().slice(0, 16).replace('T', ' '),
        pickup_location: env.SHIPROCKET_PICKUP_LOCATION,
        billing_customer_name: input.billing.name,
        billing_last_name: '',
        billing_address: input.billing.address,
        billing_address_2: input.billing.address2 ?? '',
        billing_city: input.billing.city,
        billing_pincode: input.billing.pincode,
        billing_state: input.billing.state,
        billing_country: 'India',
        billing_email: input.billing.email,
        billing_phone: input.billing.phone,
        shipping_is_billing: true,
        order_items: input.items,
        payment_method: 'Prepaid',
        sub_total: input.subTotalRupees,
        length: dims.length,
        breadth: dims.breadth,
        height: dims.height,
        weight: input.weightKg,
      },
    );
    return { shiprocketOrderId: String(data.order_id), shiprocketShipmentId: String(data.shipment_id) };
  }

  /** Assign AWB (optionally to a specific courier). */
  async assignAwb(shipmentId: string, courierId?: number): Promise<{ awbCode: string; courierName: string }> {
    const data = await this.request<{
      response: { data: { awb_code: string; courier_name: string } };
    }>('post', '/courier/assign/awb', {
      shipment_id: shipmentId,
      ...(courierId ? { courier_id: courierId } : {}),
    });
    return { awbCode: data.response.data.awb_code, courierName: data.response.data.courier_name };
  }

  /**
   * Courier serviceability for a delivery pincode. Prepaid only (cod=0), so a
   * pincode that only has COD couriers correctly reads as not serviceable.
   */
  async checkServiceability(input: {
    deliveryPincode: string;
    pickupPincode?: string;
    weightKg?: number;
  }): Promise<ServiceabilityResult> {
    const params = new URLSearchParams({
      pickup_postcode: input.pickupPincode ?? WAREHOUSE_PINCODE,
      delivery_postcode: input.deliveryPincode,
      cod: '0',
      weight: String(input.weightKg ?? 0.5),
    });
    const data = await this.request<{
      data?: { available_courier_companies?: { courier_name?: string; estimated_delivery_days?: string | number }[] };
    }>('get', `/courier/serviceability/?${params.toString()}`);
    const couriers = data.data?.available_courier_companies ?? [];
    const etas = couriers
      .map((c) => Number(c.estimated_delivery_days))
      .filter((n) => Number.isFinite(n) && n > 0);
    const fastest = etas.length ? Math.min(...etas) : null;
    const best = fastest == null ? couriers[0] : couriers.find((c) => Number(c.estimated_delivery_days) === fastest);
    return {
      serviceable: couriers.length > 0,
      etaDays: fastest == null ? null : Math.ceil(fastest),
      courierName: best?.courier_name ?? null,
      courierCount: couriers.length,
    };
  }

  /** Track by AWB. */
  async trackByAwb(awbCode: string): Promise<unknown> {
    return this.request('get', `/courier/track/awb/${encodeURIComponent(awbCode)}`);
  }

  /** Create a return order for damaged-goods pickups. */
  async createReturn(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const dims = input.dimensionsCm ?? { length: 30, breadth: 25, height: 5 };
    const data = await this.request<{ order_id: number | string; shipment_id: number | string }>(
      'post',
      '/orders/create/return',
      {
        order_id: `${input.orderNumber}-RET`,
        order_date: input.orderDate.toISOString().slice(0, 16).replace('T', ' '),
        pickup_customer_name: input.billing.name,
        pickup_phone: input.billing.phone,
        pickup_address: input.billing.address,
        pickup_address_2: input.billing.address2 ?? '',
        pickup_city: input.billing.city,
        pickup_state: input.billing.state,
        pickup_country: 'India',
        pickup_pincode: input.billing.pincode,
        pickup_email: input.billing.email,
        shipping_customer_name: 'Chikbo Warehouse',
        shipping_phone: '9346060635',
        shipping_address: '21-1-684 & 85, Rikab gunj',
        shipping_city: 'Hyderabad',
        shipping_state: 'Telangana',
        shipping_country: 'India',
        shipping_pincode: '500002',
        order_items: input.items,
        payment_method: 'Prepaid',
        sub_total: input.subTotalRupees,
        length: dims.length,
        breadth: dims.breadth,
        height: dims.height,
        weight: input.weightKg,
      },
    );
    return { shiprocketOrderId: String(data.order_id), shiprocketShipmentId: String(data.shipment_id) };
  }
}

export const shiprocket = new ShiprocketClient();
