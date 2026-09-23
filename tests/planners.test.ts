import { account } from "./auth-fixture";
import { afterAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { createProject, db, updateJob } from "../packages/storage/db";
import { importMedia } from "../packages/storage/media";
import { handle } from "../packages/server/api";
import { origin } from "../packages/storage/config";
import {
  draftSchema,
  defaultDraft,
  plannerProviderSchema,
  planners,
} from "../packages/contracts";

async function call(route: string, method = "GET", body?: unknown) {
  return handle(
    new Request(`${origin}/api/${route}`, {
      method,
      headers: {
        origin,
        "Content-Type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    route.split("/"),
  );
}
afterAll(() => db.close());
describe("storyboard provider selection", () => {
  it("opens old films with the original Gemini default", () => {
    const { plannerProvider, ...legacy } = defaultDraft("Old film");
    expect(draftSchema.parse(legacy).plannerProvider).toBe("gemini");
  });
  it.each(plannerProviderSchema.options)(
    "persists %s and queues only its account credential and model",
    async (provider) => {
      account.user = {
        id: `owner-${provider}`,
        name: "Test",
        email: "test@example.test",
        emailVerified: true,
      };
      const p = await createProject("Planner film", "", account.user.id);
      await importMedia(
        p.id,
        await sharp({
          create: { width: 20, height: 20, channels: 3, background: "red" },
        })
          .png()
          .toBuffer(),
        "screen.png",
      );
      const key = `synthetic-${provider}-secret-1234`;
      const saved = await call("settings", "PUT", { provider, key });
      expect(saved.status).toBe(200);
      const status = await saved.text();
      expect(status).not.toContain(key);
      expect(
        JSON.parse(status).providers.find((p: any) => p.provider === provider),
      ).toMatchObject({ configured: true, source: "encrypted" });
      const edited = await call(`projects/${p.id}/edits`, "POST", {
        revision: 1,
        draft: { ...p.draft, plannerProvider: provider },
      });
      expect(edited.status).toBe(200);
      const reloaded = await (await call(`projects/${p.id}`)).json();
      expect(reloaded.project.draft.plannerProvider).toBe(provider);
      const response = await call(`projects/${p.id}/plan`, "POST", {
        revision: 2,
      });
      expect(response.status).toBe(202);
      const { job } = await response.json();
      expect(job.payload).toMatchObject({
        provider,
        model: planners[provider].model,
        revision: 2,
      });
      expect(job.reservedCents).toBe(planners[provider].reserveCents);
      await updateJob(job, { state: "cancelled", reservedCents: 0 });
      expect(
        (
          await call(`projects/${p.id}/plan`, "POST", {
            revision: 2,
            provider: "runway",
          })
        ).status,
      ).toBeGreaterThanOrEqual(400);
      await call("settings", "DELETE", { provider });
      expect(
        (await call(`projects/${p.id}/plan`, "POST", { revision: 2 })).status,
      ).toBeGreaterThanOrEqual(400);
    },
  );
});
