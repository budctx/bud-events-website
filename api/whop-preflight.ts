import { handleWhopPreflight } from '../server/whop-preflight.ts';
export const POST = (request: Request) => handleWhopPreflight(request);
export const GET = (request: Request) => handleWhopPreflight(request);
export default { fetch: POST };
