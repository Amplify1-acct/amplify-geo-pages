import { addFulginitiFaqAnchor } from "../src/lib/schema-permalink.ts";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AMPLIFY_FAQ_COUNT,
  AMPLIFY_FAQ_STANDARD_VERSION,
  deduplicateGeneratedFaqSources,
  addAmplifyFaqAnchors,
  buildAmplifyFaqSchemaNode,
  extractAmplifyFaqSection,
  faqSchemaNodesFromDocument,
  isLikelyAuthoritativeFaqSource,
  validateAmplifyFaqHtml,
  validateAmplifyFaqMarkdown,
  validateAmplifyLiveFaq,
  replacePreparationFaq,
} from "../src/lib/faq-standard.ts";

const officialSources = [
  "https://www.nysenate.gov/legislation/laws/CVP/214",
  "https://pubmed.ncbi.nlm.nih.gov/34105101/",
];

test("Pennsylvania official court sources are recognized without trusting lookalike hosts", () => {
  assert.equal(isLikelyAuthoritativeFaqSource("https://www.pacourts.us/assets/opinions/Supreme/out/example.pdf"), true);
  assert.equal(isLikelyAuthoritativeFaqSource("https://ujsportal.pacourts.us/"), true);
  assert.equal(isLikelyAuthoritativeFaqSource("https://pacourts.us.example.com/"), false);
  assert.equal(isLikelyAuthoritativeFaqSource("https://fakepacourts.us/"), false);
});

test("preparation replaces only the existing FAQ and preserves approved sections and CTA", () => {
  const before = '<h2>Approved topic</h2><p>Do not change this approved paragraph.</p>';
  const old = '<h2>FAQs</h2><p>Old introduction.</p><h3>Old question?</h3><p>Answer.</p>';
  const after = '<section class="amplify-geo-cta"><p>Firm identity</p><h2>Contact</h2><p>Phone</p></section>';
  const replacement = '<h2>New Jersey Injury FAQs</h2><p>Replacement.</p>';
  assert.equal(replacePreparationFaq(before + old + after, replacement), before + replacement + after);
  assert.throws(() => replacePreparationFaq(before, replacement), /identifiable/);
  assert.throws(() => replacePreparationFaq(old + old, replacement), /identifiable/);
});

test("generated duplicate citations are cleaned without weakening source validation", () => {
  const valid = markdownFixture();
  assert.equal(deduplicateGeneratedFaqSources(valid), valid, "reuse across answers is allowed");
  const repeated = valid.replaceAll(`[Practical official guidance](${officialSources[1]})`, `[Practical official guidance](${officialSources[1]}); [Same official guidance](${officialSources[1]})`);
  // Also exercise the actual fixture's labels without depending on their text.
  const duplicate = valid.replaceAll(`](${officialSources[0]})`, `](${officialSources[0]}); [Repeated statute](${officialSources[0]}?utm_source=test#section)`);
  assert.equal(validateAmplifyFaqMarkdown(duplicate).passed, false);
  const cleaned = deduplicateGeneratedFaqSources(duplicate);
  assert.equal(validateAmplifyFaqMarkdown(cleaned).passed, true);
  assert.equal(deduplicateGeneratedFaqSources(cleaned), cleaned);
  assert.equal(validateAmplifyFaqMarkdown(deduplicateGeneratedFaqSources(repeated)).passed, true);
  const onlyOne = valid.replaceAll(officialSources[1], officialSources[0]);
  assert.equal(validateAmplifyFaqMarkdown(deduplicateGeneratedFaqSources(onlyOne)).passed, false, "one distinct source still fails");
  const outside = `Sources: [Official statute](${officialSources[0]}); [Repeat](${officialSources[0]})\n\n`;
  assert.ok(deduplicateGeneratedFaqSources(outside + duplicate).startsWith(outside));
  const prose = `Sources: [Official statute](${officialSources[0]}); [Repeat](${officialSources[0]}) — supporting explanation`;
  assert.ok(deduplicateGeneratedFaqSources(valid + "\n" + prose).endsWith(prose));
  const spanish = markdownFixture({ spanish: true }).replace("## Sources", "## Fuentes").replaceAll(`](${officialSources[0]})`, `](${officialSources[0]}); [Ley repetida](${officialSources[0]})`);
  assert.equal(validateAmplifyFaqMarkdown(deduplicateGeneratedFaqSources(spanish)).passed, true);
});

test("HTML query separators become real citation URLs in schema", () => {
 const html=addAmplifyFaqAnchors(htmlFixture().replaceAll(officialSources[0],"https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&amp;URL=0627.748.html"));
 const node=buildAmplifyFaqSchemaNode(html,"https://example.com/article/");
 assert.equal(node.mainEntity[0].acceptedAnswer.citation[0],"https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0627.748.html");
});

test("a following branded CTA does not become part of the final FAQ answer", () => {
  const html = htmlFixture();
  const cta = '<style>.amplify-geo-cta{color:black}</style><section class="amplify-geo-cta amplify-geo-cta-closing"><p>The Epstein Law Firm</p><h2>Ready to discuss your injury?</h2><p>Call now</p></section>';
  assert.equal(validateAmplifyFaqHtml(html + cta).passed, true);
  assert.deepEqual(extractAmplifyFaqSection(html + cta).entries, extractAmplifyFaqSection(html).entries);
  assert.equal(validateAmplifyFaqHtml(htmlFixture({count:9}) + cta).passed, false);
});

test("the verified client's direct sources are allowed without trusting competitors or search engines", () => {
  const website = "https://www.theepsteinlawfirm.com";
  const ownSource = "https://theepsteinlawfirm.com/contact/";
  const markdown = markdownFixture().replaceAll(officialSources[1], ownSource);
  assert.equal(validateAmplifyFaqMarkdown(markdown).passed, false);
  assert.equal(validateAmplifyFaqMarkdown(markdown, website).passed, true);
  assert.equal(validateAmplifyFaqMarkdown(markdown, "https://anotherlawfirm.example").passed, false);
  for (const prohibited of ["https://competitorlawfirm.example/contact/", "https://theepsteinlawfirm.com.evil.example/contact/", "https://www.google.com/search?q=lawyer", "https://chatgpt.com/answer"]) {
    assert.equal(validateAmplifyFaqMarkdown(markdown.replaceAll(ownSource, prohibited), website).passed, false, prohibited);
  }
  assert.equal(validateAmplifyFaqMarkdown(markdown.replaceAll(officialSources[0], "https://theepsteinlawfirm.com/firm-overview/"), website).passed, false, "firm sources do not replace independent authority");
  const html = htmlFixture().replaceAll(officialSources[1], ownSource);
  assert.equal(validateAmplifyFaqHtml(html, website).passed, true);
  assert.equal(validateAmplifyFaqHtml(html).passed, false);
});

function answerText(index, spanish = false) {
  return spanish
    ? `La respuesta directa ${index} explica primero la regla aplicable en lenguaje sencillo y aclara por qué los hechos, la jurisdicción y la evidencia disponible pueden cambiar el análisis de una reclamación concreta.`
    : `The direct answer ${index} explains the applicable rule first in plain language and clarifies why the facts, jurisdiction, and available evidence can change the analysis of a particular claim.`;
}

function practicalText(index, spanish = false) {
  return spanish
    ? `Como paso práctico ${index}, la persona debe conservar los registros pertinentes, documentar fechas y síntomas con precisión y revisar pronto los plazos con un profesional, sin asumir que una fuente general resuelve su situación individual.`
    : `As a practical next step ${index}, the reader should preserve relevant records, document dates and symptoms accurately, and review deadlines promptly with a professional instead of assuming a general source decides an individual situation.`;
}

function question(index, spanish = false) {
  return spanish
    ? `¿Qué debo saber sobre la pregunta legal número ${index}?`
    : `What should I know about legal question number ${index}?`;
}

function markdownFixture({ count = AMPLIFY_FAQ_COUNT, spanish = false, duplicate = false, omitSourcesAt = 0 } = {}) {
  const parts = [
    "# Test page",
    "",
    spanish
      ? "## Preguntas frecuentes sobre reclamaciones por accidentes en Nueva York"
      : "## New York Accident Claim FAQs: Evidence, Deadlines, and Recovery",
    "",
    spanish
      ? "Estas respuestas ofrecen información general. Los hechos, la jurisdicción y la evidencia disponible pueden cambiar el análisis de una reclamación individual."
      : "These answers provide general information. The facts, jurisdiction, and available evidence can change the analysis of an individual claim.",
    "",
  ];
  for (let index = 1; index <= count; index += 1) {
    parts.push(`### ${question(duplicate && index === count ? 1 : index, spanish)}`);
    parts.push("");
    parts.push(answerText(index, spanish));
    parts.push("");
    parts.push(practicalText(index, spanish));
    parts.push("");
    if (omitSourcesAt !== index) {
      parts.push(`${spanish ? "Fuentes" : "Sources"}: [Official statute](${officialSources[0]}); [Peer-reviewed research](${officialSources[1]}).`);
      parts.push("");
    }
  }
  parts.push("## Sources", "", "- Source index");
  return parts.join("\n");
}

function htmlFixture(options = {}) {
  const markdown = markdownFixture(options);
  return markdown
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .split(/\n\s*\n/)
    .map((block) => /^<h[1-3]>/.test(block) ? block : `<p>${block.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')}</p>`)
    .join("\n");
}

function liveFixture() {
  const pageUrl = "https://example.com/test/";
  const anchored = addAmplifyFaqAnchors(htmlFixture());
  const schema = buildAmplifyFaqSchemaNode(anchored, pageUrl);
  assert.ok(schema);
  const render = (schemaNode) => {
    const script = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": [schemaNode] })}</script>`;
    return `<html><head><link rel="canonical" href="${pageUrl}"></head><body>${anchored}${script}</body></html>`;
  };
  return { pageUrl, schema, render };
}

test("the versioned standard accepts a complete English FAQ set", () => {
  assert.equal(AMPLIFY_FAQ_STANDARD_VERSION, "v1");
  const validation = validateAmplifyFaqMarkdown(markdownFixture());
  assert.equal(validation.passed, true, validation.errors.join("\n"));
  assert.equal(validation.count, 10);
});

test("the standard accepts the Spanish heading and Fuentes labels", () => {
  const validation = validateAmplifyFaqHtml(htmlFixture({ spanish: true }));
  assert.equal(validation.passed, true, validation.errors.join("\n"));
  assert.equal(extractAmplifyFaqSection(htmlFixture({ spanish: true }))?.inLanguage, "es-US");
});

test("the FAQ uses a descriptive SEO heading and a short general-information introduction", () => {
  const generic = markdownFixture().replace(
    "## New York Accident Claim FAQs: Evidence, Deadlines, and Recovery",
    "## Frequently Asked Questions",
  );
  const missingIntroduction = markdownFixture().replace(
    "These answers provide general information. The facts, jurisdiction, and available evidence can change the analysis of an individual claim.\n\n",
    "",
  );
  assert.equal(validateAmplifyFaqMarkdown(generic).passed, false);
  assert.equal(validateAmplifyFaqMarkdown(missingIntroduction).passed, false);
  const pilotHeading = markdownFixture().replace(
    "## New York Accident Claim FAQs: Evidence, Deadlines, and Recovery",
    "## New York E-Bike Accident FAQs: Medical Care, Insurance, and Claims",
  );
  assert.equal(validateAmplifyFaqMarkdown(pilotHeading).passed, true);
});

test("nine, eleven, duplicate, and unsourced FAQ sets are rejected", () => {
  for (const fixture of [
    markdownFixture({ count: 9 }),
    markdownFixture({ count: 11 }),
    markdownFixture({ duplicate: true }),
    markdownFixture({ omitSourcesAt: 4 }),
  ]) {
    assert.equal(validateAmplifyFaqMarkdown(fixture).passed, false);
  }
});

test("FAQ source labels must match the page language", () => {
  const englishWithSpanishLabels = markdownFixture().replace(/^Sources:/gm, "Fuentes:");
  const spanishWithEnglishLabels = markdownFixture({ spanish: true }).replace(/^Fuentes:/gm, "Sources:");
  assert.equal(validateAmplifyFaqMarkdown(englishWithSpanishLabels).passed, false);
  assert.equal(validateAmplifyFaqMarkdown(spanishWithEnglishLabels).passed, false);
});

test("a second FAQ H2 is rejected instead of being ignored", () => {
  const duplicateSection = markdownFixture().replace(
    "\n## Sources\n",
    "\n## Frequently Asked Questions\n\n## Sources\n",
  );
  assert.equal(validateAmplifyFaqMarkdown(duplicateSection).passed, false);
});

test("deceptive hosts containing .gov. are not treated as government sources", () => {
  assert.equal(isLikelyAuthoritativeFaqSource("https://agency.gov.example.com/rule"), false);
  const deceptiveSources = markdownFixture()
    .replaceAll(officialSources[0], "https://agency.gov.example.com/rule")
    .replaceAll(officialSources[1], "https://health.gov.example.com/study");
  assert.equal(validateAmplifyFaqMarkdown(deceptiveSources).passed, false);
});

test("a valid official source does not make a prohibited second source acceptable", async (t) => {
  for (const [name, sourceUrl] of [
    ["competing law-firm article", "https://competitorlawfirm.example/blog/answer"],
    ["search-results page", "https://www.google.com/search?q=legal+answer"],
  ]) {
    await t.test(name, () => {
      const fixture = markdownFixture().replaceAll(officialSources[1], sourceUrl);
      assert.equal(validateAmplifyFaqMarkdown(fixture).passed, false);
    });
  }
});

test("content after an FAQ Sources line is rejected", () => {
  const original = htmlFixture();
  const trailingContent = original.replace(
    /(<p>Sources:[\s\S]*?<\/p>)\n<h3>/,
    "$1\n<ul><li>Trailing advice after the source line.</li></ul>\n<h3>",
  );
  assert.notEqual(trailingContent, original);
  assert.equal(validateAmplifyFaqHtml(trailingContent).passed, false);
});

test("FAQ questions at the wrong heading level are rejected", () => {
  const wrongMarkdownLevel = markdownFixture().replace(/^### (.+)$/m, "#### $1");
  const wrongHtmlLevel = htmlFixture().replace(/<h3>([\s\S]*?)<\/h3>/i, "<h4>$1</h4>");
  assert.equal(validateAmplifyFaqMarkdown(wrongMarkdownLevel).passed, false);
  assert.equal(validateAmplifyFaqHtml(wrongHtmlLevel).passed, false);
});

test("the FAQ must be the final substantive section before Sources", () => {
  const misplaced = markdownFixture().replace(
    "\n## Sources\n",
    "\n## Additional Legal Guidance\n\nThis substantive section appears after the FAQ.\n\n## Sources\n",
  );
  assert.equal(validateAmplifyFaqMarkdown(misplaced).passed, false);
});

test("WordPress anchors and schema use stable visible IDs and citations", () => {
  const anchored = addAmplifyFaqAnchors(htmlFixture());
  const section = extractAmplifyFaqSection(anchored);
  assert.equal(section?.entries.length, 10);
  assert.match(anchored, /<h2[^>]*id="faq"/);
  assert.match(anchored, /<h3[^>]*id="faq-what-should-i-know-about-legal-question-number-1"/);
  assert.match(anchored, /<p[^>]*id="answer-what-should-i-know-about-legal-question-number-1"/);
  assert.match(anchored, /class="faq-sources"/);
  const schema = buildAmplifyFaqSchemaNode(anchored, "https://example.com/test/");
  assert.equal(schema?.inLanguage, "en-US");
  assert.equal(schema?.mainEntity.length, 10);
  assert.deepEqual(schema?.mainEntity[0].acceptedAnswer.citation, officialSources);
  assert.equal(schema?.mainEntity[0].name, section?.entries[0].question);
});

test("live verification requires one schema node with exact visible parity", () => {
  const anchored = addAmplifyFaqAnchors(htmlFixture());
  const schema = buildAmplifyFaqSchemaNode(anchored, "https://example.com/test/");
  const script = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": [schema] })}</script>`;
  const validDocument = `<html><head><link rel="canonical" href="https://example.com/test/"></head><body>${anchored}${script}</body></html>`;
  assert.equal(validateAmplifyLiveFaq(validDocument).passed, true, validateAmplifyLiveFaq(validDocument).errors.join("\n"));
  assert.equal(validateAmplifyLiveFaq(validDocument, "https://example.com/test/").passed, true);
  assert.equal(faqSchemaNodesFromDocument(validDocument).length, 1);
  assert.equal(validateAmplifyLiveFaq(`${validDocument}${script}`).passed, false);
  const mismatched = validDocument.replace("legal question number 1", "different question");
  assert.equal(validateAmplifyLiveFaq(mismatched).passed, false);
  assert.equal(validateAmplifyLiveFaq(validDocument, "https://example.com/wrong/").passed, false);
  assert.equal(validateAmplifyLiveFaq(validDocument.replace("</head>", '<meta name="robots" content="noindex, follow"></head>'), "https://example.com/test/").passed, false);
});

test("live verification rejects missing or incorrect schema identity fields", async (t) => {
  const { pageUrl, schema, render } = liveFixture();
  const cases = [
    ["missing FAQPage @id", (node) => { delete node["@id"]; }],
    ["wrong FAQPage @id", (node) => { node["@id"] = `${pageUrl}#wrong-faq`; }],
    ["missing FAQPage url", (node) => { delete node.url; }],
    ["wrong FAQPage url", (node) => { node.url = `${pageUrl}#wrong-faq`; }],
    ["missing inLanguage", (node) => { delete node.inLanguage; }],
    ["wrong inLanguage", (node) => { node.inLanguage = "es-US"; }],
    ["missing Question @type", (node) => { delete node.mainEntity[0]["@type"]; }],
    ["wrong Question @type", (node) => { node.mainEntity[0]["@type"] = "Thing"; }],
    ["missing Question @id", (node) => { delete node.mainEntity[0]["@id"]; }],
    ["wrong Question @id", (node) => { node.mainEntity[0]["@id"] = `${pageUrl}#wrong-question`; }],
    ["missing Question url", (node) => { delete node.mainEntity[0].url; }],
    ["wrong Question url", (node) => { node.mainEntity[0].url = `${pageUrl}#wrong-question`; }],
    ["missing Answer @type", (node) => { delete node.mainEntity[0].acceptedAnswer["@type"]; }],
    ["wrong Answer @type", (node) => { node.mainEntity[0].acceptedAnswer["@type"] = "Thing"; }],
    ["missing Answer @id", (node) => { delete node.mainEntity[0].acceptedAnswer["@id"]; }],
    ["wrong Answer @id", (node) => { node.mainEntity[0].acceptedAnswer["@id"] = `${pageUrl}#wrong-answer`; }],
    ["missing Answer url", (node) => { delete node.mainEntity[0].acceptedAnswer.url; }],
    ["wrong Answer url", (node) => { node.mainEntity[0].acceptedAnswer.url = `${pageUrl}#wrong-answer`; }],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const mutated = JSON.parse(JSON.stringify(schema));
      mutate(mutated);
      assert.equal(validateAmplifyLiveFaq(render(mutated), pageUrl).passed, false);
    });
  }
});

test("live verification rejects missing visible anchors, competing QAPage, and duplicate canonicals", () => {
  const { pageUrl, schema, render } = liveFixture();
  const valid = render(schema);
  assert.equal(validateAmplifyLiveFaq(valid.replace(' id="faq"', ""), pageUrl).passed, false);
  assert.equal(validateAmplifyLiveFaq(valid.replace(/ id="faq-/, ' data-old-id="faq-'), pageUrl).passed, false);
  assert.equal(validateAmplifyLiveFaq(valid.replace(/ id="answer-/, ' data-old-id="answer-'), pageUrl).passed, false);
  const qaPage = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "QAPage" })}</script>`;
  assert.equal(validateAmplifyLiveFaq(valid.replace("</body>", `${qaPage}</body>`), pageUrl).passed, false);
  assert.equal(validateAmplifyLiveFaq(valid.replace("</head>", `<link href="${pageUrl}" rel="canonical"></head>`), pageUrl).passed, false);
});

test("schema text decodes common entities and citation fragments remain exact", () => {
  const html = addAmplifyFaqAnchors(
    htmlFixture()
      .replace("legal question number 1", "Uber &amp; Lyft question number 1")
      .replaceAll(officialSources[0], `${officialSources[0]}#deadline`),
  );
  const schema = buildAmplifyFaqSchemaNode(html, "https://example.com/test/");
  assert.equal(schema?.mainEntity[0].name.includes("&amp;"), false);
  assert.equal(schema?.mainEntity[0].name.includes("&"), true);
  assert.equal(schema?.mainEntity[0].acceptedAnswer.citation[0], `${officialSources[0]}#deadline`);
});

test("all app prompt builders use the shared standard and contain no stale FAQ count", async () => {
  const files = ["master-prompt.ts", "aop-prompt.ts", "sub-aop-prompt.ts", "blog-prompt.ts", "enhance-prompt.ts"];
  for (const file of files) {
    const source = await readFile(new URL(`../src/lib/${file}`, import.meta.url), "utf8");
    assert.match(source, /AMPLIFY_FAQ_PROMPT/);
    assert.doesNotMatch(source, /exactly 4 distinct H3 questions|Repeat for exactly 4 total questions|Repeat for 3 to 4 total questions|Three or four high-value FAQs/);
  }
});

test("the canonical app pipeline fails closed and legacy page creators are retired", async () => {
  const files = {
    generation: await readFile(new URL("../src/app/api/generate/route.ts", import.meta.url), "utf8"),
    preview: await readFile(new URL("../src/lib/google-doc-content.ts", import.meta.url), "utf8"),
    draft: await readFile(new URL("../src/app/api/wordpress/draft/route.ts", import.meta.url), "utf8"),
    goLive: await readFile(new URL("../src/app/api/wordpress/go-live/route.ts", import.meta.url), "utf8"),
    legacyPublish: await readFile(new URL("../src/app/api/wordpress/publish/route.ts", import.meta.url), "utf8"),
    spanishMirrors: await readFile(new URL("../src/app/api/wordpress/billy-spanish-mirrors/route.ts", import.meta.url), "utf8"),
    yonkersSpanish: await readFile(new URL("../src/app/api/wordpress/billy-yonkers-spanish/route.ts", import.meta.url), "utf8"),
  };
  assert.match(files.generation, /validateAmplifyFaqMarkdown\(markdown, client\.website\)/);
  assert.match(files.preview, /assertAmplifyFaqHtml\(exportedContent, client\?\.website\)/);
  assert.match(files.draft, /assertAmplifyFaqHtml\(extracted\.content, config\.siteUrl\)/);
  assert.match(files.draft, /const anchoredContent = addFulginitiFaqAnchor\(addAmplifyFaqAnchors\(/);
  assert.match(files.draft, /amplify-faq-standard:\$\{AMPLIFY_FAQ_STANDARD_VERSION\}/);
  assert.match(files.goLive, /if \(!currentFaqStandard\)/);
  assert.match(files.goLive, /assertAmplifyFaqHtml\(rawPageContent, config\.siteUrl\)/);
  assert.match(files.goLive, /await verifyPublishedFaq\(updatedPageUrl\)/);
  assert.match(files.goLive, /restored\.status === "draft"/);
  for (const source of [files.legacyPublish, files.spanishMirrors, files.yonkersSpanish]) {
    assert.match(source, /status:\s*410/);
  }
});

test('FAQ parity tolerates block whitespace but rejects changed answer wording', () => {
  const url='https://example.com/article/';
  const compact=addAmplifyFaqAnchors(htmlFixture()).replace(/>\s+</g,'><');
  const schema=buildAmplifyFaqSchemaNode(compact,url);
  const document=`<link rel="canonical" href="${url}">${compact.replaceAll('</p>','</p>\n\n')}<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  assert.equal(validateAmplifyLiveFaq(document,url).passed,true);
  assert.equal(validateAmplifyLiveFaq(document.replace('The direct answer 1','A materially different answer'),url).passed,false);
});

test("Fulginiti FAQ aliases work for every draft without changing other sites or duplicating anchors", () => {
 const content=addAmplifyFaqAnchors(htmlFixture());
 const fixed=addFulginitiFaqAnchor(content,"https://www.fulginiti-law.com");
 assert.equal((fixed.match(/id="faqpage"/g)||[]).length,1);
 assert.equal(addFulginitiFaqAnchor(fixed,"https://fulginiti-law.com"),fixed);
 assert.equal(addFulginitiFaqAnchor(content,"https://otherfirm.com"),content);
 assert.equal(addFulginitiFaqAnchor(content,"https://fulginiti-law.com.evil.example"),content);
 assert.deepEqual(extractAmplifyFaqSection(fixed).entries,extractAmplifyFaqSection(content).entries);
 const pageUrl="https://www.fulginiti-law.com/test/";
 const schema=buildAmplifyFaqSchemaNode(fixed,pageUrl);
 schema['@id']=pageUrl+'#faqpage';
 const document=fixed+'<link rel="canonical" href="'+pageUrl+'"><script type="application/ld+json">'+JSON.stringify(schema)+'</script>';
 assert.equal(validateAmplifyLiveFaq(document,pageUrl).passed,true);
 assert.equal(validateAmplifyLiveFaq(document.replace('<span id="faqpage" data-amplify-faq-anchor="1"></span>',''),pageUrl).passed,false);
});
