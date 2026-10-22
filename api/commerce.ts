import { handleCommerce } from '../server/commerce.ts';
export const POST = (request: Request) => handleCommerce(request);
export const GET = (request: Request) => handleCommerce(request);
// Plain Vercel /api entrypoint (this project uses Vite, not Next route.ts).
export default { fetch: handleCommerce };
