export type PaymentState = 'pending' | 'confirmed' | 'review' | 'refunded' | 'disputed';
export type PaymentReceipt = { orderId: string; state: PaymentState; currency: 'sar'; amountMinor: number; createdAt: string; checkedAt: string | null };
