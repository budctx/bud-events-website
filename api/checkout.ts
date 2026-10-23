import { handleCheckout } from '../server/checkout.ts';
export const POST = (request: Request) => handleCheckout(request);
export const GET = (request: Request) => handleCheckout(request);
export default { fetch: handleCheckout };
