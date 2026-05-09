/* Nucleus Match — single source of truth for the controlled vocabulary.

   Every other module (matcher, validator, integrations, UI) reads from here.
   Adding a new sector or school = one edit, one place.

   This file is dual-mode: it works as a browser global (window.NMConstants)
   and as a CommonJS module (so data/validate.js can require it under Node).
*/
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;                  // Node (data/validate.js)
  } else {
    root.NMConstants = api;                // Browser (engine + pages)
  }
})(typeof self !== "undefined" ? self : this, function () {
  const SECTORS = [
    "life-sciences",
    "ai",
    "defense",
    "cyber",
    "energy",
    "advanced-manufacturing",
    "fintech",
    "software",
  ];

  const STAGES = ["idea", "pre-seed", "seed", "series-a", "growth"];

  const AVAILABILITY = ["full-time", "fractional", "advisory", "internship"];

  const ROLE_TYPES = [
    "executive",
    "operator",
    "student",
    "intern",
    "board",
    "advisor",
    "mentor",
  ];

  const SCHOOLS = [
    "BYU",
    "University of Utah",
    "Utah State University",
    "Utah Valley University",
  ];

  // Allowed institution.type values used by data/institutions.json.
  // Labs are a sub-category here rather than a separate file.
  const INSTITUTION_TYPES = [
    "university",
    "accelerator",
    "lab",
    "innovation-hub",
    "community",
    "vc",
    "govt-program",
    "industry-anchor",
  ];

  // Short parent tags accepted on institution.parent (canonical short form).
  const INSTITUTION_PARENTS = ["BYU", "U of U", "USU", "UVU"];

  // Lowercased aliases → canonical short tag used in startup.origin strings.
  // Used by the matcher (network bonus) and the ecosystem map (graph anchors).
  const SCHOOL_TAGS = {
    "byu": "byu",
    "brigham young university": "byu",
    "u of u": "u of u",
    "university of utah": "u of u",
    "utah": "u of u",
    "usu": "usu",
    "utah state university": "usu",
    "utah state": "usu",
    "uvu": "uvu",
    "utah valley university": "uvu",
    "utah valley": "uvu",
  };

  // Canonical display labels used by the ecosystem graph.
  const SCHOOL_DISPLAY = {
    "byu": "BYU",
    "u of u": "U of U",
    "usu": "USU",
    "uvu": "UVU",
  };

  // Sectors that pair well when not exact-match. Symmetric on read; declare each
  // direction once and consumers can look up either side.
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

  // Need ↔ skill expansion. A startup that says "needs: COO" is really asking
  // for the underlying skills below; the matcher Jaccards against talent skills.
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

  // Founding-team risk required by stage. Compared against talent.risk_tolerance (1–5).
  const STAGE_RISK = {
    "idea": 5,
    "pre-seed": 5,
    "seed": 4,
    "series-a": 3,
    "growth": 2,
  };

  // Stage fit for each availability mode.
  const AVAILABILITY_STAGE_FIT = {
    "full-time":  { idea: 0.9,  "pre-seed": 1.0,  seed: 1.0,  "series-a": 0.9,  growth: 0.85 },
    "fractional": { idea: 0.85, "pre-seed": 0.95, seed: 0.95, "series-a": 0.85, growth: 0.7  },
    "advisory":   { idea: 0.95, "pre-seed": 0.9,  seed: 0.8,  "series-a": 0.7,  growth: 0.6  },
    "internship": { idea: 0.7,  "pre-seed": 0.8,  seed: 0.85, "series-a": 0.7,  growth: 0.6  },
  };

  // Allowed origin shapes for startup profiles. Keep the regex list narrow so
  // the validator catches typos like "BYU spinout!" or "spinoff".
  const ORIGIN_PATTERNS = [
    /spinout$/i,
    /^bootstrapped$/i,
    /^independent$/i,
  ];

  // Base 6-criteria weights. Sum to 1.0. Handshake demand and rare-bond bonuses
  // layer on top as bounded additive points (see core/match.js).
  const MATCH_WEIGHTS = {
    sector:       0.25,
    skills:       0.25,
    stage:        0.15,
    availability: 0.10,
    risk:         0.10,
    mission:      0.15,
  };

  function lc(s) { return String(s == null ? "" : s).toLowerCase().trim(); }

  function schoolTag(name) {
    const k = lc(name);
    if (!k) return "";
    return SCHOOL_TAGS[k] || k;
  }

  function schoolFromOrigin(origin) {
    const k = lc(origin);
    if (!k) return null;
    if (k.includes("byu")) return "byu";
    if (k.includes("u of u")) return "u of u";
    if (k.includes("usu")) return "usu";
    if (k.includes("uvu")) return "uvu";
    return null;
  }

  function schoolDisplay(tag) {
    return SCHOOL_DISPLAY[lc(tag)] || tag || "";
  }

  return {
    SECTORS,
    STAGES,
    AVAILABILITY,
    ROLE_TYPES,
    SCHOOLS,
    SCHOOL_TAGS,
    SCHOOL_DISPLAY,
    INSTITUTION_TYPES,
    INSTITUTION_PARENTS,
    SECTOR_ADJ,
    NEED_SKILL_MAP,
    STAGE_RISK,
    AVAILABILITY_STAGE_FIT,
    ORIGIN_PATTERNS,
    MATCH_WEIGHTS,
    lc,
    schoolTag,
    schoolFromOrigin,
    schoolDisplay,
  };
});
