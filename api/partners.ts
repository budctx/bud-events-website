import { handlePartners } from '../server/partners.ts';
export const GET = (request: Request) => handlePartners(request);
export default { fetch: GET };
