#!/usr/bin/env node
/* Nucleus Match — synthetic data validator.

   Run from the repo root:
     node data/validate.js

   Exits non-zero if any entries fail validation, so you can chain into pre-push
   or CI. Pulls its controlled vocabulary from core/constants.js — adding a new
   sector or school is a one-line edit there, no validator changes needed.
*/
const fs   = require("fs");
const path = require("path");

const C = require("../core/constants.js");

const here          = __dirname;
const talentPath    = path.join(here, "talent.json");
const startupsPath  = path.join(here, "startups.json");

const SECTORS    = new Set(C.SECTORS);
const ROLE_TYPES = new Set(C.ROLE_TYPES);
const STAGES     = new Set(C.STAGES);
const AVAIL      = new Set(C.AVAILABILITY);
const SCHOOLS    = new Set(C.SCHOOLS);
const ORIGIN_OK  = (s) => C.ORIGIN_PATTERNS.some((re) => re.test(s));

function fail(arr, id, msg) { arr.push({ id, msg }); }

function validateTalent(items) {
  const errs = [];
  if (!Array.isArray(items)) { errs.push({ id: "(file)", msg: "not an array" }); return errs; }
  const seen = new Set();
  items.forEach((t, i) => {
    const id = t.id || `(index ${i})`;
    if (!t.id || !/^t-\d{3,}$/.test(t.id)) fail(errs, id, "id missing or wrong shape (expected t-NNN)");
    if (seen.has(t.id)) fail(errs, id, "duplicate id");
    seen.add(t.id);
    if (!t.name) fail(errs, id, "name missing");
    if (!ROLE_TYPES.has(t.role_type)) fail(errs, id, `role_type invalid: ${t.role_type}`);
    if (!t.headline) fail(errs, id, "headline missing");
    if (!Array.isArray(t.skills) || t.skills.length === 0) fail(errs, id, "skills empty");
    if (!Array.isArray(t.domains) || t.domains.length === 0) fail(errs, id, "domains empty");
    (t.domains || []).forEach((d) => { if (!SECTORS.has(d)) fail(errs, id, `domain invalid: ${d}`); });
    if (!Array.isArray(t.stage_pref) || t.stage_pref.length === 0) fail(errs, id, "stage_pref empty");
    (t.stage_pref || []).forEach((stg) => { if (!STAGES.has(stg)) fail(errs, id, `stage_pref invalid: ${stg}`); });
    if (!AVAIL.has(t.availability)) fail(errs, id, `availability invalid: ${t.availability}`);
    if (typeof t.risk_tolerance !== "number" || t.risk_tolerance < 1 || t.risk_tolerance > 5) {
      fail(errs, id, `risk_tolerance out of range: ${t.risk_tolerance}`);
    }
    if (!t.mission) fail(errs, id, "mission missing");
    if (!t.location || !/, UT$/i.test(t.location)) fail(errs, id, `location must end ", UT": ${t.location}`);
    if (t.school != null && t.school !== "" && !SCHOOLS.has(t.school)) {
      fail(errs, id, `school invalid: ${t.school}`);
    }
  });
  return errs;
}

function validateStartups(items) {
  const errs = [];
  if (!Array.isArray(items)) { errs.push({ id: "(file)", msg: "not an array" }); return errs; }
  const seen = new Set();
  items.forEach((s, i) => {
    const id = s.id || `(index ${i})`;
    if (!s.id || !/^s-\d{3,}$/.test(s.id)) fail(errs, id, "id missing or wrong shape (expected s-NNN)");
    if (seen.has(s.id)) fail(errs, id, "duplicate id");
    seen.add(s.id);
    if (!s.name) fail(errs, id, "name missing");
    if (!SECTORS.has(s.sector)) fail(errs, id, `sector invalid: ${s.sector}`);
    if (!s.origin || !ORIGIN_OK(s.origin)) fail(errs, id, `origin invalid: ${s.origin}`);
    if (!STAGES.has(s.stage)) fail(errs, id, `stage invalid: ${s.stage}`);
    if (typeof s.trl !== "number" || s.trl < 1 || s.trl > 9) fail(errs, id, `trl out of range: ${s.trl}`);
    if (!Array.isArray(s.needs) || s.needs.length === 0) fail(errs, id, "needs empty");
    if (!s.location || !/, UT$/i.test(s.location)) fail(errs, id, `location must end ", UT": ${s.location}`);
    if (!s.mission) fail(errs, id, "mission missing");
    if (!s.funding_status) fail(errs, id, "funding_status missing");
  });
  return errs;
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) {
    console.error(`✗ ${path.basename(p)}: cannot parse JSON — ${e.message}`);
    process.exit(2);
  }
}

function report(name, count, errs) {
  if (errs.length === 0) { console.log(`✓ ${name}: ${count} entries OK`); return 0; }
  console.log(`✗ ${name}: ${count} entries, ${errs.length} problem${errs.length === 1 ? "" : "s"}`);
  errs.slice(0, 50).forEach((e) => console.log(`   - ${e.id}: ${e.msg}`));
  if (errs.length > 50) console.log(`   …and ${errs.length - 50} more`);
  return 1;
}

const talent   = readJson(talentPath);
const startups = readJson(startupsPath);

const tErr = validateTalent(talent);
const sErr = validateStartups(startups);

let bad = 0;
bad += report("data/talent.json",   talent.length,   tErr);
bad += report("data/startups.json", startups.length, sErr);

if (bad === 0) {
  console.log("");
  console.log(`Counts: ${talent.length} talent · ${startups.length} startups`);
  process.exit(0);
} else {
  process.exit(1);
}
