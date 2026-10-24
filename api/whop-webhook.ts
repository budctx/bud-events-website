import { handleWebhookRoute } from '../server/commerce-routing.ts';
export const POST = (request: Request) => handleWebhookRoute(request);
export const GET = (request: Request) => handleWebhookRoute(request);
export default { fetch: POST };
