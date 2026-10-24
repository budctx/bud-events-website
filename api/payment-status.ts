import { handlePaymentStatus } from '../server/payment-status.ts';
export const POST = (request: Request) => handlePaymentStatus(request);
export const GET = (request: Request) => handlePaymentStatus(request);
export default { fetch: POST };
