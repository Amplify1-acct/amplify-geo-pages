import { authorizedAmplifyUser } from "@/lib/permissions";
import { validateAmplifyFaqHtml } from "@/lib/faq-standard";
import { NextRequest, NextResponse } from "next/server";
import { getClientProfileAsync } from "@/lib/client-store";
import { getGoogleAccessToken } from "@/lib/google";
import { getWordPressConfigAsync, wordPressAuthorization } from "@/lib/wordpress";

export const dynamic = "force-dynamic";

type BridgeResponse = {
  ready?: boolean;
  version?: string;
  yoastActive?: boolean;
  supportedPostTypes?: string[];
};

async function wpCheck(url: string, authorization: string) {
  return fetch(url, { headers: { Authorization: authorization }, cache: "no-store" });
}

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId") || undefined;
  const fullHealth = request.nextUrl.searchParams.get("full") === "1";
  let accessToken: string | undefined;
  try {
    accessToken = await getGoogleAccessToken();
  } catch {
    // Environment-backed profiles can still be checked before Google is connected.
  }
  const client = await getClientProfileAsync(clientId, undefined, accessToken);
  if (!client?.wordpress) {
    return NextResponse.json({
      configured: false,
      connected: false,
      bridgeConnected: false,
      clientId: client?.id || clientId || null,
      siteUrl: client?.website || null,
    });
  }

  try {
    const config = await getWordPressConfigAsync(client.id, undefined, accessToken);
    const siteUrl = new URL(config.siteUrl).origin;
    const authorization = wordPressAuthorization(config);
    const auditPostId = Number(request.nextUrl.searchParams.get("postId"));
    if (Number.isInteger(auditPostId) && auditPostId > 0) {
      await authorizedAmplifyUser();
      const response = await wpCheck(`${config.siteUrl}/wp-json/wp/v2/posts/${auditPostId}?context=edit&_fields=id,status,date_gmt,link,title,content`, authorization);
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        return NextResponse.json({ error: "WordPress could not confirm this scheduled post." }, { status: 502 });
      }
      const post = await response.json();
      return NextResponse.json({ id: post.id, status: post.status, dateGmt: post.date_gmt,
        title: post.title?.raw || post.title?.rendered, link: post.link,
        faq: validateAmplifyFaqHtml(post.content?.raw || "", config.siteUrl),
      });
    }
    const pages = await wpCheck(
      `${config.siteUrl}/wp-json/wp/v2/pages?context=edit&per_page=1&_fields=id`,
      authorization,
    );
    if (!pages.ok) {
      const cloudflareChallenge = pages.headers.get("cf-mitigated") === "challenge";
      return NextResponse.json({
        configured: true,
        connected: false,
        siteUrl,
        clientId: config.clientId,
        bridgeConnected: false,
        message: cloudflareChallenge
          ? "Cloudflare is challenging the WordPress REST API. Check Cloudflare Security Events for the matching request. If Bot Fight Mode caused it, disable that mode or upgrade to Super Bot Fight Mode; otherwise add a narrowly scoped skip rule for AMPLIFY’s /wp-json/ requests."
          : pages.status === 401 || pages.status === 403
            ? "WordPress rejected the username or Application Password."
            : "WordPress is configured but its Pages API could not be reached.",
      });
    }
    if (!fullHealth) {
      return NextResponse.json({
        configured: true,
        connected: true,
        clientId: config.clientId,
        siteUrl,
        pagesConnected: true,
        bridgeConnected: false,
      });
    }
    const [posts, media, bridge, user] = await Promise.all([
      wpCheck(`${config.siteUrl}/wp-json/wp/v2/posts?context=edit&per_page=1&_fields=id`, authorization),
      wpCheck(`${config.siteUrl}/wp-json/wp/v2/media?context=edit&per_page=1&_fields=id`, authorization),
      wpCheck(`${config.siteUrl}/wp-json/amplify-geo/v1/status`, authorization),
      wpCheck(`${config.siteUrl}/wp-json/wp/v2/users/me?context=edit&_fields=id,name`, authorization),
    ]);
    const bridgeData = await bridge.json().catch(() => ({})) as BridgeResponse;
    const userData = await user.json().catch(() => ({})) as { id?: number; name?: string };
    const authorId = client.blogDefaults.authorId;
    const categoryId = client.blogDefaults.categoryId;
    const [author, category] = await Promise.all([
      authorId
        ? wpCheck(`${config.siteUrl}/wp-json/wp/v2/users/${authorId}?context=edit&_fields=id,name`, authorization)
        : Promise.resolve(null),
      categoryId
        ? wpCheck(`${config.siteUrl}/wp-json/wp/v2/categories/${categoryId}?context=edit&_fields=id,name`, authorization)
        : Promise.resolve(null),
    ]);
    return NextResponse.json({
      configured: true,
      connected: true,
      clientId: config.clientId,
      siteUrl,
      pagesConnected: pages.ok,
      postsConnected: posts.ok,
      mediaConnected: media.ok,
      currentUser: user.ok ? userData : null,
      bridgeConnected: bridge.ok && bridgeData.ready === true,
      bridgeVersion: bridgeData.version || null,
      yoastActive: bridgeData.yoastActive === true,
      supportedPostTypes: Array.isArray(bridgeData.supportedPostTypes) ? bridgeData.supportedPostTypes : [],
      blogAuthorConfigured: Boolean(authorId),
      blogAuthorValid: author ? author.ok : false,
      blogCategoryConfigured: Boolean(categoryId),
      blogCategoryValid: category ? category.ok : false,
    });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      connected: false,
      bridgeConnected: false,
      clientId: client?.id || clientId || null,
      siteUrl: client?.website || null,
      message: error instanceof Error ? error.message : "The WordPress connection could not be checked.",
    });
  }
}
