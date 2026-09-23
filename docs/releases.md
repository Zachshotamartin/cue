# Checks and manual releases

GitHub CI runs `npm run check` (TypeScript, Vitest, extension packaging and the Next production build) for pull requests and pushes to `feature/cue`, the default branch. It uses Node.js 24 and needs no production credentials. It also supports manual dispatch.

Production deployment is manual. A merged pull request is not proof that production has been updated. When hosted runners are unavailable, run the same checks locally and record the result on the PR; do not report a blocked workflow as passing.

## Release

1. Review the diff and run `npm ci --no-audit` and `npm run check` on the release commit. Verify the affected UI in the browser. Authentication changes also need same-origin and cross-origin request checks.
2. Push and merge the PR. Sync `feature/cue`, confirm no tracked changes remain, and record `git rev-parse HEAD`. The source must be available on GitHub because render jobs clone this commit.
3. Confirm the Vercel CLI is linked to `zach-2267/cue`. Update the production `CUE_RENDER_REF` to the exact source commit using `vercel env add CUE_RENDER_REF production --force --yes --scope zach-2267` (supply the commit through stdin). Do not rotate encryption or signing keys when releasing.
4. From the repo root, run `npx --yes vercel@59.11.2 deploy --prod --skip-domain --yes --scope zach-2267`. This builds with production configuration but leaves the public domain on the previous deployment.
5. Check the staged deployment, then promote that exact URL with `npx --yes vercel@59.11.2 promote DEPLOYMENT_URL --yes --scope zach-2267`. Verify the public domain, sign-in, existing saved work and the changed interactions. Do not trigger paid generation merely to check a deployment.
6. Record the PR, source SHA, deployment URL and verification results. If a check fails, keep the previous deployment live. For a regression after promotion, use Vercel rollback to the previously verified production deployment.

`.vercelignore` excludes secrets, local data and test artifacts from CLI uploads. Never put environment values in PR comments or logs. The postponed authenticated-extension test, custom SMTP configuration and live AI-provider checks are separate from CI; a green build does not verify those integrations.
