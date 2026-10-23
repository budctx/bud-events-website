import { handleHost } from '../server/host.ts';
export const POST = (request: Request) => handleHost(request);
export const GET = (request: Request) => handleHost(request);
export default { fetch: handleHost };
