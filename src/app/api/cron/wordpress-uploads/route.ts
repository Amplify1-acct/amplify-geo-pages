import { NextRequest, NextResponse } from "next/server";
import { drainWordPressUploads } from "@/lib/wordpress-upload-worker";
import { drainPublicationLinks } from "@/lib/post-publication-worker";
export const dynamic="force-dynamic";
export const maxDuration=300;
export async function GET(request:NextRequest) {
  if(!process.env.CRON_SECRET||request.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:"Unauthorized."},{status:401});
  const uploads = await drainWordPressUploads();
  const linking = await drainPublicationLinks();
  return NextResponse.json({ uploads, linking });
}
