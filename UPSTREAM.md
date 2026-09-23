# Upstream provenance

Cue is an independent application. It is not a wholesale SiteDNA fork.

## SiteDNA

Repository: https://github.com/Zachshotamartin/site-dna

Reviewed commit: `f072dfa969b0a3b3141827214b548ca60f5018d6` (`origin/main` at initial review).

Vendored file: `apps/extension/vendor/site-dna-readiness.js`. This is SiteDNA's rendered-state readiness expression adapted to a browser extension module. Cue adds bounded font/image waits and capture navigation-epoch checks around it. Route selection, pixel capture/redaction, recording, uploads, editing, providers and compositing are new Cue implementation.

The source repository did not expose a root license at review. Keep this application private until the owner confirms redistribution terms. Do not infer an open-source license from public repository visibility.

## Other dependencies

Next.js/React power the editor, Remotion powers local preview/export, Sharp handles image validation, FFmpeg handles media inspection/normalization, and Phosphor supplies interface icons. Manrope and IBM Plex Mono are installed through Fontsource; their distributed notices are included in `docs/licenses/`. Dependency versions are pinned in `package-lock.json`.

Review Remotion's license for the intended team and commercial use before distributing or hosting. Current license terms: https://www.remotion.dev/license

## Provider references

- Runway: https://docs.dev.runwayml.com/guides/using-the-api/
- Pricing: https://docs.dev.runwayml.com/guides/pricing/
- Gemini structured outputs: https://ai.google.dev/gemini-api/docs/structured-output
- ElevenLabs speech: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- Chrome tabCapture: https://developer.chrome.com/docs/extensions/reference/api/tabCapture

Provider integration contracts are tested with stubbed HTTP. Paid end-to-end testing is tracked separately; API documentation is not evidence of successful generation in this installation.
