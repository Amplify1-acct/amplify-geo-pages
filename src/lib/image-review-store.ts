import { Redis } from "@upstash/redis";

const IMAGE_REVIEW_PREFIX = "amplify:content-image-review:v1:";
const IMAGE_REVIEW_TTL_SECONDS = 60 * 60 * 48;

export type ContentImageReview = {
  id: string;
  clientId: string;
  docId: string;
  title: string;
  altText: string;
  fileName: string;
  mimeType: "image/jpeg";
  imageBase64: string;
  createdAt: string;
  approvedAt?: string;
};

function imageReviewRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
  if (!url || !token) {
    throw new Error("Image-review storage is not connected. Add an Upstash Redis integration to this Vercel project.");
  }
  return new Redis({ url, token });
}

function key(id: string) {
  return `${IMAGE_REVIEW_PREFIX}${id}`;
}

function decode(value: unknown): ContentImageReview | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as ContentImageReview;
    } catch {
      return null;
    }
  }
  return typeof value === "object" ? value as ContentImageReview : null;
}

export async function saveContentImageReview(review: ContentImageReview) {
  await imageReviewRedis().set(key(review.id), JSON.stringify(review), { ex: IMAGE_REVIEW_TTL_SECONDS });
  return review;
}

export async function getContentImageReview(id: string) {
  if (!/^[A-Za-z0-9-]{20,80}$/.test(id)) return null;
  return decode(await imageReviewRedis().get(key(id)));
}

export async function approveContentImageReview(id: string) {
  const review = await getContentImageReview(id);
  if (!review) return null;
  const approved = { ...review, approvedAt: new Date().toISOString() };
  await saveContentImageReview(approved);
  return approved;
}

export async function deleteContentImageReview(id: string) {
  if (!/^[A-Za-z0-9-]{20,80}$/.test(id)) return;
  await imageReviewRedis().del(key(id));
}
