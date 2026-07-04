import { describe, expect, it } from "vitest";
import { type Express } from "express";

async function request(app: Express, path: string): Promise<unknown> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected an ephemeral TCP address");
  }

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
    return await response.json();
  } finally {
    server.close();
  }
}

describe("Vercel API entrypoint", () => {
  it("exports the Express API app for Vercel serverless routing", async () => {
    const module = await import("../../api/[...path]");
    const app = module.default as Express;

    const health = await request(app, "/api/health") as { ok: boolean; app: string };

    expect(typeof app).toBe("function");
    expect(health).toMatchObject({ ok: true, app: "MLB Edge Lab" });
  });
});
