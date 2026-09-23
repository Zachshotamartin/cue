// Adapted from SiteDNA, commit f072dfa969b0a3b3141827214b548ca60f5018d6.
// Provenance and redistribution notes: ../../../UPSTREAM.md (repository root).
export function renderedStateReadinessExpression(maxWaitMs = 20_000) {
  const ceiling = Math.max(2_000, Math.min(60_000, Number(maxWaitMs) || 20_000));
  return `new Promise((resolve) => {
    const started = Date.now();
    const maxWaitMs = ${ceiling};
    const loadingCopy = /\\b(load(?:ing)?|opening|initiali[sz]ing|preparing|authenticating|signing\\s+(?:you\\s+)?in|please\\s+wait)\\b/i;
    let previousSignature = '';
    let stableSince = Date.now();
    const visible = (element) => {
      if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > .01 && rect.width > 2 && rect.height > 2 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
    };
    const finish = (ready, meaningful, reason) => resolve({ ready, readyState: document.readyState, waitedMs: Date.now() - started, meaningful, reason });
    const poll = () => {
      if (Date.now() - started >= maxWaitMs) { finish(false, false, 'soft-readiness-limit'); return; }
      if (!document.body || document.readyState === 'loading') { setTimeout(poll, 250); return; }
      const bodyText = (document.body.innerText || '').replace(/\\s+/g, ' ').trim();
      const elements = Array.from(document.body.querySelectorAll('*')).filter(visible).slice(0, 2500);
      const interactive = elements.filter((element) => element.matches('a[href], button, input, select, textarea, [role="button"], [role="link"]')).length;
      const structural = elements.filter((element) => element.matches('main, form, h1, h2, canvas, video, [role="main"], [role="dialog"]')).length;
      const loader = Array.from(document.querySelectorAll('[aria-busy="true"], [role="status"], [role="progressbar"], progress, [data-loading="true"]')).filter(visible).some((element) => {
        const rect = element.getBoundingClientRect();
        const areaShare = (rect.width * rect.height) / Math.max(1, innerWidth * innerHeight);
        return areaShare >= .18 || (bodyText.length < 400 && loadingCopy.test((element.textContent || '') + ' ' + bodyText));
      }) || (bodyText.length < 280 && interactive === 0 && loadingCopy.test(bodyText));
      const meaningful = elements.length >= 2 && (bodyText.length >= 60 || interactive >= 1 || structural >= 1);
      const landmarks = Array.from(document.querySelectorAll('h1,h2,form,main,[role="main"],[role="dialog"]')).filter(visible).slice(0, 20).map((element) => element.tagName + ':' + (element.textContent || '').trim().slice(0, 80));
      const signature = JSON.stringify({ href: location.href, title: document.title, textLength: Math.round(bodyText.length / 20), elements: elements.length, interactive, structural, landmarks });
      if (signature !== previousSignature) { previousSignature = signature; stableSince = Date.now(); }
      if (meaningful && !loader && Date.now() - stableSince >= 1200) {
        Promise.race([Promise.resolve(document.fonts?.ready), new Promise((done) => setTimeout(done, 1200))]).catch(() => undefined).finally(() => setTimeout(() => finish(true, meaningful, 'stable'), 60));
        return;
      }
      setTimeout(poll, 250);
    };
    poll();
  })`;
}
