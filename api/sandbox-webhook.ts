import { handleSandboxWhopWebhook } from '../server/checkout.ts';
export const POST = (request:Request) => handleSandboxWhopWebhook(request);
export const GET = (request:Request) => handleSandboxWhopWebhook(request);
export default {fetch:POST};
