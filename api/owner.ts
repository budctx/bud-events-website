import { handleOwner } from '../server/owner.ts';
import { handlePartners } from '../server/partners.ts';
export const POST = (request: Request) => handleOwner(request);
export const GET = (request: Request) => new URL(request.url).searchParams.get('public') === 'partners'
  ? handlePartners(request) : handleOwner(request);
export default { fetch: (request: Request) => request.method === 'GET' ? GET(request) : POST(request) };
