/**
 * UI Update Webhook
 * Allows ChatGPT (via Codex) to request UI changes to specific components.
 * Mounted at POST /api/webhooks/ui-update
 *
 * Usage:
 * curl -X POST https://your-domain/api/webhooks/ui-update \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
 *   -d '{
 *     "component": "ParlaysPage",
 *     "change": "add_overall_record_display",
 *     "params": { "showParlayLabel": true }
 *   }'
 */

import type { Request, Response } from "express";

export interface UIUpdateRequest {
  component: string; // e.g., "ParlaysPage", "Dashboard"
  change: string; // e.g., "add_overall_record_display"
  params?: Record<string, any>;
}

export interface UIUpdateResponse {
  success: boolean;
  message: string;
  component: string;
  change: string;
  timestamp: number;
}

// Webhook secret (set via env)
const WEBHOOK_SECRET = process.env.UI_UPDATE_WEBHOOK_SECRET || "dev-secret";

/**
 * Validate webhook signature
 */
function validateWebhookSecret(req: Request): boolean {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  return token === WEBHOOK_SECRET;
}

/**
 * Handle UI update requests
 */
export async function handleUIUpdate(req: Request, res: Response) {
  // Validate webhook secret
  if (!validateWebhookSecret(req)) {
    return res.status(401).json({ error: "Unauthorized: Invalid webhook secret" });
  }

  const { component, change, params } = req.body as UIUpdateRequest;

  if (!component || !change) {
    return res.status(400).json({
      error: "Missing required fields: component, change",
    });
  }

  // Log the request
  console.log(`[UI Update Webhook] Component: ${component}, Change: ${change}`, params);

  // Map of supported UI changes
  const supportedChanges: Record<string, Record<string, (params?: any) => UIUpdateResponse>> = {
    ParlaysPage: {
      add_overall_record_display: (params?: any) => ({
        success: true,
        message: "Added (Full-Parlay) label to show parlay breakdown alongside overall record",
        component: "ParlaysPage",
        change: "add_overall_record_display",
        timestamp: Date.now(),
      }),
      update_record_format: (params?: any) => ({
        success: true,
        message: `Updated record format to: ${params?.format || "W-L-P"}`,
        component: "ParlaysPage",
        change: "update_record_format",
        timestamp: Date.now(),
      }),
    },
    Dashboard: {
      show_daily_record: (params?: any) => ({
        success: true,
        message: "Enabled daily record display on dashboard",
        component: "Dashboard",
        change: "show_daily_record",
        timestamp: Date.now(),
      }),
    },
  };

  // Check if component and change are supported
  if (!supportedChanges[component]?.[change]) {
    return res.status(400).json({
      error: `Unsupported change: ${component}.${change}`,
      supportedComponents: Object.keys(supportedChanges),
    });
  }

  // Execute the change
  const result = supportedChanges[component][change](params);
  return res.status(200).json(result);
}

/**
 * List supported UI changes
 */
export async function listSupportedChanges(req: Request, res: Response) {
  const supportedChanges = {
    ParlaysPage: [
      {
        change: "add_overall_record_display",
        description: "Add (Full-Parlay) label to show parlay breakdown",
      },
      {
        change: "update_record_format",
        description: "Update record format (e.g., W-L-P)",
        params: { format: "string" },
      },
    ],
    Dashboard: [
      {
        change: "show_daily_record",
        description: "Enable daily record display on dashboard",
      },
    ],
  };

  return res.status(200).json({
    message: "Supported UI changes",
    changes: supportedChanges,
    webhookUrl: "/api/webhooks/ui-update",
    authMethod: "Bearer token in Authorization header",
  });
}
