# How the "Parlays of the Day" Are Calculated (Plain English)

This explains, in non-technical terms, exactly how MLB Edge builds the five daily parlay cards. It's accurate to the actual code (`parlayEngine.ts`), not marketing fluff. Use it as your own reference and to answer "how does this work?" from customers honestly.

---

## Step 1 — Start with every game's model picks

For each game on today's slate, the model has already produced picks for three core markets:
- **Money line** (who wins)
- **Run line** (the -1.5 / +1.5 spread)
- **Total** (over/under on combined runs)

Each pick comes with an **edge score** — the gap between the model's estimated probability and what the sportsbook's odds imply. A positive edge means the model thinks the bet is priced better than the book realizes.

## Step 2 — Keep only the legs that clear a real edge gate

A pick is only allowed to become a parlay "leg" if it has **real odds from DraftKings/FanDuel** AND its edge clears a minimum:
- Money line: edge above **4%**
- Run line: edge above **4%**
- Total: edge above **5%**

Picks below these thresholds are thrown out. If the data isn't there, the leg doesn't get forced in. Each surviving leg also gets a **confidence score** that blends its edge with a bonus for A/B "tier" grades.

## Step 3 — One leg per game (no correlated bets)

Within a single parlay, the engine allows **at most one leg per game**. This prevents stacking correlated bets (e.g. betting the same team's money line *and* run line), which would make a parlay look stronger than it really is.

---

## The five cards — how each one is built differently

### 1. Power Parlay (the "safest" card)
Takes the **highest-confidence legs of the day**, up to 6, one per game, mixed across markets. This is the chalk: the picks the model is most sure of. The card reports the average model edge across its legs.

### 2. Value Parlay (balanced payout)
A tighter 3-leg core of the sharpest money line / run line / total picks, **plus one player prop** — but only if that prop is genuinely strong: edge above **8%**, an A-tier grade, AND a real numeric model projection behind it. If no prop clears that bar, the card simply runs without one. (This is the spot where a fabricated default was removed — it now requires real numbers.)

### 3. Lotto Pick (the longshot swing)
Deliberately built to be **different from the Power Parlay**. Instead of the safest legs, it sorts by **highest payout** — favoring plus-money underdogs and longshot leans — and stacks them until the combined odds reach roughly **+4000**. It also actively avoids reusing the exact legs Power already took, and the card tells you how many of its legs differ from Power. High risk, high reward — but every leg still has to carry positive model edge.

### 4. High-Value Play (best single risk/reward)
A 1–2 leg card hunting the day's best **underdog with a strong model edge** (e.g. the model gives a +120 underdog a >55% win chance) and/or a total with a 10%+ edge. The idea is the single cleanest "the book is wrong here" spot.

### 5. HR Prop Parlay (home runs)
Built from a different angle — power conditions rather than win/loss models. For each game it scores home-run likelihood from:
- **Pitcher vulnerability** (ERA gate so it only targets hittable starters)
- **Hitter-friendly park** (handedness-adjusted HR park factor)
- **Wind blowing out + temperature above ~78°F** (ball carries)
- **Statcast power signals** — barrel%, exit velocity, ISO, recent HR rate, and batter-vs-pitcher matchup

It ranks all qualifying spots by combined edge and takes the top 5 (one per game). **Important honesty detail:** when the live Statcast feed is missing for a hitter, the engine falls back to model-derived estimates — and those are now explicitly labeled "(est.)" in the reasoning so you never see an estimated number presented as a confirmed Statcast reading. If no game offers a real power spot, the card returns empty rather than forcing a pick.

---

## How the combined odds are calculated

Each leg's American odds are converted to a probability-equivalent, multiplied together (the standard parlay math), and converted back to a single combined American price. More legs = bigger payout but lower hit probability — which is exactly why the five cards span the spectrum from safe (Power) to longshot (Lotto).

---

## What happens after the games end

That night, every leg is graded against the real final score (money line, run line, total, and props each settled win/loss/push). Postponed or suspended games are **voided, never counted as losses.** A plain-English post-game debrief is written for each card, and losses are logged for review. (See `docs/model-self-improvement-assessment.md` for the honest scope of what that feedback loop does and doesn't do.)

---

## The one principle behind all of it

**No edge, no pick.** Every card is allowed to come back empty or short rather than manufacture a bet. The thresholds, the real-odds requirement, and the "(est.)" labeling all exist so the product shows you genuine model output — not a number invented to fill a slot.
