import {handlePrice} from '../server/price.ts';
import { handleCheckoutRoute } from '../server/commerce-routing.ts';
export const POST = (request: Request) => handleCheckoutRoute(request);
export const GET = (request: Request) => handlePrice(request);
export default { fetch: (request:Request)=>request.method==='GET'?GET(request):POST(request) };
