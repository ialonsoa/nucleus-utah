/* Nucleus Match — explanation layer.

   Turns the breakdown + top_reasons from core/match.js into 3 friendly bullets,
   in a Utah-aware voice. 100% client-side, deterministic.

   Public API (window.NMExplain):
     toBullets({ me, other, breakdown, top_reasons, perspective }) -> string[]
*/
(function () {
  const C = window.NMConstants;

  function utahFlavor(t, s) {
    const flavors = [];
    if (t && s && t.location && s.location) {
      const tCity = String(t.location).split(",")[0];
      const sCity = String(s.location).split(",")[0];
      if (tCity && sCity && tCity.toLowerCase() === sCity.toLowerCase()) {
        flavors.push(`Both based in ${tCity} — easy in-person collaboration.`);
      }
    }
    // Use the canonical school tag (BYU, U of U, USU, UVU) so "University of
    // Utah" matches a "U of U spinout" origin string.
    if (t && s && t.school && s.origin) {
      const tag = C ? C.schoolTag(t.school) : String(t.school).toLowerCase();
      if (tag && String(s.origin).toLowerCase().includes(tag)) {
        flavors.push(`Shared ${t.school} network — warm intro likely.`);
      }
    }
    return flavors;
  }

  function toBullets({ me, other, breakdown, top_reasons, perspective }) {
    const t = perspective === "talent" ? me : other;
    const s = perspective === "talent" ? other : me;
    const out = [...(top_reasons || [])].slice(0, 3);
    const extra = utahFlavor(t, s);
    extra.forEach((e) => { if (out.length < 4 && !out.includes(e)) out.push(e); });
    if (out.length < 3 && breakdown) {
      const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
      const [k, v] = sorted[0] || [];
      if (k) out.push(`Strongest signal: ${k} (${Math.round(v * 100)}%).`);
    }
    return out;
  }

  window.NMExplain = { toBullets };
})();
