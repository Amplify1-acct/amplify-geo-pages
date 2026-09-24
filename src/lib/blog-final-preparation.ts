// Keep source anchors on the visible question text when a theme rewrites H2/H3 IDs.
export function protectThemeFaqAnchors(content:string) {
 return content.replace(/<(h[23])\b([^>]*?)\bid="(faq(?:-[^"]*)?)"([^>]*)>([\s\S]*?)<\/\1>/gi,
  (_match,tag:string,before:string,id:string,after:string,inner:string)=>`<${tag}${before}id="heading-${id}"${after}><span id="${id}" data-amplify-faq-anchor="1">${inner}</span></${tag}>`);
}
export function finishBlogSourceLinks(content:string, docId:string) {
 let result=content.replaceAll('anasia-maison-v-nj-transit-corporation-and-kelvin-coats-083484-esse-county-statewide','anasia-maison-v-nj-transit-corporation-and-kelvin-coats-083484-essex-county-statewide');
 if(docId==='1AMAoNn2dDEBU_DQaxAvEdd3V8ulx66FnF92br_cD-bE') {
  result=result.replace(/<a\b[^>]*href="https:\/\/www\.uber\.com\/us\/en\/drive\/insurance\/"[^>]*>Uber Accident Response and Reporting Guidance<\/a>/g,'<a href="https://www.cdc.gov/traumatic-brain-injury/signs-symptoms/index.html">CDC — Symptoms of Mild TBI and Concussion</a>');
 }
 return result;
}
