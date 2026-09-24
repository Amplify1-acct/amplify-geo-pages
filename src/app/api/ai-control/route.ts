import {setAIPaused,isAIPaused} from '../../../lib/ai-control.mjs';
import {getGoogleAccessToken,getGoogleEmail} from '@/lib/google';
import {isAronReviewer} from '@/lib/aron-review-queue';
export const runtime='nodejs';
export async function POST(request:Request){
 try {
  const email=await getGoogleEmail(await getGoogleAccessToken()); if(!isAronReviewer(email))return Response.json({error:'Editor access required'},{status:403});
  const body=await request.json();
  if(typeof body.paused!=='boolean')return Response.json({error:'paused must be true or false'},{status:400});
  await setAIPaused(body.paused);
  return Response.json({paused:await isAIPaused()});
 }catch(error){if(error instanceof Response)return error;return Response.json({error:error instanceof Error?error.message:'AI controls unavailable'},{status:503});}
}
