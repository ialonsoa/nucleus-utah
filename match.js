/* Nucleus Match — scoring engine.
   PERSON B owns this file. The signature is fixed; tune the weights and helpers freely.

   scoreTalentToStartup(talent, startup) -> { score, breakdown, top_reasons }
     score:      0–100
     breakdown:  { sector, skills, stage, availability, risk, mission } each 0–1
     top_reasons:string[] (3–5)  short, neutral phrases the explain.js layer can polish.
*/
(function () {
  const W = {
    sector: 0.25,
    skills: 0.25,
    stage:  0.15,
    availability: 0.10,
    risk:   0.10,
    mission: 0.15,
  };

  // Sectors that pair well when not exact-match.
  const SECTOR_ADJ = {
    "ai": ["software", "cyber"],
    "software": ["ai", "fintech"],
    "fintech": ["software"],
    "cyber": ["ai", "defense"],
    "defense": ["cyber", "advanced-manufacturing"],
    "advanced-manufacturing": ["defense", "energy"],
    "energy": ["advanced-manufacturing"],
    "life-sciences": [],
  };

  // Need ↔ skill mapping. Lowercased on both sides.
  const NEED_SKILL_MAP = {
    "ceo": ["product strategy", "GTM", "fundraising", "leadership"],
    "coo": ["operations", "GTM", "team building"],
    "cto": ["engineering", "ML / AI", "hardware"],
    "cro": ["sales", "GTM"],
    "biz dev": ["GTM", "sales", "product strategy"],
    "sales": ["sales", "GTM", "B2B SaaS"],
    "marketing": ["marketing", "design"],
    "regulatory": ["regulatory"],
    "engineering": ["engineering", "ML / AI", "hardware"],
    "research": ["research"],
    "finance": ["finance"],
    "interns": ["research", "engineering"],
    "board members": ["product strategy", "finance"],
    "advisors": ["product strategy", "regulatory", "GTM"],
  };

  // Stages a given availability suits for "founding-team risk."
  const AVAILABILITY_STAGE_FIT = {
    "full-time":  { idea: 0.9, "pre-seed": 1.0, seed: 1.0, "series-a": 0.9, growth: 0.85 },
    "fractional": { idea: 0.85, "pre-seed": 0.95, seed: 0.95, "series-a": 0.85, growth: 0.7 },
    "advisory":   { idea: 0.95, "pre-seed": 0.9, seed: 0.8, "series-a": 0.7, growth: 0.6 },
    "internship": { idea: 0.7, "pre-seed": 0.8, seed: 0.85, "series-a": 0.7, growth: 0.6 },
  };

  // Founding-team risk required by stage — used to compare against talent.risk_tolerance (1–5).
  const STAGE_RISK = { idea: 5, "pre-seed": 5, seed: 4, "series-a": 3, growth: 2 };

  function lc(s) { return String(s || "").toLowerCase(); }

  function sectorScore(t, s) {
    const startupSector = lc(s.sector);
    const wanted = (t.domains || []).map(lc);
    if (!wanted.length) return 0.5;
    if (wanted.includes(startupSector)) return 1.0;
    const adj = SECTOR_ADJ[startupSector] || [];
    if (wanted.some((w) => adj.includes(w))) return 0.6;
    return 0.2;
  }

  function skillsScore(t, s) {
    const tSkills = new Set((t.skills || []).map(lc));
    const desiredSkills = new Set();
    (s.needs || []).forEach((n) => {
      (NEED_SKILL_MAP[lc(n)] || []).forEach((sk) => desiredSkills.add(lc(sk)));
    });
    if (!desiredSkills.size) return 0.4;
    let hit = 0;
    desiredSkills.forEach((sk) => { if (tSkills.has(sk)) hit++; });
    return Math.min(1, hit / Math.max(2, desiredSkills.size));
  }

  function stageScore(t, s) {
    const prefs = (t.stage_pref || []).map(lc);
    if (!prefs.length) return 0.5;
    return prefs.includes(lc(s.stage)) ? 1.0 : 0.25;
  }

  function availabilityScore(t, s) {
    const a = lc(t.availability);
    const stg = lc(s.stage);
    return (AVAILABILITY_STAGE_FIT[a] && AVAILABILITY_STAGE_FIT[a][stg]) || 0.5;
  }

  function riskScore(t, s) {
    const need = STAGE_RISK[lc(s.stage)] || 3;
    const have = Number(t.risk_tolerance) || 3;
    return Math.max(0, 1 - Math.abs(need - have) / 4);
  }

  function missionScore(t, s) {
    const a = lc(t.mission);
    const b = lc(s.mission);
    if (!a || !b) return 0.4;
    const tokens = (x) => new Set(x.split(/[^a-z0-9]+/).filter((w) => w.length > 3));
    const A = tokens(a), B = tokens(b);
    if (!A.size || !B.size) return 0.4;
    let inter = 0;
    A.forEach((w) => { if (B.has(w)) inter++; });
    const j = inter / new Set([...A, ...B]).size;
    return Math.min(1, 0.35 + j * 1.5);
  }

  function topReasons(t, s, b) {
    const pairs = Object.entries(b).sort((a, b) => b[1] - a[1]);
    const out = [];
    for (const [k, v] of pairs) {
      if (out.length >= 4) break;
      if (v < 0.5) continue;
      switch (k) {
        case "sector":
          out.push(`Sector fit (${s.sector || "—"}) aligns with talent's stated domains.`);
          break;
        case "skills":
          out.push(`Skill overlap covers ${(s.needs || []).slice(0, 2).join(" and ") || "core needs"}.`);
          break;
        case "stage":
          out.push(`Talent prefers ${s.stage || "this"} stage; ${s.name || "this startup"} is ${s.stage || "matching"}.`);
          break;
        case "availability":
          out.push(`Availability (${t.availability}) suits a ${s.stage} company.`);
          break;
        case "risk":
          out.push(`Risk tolerance ${t.risk_tolerance}/5 matches a ${s.stage} venture.`);
          break;
        case "mission":
          out.push(`Mission language overlaps — both reference shared themes.`);
          break;
      }
    }
    if (!out.length) out.push("Partial fit — see breakdown for detail.");
    return out;
  }

  function scoreTalentToStartup(talent, startup) {
    const breakdown = {
      sector: sectorScore(talent, startup),
      skills: skillsScore(talent, startup),
      stage: stageScore(talent, startup),
      availability: availabilityScore(talent, startup),
      risk: riskScore(talent, startup),
      mission: missionScore(talent, startup),
    };
    let s = 0;
    Object.entries(W).forEach(([k, w]) => { s += w * breakdown[k]; });
    const score = Math.round(s * 100);
    return { score, breakdown, top_reasons: topReasons(talent, startup, breakdown) };
  }

  window.NMMatch = { scoreTalentToStartup, WEIGHTS: W };
})();
