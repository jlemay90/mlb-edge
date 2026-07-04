import { describe, expect, it } from "vitest";
import { parseEnvFile } from "../server/env";

describe("local env parsing", () => {
  it("parses blank lines, comments, and quoted values", () => {
    expect(
      parseEnvFile(`
        # local only
        ODDS_API_KEY=abc123
        OPENAI_API_KEY="sk-test"
        NWS_USER_AGENT='mlb-edge-lab/test'
      `)
    ).toEqual({
      ODDS_API_KEY: "abc123",
      OPENAI_API_KEY: "sk-test",
      NWS_USER_AGENT: "mlb-edge-lab/test",
    });
  });
});
