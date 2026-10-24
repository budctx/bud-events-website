import { handlePaymentWorker } from '../server/payment-operations.ts';
export const GET = (request: Request) => handlePaymentWorker(request, undefined, undefined, 'reconcile');
export const POST = (request: Request) => handlePaymentWorker(request, undefined, undefined, 'reconcile');
export default { fetch: GET };
