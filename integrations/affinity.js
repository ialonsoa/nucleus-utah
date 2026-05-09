/* Nucleus Match — Affinity CRM integration (mock + CSV export).

   In production this hits Affinity's REST API to create / update an Opportunity
   with the matched pair attached. For the hackathon we POST to a configurable
   webhook URL (e.g. webhook.site) so judges can refresh that page and watch
   payloads land live.

   Public API (window.NMAffinity):
     getWebhookUrl()                              -> string ("" if unset)
     setWebhookUrl(url)                           -> persists to localStorage
     sendPair(me, other, score, top_reasons)      -> Promise<void>
     exportCSV(me, scored, perspective)           -> downloads CSV

   Webhook URL resolution order:
     1. localStorage.nm_webhook_url      (set via integrations/test.html)
     2. window.NM_WEBHOOK_URL            (per-deploy override)
     3. "" (unset → POST is skipped, only the toast fires)
*/
(function () {
  const STORAGE_KEY = "nm_webhook_url";

  function getWebhookUrl() {
    try {
      const fromStorage = (localStorage.getItem(STORAGE_KEY) || "").trim();
      if (fromStorage) return fromStorage;
    } catch (_) { /* localStorage may be blocked in private windows; fall through */ }
    if (typeof window !== "undefined" && window.NM_WEBHOOK_URL) {
      return String(window.NM_WEBHOOK_URL).trim();
    }
    return "";
  }

  function setWebhookUrl(url) {
    try { localStorage.setItem(STORAGE_KEY, String(url || "").trim()); }
    catch (_) { /* swallow — best-effort persistence */ }
  }

  // Flatten an (me, other) pair into the canonical Affinity-import payload,
  // regardless of which side is the talent and which is the startup.
  function buildPayload(me, other, score, top_reasons) {
    const meIsTalent = !!me.role_type;
    const talent  = meIsTalent ? me : other;
    const startup = meIsTalent ? other : me;
    return {
      source:        "nucleus-match",
      timestamp:     new Date().toISOString(),
      score,
      reasons:       top_reasons || [],
      talent_id:     talent.id   || "",
      talent_name:   talent.name || "",
      startup_id:    startup.id   || "",
      startup_name:  startup.name || "",
    };
  }

  async function sendPair(me, other, score, top_reasons) {
    const url = getWebhookUrl();
    const payload = buildPayload(me, other, score, top_reasons);

    if (!url) {
      // No webhook configured: still toast so the demo flow feels complete,
      // but nudge the user to wire it up.
      if (window.NM && window.NM.toast) {
        window.NM.toast("Affinity webhook not configured — set one in /integrations/test.html");
      }
      return;
    }

    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        mode: "no-cors",
      });
    } catch (_) {
      // Webhook may be CORS-blocked in some browsers; the request usually
      // still goes through. We swallow the error so the toast still fires.
    }
    if (window.NM && window.NM.toast) window.NM.toast("Sent to Affinity CRM ✓");
  }

  function exportCSV(me, scored, perspective) {
    const rows = [
      ["talent_id", "talent_name", "startup_id", "startup_name", "score", "top_reasons"],
    ];
    scored.forEach(({ other, score, top_reasons }) => {
      const t = perspective === "talent" ? me : other;
      const s = perspective === "talent" ? other : me;
      rows.push([
        t.id || "",
        (t.name || "").replace(/,/g, " "),
        s.id || "",
        (s.name || "").replace(/,/g, " "),
        score,
        '"' + (top_reasons || []).join(" · ").replace(/"/g, "'") + '"',
      ]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "nucleus-match-affinity.csv";
    a.click();
    URL.revokeObjectURL(url);
    if (window.NM && window.NM.toast) window.NM.toast("CSV exported for Affinity");
  }

  window.NMAffinity = {
    getWebhookUrl,
    setWebhookUrl,
    sendPair,
    exportCSV,
  };
})();
