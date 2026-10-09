import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations, AUTH_SECRET: "test-geheim-van-minstens-32-tekens-lang", RP_ID: "prijs.prulwerk.nl", ORIGIN: "https://prijs.prulwerk.nl" } },
      }),
    ],
    test: { setupFiles: ["./test/apply-migrations.js"] },
  };
});
