import { config } from '../config/env';
import { PaymentError } from '../utils/errors';

// Thin client for Pesapal API v3 (JSON). Field names follow Pesapal's v3 docs;
// confirm each against a live sandbox response before go-live (see docs/roadmap/01-payment-gateway.md).

const BASE_URLS = {
  sandbox: 'https://cybqa.pesapal.com/pesapalv3/api',
  production: 'https://pay.pesapal.com/v3/api',
} as const;

export interface PesapalOrderRequest {
  merchantReference: string;
  amount: number;
  currency: string;
  description: string;
  callbackUrl: string;
  notificationId: string;
  billingAddress: {
    email_address: string;
    phone_number?: string;
    first_name: string;
    last_name: string;
  };
}

export interface PesapalOrderResponse {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
  status: string;
  error?: { error_type?: string; code?: string; message?: string } | null;
}

export interface PesapalTransactionStatus {
  payment_status_description: string; // COMPLETED | FAILED | REVERSED | INVALID | PENDING
  merchant_reference: string;
  order_tracking_id: string;
  confirmation_code?: string;
  payment_method?: string;
  amount: number;
  currency: string;
  status_code?: number;
  error?: { error_type?: string; code?: string; message?: string } | null;
}

interface TokenResponse {
  token?: string;
  expiryDate?: string;
  error?: { message?: string } | null;
}

export class PesapalClient {
  private readonly baseUrl: string;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor() {
    this.baseUrl = BASE_URLS[config.pesapal.environment];
  }

  private assertConfigured(): void {
    if (!config.pesapal.consumerKey || !config.pesapal.consumerSecret) {
      throw new PaymentError('Pesapal is not configured. Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET.');
    }
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown, auth = true): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) headers.Authorization = `Bearer ${await this.getToken()}`;

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new PaymentError(`Pesapal ${method} ${path} failed: ${response.status} - ${text}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  async getToken(): Promise<string> {
    this.assertConfigured();
    // Refresh one minute before expiry; Pesapal tokens are short-lived.
    if (this.token && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.token;
    }

    const data = await this.request<TokenResponse>(
      'POST',
      '/Auth/RequestToken',
      { consumer_key: config.pesapal.consumerKey, consumer_secret: config.pesapal.consumerSecret },
      false,
    );

    if (!data.token) {
      throw new PaymentError(`Pesapal token request failed: ${data.error?.message ?? 'no token returned'}`);
    }

    this.token = data.token;
    this.tokenExpiresAt = data.expiryDate ? Date.parse(data.expiryDate) : Date.now() + 4 * 60_000;
    return this.token;
  }

  /** Registers an IPN URL and returns its notification_id. Run once per environment. */
  async registerIpn(url: string): Promise<string> {
    const data = await this.request<{ ipn_id?: string; error?: { message?: string } | null }>(
      'POST',
      '/URLSetup/RegisterIPN',
      { url, ipn_notification_type: 'GET' },
    );
    if (!data.ipn_id) {
      throw new PaymentError(`Pesapal IPN registration failed: ${data.error?.message ?? 'no ipn_id returned'}`);
    }
    return data.ipn_id;
  }

  async submitOrder(order: PesapalOrderRequest): Promise<PesapalOrderResponse> {
    const data = await this.request<PesapalOrderResponse>('POST', '/Transactions/SubmitOrderRequest', {
      id: order.merchantReference,
      currency: order.currency,
      amount: order.amount,
      description: order.description,
      callback_url: order.callbackUrl,
      notification_id: order.notificationId,
      billing_address: order.billingAddress,
    });

    if (!data.order_tracking_id || !data.redirect_url) {
      throw new PaymentError(`Pesapal order failed: ${data.error?.message ?? 'no redirect URL returned'}`);
    }
    return data;
  }

  /** The authoritative status. Never act on an IPN body without calling this. */
  async getTransactionStatus(orderTrackingId: string): Promise<PesapalTransactionStatus> {
    const query = new URLSearchParams({ orderTrackingId });
    return this.request<PesapalTransactionStatus>('GET', `/Transactions/GetTransactionStatus?${query.toString()}`);
  }

  /**
   * Asks Pesapal to refund a completed payment. Request fields follow Pesapal's v3 RefundRequest.
   * Not verified against a live sandbox yet: enabled only with PESAPAL_REFUNDS_ENABLED=true.
   */
  async requestRefund(input: { confirmationCode: string; amount: number; username: string; remarks: string }): Promise<{ refund_request_id?: string; status?: string; error?: { message?: string } | null }> {
    const data = await this.request<{ refund_request_id?: string; status?: string; error?: { message?: string } | null }>(
      'POST',
      '/Transactions/RefundRequest',
      {
        confirmation_code: input.confirmationCode,
        amount: input.amount,
        username: input.username,
        remarks: input.remarks,
      },
    );
    if (!data.refund_request_id && data.error) {
      throw new PaymentError(`Pesapal refund failed: ${data.error.message ?? 'unknown error'}`);
    }
    return data;
  }
}
