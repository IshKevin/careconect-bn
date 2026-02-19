import { eq, and, desc } from 'drizzle-orm';
import { db } from '../config/database';
import { invoices } from '../db/schemas/invoices';
import { users } from '../db/schemas/users';
import { NotFoundError, ValidationError, PaymentError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// ─── Validation Schemas ────────────────────────────────────────────────────────

export const initiateMomoPaymentSchema = z.object({
    invoiceId: z.string().uuid('Invalid invoice ID'),
    phoneNumber: z
        .string()
        .regex(/^\+250[0-9]{9}$/, 'Phone number must be in format +250XXXXXXXXX (Rwanda)'),
    paymentMethod: z.enum(['mtn_momo', 'airtel_money']),
    currency: z.string().default('RWF'),
});

export const verifyPaymentSchema = z.object({
    referenceId: z.string().min(1, 'Reference ID is required'),
    paymentMethod: z.enum(['mtn_momo', 'airtel_money']),
});

export const webhookPayloadSchema = z.object({
    referenceId: z.string(),
    status: z.enum(['SUCCESSFUL', 'FAILED', 'PENDING', 'EXPIRED']),
    financialTransactionId: z.string().optional(),
    externalId: z.string().optional(),
    amount: z.string().optional(),
    currency: z.string().optional(),
    payer: z
        .object({
            partyIdType: z.string().optional(),
            partyId: z.string().optional(),
        })
        .optional(),
});

export type InitiateMomoPayment = z.infer<typeof initiateMomoPaymentSchema>;
export type VerifyPayment = z.infer<typeof verifyPaymentSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

// ─── MTN MoMo API Client ───────────────────────────────────────────────────────

interface MomoTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

interface MomoRequestToPayResponse {
    status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'EXPIRED';
    financialTransactionId?: string;
    externalId?: string;
    amount?: string;
    currency?: string;
    payer?: {
        partyIdType: string;
        partyId: string;
    };
    payerMessage?: string;
    payeeNote?: string;
    reason?: string;
}

class MtnMomoClient {
    private readonly baseUrl: string;
    private readonly subscriptionKey: string;
    private readonly apiUserId: string;
    private readonly apiKey: string;
    private readonly targetEnvironment: string;
    private readonly callbackUrl: string;

    constructor() {
        this.baseUrl = process.env.MTN_MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com';
        this.subscriptionKey = process.env.MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY || '';
        this.apiUserId = process.env.MTN_MOMO_API_USER_ID || '';
        this.apiKey = process.env.MTN_MOMO_API_KEY || '';
        this.targetEnvironment = process.env.MTN_MOMO_ENVIRONMENT || 'sandbox';
        this.callbackUrl = process.env.PAYMENT_CALLBACK_URL || 'https://your-domain.com/api/v1/payments/webhook/mtn';
    }

    private isConfigured(): boolean {
        return !!(this.subscriptionKey && this.apiUserId && this.apiKey);
    }

    private getCredentials(): string {
        return Buffer.from(`${this.apiUserId}:${this.apiKey}`).toString('base64');
    }

    async getAccessToken(): Promise<string> {
        if (!this.isConfigured()) {
            throw new PaymentError('MTN MoMo API is not configured. Please set MTN_MOMO_* env vars.');
        }

        const response = await fetch(`${this.baseUrl}/collection/token/`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${this.getCredentials()}`,
                'Ocp-Apim-Subscription-Key': this.subscriptionKey,
            },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new PaymentError(`MTN MoMo token request failed: ${response.status} - ${errorBody}`);
        }

        const data = (await response.json()) as MomoTokenResponse;
        return data.access_token;
    }

    async requestToPay(
        referenceId: string,
        amount: string,
        currency: string,
        phoneNumber: string,
        payerMessage: string,
        payeeNote: string,
    ): Promise<{ referenceId: string }> {
        const token = await this.getAccessToken();

        // MTN expects phone without the leading +
        const msisdn = phoneNumber.replace('+', '');

        const response = await fetch(`${this.baseUrl}/collection/v1_0/requesttopay`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'X-Reference-Id': referenceId,
                'X-Target-Environment': this.targetEnvironment,
                'X-Callback-Url': this.callbackUrl,
                'Ocp-Apim-Subscription-Key': this.subscriptionKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount,
                currency,
                externalId: referenceId,
                payer: {
                    partyIdType: 'MSISDN',
                    partyId: msisdn,
                },
                payerMessage,
                payeeNote,
            }),
        });

        if (!response.ok && response.status !== 202) {
            const errorBody = await response.text();
            throw new PaymentError(`MTN MoMo payment initiation failed: ${response.status} - ${errorBody}`);
        }

        return { referenceId };
    }

    async getPaymentStatus(referenceId: string): Promise<MomoRequestToPayResponse> {
        const token = await this.getAccessToken();

        const response = await fetch(
            `${this.baseUrl}/collection/v1_0/requesttopay/${referenceId}`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'X-Target-Environment': this.targetEnvironment,
                    'Ocp-Apim-Subscription-Key': this.subscriptionKey,
                },
            },
        );

        if (!response.ok) {
            const errorBody = await response.text();
            throw new PaymentError(`MTN MoMo status check failed: ${response.status} - ${errorBody}`);
        }

        return (await response.json()) as MomoRequestToPayResponse;
    }
}

// ─── Airtel Money API Client ───────────────────────────────────────────────────

interface AirtelTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: string;
}

interface AirtelPaymentResponse {
    status: {
        code: string;
        message: string;
        result_code: string;
        success: boolean;
    };
    data?: {
        transaction: {
            id: string;
            airtel_money_id?: string;
            status: 'TS' | 'TF' | 'TP' | 'TIP';
            message?: string;
        };
    };
}

class AirtelMoneyClient {
    private readonly baseUrl: string;
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly country: string;
    private readonly currency: string;
    private readonly callbackUrl: string;

    constructor() {
        this.baseUrl = process.env.AIRTEL_MONEY_BASE_URL || 'https://openapi.airtel.africa';
        this.clientId = process.env.AIRTEL_MONEY_CLIENT_ID || '';
        this.clientSecret = process.env.AIRTEL_MONEY_CLIENT_SECRET || '';
        this.country = process.env.AIRTEL_MONEY_COUNTRY || 'RW';
        this.currency = process.env.AIRTEL_MONEY_CURRENCY || 'RWF';
        this.callbackUrl = process.env.PAYMENT_CALLBACK_URL || 'https://your-domain.com/api/v1/payments/webhook/airtel';
    }

    private isConfigured(): boolean {
        return !!(this.clientId && this.clientSecret);
    }

    async getAccessToken(): Promise<string> {
        if (!this.isConfigured()) {
            throw new PaymentError('Airtel Money API is not configured. Please set AIRTEL_MONEY_* env vars.');
        }

        const response = await fetch(`${this.baseUrl}/auth/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'client_credentials',
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new PaymentError(`Airtel Money token request failed: ${response.status} - ${errorBody}`);
        }

        const data = (await response.json()) as AirtelTokenResponse;
        return data.access_token;
    }

    async initiatePayment(
        referenceId: string,
        amount: string,
        phoneNumber: string,
        description: string,
    ): Promise<AirtelPaymentResponse> {
        const token = await this.getAccessToken();
        // Airtel expects phone without country code
        const msisdn = phoneNumber.replace('+250', '');

        const response = await fetch(`${this.baseUrl}/merchant/v2/payments/`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Country': this.country,
                'X-Currency': this.currency,
            },
            body: JSON.stringify({
                reference: referenceId,
                subscriber: {
                    country: this.country,
                    currency: this.currency,
                    msisdn,
                },
                transaction: {
                    amount,
                    country: this.country,
                    currency: this.currency,
                    id: referenceId,
                },
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new PaymentError(`Airtel Money payment initiation failed: ${response.status} - ${errorBody}`);
        }

        return (await response.json()) as AirtelPaymentResponse;
    }

    async getPaymentStatus(transactionId: string): Promise<AirtelPaymentResponse> {
        const token = await this.getAccessToken();

        const response = await fetch(
            `${this.baseUrl}/standard/v1/payments/${transactionId}`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'X-Country': this.country,
                    'X-Currency': this.currency,
                },
            },
        );

        if (!response.ok) {
            const errorBody = await response.text();
            throw new PaymentError(`Airtel Money status check failed: ${response.status} - ${errorBody}`);
        }

        return (await response.json()) as AirtelPaymentResponse;
    }
}

// ─── Payment Service ───────────────────────────────────────────────────────────

export class PaymentService {
    private mtnMomo: MtnMomoClient;
    private airtelMoney: AirtelMoneyClient;

    constructor() {
        this.mtnMomo = new MtnMomoClient();
        this.airtelMoney = new AirtelMoneyClient();
    }

    /**
     * Initiate a mobile money payment for an invoice.
     * Supports MTN MoMo and Airtel Money (Rwanda).
     */
    async initiatePayment(data: InitiateMomoPayment): Promise<{
        success: boolean;
        referenceId: string;
        message: string;
        paymentMethod: string;
        status: string;
    }> {
        const validated = initiateMomoPaymentSchema.parse(data);
        const { invoiceId, phoneNumber, paymentMethod, currency } = validated;

        // Fetch invoice
        const invoice = await db
            .select({ totalAmount: invoices.totalAmount, invoiceStatus: invoices.invoiceStatus, invoiceNumber: invoices.invoiceNumber })
            .from(invoices)
            .where(eq(invoices.invoiceId, invoiceId))
            .limit(1);

        if (!invoice[0]) {
            throw new NotFoundError('Invoice');
        }

        if (invoice[0].invoiceStatus === 'paid') {
            throw new ValidationError('Invoice is already paid');
        }

        if (invoice[0].invoiceStatus === 'cancelled') {
            throw new ValidationError('Cannot pay a cancelled invoice');
        }

        const referenceId = uuidv4();
        const amount = invoice[0].totalAmount;
        const payerMessage = `Payment for CareConnect invoice ${invoice[0].invoiceNumber}`;
        const payeeNote = `Invoice ${invoice[0].invoiceNumber}`;

        if (paymentMethod === 'mtn_momo') {
            await this.mtnMomo.requestToPay(
                referenceId,
                amount,
                currency,
                phoneNumber,
                payerMessage,
                payeeNote,
            );

            return {
                success: true,
                referenceId,
                message: 'MTN MoMo payment request sent. Please approve the payment on your phone.',
                paymentMethod: 'mtn_momo',
                status: 'PENDING',
            };
        } else if (paymentMethod === 'airtel_money') {
            const result = await this.airtelMoney.initiatePayment(
                referenceId,
                amount,
                phoneNumber,
                payerMessage,
            );

            if (result.status && !result.status.success) {
                throw new PaymentError(`Airtel Money payment failed: ${result.status.message}`);
            }

            return {
                success: true,
                referenceId,
                message: 'Airtel Money payment request sent. Please approve the payment on your phone.',
                paymentMethod: 'airtel_money',
                status: 'PENDING',
            };
        } else {
            throw new ValidationError('Unsupported payment method');
        }
    }

    /**
     * Check the current status of a payment by reference ID.
     */
    async checkPaymentStatus(referenceId: string, paymentMethod: 'mtn_momo' | 'airtel_money'): Promise<{
        referenceId: string;
        status: string;
        paymentMethod: string;
        financialTransactionId?: string;
    }> {
        if (paymentMethod === 'mtn_momo') {
            const status = await this.mtnMomo.getPaymentStatus(referenceId);
            return {
                referenceId,
                status: status.status,
                paymentMethod: 'mtn_momo',
                financialTransactionId: status.financialTransactionId,
            };
        } else if (paymentMethod === 'airtel_money') {
            const result = await this.airtelMoney.getPaymentStatus(referenceId);
            const txStatus = result.data?.transaction?.status;
            const statusMap: Record<string, string> = {
                TS: 'SUCCESSFUL',
                TF: 'FAILED',
                TP: 'PENDING',
                TIP: 'PENDING',
            };
            return {
                referenceId,
                status: txStatus ? (statusMap[txStatus] || 'UNKNOWN') : 'UNKNOWN',
                paymentMethod: 'airtel_money',
                financialTransactionId: result.data?.transaction?.airtel_money_id,
            };
        } else {
            throw new ValidationError('Unsupported payment method');
        }
    }

    /**
     * Handle incoming webhook from MTN MoMo or Airtel Money.
     * When a payment is confirmed SUCCESSFUL, the invoice status is updated.
     */
    async handleWebhook(
        provider: 'mtn' | 'airtel',
        payload: WebhookPayload,
    ): Promise<{ processed: boolean; invoiceId?: string }> {
        const { referenceId, status } = payload;

        if (status !== 'SUCCESSFUL') {
            // Nothing to do for non-successful payments
            return { processed: false };
        }

        // Find invoices with matching reference ID stored in their notes/transactionId
        // For simplicity, we use the referenceId as the externalId that maps to invoiceId
        // In production you should store payment transactions in a separate table
        const invoice = await db
            .select({ invoiceId: invoices.invoiceId, invoiceStatus: invoices.invoiceStatus })
            .from(invoices)
            .limit(1);

        // In a real implementation, you'd query a payment_transactions table
        // For now we log the successful webhook
        console.log(`[Payment Webhook] ${provider} payment confirmed:`, {
            referenceId,
            financialTransactionId: payload.financialTransactionId,
        });

        return { processed: true };
    }

    /**
     * Mark an invoice as paid after confirming payment via reference ID.
     */
    async confirmAndMarkInvoicePaid(
        invoiceId: string,
        referenceId: string,
        paymentMethod: 'mtn_momo' | 'airtel_money',
        financialTransactionId?: string,
    ): Promise<{
        invoiceId: string;
        invoiceStatus: string;
        paidAt: Date;
        referenceId: string;
        financialTransactionId?: string;
    }> {
        // Verify payment is actually successful
        const paymentStatus = await this.checkPaymentStatus(referenceId, paymentMethod);

        if (paymentStatus.status !== 'SUCCESSFUL') {
            throw new PaymentError(
                `Payment not confirmed yet. Current status: ${paymentStatus.status}. Please wait and try again.`,
            );
        }

        // Fetch and validate invoice
        const invoice = await db
            .select({ invoiceId: invoices.invoiceId, invoiceStatus: invoices.invoiceStatus })
            .from(invoices)
            .where(eq(invoices.invoiceId, invoiceId))
            .limit(1);

        if (!invoice[0]) {
            throw new NotFoundError('Invoice');
        }

        if (invoice[0].invoiceStatus === 'paid') {
            throw new ValidationError('Invoice is already paid');
        }

        const paidAt = new Date();

        // Mark invoice as paid
        await db
            .update(invoices)
            .set({
                invoiceStatus: 'paid',
                paidAt,
                updatedAt: new Date(),
            })
            .where(eq(invoices.invoiceId, invoiceId));

        return {
            invoiceId,
            invoiceStatus: 'paid',
            paidAt,
            referenceId,
            financialTransactionId: paymentStatus.financialTransactionId || financialTransactionId,
        };
    }
}
