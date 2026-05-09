/* Nucleus Match — Handshake integration (mock).

   In production this calls Handshake's Partner API to pull authenticated event
   data scoped to BYU / U of U / USU career-services accounts. For the hackathon
   we ship a static fixture (data/handshake-events.json) that mirrors Handshake's
   real event shape so the matching engine and demo UI can light up today.

   Public API (window.NMHandshake):
     loadEvents()                              -> Promise<Event[]>
     eventsForStartup(startup, events)         -> Event[] (sector-aligned)
     eventsForTalent(talent, events)           -> Event[] (school + domain + audience aligned)
     demandSignal(startup, events)             -> { count, students, reasons[], events }
     enrichTalent(talent, attendedIds, events) -> Talent (adds inferred skills/domains)

   School-tag canonicalization is delegated to core/constants.js so this module
   stays in lockstep with the matcher and ecosystem map.
*/
(function () {
  const C = window.NMConstants;

  function lc(s) { return String(s == null ? "" : s).toLowerCase().trim(); }
  function schoolTag(name) {
    return C ? C.schoolTag(name) : lc(name);
  }

  async function loadEvents() {
    const res = await fetch("data/handshake-events.json");
    if (!res.ok) throw new Error("Failed to load Handshake events");
    return res.json();
  }

  function eventMatchesSchool(ev, schoolName) {
    const tag = schoolTag(schoolName);
    if (!tag) return false;
    return (ev.schools || []).some((s) => schoolTag(s) === tag);
  }

  function eventsForStartup(startup, events) {
    const sector = lc(startup && startup.sector);
    return (events || []).filter((ev) => (ev.sectors || []).map(lc).includes(sector));
  }

  function eventsForTalent(talent, events) {
    const domains = new Set((talent.domains || []).map(lc));
    const role = lc(talent.role_type);
    return (events || []).filter((ev) => {
      const sectorHit = (ev.sectors || []).some((s) => domains.has(lc(s)));
      const schoolHit = eventMatchesSchool(ev, talent.school);
      const audHit    = (ev.audience || []).map(lc).includes(role);
      return sectorHit && (schoolHit || audHit);
    });
  }

  // Compress relevant events into a single "demand" signal a startup can use
  // during matching: how many Utah students are visibly interested right now?
  function demandSignal(startup, events) {
    const matched = eventsForStartup(startup, events);
    let students = 0;
    matched.forEach((ev) => { students += Number(ev.students_going) || 0; });
    const reasons = [];
    if (matched.length) {
      const top = [...matched].sort(
        (a, b) => (b.students_going || 0) - (a.students_going || 0)
      )[0];
      reasons.push(
        `${students} Utah students RSVP'd to ${matched.length} ${startup.sector} events on Handshake — strongest is ${top.title} (${top.students_going}).`
      );
    }
    return { count: matched.length, students, reasons, events: matched };
  }

  // Layer Handshake-derived signal onto a talent profile without mutating it.
  // attendedIds = string[] of event ids the student RSVP'd to.
  function enrichTalent(talent, attendedIds, events) {
    const attended = (events || []).filter((ev) => (attendedIds || []).includes(ev.id));
    if (!attended.length) return talent;

    const inferredSkills  = new Set((talent.skills  || []).map(lc));
    const inferredDomains = new Set((talent.domains || []).map(lc));
    attended.forEach((ev) => {
      (ev.skills_signaled || []).forEach((s) => inferredSkills.add(lc(s)));
      (ev.sectors         || []).forEach((s) => inferredDomains.add(lc(s)));
    });

    return Object.assign({}, talent, {
      skills:             [...inferredSkills],
      domains:            [...inferredDomains],
      _handshake_events:  attended.map((e) => ({ id: e.id, title: e.title })),
    });
  }

  window.NMHandshake = {
    loadEvents,
    eventsForStartup,
    eventsForTalent,
    demandSignal,
    enrichTalent,
  };
})();
