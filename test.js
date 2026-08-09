/* Headless checks for Charlie's Class (admin, index + emoji picker, hub)
   with jsdom. Run from this folder:  node test.js  */
"use strict";
const path = require("path");
const fs = require("fs");
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
    try{ if(fn()){ ok(true, label); return true; } }catch(e){}
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

async function testConfig(){
  console.log("\njs/config.js (live Supabase settings)");
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

  /* the roster no longer ships codes, and the site never asks for the column */
  const rosterSrc = fs.readFileSync(path.join(__dirname, "js/roster.js"), "utf8");
  ok(!/code\s*:/.test(rosterSrc), "seed roster carries no pre-assigned codes");
  ok(/ROSTER_COLS\s*=\s*'[^']*'/.test(storeSrc) && !/ROSTER_COLS\s*=\s*'[^']*\bcode\b[^']*'/.test(
       storeSrc.replace(/code_set/g, "codeflag")),
     "the roster query never selects the code column");
}

async function testBrand(){
  console.log("\nbranding");
  for(const f of ["index.html", "admin.html", "hub.html"]){
    const src = fs.readFileSync(path.join(__dirname, f), "utf8");
    ok(/<div id="brand">Wharenui School<\/div>/.test(src) && !/Charlie Company/.test(src),
       f + " shows Wharenui School bottom-left");
  }
  const machine = path.join(__dirname, "..", "algebra-vending-machine.html");
  if(fs.existsSync(machine)){
    const src = fs.readFileSync(machine, "utf8");
    ok(/Wharenui School/.test(src) && !/Charlie Company/.test(src),
       "the built vending machine was rebuilt with the new label");
  }
}

async function testAdmin(){
  console.log("\nadmin.html");
  const dom = await load("admin.html");
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);
  const rows = sel => d.querySelectorAll(sel + " .row");

  await waitFor(() => rows("#boyList").length > 0, "roster renders");

  const list = await w.CharlieStore.list();
  ok(w.CharlieStore.mode() === "local", "runs in local demo mode without keys");
  ok(list.length === 25, "25 students seeded (got " + list.length + ")");
  ok(rows("#boyList").length === 15 && rows("#girlList").length === 10, "15 boys, 10 girls");
  ok(list.every(s => !("code" in s)), "student objects never carry the code itself");
  ok(list.every(s => s.codeSet === false), "nobody has a code until they choose one");
  ok(d.querySelectorAll(".row .money").length === 25, "money shown on every row");
  ok(/No code yet/.test($("boyList").textContent), "roster shows 'No code yet'");
  ok(!/Show codes/.test(d.body.textContent), "no 'show codes' button — codes are private now");

  // reset button is dead until there is something to reset
  const cj = () => d.querySelector('.row[data-id="cj-rapata"]');
  ok(cj().querySelector('[data-act="code"]').disabled, "reset is disabled while no code is set");

  // a student sets a code, then the teacher can reset it
  await w.CharlieStore.setCode("cj-rapata", "2468");
  await refreshAdmin(w, d);
  ok(/Code set/.test(cj().textContent), "roster shows 'Code set' once chosen");
  ok(!cj().querySelector('[data-act="code"]').disabled, "reset is now enabled");
  cj().querySelector('[data-act="code"]').click();
  await waitFor(() => /No code yet/.test(cj().textContent), "teacher reset clears the code");
  ok((await w.CharlieStore.verifyLogin("cj-rapata", "2468")) === null, "the old code no longer works");

  // add / duplicate
  $("addName").value = "Testkid";
  $("addBtn").click();
  await waitFor(() => rows("#boyList").length === 16, "added student appears under Boys");
  const kid = (await w.CharlieStore.list()).find(s => s.name === "Testkid");
  ok(!!kid && kid.codeSet === false, "a new student starts with no code");
  $("addName").value = "testkid";
  $("addBtn").click();
  await sleep(80);
  ok((await w.CharlieStore.list()).length === 26, "duplicate name is refused");

  // edit: rename, regroup, set money
  const kidRow = () => d.querySelector('.row[data-id="' + kid.id + '"]');
  kidRow().querySelector('[data-act="edit"]').click();
  $("dlgName").value = "Testkiddo";
  $("dlgMoney").value = "12";
  d.querySelector('#dlgSeg [data-g="girl"]').click();
  $("dlgSave").click();
  await waitFor(() => kidRow() && kidRow().parentElement.id === "girlList", "edited student moved to Girls");
  ok(/Testkiddo/.test(kidRow().textContent), "rename shows in the roster");
  ok(/💰 12 Whare/.test(kidRow().querySelector(".money").textContent), "money shows 12 Whare");

  // print welcome cards
  $("printBtn").click();
  const cards = d.querySelectorAll("#printSheet .pcard");
  ok(cards.length === 26, "print sheet has one card per student");
  ok(w.printed === 1, "print dialog requested");
  ok(/harufocus\.com/.test(cards[0].textContent), "card tells them where to go");
  ok(/4-digit secret code/.test(cards[0].textContent), "card explains making their own code");
  ok(!/[0-9]{4}\b/.test(cards[0].querySelector(".psteps").textContent.replace(/4-digit/g, "")),
     "card prints no code");

  // remove
  kidRow().querySelector('[data-act="del"]').click();
  await waitFor(() => d.querySelectorAll(".row").length === 25, "removed student disappears");

  dom.window.close();
}
function refreshAdmin(w, d){
  // nudge the page to re-read the store the way its own change hook does
  return w.CharlieStore.list().then(() => sleep(60));
}

async function testIndex(){
  console.log("\nindex.html — first login, student picks a code");
  const dom = await load("index.html");
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);
  const press = k => Array.from(d.querySelectorAll("#pinPad button"))
    .find(b => b.textContent.trim() === k).click();
  const type = s => s.split("").forEach(press);

  await waitFor(() => w.CharlieStore, "store loads");
  await w.CharlieStore.init();
  await sleep(80);

  ok($("scrWelcome").classList.contains("on"), "welcome screen first");
  $("girlsBtn").click();
  await waitFor(() => d.querySelectorAll("#nameGrid button").length === 10, "Girls shows 10 name cards");
  ok(/NEW/.test($("nameGrid").textContent), "students without a code are tagged NEW");

  Array.from(d.querySelectorAll("#nameGrid button"))
    .find(b => /Willow/.test(b.textContent)).click();
  ok($("scrPin").classList.contains("on"), "code screen opens");
  ok(/Hi Willow/.test($("pinHello").textContent), "greets the student by name");
  ok(/Make up a 4-digit secret code/.test($("pinMsg").textContent), "asks a new student to make one up");

  // mismatch on the re-enter
  type("1234");
  await waitFor(() => /same code again/.test($("pinMsg").textContent), "asks to type it again");
  type("9999");
  await waitFor(() => /didn't match/.test($("pinMsg").textContent), "mismatch is caught");
  await waitFor(() => /Make up a 4-digit/.test($("pinMsg").textContent), "starts over after a mismatch");
  ok((await w.CharlieStore.list()).find(s => s.id === "willow-kolo").codeSet === false,
     "nothing was saved from the mismatched attempt");

  // matching pair
  type("1234");
  await waitFor(() => /same code again/.test($("pinMsg").textContent), "second attempt: asks again");
  type("1234");
  await waitFor(() => $("scrEmoji").classList.contains("on"), "matching codes go on to the emoji picker");
  ok((await w.CharlieStore.list()).find(s => s.id === "willow-kolo").codeSet === true,
     "the chosen code is saved");

  const pk = $("pickerBox");
  const gridBtn = e => Array.from(pk.querySelectorAll(".ep-grid button")).find(b => b.dataset.e === e);
  ok(pk.querySelectorAll(".ep-tabs button").length === 4, "four emoji categories");
  gridBtn("🧑").click();
  ok(pk.querySelector(".ep-tones").classList.contains("on"), "people emoji shows skin colours");
  pk.querySelectorAll(".ep-tones button")[3].click();
  ok(pk.querySelector(".ep-preview").textContent === "🧑🏽", "skin colour applies to the preview");
  pk.querySelector('.ep-tabs button[data-cat="animals"]').click();
  ok(!pk.querySelector(".ep-tones").classList.contains("on"), "animals have no skin colour row");
  gridBtn("🐰").click();
  pk.querySelector(".ep-save").click();
  await sleep(150);
  ok((await w.CharlieStore.list()).find(s => s.id === "willow-kolo").emoji === "🐰",
     "chosen emoji is saved");

  dom.window.close();
}

async function testReturning(){
  console.log("\nindex.html — coming back with a code");
  const dom = await load("index.html");
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);
  const press = k => Array.from(d.querySelectorAll("#pinPad button"))
    .find(b => b.textContent.trim() === k).click();
  const type = s => s.split("").forEach(press);

  await waitFor(() => w.CharlieStore, "store loads");
  await w.CharlieStore.init();
  await w.CharlieStore.setCode("kiean-oabel", "7531");
  await sleep(80);

  $("boysBtn").click();
  await waitFor(() => d.querySelectorAll("#nameGrid button").length === 15, "Boys list shows");
  const card = Array.from(d.querySelectorAll("#nameGrid button")).find(b => /Kiean/.test(b.textContent));
  ok(!/NEW/.test(card.textContent), "a student with a code has no NEW tag");
  card.click();
  ok(/Type your 4-digit secret code/.test($("pinMsg").textContent), "asks for the existing code");

  type("1111");
  await waitFor(() => /not it/.test($("pinMsg").textContent), "wrong code gives a friendly nudge");
  await sleep(600);
  type("7531");
  await waitFor(() => $("scrEmoji").classList.contains("on"), "right code gets in");

  // a second student cannot claim a name that already has a code
  ok((await w.CharlieStore.setCode("kiean-oabel", "0000")) === null,
     "setCode refuses to overwrite an existing code");
  ok((await w.CharlieStore.verifyLogin("kiean-oabel", "7531")) !== null, "the real code still works");

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

  await w.CharlieStore.update("willow-kolo", { money: 7 });
  await waitFor(() => $("profMoney").textContent === "7", "money updates live");

  $("editEmojiBtn").click();
  const pk = $("profPickerBox");
  pk.querySelector('.ep-tabs button[data-cat="plants"]').click();
  Array.from(pk.querySelectorAll(".ep-grid button")).find(b => b.dataset.e === "🌵").click();
  pk.querySelector(".ep-save").click();
  await waitFor(() => $("meEmoji").textContent === "🌵", "new emoji shows in the top bar");

  $("algebraGame").click();
  ok(/almost ready/.test($("toast").textContent), "Algebra Machine says it's coming soon");

  dom.window.close();
}

(async () => {
  try{
    await testConfig();
    await testBrand();
    await testAdmin();
    await testIndex();
    await testReturning();
    await testHub();
  }catch(e){
    failed++;
    console.error("\nUnexpected error:", e);
  }
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
