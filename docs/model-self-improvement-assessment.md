# MLB Edge — Is the Model Actually Self-Improving? (Honest Assessment)

Short answer: **No — not automatically, and the product should not claim that it does.** What the system has today is an honest, structured *feedback loop for a human* (you), not a model that retrains or reweights itself. That distinction matters for both truth-in-advertising and for knowing what to build next.

This document separates what is real, what is not, and the realistic path to genuine self-improvement.

---

## What actually happens today (the real loop)

Every night, a scheduled job (`parlayGrader.ts`) does the following:

1. **Grades yesterday's parlays** against real final scores pulled from the MLB Stats API. Money line, run line, totals, and props are each settled win/loss/push. Postponed or suspended games are auto-voided (pushed), never silently counted as a loss.
2. **Writes a post-game debrief** using an LLM. The debrief reads the legs and outcomes and produces a plain-English "here's what likely went wrong" narrative in three sections (what was picked, what the engine missed, how we'd improve).
3. **Logs a loss-analysis record** (`parlayModelFeedback` table) via `analyzeLoss()`. This tallies which market lost most and emits a *templated* improvement note (e.g. "totals losses → revisit weather/umpire calibration").

That is a **complete, honest measurement and journaling system.** It tells the truth about results and produces useful human-readable hypotheses about why a card lost.

---

## What it does NOT do (the honest limits)

- **It does not change a single model weight.** The prediction weights in `predictionEngine.ts` (park factors, pitcher trend, bullpen rest, umpire/weather adjustments, win% nudges) are **hand-set constants**. Nothing in the nightly job edits them.
- **The "improvement note" is a fixed template, not a learned action.** `analyzeLoss()` maps the dominant losing market to a pre-written sentence. The same loss pattern always produces the same note. It is a prompt for *you*, not an instruction the system executes.
- **The LLM debrief is narration, not learning.** It explains plausibly; it has no mechanism to feed its conclusions back into the math. Two identical losses next week would get the same treatment.
- **There is no backtest-on-new-data, no parameter search, no drift detection.** "Self-improving" in the ML sense (the model gets measurably better at predicting because of yesterday's results) is **not implemented.**

So if any page, ad, or pitch says "self-learning AI that gets smarter every day," that is currently **false** and should be removed or reworded. Honest phrasing: *"Every pick is graded against real results and logged, so the model's record is transparent and its misses are analyzed."*

---

## Why this is actually fine for right now

- You have **zero subscribers and a small sample of graded days.** Auto-retraining on a few dozen outcomes would *overfit to noise* and make the model worse, not better. Baseball is high-variance; a 5-leg card losing tells you almost nothing statistically.
- The highest-value thing at this stage is **trustworthy measurement** — which you have. That's what lets you (and eventually customers) see the real, un-fudged record.
- Genuine self-improvement is a real feature you can build *later*, once you have a few hundred graded picks to learn from. Building it now would be expensive theater.

---

## The realistic path to genuine self-improvement (when the data justifies it)

Ranked by effort-to-value:

1. **Calibration tracking (cheap, do first).** For each market, bucket picks by predicted probability and compare to actual hit rate. If "60% confidence" picks hit 52%, the model is overconfident. This is a real, defensible metric and the foundation for everything else.
2. **Threshold tuning from logged outcomes (medium).** You already log edge scores and outcomes. Once you have ~200+ settled legs per market, you can empirically find the edge threshold above which picks are actually profitable, and raise the gate. This is "self-improvement" you can honestly claim — the model stops recommending bet types that haven't earned it.
3. **Per-factor weight fitting (harder).** Replace the hand-set constants in `predictionEngine.ts` with a simple regression fit on historical features → outcomes. This is real learning, but needs a real dataset and validation to avoid overfitting.
4. **Closing-line-value (CLV) tracking (the pro metric).** Compare your pick's odds at generation vs the closing line. Beating the close consistently is the single best evidence a model has edge — better than short-run win/loss. (Note: CLV is **not built yet**; it was removed from the Syndicate copy for that reason.)

---

## Bottom line for the operator

- **Keep** the grading + debrief system — it's the honest backbone.
- **Do not** advertise auto-learning until at least calibration tracking (#1) ships.
- **Build #1 and #2 first**, after you have real graded volume. They're the cheapest credible upgrades and they directly protect customers from chasing bet types the model can't actually beat.
- The most valuable near-term "improvement" isn't the model — it's **discipline**: only surfacing picks above an edge threshold the logged data supports. The infrastructure to do that already exists; it just needs the data to accumulate.
