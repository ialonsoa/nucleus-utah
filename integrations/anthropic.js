/* Nucleus Match — Anthropic (Claude) integration.

   Direct browser → api.anthropic.com call using the
   `anthropic-dangerous-direct-browser-access: true` header. Anthropic added
   this header specifically for prototypes / demos that don't have a backend.

   Security note: in production this MUST move behind a server proxy (Cloudflare
   Worker, Vercel function, etc.). Putting an API key in client JS means anyone
   who opens the demo can read it from their browser's storage. For the
   hackathon: each judge / user supplies their OWN key, stored in their own
   browser's localStorage and never transmitted anywhere except to Anthropic.

   Public API (window.NMAnthropic):
     getApiKey()   / setApiKey(k)   / clearApiKey()
     getModel()    / setModel(m)
     isConfigured()                            -> boolean
     extractProfile({ url, text })             -> Promise<Profile|null>

   extractProfile() returns null on:
     - no API key set
     - empty input
     - network / API error
     - unparseable JSON response
   …so the calling layer (profile-builder.js) can fall back to the local
   heuristics without special-casing.
*/
(function () {
  const KEY_STORAGE        = "nm_anthropic_key";
  const LEGACY_KEY_STORAGE = "nm_claude_key";        // older key used by an earlier profile-builder draft
  const MODEL_STORAGE      = "nm_anthropic_model";
  const DEFAULT_MODEL      = "claude-haiku-4-5";

  const ENDPOINT     = "https://api.anthropic.com/v1/messages";
  const API_VERSION  = "2023-06-01";
  const MAX_TOKENS   = 1024;

  function safeGet(key) {
    try { return localStorage.getItem(key) || ""; }
    catch (_) { return ""; }
  }
  function safeSet(key, val) {
    try {
      if (val) localStorage.setItem(key, String(val));
      else     localStorage.removeItem(key);
    } catch (_) { /* private mode etc. — best effort */ }
  }

  // Read order: canonical key → legacy key. On legacy hit we migrate transparently.
  function getApiKey() {
    const fresh = safeGet(KEY_STORAGE).trim();
    if (fresh) return fresh;
    const legacy = safeGet(LEGACY_KEY_STORAGE).trim();
    if (legacy) {
      safeSet(KEY_STORAGE, legacy);
      safeSet(LEGACY_KEY_STORAGE, "");
      return legacy;
    }
    return "";
  }
  function setApiKey(k) {
    const v = String(k || "").trim();
    safeSet(KEY_STORAGE, v);
    safeSet(LEGACY_KEY_STORAGE, "");
  }
  function clearApiKey() {
    safeSet(KEY_STORAGE, "");
    safeSet(LEGACY_KEY_STORAGE, "");
  }

  function getModel() { return (safeGet(MODEL_STORAGE) || DEFAULT_MODEL).trim(); }
  function setModel(m) {
    const v = String(m || "").trim();
    safeSet(MODEL_STORAGE, v || DEFAULT_MODEL);
  }

  function isConfigured() { return !!getApiKey(); }

  // ------------------------------------------------------------------
  // Prompt construction.
  // ------------------------------------------------------------------
  function buildPrompt({ url, text }) {
    const C = window.NMConstants || {};
    const SECTORS = (C.SECTORS    || []).join(", ");
    const STAGES  = (C.STAGES     || []).join(", ");
    const AVAIL   = (C.AVAILABILITY || []).join(", ");
    const ROLES   = (C.ROLE_TYPES || []).join(", ");
    const SCHOOLS = (C.SCHOOLS    || []).join(", ");
    const SKILLS  = [
      "product strategy", "B2B SaaS", "GTM", "sales", "marketing",
      "engineering", "ML / AI", "hardware", "regulatory", "finance",
      "operations", "design", "research", "manufacturing",
    ].join(", ");

    return [
      "You extract structured Nucleus Match profiles from messy inputs (LinkedIn copy, faculty bios, resume snippets).",
      "",
      "Return ONLY a JSON object — no markdown fences, no commentary, no preamble. Use ONLY values from the listed enums; leave a string empty (\"\") or an array empty ([]) when unknown rather than inventing.",
      "",
      "Schema:",
      "{",
      "  \"name\":          string,",
      "  \"headline\":      string (<=140 chars, e.g. \"Ex-Pluralsight VP Product · Lehi\"),",
      `  "role_type":     one of [${ROLES}] or "",`,
      `  "school":        one of [${SCHOOLS}] or "",`,
      "  \"location\":      string (Utah city only, e.g. \"Lehi\" or \"Salt Lake City\" — no \", UT\" suffix),",
      `  "skills":        string[] (subset of [${SKILLS}]),`,
      `  "domains":       string[] (subset of [${SECTORS}]),`,
      `  "stage_pref":    string[] (subset of [${STAGES}]),`,
      `  "availability":  one of [${AVAIL}] or "",`,
      "  \"risk_tolerance\": integer 1..5 (1 = stable salary required, 5 = founding-team risk welcome),",
      "  \"mission\":       one sentence",
      "}",
      "",
      "Heuristics:",
      "- Faculty / professors: role_type = \"advisor\", availability = \"advisory\", risk_tolerance 4–5.",
      "- MS / PhD students: role_type = \"student\", availability = \"internship\", risk_tolerance 5.",
      "- VPs / Heads / C-levels: role_type = \"executive\", availability = \"fractional\", risk_tolerance 4.",
      "- Map \"AI\" / \"ML\" / \"machine learning\" to domain \"ai\".",
      "- Map \"biotech\" / \"medtech\" / \"biomedical\" / \"pharma\" to domain \"life-sciences\".",
      "- Map \"manufacturing\" / \"materials\" / \"3D printing\" to domain \"advanced-manufacturing\".",
      "- Schools: \"BYU\" / \"Brigham Young\" → BYU; \"U of U\" / \"University of Utah\" → University of Utah; \"USU\" / \"Utah State\" → Utah State University; \"UVU\" / \"Utah Valley\" → Utah Valley University.",
      "- If location reads \"Salt Lake City, UT\" return just \"Salt Lake City\".",
      "",
      `Input URL: ${url || "(none)"}`,
      "",
      "Input text:",
      text || "(none)",
      "",
      "Return ONLY the JSON object.",
    ].join("\n");
  }

  // ------------------------------------------------------------------
  // Network call.
  // ------------------------------------------------------------------
  async function callClaude(prompt, { signal } = {}) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("No Anthropic API key configured.");

    const body = {
      model:      getModel(),
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "user",      content: prompt },
        // Prefill the assistant turn with `{` to coerce JSON-only output.
        { role: "assistant", content: "{" },
      ],
    };

    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal,
      headers: {
        "x-api-key":                                 apiKey,
        "anthropic-version":                         API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
        "content-type":                              "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = "";
      try { detail = (await res.text()).slice(0, 240); } catch (_) {}
      throw new Error(`Anthropic ${res.status}: ${detail || res.statusText}`);
    }

    const data = await res.json();
    const block = (data.content || []).find((c) => c.type === "text");
    if (!block || !block.text) throw new Error("Empty Claude response.");

    // Re-attach the prefilled `{` so the result parses as a complete object.
    return "{" + block.text;
  }

  // ------------------------------------------------------------------
  // Output normalization — clamp Claude's strings to canonical vocab.
  // ------------------------------------------------------------------
  function clampOne(value, allowed) {
    if (value == null) return "";
    const s = String(value).trim();
    if (!s) return "";
    const lc = s.toLowerCase();
    return allowed.find((v) => v.toLowerCase() === lc) || "";
  }
  function clampMany(values, allowed) {
    if (!Array.isArray(values)) return [];
    const out = [];
    const seen = new Set();
    values.forEach((v) => {
      const m = clampOne(v, allowed);
      if (m && !seen.has(m)) { seen.add(m); out.push(m); }
    });
    return out;
  }
  function clampSchool(value) {
    const C = window.NMConstants;
    if (!value) return "";
    if (C && C.SCHOOLS.includes(value)) return value;
    if (!C) return String(value);
    const tag = C.schoolTag(value);
    return tag ? C.schoolDisplay(tag) : "";
  }
  function clampLocation(loc) {
    return String(loc || "").replace(/,\s*UT$/i, "").trim();
  }
  function clampRisk(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 3;
    return Math.max(1, Math.min(5, Math.round(v)));
  }
  function clampString(s, maxLen = 200) {
    return String(s || "").trim().slice(0, maxLen);
  }

  function normalize(raw) {
    const C = window.NMConstants || {};
    const SKILLS = [
      "product strategy", "B2B SaaS", "GTM", "sales", "marketing",
      "engineering", "ML / AI", "hardware", "regulatory", "finance",
      "operations", "design", "research", "manufacturing",
    ];
    return {
      name:           clampString(raw.name, 80),
      headline:       clampString(raw.headline, 140),
      role_type:      clampOne(raw.role_type, C.ROLE_TYPES || []),
      school:         clampSchool(raw.school),
      location:       clampLocation(raw.location),
      skills:         clampMany(raw.skills,     SKILLS),
      domains:        clampMany(raw.domains,    C.SECTORS || []),
      stage_pref:     clampMany(raw.stage_pref, C.STAGES  || []),
      availability:   clampOne(raw.availability, C.AVAILABILITY || []),
      risk_tolerance: clampRisk(raw.risk_tolerance),
      mission:        clampString(raw.mission, 240),
      _source:        "Claude (" + getModel() + ")",
    };
  }

  // ------------------------------------------------------------------
  // Public extract — returns a normalized profile or null.
  // ------------------------------------------------------------------
  async function extractProfile({ url, text } = {}, opts = {}) {
    if (!isConfigured()) return null;
    const u = String(url  || "").trim();
    const t = String(text || "").trim();
    if (!u && !t) return null;

    let json;
    try {
      const raw = await callClaude(buildPrompt({ url: u, text: t }), opts);
      json = JSON.parse(raw);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[NMAnthropic] extract failed:", err.message);
      return null;
    }
    return normalize(json);
  }

  window.NMAnthropic = {
    getApiKey,
    setApiKey,
    clearApiKey,
    getModel,
    setModel,
    isConfigured,
    extractProfile,
    DEFAULT_MODEL,
  };
})();
