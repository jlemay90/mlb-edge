import { describe, it, expect, beforeAll } from "vitest";
import axios from "axios";

const WEBHOOK_URL = "http://localhost:3000/api/webhooks/ui-update";
const WEBHOOK_SECRET = process.env.UI_UPDATE_WEBHOOK_SECRET || "dev-secret";

describe("UI Update Webhook", () => {
  it("should reject requests without valid secret", async () => {
    try {
      await axios.post(
        WEBHOOK_URL,
        { component: "ParlaysPage", change: "add_overall_record_display" },
        { headers: { Authorization: "Bearer invalid-secret" } }
      );
      expect.fail("Should have rejected invalid secret");
    } catch (err: any) {
      expect(err.response?.status).toBe(401);
    }
  });

  it("should accept requests with valid secret", async () => {
    const response = await axios.post(
      WEBHOOK_URL,
      { component: "ParlaysPage", change: "add_overall_record_display" },
      { headers: { Authorization: `Bearer ${WEBHOOK_SECRET}` } }
    );

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.component).toBe("ParlaysPage");
  });

  it("should reject requests with missing required fields", async () => {
    try {
      await axios.post(
        WEBHOOK_URL,
        { component: "ParlaysPage" }, // missing 'change'
        { headers: { Authorization: `Bearer ${WEBHOOK_SECRET}` } }
      );
      expect.fail("Should have rejected missing fields");
    } catch (err: any) {
      expect(err.response?.status).toBe(400);
    }
  });

  it("should list supported UI changes", async () => {
    const response = await axios.get(`${WEBHOOK_URL}/supported`);

    expect(response.status).toBe(200);
    expect(response.data.changes).toBeDefined();
    expect(response.data.changes.ParlaysPage).toBeDefined();
  });
});
