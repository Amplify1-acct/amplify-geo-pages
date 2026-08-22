export type WordPressConfig = {
  siteUrl: string;
  username: string;
  applicationPassword: string;
};

export function wordpressConfigured() {
  return Boolean(
    process.env.WORDPRESS_SITE_URL &&
      process.env.WORDPRESS_USERNAME &&
      process.env.WORDPRESS_APPLICATION_PASSWORD,
  );
}

export function getWordPressConfig(): WordPressConfig {
  if (!wordpressConfigured()) {
    throw new Error(
      "WordPress is not connected yet. Add the WordPress settings in Vercel first.",
    );
  }

  const siteUrl = process.env.WORDPRESS_SITE_URL!.trim().replace(/\/$/, "");
  const parsed = new URL(siteUrl);
  if (parsed.protocol !== "https:") {
    throw new Error("The connected WordPress website must use HTTPS.");
  }

  return {
    siteUrl,
    username: process.env.WORDPRESS_USERNAME!.trim(),
    applicationPassword: process.env.WORDPRESS_APPLICATION_PASSWORD!.replace(/\s+/g, ""),
  };
}

export function wordPressAuthorization(config: WordPressConfig) {
  return `Basic ${Buffer.from(
    `${config.username}:${config.applicationPassword}`,
    "utf8",
  ).toString("base64")}`;
}

export function wordPressRequestHeaders(config: WordPressConfig) {
  return {
    Authorization: wordPressAuthorization(config),
    Accept: "application/json",
    "User-Agent":
      "AMPLIFYGeoPages/1.0 (+https://amplify-geo-pages.vercel.app)",
  };
}
