/* Nucleus Match — explanation layer.
   Turns the breakdown + top_reasons from match.js into 3 friendly bullets,
   in a Utah-aware voice. 100% client-side, deterministic.
*/
(function () {
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function utahFlavor(t, s) {
    const flavors = [];
    if (t && s && t.location && s.location) {
      const tCity = String(t.location).split(",")[0];
      const sCity = String(s.location).split(",")[0];
      if (tCity && sCity && tCity.toLowerCase() === sCity.toLowerCase()) {
        flavors.push(`Both based in ${tCity} — easy in-person collaboration.`);
      }
    }
    if (t && s && t.school && s.origin && String(s.origin).toLowerCase().includes(String(t.school).toLowerCase())) {
      flavors.push(`Shared ${t.school} network — warm intro likely.`);
    }
    return flavors;
  }

  function toBullets({ me, other, breakdown, top_reasons, perspective }) {
    const t = perspective === "talent" ? me : other;
    const s = perspective === "talent" ? other : me;
    const out = [...(top_reasons || [])].slice(0, 3);
    const extra = utahFlavor(t, s);
    extra.forEach((e) => { if (out.length < 4) out.push(e); });
    if (out.length < 3) {
      const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
      const [k, v] = sorted[0] || [];
      if (k) out.push(`Strongest signal: ${k} (${Math.round(v * 100)}%).`);
    }
    return out;
  }

  window.NMExplain = { toBullets };
})();
