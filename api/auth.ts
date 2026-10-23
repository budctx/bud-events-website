import { handleAuth } from '../server/auth.ts';
export const POST = (request: Request) => handleAuth(request);
export const GET = (request: Request) => handleAuth(request);
export default { fetch: handleAuth };
