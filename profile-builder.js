/* Nucleus Match — AI Profile Builder.

   Paste a LinkedIn URL, a faculty page URL, or any bio/resume text and we
   return a fully structured Nucleus profile. The builder uses a layered
   approach with graceful fallback at every step:

     1. URL fixture lookup — known LinkedIn / .edu URLs map to canonical
        Utah profiles already in our dataset. Instant + deterministic.
     2. Claude (Anthropic) extraction — when the user has set an API key
        via the AI Settings panel, we delegate to integrations/anthropic.js.
        That module handles transport, prompting, and clamps Claude's
        output to our canonical chip vocabularies (core/constants.js).
     3. Local heuristic inference — keyword + regex over the pasted text.
        Always available, no auth required, ~1s simulated delay.
     4. URL-only stub — last-resort school/role inference from the domain.

   Public surface (window.NMProfileBuilder):
     extract(url, text)            -> Promise<Profile>
     applyToForm(profile, formEl)  -> number (count of fields filled)
     SAMPLE_TEXTS                  -> { maya, jacob, brad }

   Claude API key + model are managed by window.NMAnthropic (see
   integrations/anthropic.js); back-compat shims below preserve the older
   getApiKey / setApiKey / hasApiKey surface for any existing callers.
*/
(function () {
  // ------------------------------------------------------------------
  // Vocabularies — must match talent.html chip values.
  // ------------------------------------------------------------------
  const SKILL_VOCAB = [
    "product strategy", "B2B SaaS", "GTM", "sales", "marketing",
    "engineering", "ML / AI", "hardware", "regulatory", "finance",
    "operations", "design", "research", "manufacturing",
  ];
  const DOMAIN_KEYWORDS = {
    "life-sciences": ["bio", "biotech", "pharma", "drug", "clinical", "medical", "biomedical", "neuro", "genomic", "life science"],
    "ai":            ["ai", "machine learning", "ml /", "deep learning", "nlp", "computer vision", "llm", "ml researcher", "ml engineer"],
    "defense":       ["defense", "aerospace", "northrop", "l3harris", "uav", "satellite", "national security", "dod"],
    "cyber":         ["cyber", "infosec", "security engineer", "appsec", "cloud security", "penetration"],
    "energy":        ["energy", "solar", "wind", "battery", "cleantech", "grid", "geothermal"],
    "advanced-manufacturing": ["manufacturing", "materials", "additive", "3d print", "metallurgy", "aerospace materials", "mech eng", "mechanical engineer"],
    "fintech":       ["fintech", "payments", "billing", "saas billing", "ledger", "banking", "ledgerloop"],
    "software":      ["software", "saas", "b2b saas", "engineer", "full stack", "frontend", "backend", "platform"],
  };
  const SKILL_KEYWORDS = {
    "product strategy":  ["vp product", "product manager", "product strategy", "head of product", "product lead"],
    "B2B SaaS":          ["b2b saas", "saas", "enterprise software", "salesforce", "qualtrics", "pluralsight"],
    "GTM":               ["go-to-market", "gtm", "growth", "revenue ops", "rev ops"],
    "sales":             ["sales", "account executive", "sales engineer", "sdr", "ae"],
    "marketing":         ["marketing", "brand", "demand gen", "growth marketing"],
    "engineering":       ["engineer", "developer", "software engineer", "ml engineer"],
    "ML / AI":           ["machine learning", "ml engineer", "ai engineer", "deep learning", "data scientist"],
    "hardware":          ["hardware", "robotics", "embedded", "fpga", "circuit"],
    "regulatory":        ["regulatory", "fda", "compliance"],
    "finance":           ["finance", "cfo", "fp&a", "investment"],
    "operations":        ["operations", "coo", "ops"],
    "design":            ["design", "ux", "ui", "designer"],
    "research":          ["research", "phd", "postdoc", "professor", "scientist", "lab", "publication"],
    "manufacturing":     ["manufacturing", "production", "process engineer"],
  };
  const ROLE_KEYWORDS = {
    "executive":  ["vp ", "ceo", "cto", "coo", "cro", "founder", "co-founder", "head of"],
    "operator":   ["engineer", "manager", "lead", "specialist", "consultant", "designer"],
    "student":    ["student", "ms candidate", "phd candidate", "undergrad", "junior at", "senior at"],
    "intern":     ["intern", "internship"],
    "advisor":    ["advisor", "professor", "associate professor", "assistant professor", "faculty"],
    "mentor":     ["mentor", "teaching professor"],
    "board":      ["board member", "board director"],
  };
  const SCHOOL_KEYWORDS = {
    "BYU":                  ["byu", "brigham young university", "marriott school"],
    "University of Utah":   ["university of utah", "u of u", "uofu"],
    "Utah State University":["utah state university", "usu", "utah state"],
    "Utah Valley University":["utah valley university", "uvu"],
  };
  const UTAH_CITIES = [
    "Salt Lake City", "Provo", "Lehi", "Ogden", "Logan", "Park City",
    "Orem", "Sandy", "South Jordan", "Draper", "American Fork",
  ];
  const STAGE_HINTS = {
    "executive":  ["pre-seed", "seed", "series-a"],
    "operator":   ["seed", "series-a", "growth"],
    "student":    ["idea", "pre-seed"],
    "intern":     ["idea", "pre-seed"],
    "advisor":    ["idea", "pre-seed", "seed"],
    "mentor":     ["pre-seed", "seed"],
    "board":      ["seed", "series-a"],
  };
  const AVAIL_HINTS = {
    "executive":  "fractional",
    "operator":   "full-time",
    "student":    "internship",
    "intern":     "internship",
    "advisor":    "advisory",
    "mentor":     "advisory",
    "board":      "advisory",
  };

  // ------------------------------------------------------------------
  // Demo fixtures — known URLs map to canonical Utah profiles.
  // ------------------------------------------------------------------
  const URL_FIXTURES = [
    {
      pattern: /linkedin\.com\/in\/maya-chen|linkedin\.com\/in\/mayachen/i,
      profile: {
        name: "Maya Chen",
        headline: "Ex-Pluralsight VP Product · Lehi",
        role_type: "executive",
        school: "BYU",
        location: "Lehi",
        skills: ["product strategy", "B2B SaaS", "GTM", "operations"],
        domains: ["software", "ai", "advanced-manufacturing"],
        stage_pref: ["pre-seed", "seed"],
        availability: "fractional",
        risk_tolerance: 4,
        mission: "Help Utah-grown deep tech reach national markets.",
        _source: "LinkedIn",
      },
    },
    {
      pattern: /me\.byu\.edu\/faculty\/bradadams|byu\.edu.*brad-adams|linkedin\.com\/in\/bradadams/i,
      profile: {
        name: "Brad Adams",
        headline: "Associate Professor · BYU Mech Eng · materials microstructure & EBSD",
        role_type: "advisor",
        school: "BYU",
        location: "Provo",
        // Only chip-canonical values here so auto-fill actually activates the form chips.
        // Niche specialties (materials science, microstructure, EBSD) live in the headline + mission.
        skills: ["research", "engineering", "manufacturing"],
        domains: ["advanced-manufacturing"],
        stage_pref: ["idea", "pre-seed", "seed"],
        availability: "advisory",
        risk_tolerance: 4,
        mission: "Translate BYU materials microstructure & EBSD research into Utah deep-tech ventures.",
        _source: "BYU faculty page",
      },
    },
    {
      pattern: /linkedin\.com\/in\/jacob-reyes|linkedin\.com\/in\/jacobreyes|utah\.edu.*reyes/i,
      profile: {
        name: "Jacob Reyes",
        headline: "U of U Bioengineering MS · drug delivery",
        role_type: "student",
        school: "University of Utah",
        location: "Salt Lake City",
        skills: ["research", "engineering", "ML / AI"],
        domains: ["life-sciences"],
        stage_pref: ["idea", "pre-seed"],
        availability: "internship",
        risk_tolerance: 5,
        mission: "Translate Utah research from bench to bedside.",
        _source: "LinkedIn",
      },
    },
  ];

  // ------------------------------------------------------------------
  // Local AI extraction over free-form text.
  // ------------------------------------------------------------------
  function lc(s) { return String(s || "").toLowerCase(); }
  function unique(arr) { return [...new Set(arr)]; }

  function detectName(text) {
    // First non-empty line is usually the name on resumes / LinkedIn copy.
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 5)) {
      // Heuristic: 2–4 words, mostly capitalized, no commas / colons.
      const words = line.split(/\s+/);
      if (words.length < 2 || words.length > 4) continue;
      if (/[,:•|@]/.test(line)) continue;
      const capCount = words.filter((w) => /^[A-Z][a-zA-Z'\-.]+$/.test(w)).length;
      if (capCount >= words.length - 1) return line;
    }
    return "";
  }

  function detectLocation(text) {
    for (const city of UTAH_CITIES) {
      if (text.toLowerCase().includes(city.toLowerCase())) return city;
    }
    const m = text.match(/([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*),\s*(UT|Utah)\b/);
    if (m) return m[1];
    return "";
  }

  function detectSchool(text) {
    const t = lc(text);
    for (const [school, kws] of Object.entries(SCHOOL_KEYWORDS)) {
      if (kws.some((k) => t.includes(k))) return school;
    }
    return "";
  }

  function detectRole(text) {
    const t = lc(text);
    let bestRole = "";
    let bestPos = Infinity;
    for (const [role, kws] of Object.entries(ROLE_KEYWORDS)) {
      for (const kw of kws) {
        const idx = t.indexOf(kw);
        if (idx >= 0 && idx < bestPos) { bestRole = role; bestPos = idx; }
      }
    }
    return bestRole;
  }

  function detectSkills(text) {
    const t = lc(text);
    const found = [];
    for (const [skill, kws] of Object.entries(SKILL_KEYWORDS)) {
      if (kws.some((k) => t.includes(k))) found.push(skill);
    }
    return found.length ? unique(found) : [];
  }

  function detectDomains(text) {
    const t = lc(text);
    const found = [];
    for (const [domain, kws] of Object.entries(DOMAIN_KEYWORDS)) {
      if (kws.some((k) => t.includes(k))) found.push(domain);
    }
    return found.length ? unique(found) : [];
  }

  function detectHeadline(text, name) {
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const nameIdx = name ? lines.findIndex((l) => l === name) : -1;
    const candidate = nameIdx >= 0 && lines[nameIdx + 1] ? lines[nameIdx + 1] : lines[1] || "";
    return candidate.length > 4 && candidate.length < 140 ? candidate : "";
  }

  function detectMission(text) {
    const m = text.match(/(?:my mission|i (?:want|aim|hope) to|i'm passionate about|focused on)\s+([^.\n]{10,160})/i);
    return m ? (m[0].charAt(0).toUpperCase() + m[0].slice(1)).replace(/\s+/g, " ").trim() + "." : "";
  }

  function inferFromText(text) {
    if (!text || text.trim().length < 10) return null;
    const name = detectName(text);
    const role = detectRole(text);
    const skills = detectSkills(text);
    const domains = detectDomains(text);
    const profile = {
      name,
      headline: detectHeadline(text, name),
      role_type: role,
      school: detectSchool(text),
      location: detectLocation(text),
      skills,
      domains,
      stage_pref: STAGE_HINTS[role] || ["seed"],
      availability: AVAIL_HINTS[role] || "",
      risk_tolerance: role === "student" || role === "advisor" ? 5 : (role === "executive" ? 4 : 3),
      mission: detectMission(text),
      _source: "Pasted text",
    };
    return profile;
  }

  // ------------------------------------------------------------------
  // Public extract — layered fallback chain.
  // ------------------------------------------------------------------
  async function extract(url, text) {
    // Layer 1: known-URL fixture — instant, deterministic, perfect for demos.
    if (url) {
      for (const fx of URL_FIXTURES) {
        if (fx.pattern.test(url)) {
          // Small delay so the UX still feels like an inference call.
          await new Promise((r) => setTimeout(r, 550 + Math.random() * 250));
          return Object.assign({}, fx.profile);
        }
      }
    }

    // Layer 2: Claude (Anthropic) — only when an API key is configured.
    // Output is already vocabulary-clamped by integrations/anthropic.js.
    if (window.NMAnthropic && window.NMAnthropic.isConfigured() &&
        (url || (text && text.trim().length > 10))) {
      const fromClaude = await window.NMAnthropic.extractProfile({ url, text });
      if (fromClaude) return fromClaude;
      // null → fell through (network / parse error) → drop to local heuristics.
    }

    // Layer 3: local heuristic inference — keyword + regex over pasted text.
    await new Promise((r) => setTimeout(r, 850 + Math.random() * 350));
    const fromText = inferFromText(text);
    if (fromText) return fromText;

    // Layer 4: last-resort school/role inference from the URL alone.
    if (url) {
      const u = lc(url);
      const out = {
        name: "", headline: "", role_type: "", school: "", location: "",
        skills: [], domains: [], stage_pref: [], availability: "",
        risk_tolerance: 3, mission: "", _source: "URL",
      };
      if      (u.includes("byu.edu"))      { out.school = "BYU";                    out.role_type = "advisor";  }
      else if (u.includes("utah.edu"))     { out.school = "University of Utah";     out.role_type = "advisor";  }
      else if (u.includes("usu.edu"))      { out.school = "Utah State University";  out.role_type = "advisor";  }
      else if (u.includes("linkedin.com")) { out.role_type = "operator"; }
      return out;
    }

    return { _source: "empty", name: "", headline: "" };
  }

  // Back-compat shims for any existing caller wired before the Claude
  // transport moved into integrations/anthropic.js. New code should call
  // window.NMAnthropic directly.
  function getApiKey()  { return window.NMAnthropic ? window.NMAnthropic.getApiKey()  : ""; }
  function setApiKey(k) { if (window.NMAnthropic) window.NMAnthropic.setApiKey(k); }
  function hasApiKey()  { return window.NMAnthropic ? window.NMAnthropic.isConfigured() : false; }

  function setVal(form, name, value) {
    if (!value && value !== 0) return false;
    const el = form.querySelector(`[name="${name}"]`);
    if (!el) return false;
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.classList.add("ai-filled");
    setTimeout(() => el.classList.remove("ai-filled"), 1800);
    return true;
  }

  function toggleChips(form, multiName, values) {
    if (!values || !values.length) return;
    const group = form.querySelector(`.chips[data-multi="${multiName}"]`);
    if (!group) return;
    const wanted = new Set(values.map((v) => String(v).toLowerCase()));
    group.querySelectorAll(".chip").forEach((chip) => {
      const v = (chip.dataset.value || chip.textContent.trim()).toLowerCase();
      const should = wanted.has(v);
      chip.classList.toggle("active", should);
      if (should) {
        chip.classList.add("ai-pulse");
        setTimeout(() => chip.classList.remove("ai-pulse"), 1800);
      }
    });
  }

  function applyToForm(profile, form) {
    if (!profile || !form) return 0;
    let filled = 0;
    if (setVal(form, "name", profile.name)) filled++;
    if (setVal(form, "headline", profile.headline)) filled++;
    if (setVal(form, "role_type", profile.role_type)) filled++;
    if (setVal(form, "school", profile.school)) filled++;
    if (setVal(form, "location", profile.location)) filled++;
    if (setVal(form, "availability", profile.availability)) filled++;
    if (setVal(form, "risk_tolerance", profile.risk_tolerance)) {
      const rv = document.getElementById("risk_val");
      if (rv) rv.textContent = String(profile.risk_tolerance);
      filled++;
    }
    if (setVal(form, "mission", profile.mission)) filled++;
    toggleChips(form, "skills", profile.skills);
    toggleChips(form, "domains", profile.domains);
    toggleChips(form, "stage_pref", profile.stage_pref);
    if ((profile.skills || []).length) filled++;
    if ((profile.domains || []).length) filled++;
    if ((profile.stage_pref || []).length) filled++;
    return filled;
  }

  // Demo paste samples — used by the "Try a sample" buttons in the UI.
  const SAMPLE_TEXTS = {
    maya: `Maya Chen
Ex-Pluralsight VP Product · Lehi, UT

About
Product leader with 12 years scaling B2B SaaS at Pluralsight and Qualtrics.
Now fractional with Utah-grown deep tech. I'm passionate about helping Utah-grown deep tech reach national markets.

Skills: product strategy, B2B SaaS, GTM, operations, team building
Industries: software, AI, advanced manufacturing
Education: BYU Marriott School of Business`,

    jacob: `Jacob Reyes
U of U Bioengineering MS · drug delivery
Salt Lake City, UT

About
Master's student at the University of Utah focused on targeted drug delivery research.
Looking for an internship in life sciences or biotech with a Utah research spinout.
I want to translate Utah research from bench to bedside.

Skills: research, engineering, ML / AI
Lab: Drug Delivery Lab, U of U`,

    brad: `Brad Adams
Associate Professor · BYU Mech Eng · materials microstructure & EBSD
Provo, UT

About
Faculty at Brigham Young University researching materials microstructure, EBSD, and
mechanical engineering applied to advanced manufacturing. Open to advisory roles
with BYU spinouts in advanced manufacturing.

Skills: materials science, microstructure, EBSD, research, engineering`,
  };

  window.NMProfileBuilder = {
    extract,
    applyToForm,
    getApiKey,
    setApiKey,
    hasApiKey,
    SAMPLE_TEXTS,
  };
})();
