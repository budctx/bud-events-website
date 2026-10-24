import { handlePaymentWorker } from '../server/payment-operations.ts';
export const GET = (request: Request) => handlePaymentWorker(request);
export const POST = (request: Request) => handlePaymentWorker(request);
export default { fetch: GET };
