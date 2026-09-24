# Final approval and missed calendar dates

The owner confirmed this workflow on September 9, 2026:

1. The owner selects a topic.
2. AMPLIFY writes the article.
3. Aron approves the writing.
4. The owner authorizes WordPress preparation.
5. AMPLIFY prepares and checks the WordPress draft, including all applicable CTAs, SEO, images, theme text, links, and FAQs.
6. The owner reviews the finished draft and gives final approval.
7. A future calendar slot is scheduled in WordPress. A slot that has passed publishes immediately using the current date. No additional catch-up approval is required.

This change implements step 7 in the existing final-approval action. It does not certify that every earlier workflow stage has been rebuilt or that existing articles are ready to publish.

## Implementation and verification

- `src/lib/blog-publication.ts` selects immediate publication or future scheduling.
- The final-approval UI clearly identifies overdue dates and sends the assigned date to the server even when it has passed.
- The go-live API explicitly sets the current publication date for overdue blogs, preserves future times, and checks that WordPress returns the requested schedule. A mismatched existing schedule is not reported as a successful retry.
- Existing final-approval and FAQ checks remain required.
- Eight focused policy/API tests passed; TypeScript, the production build, and the build's existing FAQ and directory tests passed.

## Deployment status

Production deployment completed September 9, 2026. The stale local Vercel team link was corrected to exsisto-platform-b724e39a after verifying the original project ID was unchanged. Deployment dpl_DofC47g6jfvQWPvnYgPwLrBgczW1 reached READY and was aliased to https://amplify-geo-pages.vercel.app.

The production URL returned HTTP 200; its served JavaScript contains the overdue final-approval confirmation, calendar explanation, and current-date publication message. The API behavior was verified in the eight focused tests before deployment; no real article was published as a test. No article was published or scheduled while implementing this change.
