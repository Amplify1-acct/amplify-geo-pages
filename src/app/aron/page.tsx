import type { Metadata } from "next";
import AronReview from "./review-client";

export const metadata: Metadata = {
  title: "Aron Review | AMPLIFY Content",
  description: "Open AMPLIFY content drafts and record Aron’s approval.",
  robots: { index: false, follow: false },
};

export default function AronReviewPage() {
  return <AronReview />;
}
