/* Nucleus Match — shared signals (controlled-vocabulary "tags" beyond the
   standard match dimensions of sector / skills / stage / availability / risk /
   mission).

   The big idea: when two profiles share a RARE signal, we surface it as a
   "Rare bond" — the kind of insight LinkedIn can't produce. Examples:
     - Both come from the Howell Compliant-Mechanism lineage
     - Both have shipped FDA Class II devices
     - Both speak Spanish (LATAM-expansion ready)
     - Both are SBIR / STTR recipients

   Public API (window.NMSignals):
     SIGNALS                          – { id: { label, phrase, category } }
     sharedSignals(a, b)              – string[] of shared signal IDs
     rarestSharedSignal(a, b, all)    – { id, label, phrase, category, rarity } | null
     bondScore(rarity)                – 0..0.05 multiplier added to mission score
     rarity(id, all)                  – 0..1, 1 = very rare
     labelFor(id) / categoryFor(id)   – lookup helpers

   The vocab is intentionally small + curated — when EVERYTHING is distinctive,
   NOTHING is. Aim for ~25–35 active tags total.
*/
(function () {
  // Each signal has:
  //   label    – short noun phrase used in chips ("Howell Lab")
  //   phrase   – natural-language sentence, ready to drop into the bond ribbon
  //   category – grouping for UI: lineage | niche | regulatory | funding | mission | arc | identity
  const SIGNALS = {
    // ------- Lab / institutional lineage -------
    "lineage:howell-lab": {
      label: "Howell Lab",
      phrase: "Both come from the Howell Compliant-Mechanism lineage at BYU.",
      category: "lineage",
    },
    "lineage:magicc-lab": {
      label: "MAGICC Lab",
      phrase: "Both connected to BYU's MAGICC autonomy lab.",
      category: "lineage",
    },
    "lineage:flow-lab": {
      label: "FLOW Lab",
      phrase: "Both connected to BYU's FLOW aerodynamic-optimization lab.",
      category: "lineage",
    },
    "lineage:byu-neuroscience": {
      label: "BYU Neuroscience",
      phrase: "Both rooted in BYU's Neuroscience Center.",
      category: "lineage",
    },
    "lineage:byu-tech-transfer": {
      label: "BYU TT",
      phrase: "Both have worked through BYU's tech-transfer pipeline.",
      category: "lineage",
    },
    "lineage:utah-bme": {
      label: "U of U BME",
      phrase: "Both rooted in the U of U Bioengineering ecosystem.",
      category: "lineage",
    },
    "lineage:qualtrics-alum": {
      label: "Qualtrics alum",
      phrase: "Both ex-Qualtrics — instant cultural shorthand.",
      category: "lineage",
    },
    "lineage:pluralsight-alum": {
      label: "Pluralsight alum",
      phrase: "Both shaped by Pluralsight's scaling playbook.",
      category: "lineage",
    },
    "lineage:recursion-alum": {
      label: "Recursion alum",
      phrase: "Both connected to Recursion's bio + ML engineering culture.",
      category: "lineage",
    },
    "lineage:sdl": {
      label: "USU SDL",
      phrase: "Both connected to USU's Space Dynamics Lab.",
      category: "lineage",
    },
    "lineage:byu-sandbox": {
      label: "BYU Sandbox",
      phrase: "Both came through BYU Sandbox — the studio that produced Owlet and several Y Combinator companies.",
      category: "lineage",
    },
    "lineage:byu-crocker": {
      label: "Crocker Fellowship",
      phrase: "Both came through BYU's Crocker Innovation Fellowship — small cohort, deep network.",
      category: "lineage",
    },
    "lineage:lassonde": {
      label: "Lassonde",
      phrase: "Both came through U of U's Lassonde Entrepreneur Institute.",
      category: "lineage",
    },
    "lineage:cmi": {
      label: "U of U CMI",
      phrase: "Both rooted in U of U's Center for Medical Innovation.",
      category: "lineage",
    },
    "lineage:pivot": {
      label: "U of U PIVOT",
      phrase: "Both have worked through U of U's PIVOT Center for tech transfer.",
      category: "lineage",
    },
    "lineage:silicon-slopes-active": {
      label: "Silicon Slopes",
      phrase: "Both active in the Silicon Slopes community — most warm-intro paths in Utah pass through here.",
      category: "lineage",
    },
    "lineage:kickstart-portfolio": {
      label: "Kickstart",
      phrase: "Both connected to the Kickstart Seed Fund portfolio.",
      category: "lineage",
    },
    "lineage:pelion-portfolio": {
      label: "Pelion",
      phrase: "Both connected to the Pelion Ventures portfolio.",
      category: "lineage",
    },
    "lineage:owlet-alum": {
      label: "Owlet alum",
      phrase: "Both shaped by Owlet's hardware-medtech scaling story.",
      category: "lineage",
    },
    "lineage:strider-alum": {
      label: "Strider alum",
      phrase: "Both connected to Strider Technologies' national-security culture.",
      category: "lineage",
    },
    "lineage:vasion-alum": {
      label: "Vasion alum",
      phrase: "Both connected to Vasion (formerly PrinterLogic) — Lehi's quiet enterprise-SaaS scaling story.",
      category: "lineage",
    },
    "lineage:lucid-alum": {
      label: "Lucid alum",
      phrase: "Both connected to Lucid Software — Utah's largest privately-built SaaS company.",
      category: "lineage",
    },
    "lineage:domo-alum": {
      label: "Domo alum",
      phrase: "Both connected to Domo's data-platform DNA.",
      category: "lineage",
    },
    "lineage:bamboo-alum": {
      label: "BambooHR alum",
      phrase: "Both connected to BambooHR's people-ops culture.",
      category: "lineage",
    },
    "lineage:ancestry-alum": {
      label: "Ancestry alum",
      phrase: "Both connected to Ancestry's consumer-data scaling story.",
      category: "lineage",
    },
    "lineage:adobe-lehi-alum": {
      label: "Adobe Lehi alum",
      phrase: "Both shaped by Adobe Lehi — the Utah outpost of one of the world's largest creative-software companies.",
      category: "lineage",
    },
    "lineage:vivint-alum": {
      label: "Vivint alum",
      phrase: "Both connected to Vivint Smart Home's consumer-IoT culture.",
      category: "lineage",
    },

    // ------- Niche specialties -------
    "niche:compliant-mechanisms": {
      label: "Compliant mech.",
      phrase: "Both work in compliant mechanisms — fewer than a dozen people in Utah do.",
      category: "niche",
    },
    "niche:in-vivo-robotics": {
      label: "In-vivo robotics",
      phrase: "Both work on in-vivo robotics — devices designed to operate inside the body.",
      category: "niche",
    },
    "niche:additive-manufacturing": {
      label: "Additive mfg.",
      phrase: "Both deep in additive-manufacturing — Utah's fastest-growing hardware niche.",
      category: "niche",
    },
    "niche:soft-robotics": {
      label: "Soft robotics",
      phrase: "Both work on soft robotics — the human-safe corner of the field.",
      category: "niche",
    },
    "niche:multi-agent-uav": {
      label: "Multi-UAV",
      phrase: "Both work on multi-agent UAV systems — a small Utah specialty cluster.",
      category: "niche",
    },
    "niche:focused-ultrasound": {
      label: "Focused-ultrasound",
      phrase: "Both work on focused-ultrasound therapeutics.",
      category: "niche",
    },
    "niche:wind-aero-optimization": {
      label: "Wind / aero opt.",
      phrase: "Both specialize in wind and aerodynamic shape optimization.",
      category: "niche",
    },
    "niche:materials-informatics": {
      label: "Materials informatics",
      phrase: "Both apply ML / informatics to materials design — a rare hybrid skill.",
      category: "niche",
    },
    "niche:spine-biomechanics": {
      label: "Spine biomech.",
      phrase: "Both specialize in spine biomechanics.",
      category: "niche",
    },
    "niche:origami-engineering": {
      label: "Origami eng.",
      phrase: "Both work in origami-inspired engineering — deployable structures for space and defense.",
      category: "niche",
    },
    "niche:mems-microsystems": {
      label: "MEMS",
      phrase: "Both work in MEMS / microsystems — a niche skill that opens biotech, defense, and sensors.",
      category: "niche",
    },
    "niche:combustion-energy": {
      label: "Combustion",
      phrase: "Both work in combustion / engine systems — Utah industrial-energy bedrock.",
      category: "niche",
    },

    // ------- Regulatory / certifications -------
    "regulatory:fda-class-ii": {
      label: "FDA Class II",
      phrase: "Both have direct FDA Class II device experience — extremely rare in early-stage talent pools.",
      category: "regulatory",
    },
    "regulatory:itar": {
      label: "ITAR-cleared",
      phrase: "Both ITAR-cleared — defense work moves faster between you.",
      category: "regulatory",
    },
    "regulatory:hipaa": {
      label: "HIPAA",
      phrase: "Both fluent with HIPAA / clinical-data compliance.",
      category: "regulatory",
    },

    // ------- Funding history -------
    "funding:sbir": {
      label: "SBIR / STTR",
      phrase: "Both have navigated the SBIR / STTR process — a meaningful federal credibility signal.",
      category: "funding",
    },
    "funding:dod": {
      label: "DoD-funded",
      phrase: "Both already operate inside DoD funding circles.",
      category: "funding",
    },
    "funding:nih": {
      label: "NIH-funded",
      phrase: "Both come from NIH-funded research environments.",
      category: "funding",
    },
    "funding:nsf": {
      label: "NSF-funded",
      phrase: "Both come from NSF-funded research environments.",
      category: "funding",
    },

    // ------- Mission / values -------
    "mission:utah-built": {
      label: "Utah-built",
      phrase: "Both committed to keeping Utah-grown deep tech anchored in Utah.",
      category: "mission",
    },
    "mission:emerging-markets": {
      label: "Emerging markets",
      phrase: "Both design for emerging-markets users — same core values.",
      category: "mission",
    },
    "mission:dual-use": {
      label: "Dual-use",
      phrase: "Both build dual-use technology — civilian and defense pathways.",
      category: "mission",
    },
    "mission:bench-to-bedside": {
      label: "Bench-to-bedside",
      phrase: "Both committed to translating research into clinical care.",
      category: "mission",
    },
    "mission:clean-energy": {
      label: "Clean energy",
      phrase: "Both anchored in clean-energy missions.",
      category: "mission",
    },

    // ------- Career arc -------
    "arc:academic-to-industry": {
      label: "Academic → industry",
      phrase: "Both bridge academic research and industry execution.",
      category: "arc",
    },
    "arc:second-time-founder": {
      label: "2nd-time founder",
      phrase: "Both have founded before — past failures and wins translate.",
      category: "arc",
    },
    "arc:big-co-to-startup": {
      label: "Big-co → startup",
      phrase: "Both have made the big-company-to-startup leap.",
      category: "arc",
    },

    // ------- Identity -------
    "lang:spanish": {
      label: "Speaks Spanish",
      phrase: "Both speak Spanish — opens LATAM and Hispanic-market expansion.",
      category: "identity",
    },
    "lang:portuguese": {
      label: "Speaks Portuguese",
      phrase: "Both speak Portuguese — Brazil-market shorthand.",
      category: "identity",
    },
    "experience:returned-international": {
      label: "Returned international",
      phrase: "Both lived internationally — global-first instincts already wired.",
      category: "identity",
    },
  };

  function asArr(x) { return Array.isArray(x) ? x : []; }

  // Set intersection, preserving the order of `a`.
  function sharedSignals(a, b) {
    const aS = asArr(a && a.signals);
    const bS = new Set(asArr(b && b.signals));
    return aS.filter((id) => bS.has(id) && SIGNALS[id]);
  }

  // Frequency table over all profiles (talent + startups merged). Cached on
  // identity of the array AND its length, so we re-compute when callers swap
  // in a different list.
  let _freqCache = null;
  let _freqRef = null;
  let _freqLen = -1;
  function frequencies(allProfiles) {
    const arr = allProfiles || [];
    if (_freqCache && _freqRef === arr && _freqLen === arr.length) {
      return _freqCache;
    }
    const counts = Object.create(null);
    let total = 0;
    arr.forEach((p) => {
      asArr(p && p.signals).forEach((s) => {
        if (!SIGNALS[s]) return;
        counts[s] = (counts[s] || 0) + 1;
      });
      total++;
    });
    _freqCache = { counts, total: total || 1 };
    _freqRef = arr;
    _freqLen = arr.length;
    return _freqCache;
  }

  function rarity(signalId, allProfiles) {
    const { counts, total } = frequencies(allProfiles);
    const c = counts[signalId] || 1;
    return 1 - c / total;
  }

  // Pick the rarest shared signal, fall back to the first when no frequency
  // table is available.
  function rarestSharedSignal(a, b, allProfiles) {
    const shared = sharedSignals(a, b);
    if (!shared.length) return null;
    let best = shared[0];
    let bestRarity = -Infinity;
    shared.forEach((id) => {
      const r = allProfiles ? rarity(id, allProfiles) : 0;
      if (r > bestRarity) { bestRarity = r; best = id; }
    });
    const def = SIGNALS[best];
    return {
      id: best,
      label: def.label,
      phrase: def.phrase,
      category: def.category,
      rarity: bestRarity,
      sharedCount: shared.length,
    };
  }

  // Convert rarity (0..1) into a small score multiplier (0..0.05). Even the
  // rarest bond is a tiebreaker, never a dominant signal.
  function bondScore(rarityVal) {
    if (rarityVal == null) return 0;
    return Math.max(0, Math.min(0.05, rarityVal * 0.06));
  }

  function labelFor(id)    { return (SIGNALS[id] && SIGNALS[id].label)    || id; }
  function categoryFor(id) { return (SIGNALS[id] && SIGNALS[id].category) || ""; }

  window.NMSignals = {
    SIGNALS,
    sharedSignals,
    rarestSharedSignal,
    bondScore,
    rarity,
    labelFor,
    categoryFor,
  };
})();
