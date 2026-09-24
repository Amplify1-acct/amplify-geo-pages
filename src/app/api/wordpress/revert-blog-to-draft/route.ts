import { NextRequest, NextResponse } from "next/server";
import { getClientProfileAsync } from "@/lib/client-store";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import { getWordPressConfigAsync, wordPressAuthorization } from "@/lib/wordpress";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type WordPressPost = {
  id?: number;
  link?: string;
  status?: string;
  content?: { raw?: string };
  message?: string;
};

function allowedPublisher(email: string | null) {
  if (!email) return false;
  return (process.env.WORDPRESS_ALLOWED_GOOGLE_EMAILS || "accounts@amplifylaw.ai")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

async function wordPressJson<T>(response: Response, action: string): Promise<T> {
  const text = await response.text();
  if (response.headers.get("cf-mitigated") === "challenge" || /<title>\s*Just a moment/i.test(text)) {
    throw new Error("Cloudflare blocked AMPLIFY while returning the blog to draft. Check the site’s /wp-json/ skip rule, then try again.");
  }
  if (!text.trim()) throw new Error(`WordPress returned an empty response while ${action}.`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`WordPress returned an unexpected response while ${action}.`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json() as {
      clientId?: string;
      postId?: number;
      ownerConfirmed?: boolean;
    };
    const postId = Number(input.postId);
    const accessToken = await getGoogleAccessToken();
    const email = await getGoogleEmail(accessToken);
    if (!allowedPublisher(email)) {
      return NextResponse.json({ error: "This Google account is not allowed to change WordPress publishing status." }, { status: 403 });
    }
    const client = await getClientProfileAsync(input.clientId, undefined, accessToken);
    if (!client?.wordpress || !Number.isInteger(postId) || postId <= 0 || input.ownerConfirmed !== true) {
      return NextResponse.json({ error: "The client, WordPress post, or confirmation is missing." }, { status: 400 });
    }
    const config = await getWordPressConfigAsync(client.id, undefined, accessToken);
    const authorization = wordPressAuthorization(config);
    const lookup = await fetch(
      `${config.siteUrl}/wp-json/wp/v2/posts/${postId}?context=edit&_fields=id,link,status,content`,
      { headers: { Authorization: authorization }, cache: "no-store" },
    );
    const post = await wordPressJson<WordPressPost>(lookup, "opening the published blog");
    if (!lookup.ok || !post.id) throw new Error(post.message || "The WordPress blog could not be opened.");
    if (!(post.content?.raw || "").includes("amplify-blog-source:")) {
      return NextResponse.json({ error: "This post is not a verified AMPLIFY blog. Nothing was changed." }, { status: 409 });
    }
    if (post.status === "draft") {
      return NextResponse.json({
        ok: true,
        postId: post.id,
        status: "draft",
        postUrl: post.link,
        editUrl: `${config.siteUrl}/wp-admin/post.php?post=${post.id}&action=edit`,
        previewUrl: `${config.siteUrl}/?p=${post.id}&preview=true`,
      });
    }
    if (!["publish", "future", "pending"].includes(post.status || "")) {
      return NextResponse.json({ error: `This blog is currently “${post.status}” and cannot be returned to a draft.` }, { status: 409 });
    }
    const update = await fetch(`${config.siteUrl}/wp-json/wp/v2/posts/${post.id}`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
      cache: "no-store",
    });
    const draft = await wordPressJson<WordPressPost>(update, "returning the blog to draft");
    if (!update.ok || draft.status !== "draft" || !draft.id) {
      throw new Error(draft.message || "WordPress did not return the blog to draft.");
    }
    return NextResponse.json({
      ok: true,
      postId: draft.id,
      status: draft.status,
      postUrl: draft.link || post.link,
      editUrl: `${config.siteUrl}/wp-admin/post.php?post=${draft.id}&action=edit`,
      previewUrl: `${config.siteUrl}/?p=${draft.id}&preview=true`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The blog could not be returned to draft.";
    console.error("[wordpress/revert-blog-to-draft]", message);
    const status = /not allowed|connect Google|refresh token|not connected/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
