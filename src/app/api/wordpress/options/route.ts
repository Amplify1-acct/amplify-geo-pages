import { NextRequest, NextResponse } from "next/server";
import { getClientProfileAsync } from "@/lib/client-store";
import { authorizedAmplifyUser } from "@/lib/permissions";
import { getWordPressConfigAsync, wordPressAuthorization } from "@/lib/wordpress";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get("clientId") || undefined;
    const { accessToken } = await authorizedAmplifyUser();
    const client = await getClientProfileAsync(clientId, undefined, accessToken);
    if (!client?.wordpress) {
      return NextResponse.json({ error: "Save the WordPress connection first." }, { status: 400 });
    }
    const config = await getWordPressConfigAsync(client.id, undefined, accessToken);
    const authorization = wordPressAuthorization(config);
    const [usersResponse, categoriesResponse] = await Promise.all([
      fetch(`${config.siteUrl}/wp-json/wp/v2/users?context=edit&per_page=100&_fields=id,name`, {
        headers: { Authorization: authorization }, cache: "no-store",
      }),
      fetch(`${config.siteUrl}/wp-json/wp/v2/categories?context=edit&per_page=100&orderby=count&order=desc&_fields=id,name,count`, {
        headers: { Authorization: authorization }, cache: "no-store",
      }),
    ]);
    const users = await usersResponse.json().catch(() => []) as Array<{ id: number; name: string }> & { message?: string };
    const categories = await categoriesResponse.json().catch(() => []) as Array<{ id: number; name: string; count?: number }> & { message?: string };
    if (!usersResponse.ok || !categoriesResponse.ok) {
      throw new Error(users.message || categories.message || "WordPress authors or categories could not be loaded.");
    }
    return NextResponse.json({ ok: true, users, categories });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WordPress options could not be loaded.";
    const status = /not allowed/i.test(message) ? 403 : /not connected|reconnect|expired/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
