import { handlePaymentWorker } from '../server/payment-operations.ts';
import { handleOwnerMonitor } from '../server/owner-monitor.ts';
export const GET = (request: Request) => {
  const url = new URL(request.url);
  if (url.search === '?monitor=owner') {
    url.search = '';
    return handleOwnerMonitor(new Request(url, request));
  }
  return handlePaymentWorker(request);
};
export const POST = (request: Request) => handlePaymentWorker(request);
export default { fetch: GET };
