#!/usr/bin/env node
/* Copies every click and heart counter for news.html out of Abacus into counts.json.
   Run by .github/workflows/counts.yml (see README, "Clicks and hearts").
     node js/snapshot-counts.js counts.json
   Reads gently — one counter every half second — Abacus allows about 30 requests in 10 seconds. */
"use strict";
const fs = require("fs");
const path = require("path");
const CT = require("./news-counters.js");

const sleep = ms => new Promise(res => setTimeout(res, ms));

/* every S('Name', 'address', …) in news.html -> the addresses, in page order, no repeats */
function sitesIn(html){
  const out = [], re = /\bS\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'/g;
  let m;
  while((m = re.exec(html))) out.push(m[2]);
  return Array.from(new Set(out));
}

/* one counter: its value, or null when Abacus would not answer */
async function read(key, previous, fetchFn, retryMs){
  for(let attempt = 0; attempt < 5; attempt++){
    let r;
    try{ r = await fetchFn(CT.API + "/get/" + CT.NS + "/" + key); }
    catch(e){ r = {ok: false, status: 0}; }
    if(r.status === 404){
      /* Abacus forgets a counter six months after its last hit — bring it back at the number we saved */
      if(previous > 0){
        try{ await fetchFn(CT.API + "/create/" + CT.NS + "/" + key + "?initializer=" + previous); }catch(e){}
      }
      return previous || 0;
    }
    let j = {};
    try{ j = await r.json(); }catch(e){}
    if(r.ok && typeof j.value === "number") return j.value;
    await sleep(CT.retryAfter(j.error, attempt, retryMs));
  }
  return null;
}

async function snapshot(opts){
  const previous = (opts.previous && opts.previous.counts) || {};
  const fetchFn = opts.fetchFn, delay = opts.delay || 0, retryMs = opts.retryMs == null ? 500 : opts.retryMs;
  const counts = {};
  let ok = 0, kept = 0;
  for(const u of sitesIn(opts.html)){
    const k = CT.keys(u);
    for(const key of [k.views, k.hearts]){
      const v = await read(key, previous[key] || 0, fetchFn, retryMs);
      if(v === null){ kept++; if(previous[key]) counts[key] = previous[key]; }
      else { ok++; counts[key] = v; }
      if(delay) await sleep(delay);
    }
  }
  return {generated: new Date().toISOString(), read: ok, kept: kept, counts: counts};
}

module.exports = {sitesIn, read, snapshot};

if(require.main === module){
  (async () => {
    const out = process.argv[2] || "counts.json";
    const html = fs.readFileSync(path.join(__dirname, "..", "news.html"), "utf8");
    let previous = null;
    try{ const r = await fetch(CT.SNAPSHOT + "?t=" + Date.now()); if(r.ok) previous = await r.json(); }catch(e){}
    const snap = await snapshot({html, previous, fetchFn: fetch, delay: 550});
    if(!snap.read){ console.error("Abacus answered nothing — leaving the old snapshot alone"); process.exit(1); }
    fs.writeFileSync(out, JSON.stringify(snap, null, 1));
    console.log("wrote " + out + ": " + snap.read + " counters read, " + snap.kept + " kept from last time");
  })();
}
