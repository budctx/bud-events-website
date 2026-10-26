import { handleOwner } from '../server/owner.ts';
export const POST = (request: Request) => handleOwner(request);
export const GET = (request: Request) => handleOwner(request);
export default { fetch: POST };
