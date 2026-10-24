import { handleCheckoutRoute } from '../server/commerce-routing.ts';
export const POST = (request: Request) => handleCheckoutRoute(request);
export const GET = (request: Request) => handleCheckoutRoute(request);
export default { fetch: POST };
