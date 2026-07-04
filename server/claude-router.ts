import { z } from "zod";
import { router, publicProcedure } from "./trpc";

export const claudeRouter = router({
  ask: publicProcedure
    .input(z.object({ question: z.string(), context: z.string().optional() }))
    .mutation(async ({ input }) => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 2048,
          system: "You are MLB Edge Assistant. Help users understand MLB predictions, odds, and betting strategy. Be concise and data-driven. Never guarantee wins.",
          messages: [{ role: "user", content: `Context: ${input.context || "MLB predictions"}\n\nQuestion: ${input.question}` }],
        }),
      });

      if (!res.ok) throw new Error(`Claude API error: ${await res.text()}`);
      const data = await res.json();
      return { answer: data.content?.[0]?.text || "No response" };
    }),
});
