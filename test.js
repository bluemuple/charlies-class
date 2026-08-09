/* Headless checks for Charlie's Class (admin, index + emoji picker, hub)
   with jsdom. Run from this folder:  node test.js  */
"use strict";
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

let passed = 0, failed = 0;
function ok(cond, label){
  if(cond){ passed++; console.log("  ✓ " + label); }
  else { failed++; console.log("  ✗ " + label); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, label, timeout = 3000){
  const t0 = Date.now();
  while(Date.now() - t0 < timeout){
    try{ if(fn()) return true; }catch(e){}
    await sleep(25);
  }
  ok(false, label + " (timed out)");
  return false;
}

function load(file, extra){
  // jsdom can't navigate between pages; swallow only that error
  const vc = new VirtualConsole();
  if(vc.forwardTo) vc.forwardTo(console, { jsdomErrors: "none" });
  else vc.sendTo(console, { omitJSDOMErrors: true });
  vc.on("jsdomError", err => {
    if(!/navigation/i.test(err.message)) console.error("jsdomError:", err.message);
  });
  return JSDOM.fromFile(path.join(__dirname, file), {
    runScripts: "dangerously",
    resources: "usable",
    virtualConsole: vc,
    beforeParse(window){
      /* Force local demo mode: these tests must never touch the real class
         database, and must not depend on the network. js/config.js still
         assigns to CHARLIE_CONFIG — the no-op setter swallows it. */
      Object.defineProperty(window, "CHARLIE_CONFIG", {
        configurable: false,
        get(){ return { SUPABASE_URL: "", SUPABASE_ANON_KEY: "" }; },
        set(){}
      });
      window.Audio = function(){ return { play(){}, pause(){}, currentTime: 0 }; };
      window.Element.prototype.animate = function(){
        const a = {}; setTimeout(() => a.onfinish && a.onfinish(), 5); return a;
      };
      window.confirm = () => true;
      window.printed = 0;
      window.print = () => { window.printed++; };
      if(extra) extra(window);
    }
  });
}

async function testAdmin(){
  console.log("\nadmin.html");
  const dom = await load("admin.html");
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);
  const rows = sel => d.querySelectorAll(sel + " .row");

  await waitFor(() => rows("#boyList").length > 0, "roster renders");

  // seed integrity
  const list = await w.CharlieStore.list();
  ok(w.CharlieStore.mode() === "local", "runs in local demo mode without keys");
  ok(list.length === 25, "25 students seeded (got " + list.length + ")");
  ok(rows("#boyList").length === 15, "15 boys listed");
  ok(rows("#girlList").length === 10, "10 girls listed");
  ok(list.every(s => !/\s/.test(s.name) || s.name === "Jayarna-May"),
     "names are first names only");
  const codes = list.map(s => s.code);
  ok(codes.every(c => /^[0-9]{4}$/.test(c)) && new Set(codes).size === 25,
     "codes are 4 digits and unique");
  ok(d.querySelectorAll(".row .money").length === 25, "money shown on every row");

  // codes hidden until revealed
  const shown = () => Array.from(d.querySelectorAll(".row .code")).map(e => e.textContent);
  ok(shown().every(t => t === "••••"), "codes hidden by default");
  $("codesBtn").click();
  ok(shown().includes("8692") && !shown().includes("••••"), "Show codes reveals real codes");

  // add / duplicate
  $("addName").value = "Testkid";
  $("addBtn").click();
  await waitFor(() => rows("#boyList").length === 16, "added student appears under Boys");
  const list2 = await w.CharlieStore.list();
  const kid = list2.find(s => s.name === "Testkid");
  ok(!!kid && /^[0-9]{4}$/.test(kid.code) && new Set(list2.map(s => s.code)).size === 26,
     "new student got a unique 4-digit code");
  $("addName").value = "testkid";
  $("addBtn").click();
  await sleep(80);
  ok((await w.CharlieStore.list()).length === 26, "duplicate name is refused");

  // edit: rename, regroup, set money
  const kidRow = () => d.querySelector('.row[data-id="' + kid.id + '"]');
  kidRow().querySelector('[data-act="edit"]').click();
  ok($("dlgWrap").classList.contains("open"), "edit dialog opens");
  $("dlgName").value = "Testkiddo";
  $("dlgMoney").value = "12";
  d.querySelector('#dlgSeg [data-g="girl"]').click();
  $("dlgSave").click();
  await waitFor(() => kidRow() && kidRow().parentElement.id === "girlList", "edited student moved to Girls");
  ok(/Testkiddo/.test(kidRow().textContent), "rename shows in the roster");
  ok(/💰 12 Whare/.test(kidRow().querySelector(".money").textContent), "money shows 12 Whare");

  // regenerate code
  const oldCode = kid.code;
  kidRow().querySelector('[data-act="code"]').click();
  await sleep(120);
  const newCode = (await w.CharlieStore.list()).find(s => s.id === kid.id).code;
  ok(newCode !== oldCode && /^[0-9]{4}$/.test(newCode), "regenerate makes a different 4-digit code");

  // print sheet
  $("printBtn").click();
  const cards = d.querySelectorAll("#printSheet .pcard");
  ok(cards.length === 26, "print sheet has one card per student");
  ok(w.printed === 1, "print dialog requested");
  ok(/CJ/.test(cards[0].textContent), "cards start with the boys");
  ok(cards[0].querySelector(".pcode").textContent.length === 4, "card shows the 4-digit code");

  // remove
  kidRow().querySelector('[data-act="del"]').click();
  await waitFor(() => d.querySelectorAll(".row").length === 25, "removed student disappears");

  dom.window.close();
}

async function testIndex(){
  console.log("\nindex.html");
  const dom = await load("index.html");
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);

  await waitFor(() => w.CharlieStore, "store loads");
  await w.CharlieStore.init();
  await sleep(80);   // page's own list() call

  ok($("scrWelcome").classList.contains("on"), "welcome screen first");

  $("boysBtn").click();
  await waitFor(() => d.querySelectorAll("#nameGrid button").length === 15, "Boys shows 15 name cards");
  ok(/Tepono/.test($("nameGrid").textContent), "cards show first names");
  d.querySelector('.back[data-back="scrWelcome"]').click();
  $("girlsBtn").click();
  await waitFor(() => d.querySelectorAll("#nameGrid button").length === 10, "Girls shows 10 name cards");

  // pick Willow → PIN screen
  Array.from(d.querySelectorAll("#nameGrid button"))
    .find(b => /Willow/.test(b.textContent)).click();
  ok($("scrPin").classList.contains("on"), "PIN screen opens");
  ok(/Hi Willow/.test($("pinHello").textContent), "greets the student by first name");

  const press = k => {
    Array.from(d.querySelectorAll("#pinPad button"))
      .find(b => b.textContent.trim() === k).click();
  };

  // wrong code
  "1111".split("").forEach(press);
  await waitFor(() => /not it/.test($("pinMsg").textContent), "wrong code gives a friendly nudge");
  await sleep(600);   // dots reset

  // right code → first login → emoji picker
  const code = w.CHARLIE_ROSTER.find(s => s.id === "willow-kolo").code;
  code.split("").forEach(press);
  await waitFor(() => $("scrEmoji").classList.contains("on"), "first login opens the emoji picker");
  ok(/Willow/.test($("emojiTitle").textContent), "picker greets the student");

  const pk = $("pickerBox");
  const gridBtn = (box, e) =>
    Array.from(box.querySelectorAll(".ep-grid button")).find(b => b.dataset.e === e);
  ok(pk.querySelectorAll(".ep-tabs button").length === 4, "four emoji categories");

  // people → skin tones
  gridBtn(pk, "🧑").click();
  ok(pk.querySelector(".ep-tones").classList.contains("on"), "people emoji shows skin colours");
  ok(pk.querySelectorAll(".ep-tones button").length === 6, "six skin colour choices");
  pk.querySelectorAll(".ep-tones button")[3].click();
  ok(pk.querySelector(".ep-preview").textContent === "🧑🏽", "skin colour applies to the preview");

  // animals → no tones
  pk.querySelector('.ep-tabs button[data-cat="animals"]').click();
  ok(!pk.querySelector(".ep-tones").classList.contains("on"), "animals have no skin colour row");
  gridBtn(pk, "🐰").click();
  ok(pk.querySelector(".ep-preview").textContent === "🐰", "picked animal shows in preview");

  // save → stored (navigation to hub.html is attempted; jsdom can't follow it)
  pk.querySelector(".ep-save").click();
  await waitFor(async () => true, "…", 1);
  await sleep(150);
  const willow = (await w.CharlieStore.list()).find(s => s.id === "willow-kolo");
  ok(willow.emoji === "🐰", "chosen emoji is saved to the store");

  dom.window.close();
}

async function testHub(){
  console.log("\nhub.html");
  const dom = await load("hub.html", w => {
    w.CHARLIE_TEST_SESSION = { id: "willow-kolo", name: "Willow" };
  });
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);

  await waitFor(() => $("meName").textContent === "Willow", "top bar shows the student");

  $("meBtn").click();
  ok($("profWrap").classList.contains("open"), "profile room opens");
  ok($("profMoney").textContent === "0", "money starts at 0 Whare");

  // live money update (as if a game paid out)
  await w.CharlieStore.update("willow-kolo", { money: 7 });
  await waitFor(() => $("profMoney").textContent === "7", "money updates live");

  // change emoji from the profile
  $("editEmojiBtn").click();
  ok($("profPicker").style.display !== "none", "emoji picker opens in the profile");
  const pk = $("profPickerBox");
  pk.querySelector('.ep-tabs button[data-cat="plants"]').click();
  Array.from(pk.querySelectorAll(".ep-grid button")).find(b => b.dataset.e === "🌵").click();
  pk.querySelector(".ep-save").click();
  await waitFor(() => $("meEmoji").textContent === "🌵", "new emoji shows in the top bar");
  ok($("profPicker").style.display === "none", "picker closes after saving");

  // game card is a friendly placeholder
  $("algebraGame").click();
  ok(/almost ready/.test($("toast").textContent), "Algebra Machine says it's coming soon");

  dom.window.close();
}

async function testConfig(){
  console.log("\njs/config.js (live Supabase settings)");
  const fs = require("fs");
  const src = fs.readFileSync(path.join(__dirname, "js/config.js"), "utf8");
  const url = (src.match(/SUPABASE_URL:\s*"([^"]*)"/) || [])[1];
  const key = (src.match(/SUPABASE_ANON_KEY:\s*"([^"]*)"/) || [])[1];
  ok(/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url), "project URL is the bare origin (no /rest/v1)");
  ok(/^sb_publishable_/.test(key) || /^eyJ/.test(key), "key is a publishable/anon key");
  // a real secret key, not the word in a warning comment
  ok(!/sb_secret_[A-Za-z0-9_-]{5,}/.test(src), "no secret key committed to the site");

  /* the shipped normaliser should tolerate the other URLs Supabase shows */
  const storeSrc = fs.readFileSync(path.join(__dirname, "js/store.js"), "utf8");
  const fn = storeSrc.match(/function baseUrl\(u\)\{[\s\S]*?\n  \}/);
  ok(!!fn, "store.js exports a URL normaliser");
  const norm = new Function(fn[0] + "; return baseUrl;")();
  ok(norm("https://x.supabase.co/rest/v1/") === "https://x.supabase.co", "REST URL normalises to the origin");
  ok(norm("https://x.supabase.co/") === "https://x.supabase.co", "trailing slash normalises away");
  ok(norm("  https://x.supabase.co  ") === "https://x.supabase.co", "stray spaces are trimmed");
}

(async () => {
  try{
    await testConfig();
    await testAdmin();
    await testIndex();
    await testHub();
  }catch(e){
    failed++;
    console.error("\nUnexpected error:", e);
  }
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
