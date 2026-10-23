import { handleAuth } from '../server/auth.ts';
export const POST = (request: Request) => handleAuth(request);
export const GET = (request: Request) => handleAuth(request);
// Keep Vercel's runtime context separate from the handler's optional test environment.
export default { fetch: POST };
