/* Nucleus Match — scoring engine.

   Public API (window.NMMatch):
     scoreTalentToStartup(talent, startup) -> {
       score:       0–100  (base 6-criteria weighted score + Handshake demand
                            bonus + rare-bond bonus, all bounded)
       breakdown:   { sector, skills, stage, availability, risk, mission } each 0–1
       top_reasons: string[] (3–5)  short, neutral phrases the explain.js layer can polish
       demand:      { score, students, events, headline } | null
       bond:        { id, label, phrase, category, rarity, sharedCount } | null
     }
     setHandshakeEvents(events)            – feed events for demand scoring
     setAllProfiles(profiles)              – feed talent+startup list for rarity computation
     WEIGHTS                               – the 6-criteria base weights

   The matcher reads its controlled vocabulary from window.NMConstants (sectors,
   stages, school tags, etc.) so adding a new sector or school is a one-line edit
   in core/constants.js.
*/
(function () {
  const C = window.NMConstants;
  if (!C) {
    throw new Error(
      "NMMatch: core/constants.js must be loaded before core/match.js"
    );
  }

  const W = C.MATCH_WEIGHTS;

  // The base 6-criteria weights sum to 1.0. Bonuses below layer ON TOP of the
  // 0–100 base score so the demo scenario targets in PLAN.md (92 / 88 / 90)
  // remain stable when no events or signals are loaded.
  const HANDSHAKE_BONUS_MAX = 5;       // additive points (0–5)
  const HANDSHAKE_THRESHOLD = 0.40;    // below this we skip the bonus + reason

  // Module-level caches populated by callers before scoring.
  let _events = [];
  let _allProfiles = [];
  let _institutions = [];

  const lc = C.lc;

  function sectorScore(t, s) {
    const startupSector = lc(s.sector);
    const wanted = (t.domains || []).map(lc);
    if (!wanted.length) return 0.5;
    if (wanted.includes(startupSector)) return 1.0;
    const adj = C.SECTOR_ADJ[startupSector] || [];
    if (wanted.some((w) => adj.includes(w))) return 0.6;
    return 0.2;
  }

  function skillsScore(t, s) {
    const tSkills = new Set((t.skills || []).map(lc));
    const desiredSkills = new Set();
    (s.needs || []).forEach((n) => {
      (C.NEED_SKILL_MAP[lc(n)] || []).forEach((sk) => desiredSkills.add(lc(sk)));
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
    const row = C.AVAILABILITY_STAGE_FIT[a];
    return (row && row[stg]) || 0.5;
  }

  function riskScore(t, s) {
    const need = C.STAGE_RISK[lc(s.stage)] || 3;
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

  // Utah-network bonus — high signal in a tight ecosystem.
  //   • Direct shared school (talent.school in startup.origin)  +0.20
  //   • Institutional lineage (talent signal matches an institution
  //     whose parent is the startup's origin school)            +0.10
  //     — only fires when the direct school match did NOT, so this
  //     is the "you came through their accelerator/lab even though
  //     you didn't attend the school" path.
  //   • Same-city                                                +0.10
  // Capped at 0.30. Returns { bonus, reasons[] }.
  function networkBonus(t, s) {
    let bonus = 0;
    const reasons = [];
    const tag = C.schoolTag(t.school);
    const sOriginTag = C.schoolFromOrigin(s.origin);

    let directSchoolHit = false;
    if (tag && sOriginTag && tag === sOriginTag) {
      bonus += 0.20;
      reasons.push(`Shared ${t.school} network — warm-intro path likely.`);
      directSchoolHit = true;
    }

    if (!directSchoolHit && sOriginTag && _institutions.length) {
      const tSig = new Set((t.signals || []));
      // Require at least one *lineage* signal in common — generic mission /
      // niche tags don't imply an institutional pipeline.
      const matched = _institutions.find((inst) => {
        if (!inst || !inst.parent) return false;
        const instParentTag = C.schoolTag(inst.parent);
        if (instParentTag !== sOriginTag) return false;
        return (inst.signals || []).some(
          (sig) => sig.startsWith("lineage:") && tSig.has(sig)
        );
      });
      if (matched) {
        bonus += 0.10;
        reasons.push(`Connected to ${matched.parent} through ${matched.name} — institutional warm-intro path.`);
      }
    }

    const tCity = lc(String(t.location || "").split(",")[0]);
    const sCity = lc(String(s.location || "").split(",")[0]);
    if (tCity && sCity && tCity === sCity) {
      bonus += 0.10;
      const cityDisplay = String(t.location || "").split(",")[0].trim();
      reasons.push(`Both based in ${cityDisplay} — easy in-person collaboration.`);
    }
    return { bonus: Math.min(0.30, bonus), reasons };
  }

  function topReasons(t, s, breakdown, networkReasons) {
    const pairs = Object.entries(breakdown).sort((x, y) => y[1] - x[1]);
    const out = [];
    // Network reasons surface first — they're the most distinctive signals.
    (networkReasons || []).forEach((r) => { if (out.length < 2) out.push(r); });
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

  // Handshake demand — sums sector-aligned event RSVPs into a 0–1 score.
  // Only fires when events have been loaded via setHandshakeEvents().
  function demandFor(startup) {
    if (!_events.length || !startup || !startup.sector) return null;
    const sector = lc(startup.sector);
    const matched = _events.filter((ev) =>
      (ev.sectors || []).map(lc).includes(sector)
    );
    if (!matched.length) return null;
    const students = matched.reduce(
      (sum, ev) => sum + (Number(ev.students_going) || 0), 0
    );
    // 200+ RSVPs across sector events = saturated demand signal.
    const score = Math.min(1, students / 200);
    const top = [...matched].sort(
      (a, b) => (b.students_going || 0) - (a.students_going || 0)
    )[0];
    return {
      score,
      students,
      events: matched.length,
      headline: top
        ? `${students} Utah students RSVP'd to ${matched.length} ${startup.sector} events on Handshake — top: ${top.title} (${top.students_going}).`
        : null,
    };
  }

  function scoreTalentToStartup(talent, startup) {
    const net = networkBonus(talent, startup);
    const breakdown = {
      sector:       sectorScore(talent, startup),
      skills:       skillsScore(talent, startup),
      stage:        stageScore(talent, startup),
      availability: availabilityScore(talent, startup),
      risk:         riskScore(talent, startup),
      mission:      Math.min(1, missionScore(talent, startup) + net.bonus),
    };
    let s = 0;
    Object.entries(W).forEach(([k, w]) => { s += w * breakdown[k]; });
    let score = Math.round(s * 100);

    const demand = demandFor(startup);
    const reasons = topReasons(talent, startup, breakdown, net.reasons);
    if (demand && demand.score >= HANDSHAKE_THRESHOLD) {
      score = Math.min(100, score + Math.round(demand.score * HANDSHAKE_BONUS_MAX));
      if (reasons.length < 5 && demand.headline) reasons.unshift(demand.headline);
    }

    // Rare-bond layer — find the most distinctive shared signal across the pair.
    // Bounded bonus so scenario targets stay stable, but it surfaces as the
    // headline reason when present.
    let bond = null;
    if (window.NMSignals) {
      bond = window.NMSignals.rarestSharedSignal(talent, startup, _allProfiles);
      if (bond) {
        const bonus = Math.round(window.NMSignals.bondScore(bond.rarity) * 100);
        score = Math.min(100, score + bonus);
        reasons.unshift(`Rare bond — ${bond.phrase}`);
      }
    }

    return { score, breakdown, top_reasons: reasons, demand, bond };
  }

  function setHandshakeEvents(events) {
    _events = Array.isArray(events) ? events : [];
  }

  function setAllProfiles(profiles) {
    _allProfiles = Array.isArray(profiles) ? profiles : [];
  }

  function setInstitutions(institutions) {
    _institutions = Array.isArray(institutions) ? institutions : [];
  }

  window.NMMatch = {
    scoreTalentToStartup,
    setHandshakeEvents,
    setAllProfiles,
    setInstitutions,
    WEIGHTS: W,
  };
})();
