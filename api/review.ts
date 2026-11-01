import {handleReview} from '../server/review-submission.ts';
export const POST=(request:Request)=>handleReview(request);
export default {fetch:POST};
