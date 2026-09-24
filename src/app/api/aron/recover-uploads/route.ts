import { userActionRoute } from "@/lib/ai-control.mjs";
import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { getGoogleAccessToken, getGoogleEmail, GOOGLE_REFRESH_COOKIE } from "@/lib/google";
import { isAronReviewer } from "@/lib/aron-review-queue";
import { recoverWordPressUploads } from "@/lib/wordpress-upload-recovery";
import { drainWordPressUploads } from "@/lib/wordpress-upload-worker";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
async function recoverRequested(_request: Request) {
  try {
    const token = await getGoogleAccessToken();
    const email = await getGoogleEmail(token);
    const credential = (await cookies()).get(GOOGLE_REFRESH_COOKIE)?.value;
    if (!email || !credential || !isAronReviewer(email)) return NextResponse.json({error:"Connect an approved AMPLIFY Google account."},{status:403});
    const result = await recoverWordPressUploads(token, email, credential, true);
    after(async () => { await drainWordPressUploads(); });
    return NextResponse.json({ok:true,...result});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Recovery failed."},{status:500});
  }
}

export const POST=userActionRoute("Recover approved WordPress drafts",recoverRequested);
