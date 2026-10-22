import { handleWhopWebhook } from '../server/commerce.ts';
export const POST = (request: Request) => handleWhopWebhook(request);
export const GET = (request: Request) => handleWhopWebhook(request);
export default { fetch: handleWhopWebhook };
