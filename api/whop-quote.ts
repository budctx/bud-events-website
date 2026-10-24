import { handleWhopQuote } from '../server/whop-preflight.ts';
export const POST = (request:Request)=>handleWhopQuote(request);
export const GET = (request:Request)=>handleWhopQuote(request);
export default {fetch:POST};
