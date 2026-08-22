export type WordPressConfig = {
  siteUrl: string;
  username: string;
  applicationPassword: string;
};

export type WordPressConnectionInput = Partial<WordPressConfig>;

const PRIVATE_HOSTS = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/,
];

export function wordpressConfigured() {
  return Boolean(
    process.env.WORDPRESS_SITE_URL &&
      process.env.WORDPRESS_USERNAME &&
      process.env.WORDPRESS_APPLICATION_PASSWORD,
  );
}

function normalizeWordPressConfig(input: WordPressConnectionInput): WordPressConfig {
  const rawSiteUrl = input.siteUrl?.trim() || "";
  const username = input.username?.trim() || "";
  const applicationPassword = input.applicationPassword?.replace(/\s+/g, "") || "";

  if (!rawSiteUrl || !username || !applicationPassword) {
    throw new Error(
      "Complete the WordPress site URL, username, and Application Password.",
    );
  }

  const siteUrl = rawSiteUrl.replace(/\/$/, "");
  const parsed = new URL(siteUrl);
  if (parsed.protocol !== "https:") {
    throw new Error("The connected WordPress website must use HTTPS.");
  }

  if (PRIVATE_HOSTS.some((pattern) => pattern.test(parsed.hostname))) {
    throw new Error("Local and private WordPress websites are not supported.");
  }

  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";

  return {
    siteUrl: parsed.toString().replace(/\/$/, ""),
    username,
    applicationPassword,
  };
}

export function getWordPressConfig(
  connection?: WordPressConnectionInput,
): WordPressConfig {
  if (connection?.siteUrl || connection?.username || connection?.applicationPassword) {
    return normalizeWordPressConfig(connection);
  }

  if (!wordpressConfigured()) {
    throw new Error(
      "WordPress is not connected yet. Enter the site’s WordPress connection first.",
    );
  }

  return normalizeWordPressConfig({
    siteUrl: process.env.WORDPRESS_SITE_URL,
    username: process.env.WORDPRESS_USERNAME,
    applicationPassword: process.env.WORDPRESS_APPLICATION_PASSWORD,
  });
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
