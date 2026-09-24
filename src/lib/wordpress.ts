import { getClientProfile } from "@/lib/clients";
import { getClientProfileAsync } from "@/lib/client-store";

export type WordPressConfig = {
  clientId: string;
  clientName: string;
  siteUrl: string;
  username: string;
  applicationPassword: string;
  pageTemplate?: string;
};

export function wordpressConfigured(clientId?: string, website?: string) {
  return Boolean(getClientProfile(clientId, website)?.wordpress);
}

export function getWordPressConfig(clientId?: string, website?: string): WordPressConfig {
  const client = getClientProfile(clientId, website);
  if (!client?.wordpress) {
    throw new Error(
      "WordPress is not connected for this client yet. Add the client profile in Vercel first.",
    );
  }

  const siteUrl = client.wordpress.siteUrl.trim().replace(/\/$/, "");
  const parsed = new URL(siteUrl);
  if (parsed.protocol !== "https:") {
    throw new Error("The connected WordPress website must use HTTPS.");
  }

  return {
    clientId: client.id,
    clientName: client.name,
    siteUrl,
    username: client.wordpress.username,
    applicationPassword: client.wordpress.applicationPassword,
    pageTemplate: client.wordpress.pageTemplate,
  };
}

export async function wordpressConfiguredAsync(
  clientId?: string,
  website?: string,
  accessToken?: string,
) {
  return Boolean((await getClientProfileAsync(clientId, website, accessToken))?.wordpress);
}

export async function getWordPressConfigAsync(
  clientId?: string,
  website?: string,
  accessToken?: string,
): Promise<WordPressConfig> {
  const client = await getClientProfileAsync(clientId, website, accessToken);
  if (!client?.wordpress) {
    throw new Error(
      "WordPress is not connected for this client yet. Add it in Client Connections first.",
    );
  }
  const siteUrl = client.wordpress.siteUrl.trim().replace(/\/$/, "");
  const parsed = new URL(siteUrl);
  if (parsed.protocol !== "https:") {
    throw new Error("The connected WordPress website must use HTTPS.");
  }
  return {
    clientId: client.id,
    clientName: client.name,
    siteUrl,
    username: client.wordpress.username,
    applicationPassword: client.wordpress.applicationPassword,
    pageTemplate: client.wordpress.pageTemplate,
  };
}

export function wordPressAuthorization(config: WordPressConfig) {
  return `Basic ${Buffer.from(
    `${config.username}:${config.applicationPassword}`,
    "utf8",
  ).toString("base64")}`;
}
