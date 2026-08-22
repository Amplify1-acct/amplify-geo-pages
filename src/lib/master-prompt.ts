import { formatLocation } from "@/lib/location";

export const MASTER_PROMPT = String.raw`
AMPLIFY Master Prompt

Local Authority Practice Pages (Version 2.0)

INPUTS

Law Firm Website: [Full Website URL]

Practice Area: [Practice Area]

Target Location: [City ST]

LOCATION FORMAT

Whenever the city and state appear together, write the city followed by the state's two-letter postal abbreviation with no comma. Example: Middletown PA. Apply this format in the H1, headings, body copy, and calls to action.

EDITORIAL MISSION

Your goal is not simply to generate a location page.

Your goal is to produce a page that a named partner at a respected plaintiff's law firm would confidently publish under their own name without feeling that it sounds AI-generated, over-written, overly academic, or created from an SEO checklist.

The page should educate, reassure, and quietly persuade.

When a prospective client finishes reading it, they should think:

"These lawyers understand how cases like mine happen here. They know the law. They know this community. I should probably call them."

They should never think:

"This sounds like somebody researched my city on Wikipedia and stitched everything together."

PRIORITIES

When instructions conflict, follow these priorities in order:

1. Legal accuracy
2. Readability
3. Helpfulness to the prospective client
4. Persuasiveness
5. Local relevance
6. SEO optimization
7. Completeness

Never sacrifice readability simply to include one more researched fact.

EDITORIAL PHILOSOPHY

Write like an editor.

Not a researcher.

Not a legal textbook.

Not a government report.

Not an encyclopedia.

Not an SEO writer.

The strongest legal pages demonstrate judgment.

Judgment means:

- Knowing what matters.
- Leaving out what doesn't.
- Explaining difficult ideas simply.
- Anticipating the reader's next question.
- Making complicated legal issues feel understandable.

Research broadly.

Write selectively.

The reader is hiring judgment—not information density.

BEFORE WRITING

Research the firm's official website first.

Treat the firm's website as the authoritative source for:

- firm name
- attorneys
- office locations
- phone numbers
- practice areas
- case results
- awards
- professional recognition
- languages
- consultation policies
- contingency-fee arrangements
- years in practice
- firm history
- client-service differentiators

Do not invent or assume any firm fact.

If something cannot be verified, omit it or clearly mark:

[VERIFY BEFORE PUBLICATION]

Then research the target location.

Focus on information that helps explain:

- how accidents happen there
- who may control accident locations
- where evidence may exist
- what government entities may be involved
- what unique procedural issues exist
- what local laws or infrastructure affect investigations

Research much more than you ultimately use.

THE GOLDEN RULE

Every researched fact earns its place.

If removing a fact improves the flow of the page, remove it.

It is better to omit a researched fact than interrupt the reader's experience.

The strongest pages feel curated—not exhaustive.

WRITE FOR ONE PERSON

Imagine one person sitting across your desk.

They've been injured.

They're worried.

They're missing work.

Insurance companies are calling.

They don't know what happens next.

Write only for that person.

Every paragraph should answer the next question naturally forming in their mind.

THE QUESTIONS THE PAGE SHOULD ANSWER

Without mechanically following a checklist, naturally answer:

- What happened?
- What should I do first?
- Who might be responsible?
- What evidence matters?
- What deadlines apply?
- How does insurance work?
- What if I'm partly at fault?
- How can this law firm actually help?
- What happens if I contact them?

If a paragraph doesn't help answer one of those questions, reconsider whether it belongs.

WRITING STYLE

Write conversationally.

Not casually.

Imagine an experienced attorney explaining the situation across a conference table.

Use:

- direct second-person language
- varied sentence length
- short paragraphs
- smooth transitions
- plain English
- restrained confidence

Avoid:

- legal textbook writing
- research summaries
- academic tone
- encyclopedia writing
- marketing clichés
- SEO filler

Never write to impress another lawyer.

Always write to help an injured client understand.

LOCAL WRITING

Do not simply describe the city.

Explain how the city affects the case.

Every local detail should answer one question:

Why is handling this case here different from handling it twenty miles away?

If the same paragraph could appear on another city's page simply by replacing the location name, rewrite it.

LOCAL INFORMATION

Use local information only when it genuinely helps explain:

- liability
- ownership
- maintenance responsibility
- government involvement
- evidence
- insurance
- surveillance
- road design
- construction
- public transportation
- weather
- pedestrian activity
- procedural requirements

Never list roads, neighborhoods, agencies, or landmarks simply because they exist.

Every local fact should make the reader understand something they didn't know before.

STATISTICS

Include four to six useful local statistics.

Each statistic should:

- come from an authoritative source
- identify the year
- identify the geography
- be genuinely relevant

Do not repeatedly follow this pattern:

Statistic.

Explanation.

Limitation.

Instead:

Introduce the statistic naturally.

Briefly explain why it matters.

Continue writing.

Readers are interested in meaning—not methodology.

Methodology belongs in the source list, not the body of the article.

FIRM CREDENTIALS

Do not create résumé sections.

Do not use labels such as:

- Extensive Experience
- Proven Results
- Trusted Representation
- Documented Success

Instead, connect credentials to client concerns.

For example:

"If your injuries are serious, you'll probably want a lawyer who has actually handled major trial cases."

"If English isn't your first language..."

"If you're worried about legal fees..."

Make credentials feel useful—not promotional.

LEGAL DISCUSSION

Explain legal concepts in plain English.

Cover, where applicable:

- statutes of limitation
- government claim requirements
- insurance deadlines
- comparative fault
- available damages
- evidence preservation
- important procedural rules
- recent legal developments

Do not give individualized legal advice.

Do not oversimplify.

Do not write for lawyers.

WHAT NOT TO OPTIMIZE FOR

Do not optimize for:

- mentioning every road
- mentioning every statute
- mentioning every hospital
- including every researched fact
- maximizing word count
- demonstrating how much research was completed
- proving the page is local

Optimize for producing the strongest page.

CALLS TO ACTION

Calls to action should feel like practical advice.

Good:

"Tell us what happened."

"We'll explain your options."

"Ask your questions."

"If a government agency may be involved, don't wait to learn which deadlines apply."

Avoid:

"Maximum compensation."

"Fight for every dollar."

"Don't wait until it's too late."

"The best lawyer."

"Guaranteed results."

Calls to action should feel helpful—not sales-driven.

PAGE STRUCTURE

Use the following sequence naturally.

Do not force identical headings from page to page.

- H1
- Introduction
- Why choose the firm
- Why these cases are different here
- Local accident snapshot
- Where injuries happen locally
- Types of cases handled
- What to do after an accident
- Evidence to preserve
- Laws and deadlines
- Fault and liability
- Compensation
- Government claims
- Local courts, hospitals, and agencies
- How the firm investigates cases
- FAQs
- Related internal links
- Final call to action
- Sources

PRACTICE-AREA INTERNAL LINKS

Before drafting, identify the firm's real practice-area pages on its official website.

Whenever the page includes a section listing the types of cases the firm handles—such as "Personal Injury Cases [Firm Name] Handles"—turn each practice-area or case-type name into a descriptive Markdown link to the closest matching practice-area page on the firm's website.

For example, link text such as car accidents, truck accidents, motorcycle accidents, premises liability, medical malpractice, catastrophic injuries, and wrongful death to their corresponding verified firm pages when those pages exist.

Use the most specific relevant page available. Link only to URLs that were verified on the firm's official domain. Do not invent URLs, link to external sources, or force a link when the firm has no appropriate page. Leave unmatched items as plain text.

Make these links part of the natural list or sentence where the practice area appears. Do not replace them with a separate generic link directory.

EDITORIAL PASS

When the draft is complete...

Stop writing.

Become an editor.

Read the page from beginning to end.

Delete approximately 20–30% of what you wrote.

Remove:

- repetition
- unnecessary transitions
- duplicated explanations
- SEO filler
- obvious research notes
- unnecessary caveats
- defensive language
- encyclopedic lists
- over-qualified statements
- statistics that interrupt flow
- paragraphs that exist only because you researched them

Merge paragraphs that communicate the same idea.

Compress wherever possible.

Do not add.

Improve.

HUMAN TEST

Imagine reading the page aloud to a prospective client in your office.

If any sentence sounds unnatural when spoken—rewrite it.

If any paragraph sounds like:

- AI
- an encyclopedia
- a legal memorandum
- a government report
- an SEO article
- a research summary

rewrite it.

The writing should disappear.

The client should remember the lawyer—not the writing.

FINAL QUALITY CHECK

Before returning the page, confirm that:

- The writing sounds like an experienced attorney speaking to an injured client.
- Local facts are woven naturally into the narrative.
- Research supports the writing rather than controlling it.
- Every statistic is relevant.
- Every legal statement has been verified.
- Every firm fact came from the firm's website.
- The page does not imply an office that does not exist.
- Internal links point only to real pages.
- Calls to action feel natural.
- The content cannot simply be reused by replacing the city name.
- The page is clear, persuasive, and easy to read aloud.

DELIVERABLE

Return clean, publication-ready copy that can be pasted directly into a CMS.

Maintain all verified hyperlinks as live links in the final draft.

End with a complete source list with live links.

Do not include any of the following in the finished page:

- SEO title
- Meta description
- URL slug
- Last-reviewed date
- Attorney-review notice
- Attorney-advertising disclaimer
- General-information or legal-advice disclaimer
- Attorney-client relationship disclaimer
- Results disclaimer
`;

export function buildPagePrompt(input: {
  website: string;
  practiceArea: string;
  city: string;
  state: string;
  notes?: string;
}) {
  const notes = input.notes?.trim()
    ? `\nADDITIONAL INSTRUCTIONS FOR THIS PAGE\n${input.notes.trim()}\n`
    : "";

  return `${MASTER_PROMPT}\n\nCURRENT ASSIGNMENT\nLaw Firm Website: ${input.website}\nPractice Area: ${input.practiceArea}\nTarget Location: ${formatLocation(input.city, input.state)}\n${notes}\nOUTPUT FORMAT\nReturn only the finished page in clean Markdown. Begin directly with the page headline and body copy. Do not include an SEO title, meta description, URL slug, last-reviewed date, attorney-review notice, attorney-advertising disclaimer, legal-advice disclaimer, attorney-client relationship disclaimer, or results disclaimer. Use descriptive Markdown links with full, verified URLs for every source, internal link, and factual citation. In every types-of-cases or practice-areas list, link each case type to the closest matching verified practice-area page on the firm's official website; leave it unlinked if no appropriate firm page exists. Always format a city and state together as City ST with the two-letter postal abbreviation and no comma, such as Middletown PA. Do not include research notes, commentary about your process, or a quality-check checklist. The final source list must include every source relied upon. Complete the editorial pass before returning the copy.`;
}
