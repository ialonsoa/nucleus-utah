# Demo script — Nucleus Match (60–90 sec)

Hand-off note: open https://ialonsoa.github.io/nucleus-utah/ in a browser, also open https://webhook.site/#!/your-unique-id in a side tab so judges see the Affinity payload land live.

---

## 0–10 sec — The frame

> "Nucleus's connections hub today is a Squarespace form that drops into Affinity. There's no automatic matching — Nucleus staff manually match talent to startups. We rebuilt the matching layer in 4 hours, and it drops back into their existing stack."

---

## 10–25 sec — The product, on the homepage

[Click the **Maya Chen · ex-Pluralsight VP** chip on the hero]

> "Three Utah profiles are already loaded so you can see this live without filling forms. Maya is a fractional executive based in Lehi, ex-Pluralsight VP Product. Watch what we surface for her."

[Match results page loads. Five startup cards appear.]

> "Top match: HelioMet Materials, a BYU advanced-manufacturing spinout. 82% fit. The first thing she sees is **why** — shared BYU network, sector match, and her stage preference of pre-seed lines up exactly."

---

## 25–40 sec — The intelligence layer

[Point to the score breakdown bars]

> "Every match shows a 6-criteria breakdown — sector, skills, stage, availability, risk tolerance, and mission alignment. We weighted these for the Utah deep-tech context: heaviest weight on sector and skills, but risk tolerance and mission carry real weight too — those are the two signals LinkedIn doesn't have."

[Point to the "Why matched?" section]

> "And every match comes with plain-English reasons. The first reasons surfaced are the high-signal Utah-specific ones — shared school, same city — because in a tight ecosystem like Utah's, those are the matches that actually convert."

---

## 40–55 sec — The integration story

[Click "Send to Affinity ✓" button on Maya's top match. Toggle to webhook.site tab.]

> "This is what plugs into Nucleus's existing Affinity CRM. One click sends the matched pair as a structured payload — talent ID, startup ID, score, and the top reasons. Refresh the webhook and you'll see it land."

[Show the JSON payload that just arrived on webhook.site]

> "For bulk operations, there's an **Export to CSV** button matching Affinity's import schema. And on the Squarespace side, we ship an embed snippet — they paste one iframe into a Code Block and the connections hub on their existing site is now AI-powered. Zero rip-and-replace."

---

## 55–75 sec — The breadth (only if time)

[Back to homepage, click **Jacob Reyes · U of U bioengineering**]

> "Different profile, totally different output. Jacob is a U of U bioengineering MS, internship availability, risk tolerance maxed at 5. His top match is NeuraDose — a U of U drug-delivery spinout in idea stage. Same lab network, same city, same ambition level. 89%."

[Click **Priya Shah · ex-Qualtrics**]

> "And Priya, ex-Qualtrics sales engineer in Lehi, gets routed to LedgerLoop — a Lehi fintech at Series A. Different stage, different sector, different risk profile — but the engine handles all three correctly without retraining."

---

## 75–90 sec — Close

> "We chose a transparent weighted model over a black-box LLM call because Nucleus needs to defend every match they make to a founder or to a candidate. Judges, founders, and candidates can all see exactly why something scored what it did. That's our innovation pitch — not just AI, but explainable AI tuned to Utah."

> "Repo's at github.com/ialonsoa/nucleus-utah, live site at ialonsoa.github.io/nucleus-utah. Thanks."

---

## If asked: "Why no LLM in the matching layer?"

> "Two reasons. First, trust — Nucleus has to defend every match to a founder. A weighted model is auditable, an LLM call isn't. Second, latency and cost — at the scale Nucleus operates, paying for LLM calls per match is a non-starter when the deterministic model performs as well. We use templated explanations on top of the score, so the explainability layer is plain English without the black-box."

## If asked: "How would you scale this?"

> "Three steps. (1) Replace the synthetic dataset with their Affinity CRM as the source of truth via the API — they already have everything we need. (2) Move the scoring to a tiny serverless function so it can incorporate live network signals like 'who has co-invested with whom.' (3) Add a learning loop — when a match leads to an actual hire or advisor relationship, the system bumps that signal pattern's weight. Right now it's a great cold-start system; with feedback it gets smarter every quarter."

## If asked: "What's the AI here?"

> "Three places. (1) The sector adjacency graph — encoding domain expertise about which sectors transfer (AI ↔ software, defense ↔ advanced manufacturing). (2) The need-to-skill mapping — translating startup language ('we need a COO') into the actual underlying skills that role requires, then doing structured similarity. (3) The explanation layer — turning a numeric breakdown into language a human trusts. We deliberately kept the LLM out of the scoring path for the auditability reasons I mentioned."
