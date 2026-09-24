import { userActionRoute } from "../../../lib/ai-control.mjs";
import { aiFetch } from "../../../lib/ai-control.mjs";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import sanitizeHtml from "sanitize-html";
import sharp from "sharp";
import { getClientProfileAsync } from "@/lib/client-store";
import { getGoogleAccessToken, getGoogleEmail } from "@/lib/google";
import {
  approveContentImageReview,
  getContentImageReview,
  saveContentImageReview,
} from "@/lib/image-review-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ImageReviewInput = {
  action?: "generate" | "approve";
  reviewId?: string;
  clientId?: string;
  website?: string;
  docId?: string;
  title?: string;
  practiceArea?: string;
  primaryKeyword?: string;
  jurisdiction?: string;
  workflow?: "create" | "blog" | "aop" | "subaop";
};

function allowedPublisher(email: string | null) {
  if (!email) return false;
  const allowed = (process.env.WORDPRESS_ALLOWED_GOOGLE_EMAILS || "accounts@amplifylaw.ai")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

function plainText(value: string) {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "content-image";
}

function visualDirection(topic: string) {
  const signals = topic.toLowerCase();
  const plans = [
    {
      matches: /\b(nursing home|assisted living|elder abuse|bed sore)\b/,
      scene: "a bright, well-maintained long-term care environment with a caregiver assisting an older adult from a respectful distance; no visible injury and no identifiable medical information",
      alt: "Caregiver assisting an older adult in a long-term care setting",
    },
    {
      matches: /\b(truck|tractor[- ]trailer|18[- ]wheeler|semi)\b/,
      scene: "a full-size unbranded commercial tractor-trailer as the unmistakable primary vehicle in a realistic roadway environment; no collision spectacle and no readable license plate",
      alt: "Commercial tractor-trailer in a roadway environment",
    },
    {
      matches: /\b(car accident|auto accident|vehicle crash|motor vehicle)\b/,
      scene: "passenger vehicles in a realistic roadway setting after a minor collision, with no visible injuries, no emergency spectacle, and no readable license plates",
      alt: "Passenger vehicles in a roadway setting after a minor collision",
    },
    {
      matches: /\b(medical malpractice|birth injury|hospital|surgical|misdiagnosis)\b/,
      scene: "a calm modern clinical environment with medical professionals reviewing care information, no readable records, and no identifiable patient",
      alt: "Medical professionals reviewing information in a clinical setting",
    },
    {
      matches: /\b(construction|worksite|jobsite|scaffold)\b/,
      scene: "an active construction site with clearly visible safety equipment and workers shown only at a distance",
      alt: "Construction site with visible safety equipment",
    },
    {
      matches: /\b(slip|trip|premises|unsafe property|fall)\b/,
      scene: "an ordinary property entrance or walkway with one clearly visible maintenance hazard and no injured person",
      alt: "Property walkway with a visible maintenance hazard",
    },
    {
      matches: /\b(bicycle|cyclist|e-?bike)\b/,
      scene: "a cyclist traveling through an ordinary street environment with nearby vehicles and no collision",
      alt: "Cyclist traveling through an ordinary street environment",
    },
    {
      matches: /\b(motorcycle|motorcyclist)\b/,
      scene: "a helmeted motorcyclist riding near passenger vehicles on a realistic roadway without a collision",
      alt: "Helmeted motorcyclist on a roadway",
    },
    {
      matches: /\b(wrongful death|fatal accident|fatal crash)\b/,
      scene: "a quiet, respectful consultation setting with warm natural light that suggests support without depicting grief",
      alt: "Quiet consultation setting with warm natural light",
    },
  ];
  return plans.find((plan) => plan.matches.test(signals)) || {
    scene: "one realistic everyday environment that directly represents the specific practical problem named in the article title",
    alt: "Editorial scene related to the article topic",
  };
}

async function generatedBytes(prompt: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI image generation is not configured for content images.");
  }
  const openai = new OpenAI({ fetch: aiFetch, maxRetries: 0,  apiKey: process.env.OPENAI_API_KEY });
  const generated = await openai.images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
    size: "1536x1024",
    quality: "high",
    prompt,
  });
  const image = generated.data?.[0] as { b64_json?: string; url?: string } | undefined;
  if (image?.b64_json) return Buffer.from(image.b64_json, "base64");
  if (image?.url) {
    const response = await fetch(image.url, { cache: "no-store" });
    if (!response.ok) throw new Error("The generated image could not be downloaded.");
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error("OpenAI did not return a featured image.");
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id") || "";
    const review = await getContentImageReview(id);
    if (!review) return NextResponse.json({ error: "This image preview has expired." }, { status: 404 });
    const bytes = Buffer.from(review.imageBase64, "base64");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": review.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The image preview could not be opened.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handlePOST(request: NextRequest) {
  try {
    const input = await request.json() as ImageReviewInput;
    const accessToken = await getGoogleAccessToken();
    const googleEmail = await getGoogleEmail(accessToken);
    if (!allowedPublisher(googleEmail)) {
      return NextResponse.json({ error: "This Google account is not allowed to review publishing images." }, { status: 403 });
    }

    if (input.action === "approve") {
      const review = await getContentImageReview(input.reviewId || "");
      if (!review) return NextResponse.json({ error: "This image preview has expired. Generate another image." }, { status: 404 });
      if (review.clientId !== input.clientId || review.docId !== input.docId) {
        return NextResponse.json({ error: "This image does not belong to the selected content item." }, { status: 409 });
      }
      const approved = await approveContentImageReview(review.id);
      return NextResponse.json({ ok: true, approvedAt: approved?.approvedAt });
    }

    const docId = input.docId?.trim() || "";
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(docId)) {
      return NextResponse.json({ error: "The approved Google Doc is missing." }, { status: 400 });
    }
    const client = await getClientProfileAsync(input.clientId, input.website, accessToken);
    if (!client) return NextResponse.json({ error: "The selected AMPLIFY client could not be found." }, { status: 404 });
    const title = plainText(input.title || input.practiceArea || "").slice(0, 180);
    if (!title) return NextResponse.json({ error: "The content title is missing." }, { status: 400 });
    const practiceArea = plainText(input.practiceArea || "").slice(0, 120);
    const primaryKeyword = plainText(input.primaryKeyword || "").slice(0, 140);
    const jurisdiction = plainText(input.jurisdiction || "").slice(0, 120);
    const plan = visualDirection(`${title} ${practiceArea} ${primaryKeyword}`);
    const prompt = `Never depict a person lying, sprawled, collapsed, or injured on the ground or roadway. Avoid staged victim reenactments; prefer relevant vehicles, property conditions, or aftermath without people. Any people must be upright and non-distressed. Create a photorealistic wide 3:2 editorial featured photograph for a law-firm ${input.workflow || "content"} page.

Article title: “${title}”
Publisher: ${plainText(client.name).slice(0, 100)}
Practice area: ${practiceArea || "infer from the title"}
Primary search topic: ${primaryKeyword || "infer from the title"}
Jurisdiction: ${jurisdiction || client.jurisdictions[0] || "the client’s service area"}

Show: ${plan.scene}. Make the subject immediately relevant to the title. Use an authentic, calm, contemporary documentary style suitable for a respected law firm. Make the architecture, road design, vegetation, weather, and density plausible for the supplied jurisdiction without pretending to depict a named landmark or real event. Compose for a responsive website crop with a clear subject and natural depth.

Do not include any headline, caption, letters, digits, pseudo-text, logo, phone number, branding, watermark, readable sign, license-plate characters, attorney portrait, courtroom symbolism, gore, visible injury, distressed face, identifiable private information, or sensational scene.`;
    const source = await generatedBytes(prompt);
    if (source.byteLength < 10_000) throw new Error("The generated image was incomplete. Try again.");
    const jpeg = await sharp(source)
      .rotate()
      .resize(1200, 800, { fit: "cover", position: "attention" })
      .jpeg({ quality: 84, chromaSubsampling: "4:4:4" })
      .toBuffer();
    const id = randomUUID();
    const altText = `${plan.alt}${jurisdiction ? ` in ${jurisdiction}` : ""}`.slice(0, 160);
    await saveContentImageReview({
      id,
      clientId: client.id,
      docId,
      title,
      altText,
      fileName: `${slugify(`${client.id}-${title}-${id.slice(0, 8)}`)}.jpg`,
      mimeType: "image/jpeg",
      imageBase64: jpeg.toString("base64"),
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({
      ok: true,
      reviewId: id,
      imageUrl: `/api/image-review?id=${encodeURIComponent(id)}`,
      altText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The image could not be generated.";
    console.error("[image-review]", message);
    const status = /not connected|reconnect|expired|authorized/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const POST = userActionRoute("Generate or review content image", handlePOST);
