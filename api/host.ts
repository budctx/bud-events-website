import { handleHostRoute } from '../server/commerce-routing.ts';
export const POST = (request: Request) => handleHostRoute(request);
export const GET = (request: Request) => handleHostRoute(request);
export default { fetch: POST };
