/* Nucleus Match — Affinity CRM integration (mock + CSV export).

   In production this hits Affinity's REST API to create / update an Opportunity
   with the matched pair attached. For the hackathon we POST to a webhook.site
   URL so judges can see the payload land in real time, and we provide a CSV
   export that maps cleanly to Affinity's import schema.
*/
(function () {
  // Replace WEBHOOK_URL with your webhook.site URL during the demo so judges
  // can refresh that page and watch payloads arrive live.
  const WEBHOOK_URL = "https://webhook.site/REPLACE-ME-DURING-DEMO";

  async function sendPair(me, other, score, top_reasons) {
    const payload = {
      source: "nucleus-match",
      timestamp: new Date().toISOString(),
      score,
      reasons: top_reasons,
      talent_id: me.role_type ? me.id : other.id,
      startup_id: me.sector ? me.id : other.id,
      talent_name: me.role_type ? me.name : other.name,
      startup_name: me.sector ? me.name : other.name,
    };

    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        mode: "no-cors",
      });
    } catch (e) {
      // Webhook may be CORS-blocked; that's fine for the demo — the toast still fires.
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nucleus-match-affinity.csv";
    a.click();
    URL.revokeObjectURL(url);
    if (window.NM && window.NM.toast) window.NM.toast("CSV exported for Affinity");
  }

  window.NMAffinity = { sendPair, exportCSV };
})();
