import { cookies } from "next/headers";
import { getGoogleEmail, GOOGLE_REFRESH_COOKIE } from "@/lib/google";
import { isAronReviewer } from "@/lib/aron-review-queue";
import { saveDocUploadConnection } from "@/lib/wordpress-upload-store";

// Called only after the app creates or verifies a Doc with the creator token.
export async function rememberCreatedDocConnection(docId:string,accessToken:string) {
  const email=await getGoogleEmail(accessToken);
  const credential=(await cookies()).get(GOOGLE_REFRESH_COOKIE)?.value;
  if(email&&credential&&isAronReviewer(email))await saveDocUploadConnection(docId,{email,credential});
}
