# Nucleus Match — Utah Innovation Connections Hub

> Builder Day Hackathon · May 2026 · Nucleus Bounty
> AI-powered, explainable matching between Utah deep-tech startups and the operators, executives, students, and advisors who can build them.

**Live demo:** https://ialonsoa.github.io/nucleus-utah/
**Repo:** https://github.com/ialonsoa/nucleus-utah

---

## What it is

Nucleus's current connections hub is a Squarespace page that funnels Typeform submissions into Affinity. There's no automatic matching, no explainability, and no Utah-specific signal. Nucleus Match replaces the matching layer with a small, fast, explainable system tuned to Utah's BYU / U of U / USU innovation ecosystem — and drops back into Squarespace + Affinity without any rip-and-replace.

## How it works

1. **Two-sided structured profiles** — talent and startups sign up with the same six dimensions: sector, skills/needs, stage, availability, risk tolerance, mission.
2. **Multi-criteria weighted scoring** (`match.js`):
   ```
   score = 0.25*sector + 0.25*skills + 0.15*stage
         + 0.10*availability + 0.10*risk + 0.15*mission
   ```
3. **Explainable output** — every match returns a 0–100 score, a per-dimension breakdown, and 3 plain-English bullets (`explain.js`).
4. **Affinity + Squarespace integration** — one-click "Send to Affinity" webhook + CSV export + a Squarespace embed snippet (`embed.html`).

## AI approach (judging criterion #2 — 30%)

We deliberately chose a **transparent weighted-scoring model over a black-box LLM call** for the matching layer. Reasons:

- **Trust:** judges, founders, and Nucleus staff can see exactly why a match scored what it did.
- **Speed:** no API latency at demo time, no rate limits.
- **Determinism:** the same profile pair always yields the same score.

The "intelligence" sits in three places:
1. **Sector adjacency graph** — exact-match sectors score 1.0; adjacent sectors (e.g. AI ↔ Software, Defense ↔ Advanced Manufacturing) score 0.6 instead of zero.
2. **Need-to-skill mapping** — startup needs ("COO", "biz dev", "regulatory") expand into the underlying skills they require, then we score Jaccard overlap with the talent's skills.
3. **Stage-aware availability and risk** — full-time + early stage scores higher than full-time + growth; talent with risk tolerance 5 maps better to idea-stage university spinouts than to Series-A scaleups.

The **explanation layer** (`explain.js`) takes the breakdown and the top reasons from the scorer, then layers in Utah-specific flavor: shared school (warm intro likely), shared city (in-person collaboration), etc. This is the "Why was I matched?" feature the brief calls out.

### Why this beats LinkedIn / generic job boards

| | LinkedIn | Nucleus Match |
|---|---|---|
| Risk tolerance signal | ✗ | ✓ (1–5 scale) |
| Mission alignment | ✗ | ✓ (text similarity) |
| Stage compatibility | ✗ | ✓ (founder-stage matrix) |
| University spinout aware | ✗ | ✓ (origin + TRL) |
| Explainable per-match | ✗ | ✓ (breakdown + bullets) |
| CRM integration ready | ✗ | ✓ (Affinity webhook + CSV) |

## Utah context (judging criterion #3 — 20%)

- Sector list mirrors Utah's actual deep-tech economy: life sciences, AI, defense/aerospace, cyber, energy, advanced manufacturing, fintech, software.
- Synthetic dataset draws from real Utah landmarks: BYU / U of U / USU spinouts, ex-Qualtrics / Pluralsight / Domo / Recursion / Pattern / Weave / Lucid operators, Lehi / SLC / Provo / Logan / Park City locations.
- Explanation layer surfaces shared-school and shared-city signals — high-signal in a tight ecosystem like Utah's.

## Integration story (judging criterion #3 — 20%)

- **Squarespace:** `embed.html` is a self-contained card a Nucleus team member pastes into a Squarespace **Code Block** as `<iframe src="https://USER.github.io/nucleus-utah/embed.html" style="width:100%; height:240px; border:0;"></iframe>`. No theme changes required.
- **Affinity:**
  - **Real-time:** "Send to Affinity ✓" button POSTs the matched pair to a webhook (mocked via `webhook.site` for the demo; production swaps in Affinity's REST API endpoint with an API key).
  - **Bulk:** "Export to CSV" produces a file with the exact columns Affinity expects on import — `talent_id, talent_name, startup_id, startup_name, score, top_reasons`.

## Repo layout

```
/
├── index.html              landing
├── talent.html             talent signup (3-step + AI builder)
├── startup.html            startup signup (3-step)
├── match.html              results page
├── demo.html               3 hard-coded judge scenarios
├── ecosystem.html          Utah ecosystem map (D3 force graph)
├── handshake.html          Handshake events feed
├── embed.html              Squarespace embed
├── styles.css              design system + Utah palette
├── app.js                  UX glue (forms, rendering, toasts)
├── profile-builder.js      AI Profile Builder (URL fixtures + heuristic extraction)
├── core/                   matching engine — pure, deterministic, framework-free
│   ├── constants.js        single source of truth: sectors, stages, schools, weights
│   ├── signals.js          shared-signal vocabulary + rarity / bond scoring
│   ├── match.js            6-criteria weighted scorer (talent → startup)
│   └── explain.js          natural-language bullet generator
├── data/
│   ├── talent.json         40 synthetic Utah talent profiles
│   ├── startups.json       9 synthetic Utah startups
│   ├── handshake-events.json  mocked Handshake API events
│   ├── institutions.json   labs / hubs / accelerators (ecosystem map)
│   └── validate.js         Node-based schema validator (reads core/constants.js)
├── integrations/
│   ├── affinity.js         webhook + CSV export (URL via localStorage)
│   ├── handshake.js        Handshake API mock (load events, demand signal)
│   └── test.html           internal Affinity webhook tester
└── PLAN.md                 full hackathon plan & team split
```

**`core/` is the only place the matching logic lives.** Adding a new sector,
school, or scoring weight is a one-line change in `core/constants.js` — every
consumer (matcher, ecosystem map, Handshake, validator, integrations) reads from
that one module.

## Running locally

```bash
# any static server works
python3 -m http.server 8000
# then open http://localhost:8000
```

## The team

- **Carlos** — UX / Frontend (`index.html`, `talent.html`, `startup.html`, `match.html`, `demo.html`, `styles.css`, `app.js`)
- **Alonso** ([@ialonsoa](https://github.com/ialonsoa)) — Matching engine + data + integrations (`match.js`, `explain.js`, `data/*.json`, `integrations/affinity.js`)

See [`PLAN.md`](./PLAN.md) for the full timeline, schema contract, and Claude-chat prompts each side can use.
