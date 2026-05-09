/* Nucleus Match — UX glue (Person A owns this file).
   - Multi-step form helpers
   - Chip multi-select
   - Local profile storage
   - Match rendering using match.js + explain.js + integrations/affinity.js
*/
(function () {
  const NM = {};

  /* ------------------------------------------------------------------ */
  /* Toast                                                               */
  /* ------------------------------------------------------------------ */
  NM.toast = function (msg, ms = 1800) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(NM._toastT);
    NM._toastT = setTimeout(() => t.classList.remove("show"), ms);
  };

  /* ------------------------------------------------------------------ */
  /* Chip multi-select                                                   */
  /* ------------------------------------------------------------------ */
  function bindChips(root) {
    root.querySelectorAll(".chips").forEach((group) => {
      group.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        chip.classList.toggle("active");
      });
    });
  }
  function readChips(group) {
    const out = [];
    group.querySelectorAll(".chip.active").forEach((c) => {
      out.push(c.dataset.value || c.textContent.trim());
    });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Multi-step form                                                     */
  /* ------------------------------------------------------------------ */
  NM.initStepForm = function (selector, kind) {
    const form = document.querySelector(selector);
    if (!form) return;
    bindChips(form);

    function showStep(n) {
      form.querySelectorAll(".form-step").forEach((s) => {
        s.hidden = String(s.dataset.step) !== String(n);
      });
      document.querySelectorAll(".step").forEach((s) => {
        s.classList.toggle("active", Number(s.dataset.step) <= n);
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    form.addEventListener("click", (e) => {
      const next = e.target.dataset && e.target.dataset.next;
      const back = e.target.dataset && e.target.dataset.back;
      if (next) showStep(Number(next));
      if (back) showStep(Number(back));
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = collect(form, kind);
      const key = kind === "talent" ? "nm_talent_profile" : "nm_startup_profile";
      localStorage.setItem(key, JSON.stringify(data));
      window.location.href = `match.html?as=${kind}`;
    });
  };

  function collect(form, kind) {
    const fd = new FormData(form);
    const obj = {};
    fd.forEach((v, k) => (obj[k] = v));
    form.querySelectorAll(".chips[data-multi]").forEach((g) => {
      obj[g.dataset.multi] = readChips(g);
    });
    obj.id = (kind === "talent" ? "t-" : "s-") + Date.now().toString(36);
    if (obj.risk_tolerance) obj.risk_tolerance = Number(obj.risk_tolerance);
    if (obj.trl) obj.trl = Number(obj.trl);
    return obj;
  }

  /* ------------------------------------------------------------------ */
  /* Render matches on match.html                                        */
  /* ------------------------------------------------------------------ */
  NM.renderMatches = async function () {
    const params = new URLSearchParams(location.search);
    const demoId = params.get("demo");        // e.g. ?demo=t-001 or ?demo=s-001
    let as = params.get("as") || "talent";
    if (demoId) as = demoId.startsWith("s-") ? "startup" : "talent";

    const title = document.getElementById("match-title");
    const sub = document.getElementById("match-subtitle");

    const [talent, startups, events] = await Promise.all([
      fetch("data/talent.json").then((r) => r.json()).catch(() => []),
      fetch("data/startups.json").then((r) => r.json()).catch(() => []),
      fetch("data/handshake-events.json").then((r) => r.json()).catch(() => []),
    ]);
    if (window.NMMatch && window.NMMatch.setHandshakeEvents) {
      window.NMMatch.setHandshakeEvents(events);
    }
    if (window.NMMatch && window.NMMatch.setAllProfiles) {
      window.NMMatch.setAllProfiles([...talent, ...startups]);
    }

    let me;
    if (demoId) {
      me = (demoId.startsWith("s-") ? startups : talent).find((x) => x.id === demoId);
      if (!me) {
        title.textContent = "Demo profile not found";
        sub.textContent = `No profile with id ${demoId} in the data files.`;
        return;
      }
    } else {
      me = JSON.parse(
        localStorage.getItem(as === "talent" ? "nm_talent_profile" : "nm_startup_profile") || "null"
      );
      if (!me) {
        title.textContent = "No profile yet";
        sub.textContent = "Sign up first, then we'll find your matches.";
        return;
      }
    }

    const allCandidates = as === "talent" ? startups : talent;
    const candidates = allCandidates.filter((c) => c.id !== me.id);
    if (!Array.isArray(candidates) || candidates.length === 0) {
      title.textContent = "Match dataset not loaded yet";
      sub.textContent =
        "Person B: drop the synthetic profiles into data/talent.json and data/startups.json.";
      return;
    }

    const scored = candidates
      .map((c) => {
        const result = as === "talent"
          ? window.NMMatch.scoreTalentToStartup(me, c)
          : window.NMMatch.scoreTalentToStartup(c, me);
        return { other: c, ...result };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    title.textContent = `Top ${scored.length} matches for ${me.name || "you"}`;
    sub.textContent = `Ranked by 6-criteria fit + Handshake demand · ${as === "talent" ? "startups" : "talent"} from across Utah${demoId ? " · demo mode" : ""}`;

    const root = document.getElementById("results");
    root.innerHTML = "";
    scored.forEach(({ other, score, breakdown, top_reasons, demand, bond }) => {
      root.appendChild(renderCard(me, other, score, breakdown, top_reasons, as, demand, bond));
    });

    document.getElementById("export-csv").addEventListener("click", () => {
      window.NMAffinity.exportCSV(me, scored, as);
    });
  };

  /* ------------------------------------------------------------------ */
  /* Demo page                                                           */
  /* ------------------------------------------------------------------ */
  NM.renderDemoScenarios = async function () {
    const root = document.getElementById("demo-results");
    const [talent, startups, events] = await Promise.all([
      fetch("data/talent.json").then((r) => r.json()).catch(() => []),
      fetch("data/startups.json").then((r) => r.json()).catch(() => []),
      fetch("data/handshake-events.json").then((r) => r.json()).catch(() => []),
    ]);
    if (window.NMMatch && window.NMMatch.setHandshakeEvents) {
      window.NMMatch.setHandshakeEvents(events);
    }
    if (window.NMMatch && window.NMMatch.setAllProfiles) {
      window.NMMatch.setAllProfiles([...talent, ...startups]);
    }
    const scenarios = [
      { label: "Executive → Deep-tech startup", talentId: "t-001", startupId: "s-001" },
      { label: "Student → Research spinout",     talentId: "t-002", startupId: "s-002" },
      { label: "Operator → Scaling company",     talentId: "t-003", startupId: "s-003" },
    ];
    scenarios.forEach((sc) => {
      const t = talent.find((x) => x.id === sc.talentId);
      const s = startups.find((x) => x.id === sc.startupId);
      if (!t || !s) {
        const ph = document.createElement("div");
        ph.className = "card";
        ph.innerHTML = `<div class="tag">${sc.label}</div>
          <p class="muted mt-2">Add ${sc.talentId} + ${sc.startupId} to data files to populate this scenario.</p>`;
        root.appendChild(ph);
        return;
      }
      const result = window.NMMatch.scoreTalentToStartup(t, s);
      const card = renderCard(t, s, result.score, result.breakdown, result.top_reasons, "talent", result.demand, result.bond);
      const header = document.createElement("div");
      header.className = "flex between mb-0";
      const tag = document.createElement("div");
      tag.className = "tag";
      tag.textContent = sc.label;
      const live = document.createElement("a");
      live.className = "btn btn-secondary";
      live.style.padding = "8px 14px";
      live.href = `match.html?demo=${sc.talentId}`;
      live.textContent = `Open live for ${t.name.split(" ")[0]} →`;
      header.appendChild(tag);
      header.appendChild(live);
      card.prepend(header);
      root.appendChild(card);
    });
  };

  /* ------------------------------------------------------------------ */
  /* Match card renderer                                                 */
  /* ------------------------------------------------------------------ */
  function renderCard(me, other, score, breakdown, top_reasons, as, demand, bond) {
    const card = document.createElement("div");
    card.className = "card";

    const isStartup = !!other.sector;
    const initials = (other.name || "??")
      .split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

    // The "Rare bond" line is already prepended into top_reasons by match.js,
    // so strip it here to avoid duplication when we render the highlighted ribbon.
    const reasonsForBullets = (top_reasons || []).filter(
      (r) => !/^Rare bond — /.test(r)
    );
    const why = window.NMExplain.toBullets({
      me, other, breakdown, top_reasons: reasonsForBullets, perspective: as
    });

    const trendingPill = (isStartup && demand && demand.score >= 0.4)
      ? `<span class="trend-pill" title="${escape(demand.headline || "")}">↗ Trending on Handshake · ${demand.students} RSVPs</span>`
      : "";

    const bondRibbon = bond
      ? `<div class="bond-ribbon" title="The rarest signal both profiles share.">
           <span class="bond-kicker">Rare bond</span>
           <span class="bond-body">${escape(bond.phrase)}</span>
         </div>`
      : "";

    card.innerHTML = `
      ${bondRibbon}
      <div class="match-card">
        <div class="avatar">${initials}</div>
        <div>
          <div class="flex between">
            <div>
              <h3 class="mb-0">${escape(other.name || "Unnamed")}</h3>
              <div class="muted">${escape(other.headline || other.mission || "")}</div>
              <div class="mt-1">
                ${(other.sector ? `<span class="tag">${other.sector}</span>` : "")}
                ${(other.stage ? `<span class="tag">${other.stage}</span>` : "")}
                ${(other.role_type ? `<span class="tag">${other.role_type}</span>` : "")}
                ${(other.location ? `<span class="tag">${other.location}</span>` : "")}
                ${(other.school ? `<span class="tag">${other.school}</span>` : "")}
                ${trendingPill}
              </div>
            </div>
            <div class="score-pill">${Math.round(score)}% fit</div>
          </div>

          <div class="breakdown">
            ${barRow("Sector",       breakdown.sector)}
            ${barRow("Skills",       breakdown.skills)}
            ${barRow("Stage",        breakdown.stage)}
            ${barRow("Availability", breakdown.availability)}
            ${barRow("Risk",         breakdown.risk)}
            ${barRow("Mission",      breakdown.mission)}
          </div>

          <div class="why">
            <strong>Why matched?</strong>
            <ul>${why.map((b) => `<li>${escape(b)}</li>`).join("")}</ul>
          </div>

          <div class="flex mt-2" style="flex-wrap:wrap;">
            <button class="btn btn-primary" data-action="affinity">Send to Affinity ✓</button>
            <button class="btn btn-secondary" data-action="save">Save</button>
          </div>
        </div>
      </div>
    `;

    card.querySelector('[data-action="affinity"]').addEventListener("click", () => {
      window.NMAffinity.sendPair(me, other, score, top_reasons);
    });
    card.querySelector('[data-action="save"]').addEventListener("click", () => {
      NM.toast("Saved to your shortlist");
    });

    return card;
  }

  function barRow(label, v) {
    const pct = Math.round((v || 0) * 100);
    return `
      <div class="bar-row">
        <div class="muted">${label}</div>
        <div class="bar"><span style="width:${pct}%"></span></div>
        <div>${pct}%</div>
      </div>`;
  }
  function escape(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  window.NM = NM;
})();
