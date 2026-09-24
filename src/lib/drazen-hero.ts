function escapeHtml(value:string) {
  return value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

export function drazenHeroAuthorPanel(pageTitle: string) {
  const heroTitle = pageTitle.replace(/\s+FL\s+/i, " ").trim();
  const credibility = "The articles published on this platform have been thoroughly checked and reviewed for accuracy and reliability. However, while every effort is made to ensure the information is up-to-date and credible, we encourage readers to verify the details independently.";
  const panel = `
<div class="row-wrap">
  <div class="col-small-12 col-medium-4 col-xlarge-4 heading-col">
    <p class="default-hero__title">${escapeHtml(heroTitle)}</p>
    <h4 class="default-hero__tag">Practice Areas</h4>
  </div>
  <div class="col-small-12 col-medium-7 col-large-6 col-xlarge-6 col-wide-5">
    <div class="authors-box">
      <div class="container">
        <div class="authors-row">
          <div class="authors-col">
            <div class="authors-box__list">
              <div class="authors-box__item">
                <a href="https://muckrack.com/aron-solomon" class="link" target="_blank" rel="noopener noreferrer">
                  <div class="authors-box__image"><img width="124" height="130" src="https://www.myfloridainjurylaw.com/wp-content/uploads/2026/04/Screenshot-2026-03-05-at-2.22.00-PM-2.jpg.webp" class="attachment-full size-full wp-post-image" alt="Aron Solomon" decoding="async"></div>
                  <div class="authors-box__content"><p class="title">Written by</p><p class="author-name">Aron Solomon</p></div>
                </a>
              </div>
              <div class="authors-box__item">
                <a href="https://www.myfloridainjurylaw.com/team/eugenio-mancini/" class="link" target="_blank" rel="noopener noreferrer">
                  <div class="authors-box__image"><img width="1440" height="998" src="https://www.myfloridainjurylaw.com/wp-content/uploads/2026/04/eug.jpg.webp" class="attachment-full size-full wp-post-image" alt="Eugenio Mancini" decoding="async"></div>
                  <div class="authors-box__content"><p class="title">Reviewed by</p><p class="author-name">Eugenio Mancini</p></div>
                </a>
              </div>
            </div>
          </div>
          <div class="text-col">
            <div class="authors-box__text-wrap"><div class="authors-box__text"><p>${credibility}</p></div></div>
            <div id="fact-checked" style="display:none" class="modal"><div class="modal__heading"><h3 class="modal__heading--title">Fact Checked</h3></div><div class="modal__content"><p>${credibility}</p></div></div>
            <div id="why-trust" style="display:none" class="modal"><div class="modal__wrapper"><div class="modal__heading"><h3 class="modal__heading--title">Our Credibility</h3></div><div class="modal__content"><p>${credibility}</p></div></div></div>
          </div>
        </div>
        <div class="buttons-row"><div class="authors-box__links">
          <a class="authors-box__links-link button button-transparent fact-chack" data-fancybox data-custom-bg="white-modal" data-touch="false" data-small-btn="true" data-toolbar="false" data-auto-focus="false" data-src="#fact-checked" href="#fact-checked"><span>Fact Checked</span></a>
          <a class="authors-box__links-link button button-transparent why-trust" data-fancybox data-custom-bg="white-modal" data-touch="false" data-small-btn="true" data-toolbar="false" data-auto-focus="false" data-src="#why-trust" href="#why-trust"><span>Our Credibility</span></a>
        </div></div>
      </div>
    </div>
  </div>
</div>`.trim();
  return `<!-- amplify-geo-author-panel:v3 -->
<!-- wp:html -->
<style id="amplify-drazen-reference-hero">.default-hero{background-image:url("https://www.myfloridainjurylaw.com/wp-content/uploads/2026/05/Auto-Accidents.webp")!important}</style>
<script id="amplify-geo-author-panel-script">(function(){var root=document.querySelector('.default-hero__content');if(!root||root.querySelector('.authors-box'))return;root.innerHTML=${JSON.stringify(panel)};})();</script>
<!-- /wp:html -->`;
}

