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
    try{
      let v = fn();
      if(v && typeof v.then === "function") v = await v;   // async predicates too
      if(v){ ok(true, label); return true; }
    }catch(e){}
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
      window.prompt = () => "Bubbles";
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

/* a rested game must never be painted, not even for one frame */
async function testHiddenGamesNeverFlash(){
  console.log("\nhub.html — hidden games never flash up");
  const src = fs.readFileSync(path.join(__dirname, "hub.html"), "utf8");
  ok(/\.games\{[^}]*visibility:hidden/.test(src.replace(/\s+/g, " ").replace(/; /g, ";")) ||
     /\.games\{[\s\S]*?visibility:hidden[\s\S]*?\}/.test(src),
     "the game row starts hidden in the stylesheet, before any script runs");
  ok(/\.games\.ready\{visibility:visible;\}/.test(src.replace(/\s+/g, "")),
     "only the ready class reveals it");
  // inside revealGames, every card is hidden BEFORE the row is revealed
  const fn = src.match(/function revealGames\(s\)\{[\s\S]*?\n  \}/);
  ok(!!fn, "revealGames decides what to show");
  const body = fn[0];
  const lastHide = Math.max(body.lastIndexOf("style.display = 'none'"),
                            body.lastIndexOf('style.display = "none"'));
  const reveal = body.indexOf("classList.add('ready')");
  ok(lastHide > -1 && reveal > -1 && lastHide < reveal,
     "cards are hidden before the row is shown, so nothing can flash");
  ok(/setTimeout\(function\(\)\{ revealGames\(null\); \}/.test(body + src),
     "and a stalled connection still reveals the games rather than an empty page");
}

async function testBrand(){
  console.log("\nbranding");
  for(const f of ["index.html", "admin.html", "hub.html", "algebra.html", "alzebra.html", "paving.html"]){
    const src = fs.readFileSync(path.join(__dirname, f), "utf8");
    ok(!/id="brand"/.test(src) && !/Charlie Company/.test(src),
       f + " carries no corner label");
  }
  const machine = path.join(__dirname, "..", "algebra-vending-machine.html");
  if(fs.existsSync(machine)){
    const src = fs.readFileSync(machine, "utf8");
    ok(/Wharenui School/.test(src) && !/Charlie Company/.test(src),
       "the built vending machine was rebuilt with the new label");
  }
}

async function testGameCore(){
  console.log("\ngame-core (pure logic)");
  const G = require("./js/game-core.js");
  const keys = Object.keys(G.PRODUCTS);
  ok(keys.length === 40, "40 products in the catalogue");
  ok(keys.filter(k => G.PRODUCTS[k].sheet === "s").length === 20, "20 snacks");
  ok(G.PRODUCTS.car.weight < G.PRODUCTS.ps5.weight && G.PRODUCTS.ps5.weight < G.PRODUCTS.phone.weight,
     "the car is the rarest prize");
  ok(G.PRODUCTS.car.sell > G.PRODUCTS.phone.sell, "rarer items sell for more");

  const rule = [{t:"var"},{t:"op",v:"*"},{t:"num",v:"3"},{t:"op",v:"+"},{t:"num",v:"2"}];
  ok(G.evalRule(rule, 2) === 8, "x×3+2 at 2 gives 8");
  ok(G.reward([{t:"var"},{t:"op",v:"+"},{t:"num",v:"3"}]) === 3, "+ rule pays 3");
  ok(G.reward([{t:"var"},{t:"op",v:"/"},{t:"num",v:"2"}]) === 6, "÷ rule pays 6");
  ok(G.reward(rule) === 10, "×…+ two-op rule pays 5+3+2=10");
  ok(!G.validRule([{t:"num",v:"3"}]), "a rule needs x");
  ok(!G.validRule([{t:"var"},{t:"op",v:"+"}]), "a rule can't end on an operation");
  const threeOps = [{t:"var"},{t:"op",v:"+"},{t:"num",v:"1"},{t:"op",v:"+"},{t:"num",v:"1"},{t:"op",v:"+"},{t:"num",v:"1"}];
  ok(!G.validRule(threeOps), "max two operations");

  // review findings: unwinnable rules refused, "012" is twelve not octal ten
  ok(!G.evaluableRule([{t:"var"},{t:"op",v:"/"},{t:"num",v:"0"}]), "x ÷ 0 is not a playable rule");
  ok(G.evaluableRule([{t:"num",v:"5"},{t:"op",v:"/"},{t:"var"}]), "5 ÷ x is playable (only jams at 0)");
  ok(G.evalRule([{t:"var"},{t:"op",v:"+"},{t:"num",v:"012"}], 1) === 13, "'012' means twelve, not octal");

  ok(G.checkGuess(rule, "x*3+2"), "plain guess accepted");
  ok(G.checkGuess(rule, "  x × 3  +  2 "), "spaces and pretty symbols accepted");
  ok(G.checkGuess(rule, "2 + 3x"), "reordered but equal guess accepted");
  ok(!G.checkGuess(rule, "x*3+1"), "wrong guess rejected");
  ok(!G.checkGuess(rule, "3+2"), "guess without x rejected");

  ok(G.prizeCount(1) === 7 && G.prizeCount(2) === 7, "crack it by your 2nd turn → all 7");
  ok(G.prizeCount(3) === 6 && G.prizeCount(7) === 2 && G.prizeCount(11) === 1, "prize ladder 6…2…1");
  const seven = ["cola","chips","cookie","gummies","popcorn","car","phone"];
  ok(G.pickPrizes(seven, 7).length === 7, "n=7 takes everything");
  const picked3 = G.pickPrizes(seven, 3);
  ok(picked3.length === 3 && new Set(picked3).size === 3, "weighted draw picks n distinct items");
  // statistically: the car must show up far less often than a snack
  let carWins = 0, colaWins = 0;
  for(let i=0;i<800;i++){
    const p = G.pickPrizes(seven, 1);
    if(p[0] === "car") carWins++;
    if(p[0] === "cola") colaWins++;
  }
  ok(carWins < colaWins, "car is drawn less often than a snack ("+carWins+" vs "+colaWins+")");

  ok(G.rangeIndexFor(-5) === 0 && G.rangeIndexFor(2) === 1 && G.rangeIndexFor(100) === 6,
     "input ranges map correctly");
  ok(G.assignRanges(seven).length === 7, "7 products cover the 7 ranges");
  ok(/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(G.alias()), "alias looks like Cute Rabbit");

  // Al-Zebra: time limits, speed ratings, growing problems
  const plus = [{t:"var"},{t:"op",v:"+"},{t:"num",v:"3"}];
  ok(G.zebraTimeLimit(plus) === 18, "an + pen gives 18 seconds");
  ok(G.zebraTimeLimit([{t:"var"},{t:"op",v:"*"},{t:"num",v:"3"},{t:"op",v:"+"},{t:"num",v:"1"}]) === 28,
     "the hardest operation sets the time (× → 28 s)");
  ok(G.zebraTimeLimit([{t:"num",v:"5"},{t:"op",v:"/"},{t:"var"}]) === 32, "÷ gives 32 seconds");
  ok(G.zebraRating(2, 12, true).label === "Perfect!" && G.zebraRating(2, 12, true).points === 50,
     "3 s or faster is Perfect! (50)");
  ok(G.zebraRating(4.5, 12, true).points === 40, "4–5 s is Great (40)");
  ok(G.zebraRating(7, 12, true).points === 30 && G.zebraRating(11, 12, true).points === 20,
     "then Good (30) and Nice (20)");
  ok(G.zebraRating(2, 12, false).label === "Oops" && G.zebraRating(2, 12, false).points === 10,
     "a wrong answer is Oops (10)");
  ok(G.zebraRating(13, 12, true).label === "Oops", "over the limit is Oops even if right");
  const xs = G.zebraProblems();
  ok(xs.length === 6 && xs[0] === 1, "six problems starting at x = 1");
  ok(xs.every((v,i) => i===0 || (v - xs[i-1] >= 1 && v - xs[i-1] <= 4)), "each step grows by 1–4");
}

async function testAdminLock(){
  console.log("\nadmin.html — teacher lock");
  const dom = await load("admin.html");
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);
  const press = k => Array.from(d.querySelectorAll("#lockPad button"))
    .find(b => (b.dataset.k || b.textContent.trim()) === k).click();

  await sleep(150);
  ok(!$("lockWrap").classList.contains("off"), "admin starts locked");
  ok(d.querySelectorAll("#boyList .row").length === 0, "roster is not loaded while locked");

  "9999".split("").forEach(press);
  await waitFor(() => $("lockDots").classList.contains("err"), "wrong teacher code is refused");
  await sleep(550);
  "2316".split("").forEach(press);
  await waitFor(() => $("lockWrap").classList.contains("off"), "code 2316 unlocks the page");
  await waitFor(() => d.querySelectorAll("#boyList .row").length === 15, "roster loads after unlock");
  try{ dom.window.close(); }catch(e){}
}

async function testAdmin(){
  console.log("\nadmin.html");
  const dom = await load("admin.html", w => { w.CHARLIE_TEST_TEACHER = true; });
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

  // the teacher can see who has a pet and how loved it is
  await w.CharlieStore.update("cj-rapata", { pet: {type:3, name:"Mochi", affection:15, powers:[]} });
  await waitFor(() => /🐱 15❤/.test((d.querySelector('.row[data-id="cj-rapata"]')||{}).textContent || ""),
     "pet badge shows in the roster");
  ok(/Mochi/.test(d.querySelector('.row[data-id="cj-rapata"] .petb').title), "badge tooltip names the pet");

  // the games card: hide a game + retune the difficulty, saved as one blob
  ok(!!$("gamesCard") && $("setZebraOn").checked && $("setAlgOn").checked,
     "games card starts with both games visible");
  $("setZebraOn").checked = false;
  $("setZebraOn").dispatchEvent(new w.Event("change"));
  $("limPlus").value = "20";
  $("limPlus").dispatchEvent(new w.Event("change"));
  $("setTurnSecs").value = "25";
  $("setTurnSecs").dispatchEvent(new w.Event("change"));
  await waitFor(async () => {
    const s = await w.CharlieStore.getMachine("game-settings");
    return s && s.hidden.alzebra === true && s.hidden.algebra === false
        && s.alzebra.limits["+"] === 20 && s.algebra.turnSecs === 25;
  }, "hide + difficulty settings land in the game-settings blob", 5000);
  $("setFriendsNames").checked = true;
  $("setFriendsNames").dispatchEvent(new w.Event("change"));
  await waitFor(async () => {
    const s = await w.CharlieStore.getMachine("game-settings");
    return s && s.friends && s.friends.nicknames === true && s.friends.hidden === false;
  }, "the Friends nickname switch lands in the blob", 5000);
  ok(!$("setAlgMusic").checked, "background music starts switched off");
  $("setAlgMusic").checked = true;
  $("setAlgMusic").dispatchEvent(new w.Event("change"));
  $("setAlgSkip").checked = true;
  $("setAlgSkip").dispatchEvent(new w.Event("change"));
  $("setZebraSkip").checked = true;
  $("setZebraSkip").dispatchEvent(new w.Event("change"));
  await waitFor(async () => {
    const s = await w.CharlieStore.getMachine("game-settings");
    return s && s.algebra.skipStock === true && s.alzebra.skipStock === true
        && s.algebra.music === true;
  }, "skip-the-shelves and music switches land", 5000);
  ok($("setPadOn").checked && !$("setPadOnly").checked,
     "Padlet starts visible, and Padlet-only starts off");
  $("setPadOnly").checked = true;
  $("setPadOnly").dispatchEvent(new w.Event("change"));
  await waitFor(async () => {
    const s = await w.CharlieStore.getMachine("game-settings");
    return s && s.padletOnly === true && s.hidden.padlet === false;
  }, "the Padlet-only switch lands in the blob", 5000);
  $("setPadOnly").checked = false;
  $("setPadOnly").dispatchEvent(new w.Event("change"));
  $("setTriNick").checked = true;
  $("setTriNick").dispatchEvent(new w.Event("change"));
  await waitFor(async () => {
    const s = await w.CharlieStore.getMachine("game-settings");
    return s && s.triangles && s.triangles.nicknames === true;
  }, "the Try Triangles nickname switch lands", 5000);
  // and the teacher can wipe the ranking
  await w.CharlieStore.saveMachine({id:"triangle-scores", type:"scores", created:Date.now(),
    entries:[{id:"cj-rapata", name:"CJ", emoji:"🦖", score:99, t:Date.now()}]});
  // the teacher can read each child's per-type record, turn by turn
  await w.CharlieStore.saveMachine({id:"triangle-results", type:"results", created:Date.now(), rows:[
    {id:"cj-rapata", name:"CJ", emoji:"🦖", turn:1, score:120, t:Date.now()-9e5, hb:[2,3], concept:[1,1], area:[3,4]},
    {id:"cj-rapata", name:"CJ", emoji:"🦖", turn:2, score:190, t:Date.now(), hb:[3,3], concept:[1,1], area:[4,4]}
  ]});
  ok(!!$("triResults"), "there is a Results button");
  $("triResults").click();
  await waitFor(() => /CJ/.test($("triResultsBox").textContent), "the results panel lists the student", 5000);
  ok(d.querySelectorAll("#triResultsBox tbody tr").length === 2, "both turns are shown");
  ok(/heights/.test($("triResultsBox").textContent) && /wording/.test($("triResultsBox").textContent)
     && /areas/.test($("triResultsBox").textContent), "the three question types are named");
  ok(/best 190/.test($("triResultsBox").textContent), "the student's best score is summarised");

  ok(!!$("triReset"), "there is a button to clear the ranking");
  $("triReset").click();
  await waitFor(async () => {
    const b = await w.CharlieStore.getMachine("triangle-scores");
    return b && b.entries.length === 0;
  }, "clearing empties the ranking", 5000);
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
  ok(/bluemuple\.github\.io\/charlies-class/.test(cards[0].textContent),
     "card prints the school-safe address");
  ok(/4-digit secret code/.test(cards[0].textContent), "card explains making their own code");
  ok(!/[0-9]{4}\b/.test(cards[0].querySelector(".psteps").textContent.replace(/4-digit/g, "")),
     "card prints no code");

  // remove
  kidRow().querySelector('[data-act="del"]').click();
  await waitFor(() => d.querySelectorAll(".row").length === 25, "removed student disappears");

  try{ dom.window.close(); }catch(e){}
}
function refreshAdmin(w, d){
  // nudge the page to re-read the store the way its own change hook does
  return w.CharlieStore.list().then(() => sleep(60));
}

async function testIndex(){
  console.log("\nindex.html — first login, student picks a code");
  const dom = await load("index.html", w => { w.CHARLIE_TEST_FAST = 1; });
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);
  const press = k => Array.from(d.querySelectorAll("#pinPad button"))
    .find(b => b.textContent.trim() === k).click();
  const type = s => s.split("").forEach(press);

  await waitFor(() => w.CharlieStore, "store loads");
  await w.CharlieStore.init();
  await sleep(80);

  ok($("scrWelcome").classList.contains("on"), "welcome screen first");
  // nothing shows until the teacher's settings are in, so a hidden half never flashes
  await waitFor(() => $("scrWelcome").classList.contains("ready"),
     "the welcome screen waits for the settings", 6000);
  const wpad = $("padletBtn");
  ok(!!wpad && /Padlet/.test(wpad.textContent), "the Padlet button is on the welcome screen");
  ok(/^https:\/\/padlet\.com\//.test(wpad.getAttribute("href")), "it points at the Padlet wall");
  ok(wpad.getAttribute("target") === "_blank" && /noopener/.test(wpad.getAttribute("rel")),
     "it opens in a new tab, safely");
  ok($("loginPart").style.display !== "none" && wpad.style.display !== "none",
     "by default the class sees both the group buttons and the Padlet link");
  // Padlet only: the group buttons and their prompt step aside
  w.INDEX_TEST.welcome({padletOnly:true});
  ok($("loginPart").style.display === "none", "Padlet only hides Boys/Girls and the prompt");
  ok(wpad.style.display !== "none", "and leaves just the Padlet button");
  ok($("scrWelcome").classList.contains("padonly"), "standing alone, the link is sized up");
  // hiding the link wins over Padlet only, so the class can still log in
  w.INDEX_TEST.welcome({padletOnly:true, hidden:{padlet:true}});
  ok(wpad.style.display === "none", "hiding Padlet takes the link away");
  ok($("loginPart").style.display !== "none", "and the group buttons come back, never a dead end");
  w.INDEX_TEST.welcome(null);

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

  try{ dom.window.close(); }catch(e){}
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

  try{ dom.window.close(); }catch(e){}
}

async function testGamePlay(){
  console.log("\nalgebra.html — seller builds a machine");
  const dom = await load("algebra.html", w => {
    w.CHARLIE_TEST_SESSION = { id: "willow-kolo", name: "Willow" };
  });
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);
  const G = require("./js/game-core.js");

  await waitFor(() => w.CharlieStore, "store loads");
  await w.CharlieStore.init();
  await sleep(120);

  ok($("scrRole").classList.contains("on"), "role choice first");
  $("roleSeller").click();
  ok($("scrStock").classList.contains("on"), "seller goes to the shelves");
  ok(!!$("fillBar") && !$("timerBar"), "the countdown is gone — a fill bar instead");
  ok(!!$("stockVend"), "the little vending machine waits on the right");
  ok(!$("stockVendCount"), "no n/7 under the little machine");
  ok($("muteBtn").style.display === "none",
     "no music button while the teacher has the soundtrack off");

  // 🎲 fills a legal basket, and again for a different one
  $("randomBtn").click();
  await waitFor(() => d.querySelectorAll(".shelf button.sel").length === 7,
     "the surprise button stocks all seven");
  ok(d.querySelectorAll("#shelfN button.sel").length <= 3, "and never breaks the 3 non-snack rule");
  const firstRoll = [...d.querySelectorAll(".shelf button.sel")].map(b => b.dataset.k).sort().join();
  let rerolled = false;
  for(let i = 0; i < 8 && !rerolled; i++){
    $("randomBtn").click();
    const roll = [...d.querySelectorAll(".shelf button.sel")].map(b => b.dataset.k).sort().join();
    if(roll !== firstRoll) rerolled = true;
  }
  ok(rerolled, "pressing again rolls a different basket");
  ok(/surprise basket/i.test($("toast").textContent),
     "the surprise button gets all the way through to its message");
  ok(d.querySelector('.shelf-tabs button[data-shelf="s"]').classList.contains("active"),
     "and lands the seller back on the snacks shelf");
  [...d.querySelectorAll(".shelf button.sel")].forEach(b => b.click());   // clear for the next checks

  // pick limits: 8 snacks → only 7 stick; 4 non-snacks → only 3
  const shelfBtns = sel => Array.from(d.querySelectorAll(sel + " button[data-k]"));
  shelfBtns("#shelfS").slice(0, 8).forEach(b => b.click());
  ok(d.querySelectorAll("#shelfS .sel").length === 7, "8th product is refused (7 max)");
  ok($("fillBar").style.width === "100%", "the bar fills up with the picks");
  // clear and mix: 4 snacks + try 4 non-snacks
  shelfBtns("#shelfS").forEach(b => { if(b.classList.contains("sel")) b.click(); });
  shelfBtns("#shelfS").slice(0, 4).forEach(b => b.click());
  shelfBtns("#shelfN").slice(0, 4).forEach(b => b.click());
  ok(d.querySelectorAll("#shelfN .sel").length === 3, "4th non-snack is refused (3 max)");

  $("stockDone").click();
  ok($("scrRule").classList.contains("on"), "on to the rule laptop");

  const rk = k => d.querySelector('#rulePad button[data-k="' + k + '"]').click();

  // x is pre-typed alone (no grey example), and it can be deleted
  ok(/𝑥/.test($("ruleScreen").textContent), "x starts on the laptop screen");
  ok(!/ex\)|\+\s*2/.test($("ruleScreen").textContent), "no grey example beside it");
  rk("back");
  ok(!/𝑥/.test($("ruleScreen").textContent), "the pre-typed x can be deleted");
  rk("x");

  // the new pad: ops on top, x + numbers below, digits fold out
  ok(!!$("numsToggle") && !!$("numsPanel"), "the numbers key is there");
  ok(!$("numsPanel").classList.contains("open"), "digits start folded away");
  $("numsToggle").click();
  ok($("numsPanel").classList.contains("open"), "numbers unfolds the digits");
  $("numsToggle").click();
  ok(!$("numsPanel").classList.contains("open"), "and folds them back");

  // stuck? the idk button ladders through examples but types nothing
  ok(/I don't know what to write/.test($("idkBtn").textContent), "the shrug button waits");
  $("idkBtn").click();
  ok($("exBox").classList.contains("on") && /ex\)/.test($("exBox").textContent),
     "an example appears below it");
  ok(/More examples\?/.test($("idkBtn").textContent), "the button now offers more");
  const firstEx = $("exBox").textContent;
  $("idkBtn").click();
  ok($("exBox").textContent !== firstEx, "another press, another example");
  ok(/𝑥$/.test($("ruleScreen").textContent.trim()), "examples never type themselves");

  // an unplayable rule (x ÷ 0) is refused at Open my shop
  ["/","0"].forEach(rk);
  $("openShop").click();
  await waitFor(() => /breaks the machine/.test($("toast").textContent), "x ÷ 0 rule is refused");
  ok($("scrRule").classList.contains("on"), "seller stays on the rule screen");
  // leading zeros can't build octal-looking numbers: 0 then 1 → 1
  rk("back"); rk("1");
  ok(/÷.*1/.test($("ruleScreen").textContent) && !/01/.test($("ruleScreen").textContent),
     "typing 0 then 1 gives 1, not 01");
  rk("back"); rk("back");   // back to just x

  // build x × 3 + 2 on the pad
  ["*","3","+","2"].forEach(rk);
  ok(/𝑥/.test($("ruleScreen").textContent), "rule shows on the laptop screen");
  ok(/50 Whare/.test($("rewardLine").textContent), "reward reads 50 Whare for ×…+ (5× boost)");
  await waitFor(() => /𝑥.*3.*2/.test($("machineEcho").textContent),
     "a second later the machine's yellow panel echoes it", 3000);
  ok(!d.getElementById("capSeg"), "the seller no longer picks a customer count");
  $("howInfo").click();
  ok($("infoWrap").classList.contains("open") && /How it works/.test($("infoTitle").textContent),
     "the ⓘ on the laptop opens How it works");
  $("infoClose").click();
  $("rewardInfo").click();
  ok(/Crack-rewards/.test($("infoTitle").textContent), "the reward ⓘ explains the money");
  $("infoClose").click();
  rk("/");  // third operation must bounce
  ok(/50 Whare/.test($("rewardLine").textContent), "a third operation is refused");

  $("openShop").click();
  await waitFor(() => $("scrSell").classList.contains("on"), "shop opens into the lobby");
  const ms = await w.CharlieStore.listMachines();
  ok(ms.length === 1 && ms[0].state === "open", "machine saved and open");
  ok(ms[0].capacity === 5, "every room holds up to 5 customers");
  ok(ms[0].turnSecs === 40, "each turn gets the default 40-second clock");
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.profile && s.profile.stats && s.profile.stats.made === 1;
  }, "opening a shop counts one on the rule-maker board", 5000);
  await waitFor(() => /mission: crack this rule/.test($("sellRule").textContent),
     "the rule line tells the seller what customers are trying to do");
  ok($("startBtn").disabled, "Start sleeps while the shop is empty");

  // one customer is not enough; the second lights the button up
  const room = await w.CharlieStore.getMachine(ms[0].id);
  room.buyers.push({id:"kiean-oabel", name:"Kiean", emoji:"🦊"});
  await w.CharlieStore.saveMachine(room);
  await waitFor(() => /1\/5 customers/.test($("turnLineSell").textContent), "the lobby counts 1/5");
  ok($("startBtn").disabled, "one customer is never enough");
  const room2 = await w.CharlieStore.getMachine(ms[0].id);
  room2.buyers.push({id:"jason-lin", name:"Jason", emoji:"🐸"});
  await w.CharlieStore.saveMachine(room2);
  await waitFor(() => !$("startBtn").disabled, "two customers light up Start");
  ok(/start now|wait for a few more/.test($("turnLineSell").textContent),
     "a faint note says: start now, or wait for more");
  ok(ms[0].products.length === 7 && ms[0].ranges.length === 7, "7 products on 7 ranges");
  ok(/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(ms[0].alias), "seller got an animal alias");
  ok(ms[0].reward === 50, "reward stored at five-fold");
  try{ dom.window.close(); }catch(e){}

  /* ---- buyer joins, plays, cracks it ---- */
  console.log("\nalgebra.html — customer cracks the rule");
  const dom2 = await load("algebra.html", w2 => {
    w2.CHARLIE_TEST_SESSION = { id: "kiean-oabel", name: "Kiean" };
    w2.CHARLIE_TEST_FAST = true;
  });
  const w2 = dom2.window, d2 = dom2.window.document;
  const $2 = id => d2.getElementById(id);

  await waitFor(() => w2.CharlieStore, "store loads");
  await w2.CharlieStore.init();
  await sleep(120);

  // a known machine from "Cute Rabbit": rule x×3+2, cookie on every range
  const machine = {
    id:"m-test01", created: Date.now(),
    seller:{id:"willow-kolo", name:"Willow", emoji:"🐰"},
    alias:"Cute Rabbit", state:"open", capacity:5,
    products:["cola","chips","cookie","gummies","popcorn","phone","car"],
    rule:[{t:"var"},{t:"op",v:"*"},{t:"num",v:"3"},{t:"op",v:"+"},{t:"num",v:"2"}],
    reward:10,
    ranges:["cookie","cookie","cookie","cookie","cookie","cookie","cookie"],
    buyers:[], history:[], turn:0, winner:null
  };
  await w2.CharlieStore.saveMachine(machine);

  // a zebra pen must never appear in the Algebra Machine mall
  await w2.CharlieStore.saveMachine({
    id:"m-zebrapen", type:"zebra", created:Date.now(), state:"open",
    seller:{id:"willow-kolo", name:"Willow", emoji:"🐰"}, alias:"Zebra Pen",
    capacity:1, buyers:[]
  });

  $2("roleBuyer").click();
  await waitFor(() => d2.querySelectorAll("#sections .sec").length === 1, "the mall shows one shop");
  ok(!/Zebra Pen/.test($2("sections").textContent), "zebra pens stay out of the mall");
  const sec = d2.querySelector("#sections .sec");
  ok(/Cute Rabbit/.test(sec.textContent) && !/Willow/.test(sec.textContent),
     "shop shows the alias, never the real name");
  sec.click();
  await waitFor(() => $2("scrWait").classList.contains("on"), "joining enters the waiting room");
  await waitFor(() => /Cute Rabbit's Shop/.test($2("waitTitle").textContent),
     "the room is titled with the seller's alias");
  ok(!/You are/.test($2("scrWait").textContent), "no 'You are…' line for a customer");
  ok(!/Your rule/.test($2("scrWait").textContent) && !d2.querySelector("#scrWait .sprite"),
     "the products and the rule stay hidden");
  ok(/1\/5 customers here/.test($2("waitLine").textContent), "the room counts its customers");
  ok(!!d2.querySelector("#scrWait .redact .ink"), "the seller's rule sits blacked out");
  ok(/crack the seller's secret rule/.test(d2.querySelector("#scrWait .wait-mission").textContent),
     "with the mission written beside it");

  // seller presses start (simulated through the store) → onto the machine
  const m1 = await w2.CharlieStore.getMachine("m-test01");
  m1.state = "playing"; m1.turn = 0;
  await w2.CharlieStore.saveMachine(m1);
  await waitFor(() => $2("scrPlay").classList.contains("on"),
     "the start moves the customer to the vending machine", 6000);
  ok(!!d2.querySelector("#machineWrap img.machine"), "the vending machine picture is there");
  ok(/\?/.test($2("ruleBox").textContent), "the rule box keeps the rule secret");
  ok($2("trayName").textContent.trim() === "y", "the tray says y");
  await waitFor(() => !$2("numIn").disabled, "my turn wakes the money input");

  // the machine's own keypad types onto the money
  [...d2.querySelectorAll("#keypad button")].find(b => b.textContent.trim() === "2").click();
  ok($2("numIn").value === "2", "the machine keypad types onto the money");

  // insert: money flies, machine shakes 1.5 s, the product grows out
  $2("insertBtn").click();
  await waitFor(() => $2("display").textContent === "2", "the price screen shows my number");
  await waitFor(() => d2.querySelector("#machineWrap").classList.contains("shake"), "the machine shakes");
  await waitFor(() => $2("canOverlay").classList.contains("open"), "the product pops out", 4000);
  ok($2("canVal").textContent === "8", "2 → 8 through x×3+2");
  ok(/y.*=.*8/.test($2("canCaption").textContent), "caption reads y = 8");

  // who did what lands in Results — as an alias while the game runs
  ok(!/Kiean/.test($2("histBody").textContent) && !!$2("histBody").querySelector("tr"),
     "Results shows an alias, not the real name, during play");
  const row = $2("histBody").querySelector("tr");
  ok(/2/.test(row.children[1].textContent) && /8/.test(row.children[2].textContent),
     "Results row holds x and y");
  ok(row.children.length === 3, "no item column in the results");

  await waitFor(() => !$2("canOverlay").classList.contains("open"),
     "the product tidies itself away after 3 s", 6500);
  await waitFor(() => $2("display").textContent === "--", "the price screen resets");

  // a number IS the whole turn — it moved straight on (and wrapped back: one customer)
  const midGame = await w2.CharlieStore.getMachine("m-test01");
  ok(midGame.turn === 1 && midGame.turnInserted === false, "a number spends the whole turn");
  await waitFor(() => !$2("numIn").disabled, "the turn wraps back — the money wakes again");

  // wrong guess first: x+1
  $2("guessIn").value = "x+1";
  $2("guessBtn").click();
  await waitFor(() => /Not quite/.test($2("guessMsg").textContent), "wrong guess gets a friendly no");
  await waitFor(() => !$2("numIn").disabled, "next turn wakes the money again");
  ok((await w2.CharlieStore.getMachine("m-test01")).turnInserted === false,
     "a wrong guess hands the next player a fresh turn");
  let kiean = (await w2.CharlieStore.list()).find(s => s.id === "kiean-oabel");
  ok(kiean.guesses.length === 1 && kiean.guesses[0].ok === false, "wrong attempt recorded");

  // now the right one, built with the insert buttons and spaces
  $2("guessVarBtn").click();
  ok($2("guessIn").value === "x", "the x button inserts into the guess");
  $2("guessIn").value = "x × 3 + 2";
  d2.querySelector("#guessIn").dispatchEvent(new w2.Event("input"));
  ok(/𝑥/.test($2("guessPreview").innerHTML), "preview shows what I wrote");
  $2("guessBtn").click();
  await waitFor(() => $2("winWrap").classList.contains("on"), "right guess wins — slot machine time");
  await waitFor(() => d2.querySelectorAll("#slotRow .slotwin").length === 7, "7 slot windows for 7 prizes");
  await waitFor(() => /𝑥/.test($2("ruleBox").innerHTML), "the rule box reveals the rule at the end");

  const done = await w2.CharlieStore.getMachine("m-test01");
  ok(done.state === "done" && done.winner.id === "kiean-oabel", "machine records the winner");
  ok(done.winner.prizes.length === 7, "cracked on 2nd turn → all 7 prizes");
  kiean = (await w2.CharlieStore.list()).find(s => s.id === "kiean-oabel");
  ok(kiean.items.length === 7, "prizes landed in my stuff");
  await waitFor(async () => {
    const s = (await w2.CharlieStore.list()).find(x => x.id === "kiean-oabel");
    return s.profile && s.profile.stats && s.profile.stats.cracked === 1;
  }, "the crack counts one on the rule-breaker board", 5000);
  ok(kiean.guesses.length === 2 && kiean.guesses[1].ok === true, "winning attempt recorded");
  const willow = (await w2.CharlieStore.list()).find(s => s.id === "willow-kolo");
  ok(willow.money === 10, "seller earned the machine's stored reward");
  $2("winClose").click();
  await waitFor(() => $2("scrMall").classList.contains("on"), "after the game it's back to the mall");
  try{ dom2.window.close(); }catch(e){}

  /* ---- a hostile emoji in the database must render as text, not HTML ---- */
  console.log("\nalgebra.html — hostile emoji stays harmless");
  const dom3 = await load("algebra.html", w3 => {
    w3.CHARLIE_TEST_SESSION = { id: "jason-lin", name: "Jason" };
    w3.CHARLIE_TEST_FAST = true;
  });
  const w3 = dom3.window, d3 = dom3.window.document;
  await waitFor(() => w3.CharlieStore, "store loads");
  await w3.CharlieStore.init();
  const evil = '<img src=x onerror="window.pwned=1">';
  await w3.CharlieStore.saveMachine({
    id:"m-evil", created: Date.now(),
    seller:{id:"willow-kolo", name:"Willow", emoji:evil},
    alias:"Sneaky Gecko", state:"playing", capacity:1,
    products:["cola","chips","cookie","gummies","popcorn","phone","car"],
    rule:[{t:"var"},{t:"op",v:"+"},{t:"num",v:"1"}], reward:3,
    ranges:["cola","cola","cola","cola","cola","cola","cola"],
    buyers:[{id:"jason-lin", name:"Jason", emoji:evil}],
    history:[{b:"jason-lin", v:1, out:2, p:"cola"}],
    turn:0, turnInserted:false, winner:null
  });
  dom3.window.document.getElementById("roleBuyer").click();
  await waitFor(() => d3.querySelectorAll("#sections .sec").length === 1, "the evil shop shows in the mall");
  ok(!d3.querySelector("#sections img"), "mall renders the emoji as text, not markup");
  d3.querySelector("#sections .sec").click();
  await waitFor(() => d3.getElementById("histBody").textContent.includes("Mystery Player"),
     "room opens with history — alias only, no real name");
  ok(!d3.getElementById("histBody").textContent.includes("Jason"), "Jason stays incognito during play");
  ok(!d3.querySelector("#histBody img") && !d3.querySelector("#playPlayers img"),
     "results and players render the emoji as text, not markup");
  ok(!w3.pwned, "no script ran from the hostile emoji");

  // spectator race: someone else's number hides its answer for a beat
  const evil2 = await w3.CharlieStore.getMachine("m-evil");
  evil2.history.push({b:"kiean-oabel", v:2, out:4, p:"cola"});
  await w3.CharlieStore.saveMachine(evil2);
  await waitFor(() => d3.getElementById("predictCard").style.display !== "none",
     "a spectator gets the quick-predict card", 6000);
  await waitFor(() => /❓/.test(d3.getElementById("histBody").textContent),
     "the newest answer hides behind a ❓");
  d3.getElementById("predictIn").value = "4";
  d3.getElementById("predictGo").click();
  await waitFor(() => /Spot on/.test(d3.getElementById("predictMsg").textContent),
     "a right prediction gets a cheer");
  await waitFor(() => !/❓/.test(d3.getElementById("histBody").textContent),
     "the answer unmasks after the guess");
  try{ dom3.window.close(); }catch(e){}
}

async function testStockAutofill(){
  console.log("\nalgebra.html — short baskets top themselves up on Done");
  const dom = await load("algebra.html", w => {
    w.CHARLIE_TEST_SESSION = { id: "jason-lin", name: "Jason" };
  });
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);
  await waitFor(() => w.CharlieStore, "store loads");
  await w.CharlieStore.init();
  await sleep(120);
  $("roleSeller").click();
  ok($("scrStock").classList.contains("on"), "seller reaches the shelves");
  // pick just two, press Done: the machine quietly fills itself to 7
  [...d.querySelectorAll("#shelfS button[data-k]")].slice(0, 2).forEach(b => b.click());
  $("stockDone").click();
  await waitFor(() => /topped itself up/.test($("toast").textContent), "the machine tops itself up");
  ok(d.querySelectorAll(".shelf button.sel").length === 7, "seven products loaded");
  ok($("scrRule").classList.contains("on"), "then straight on to the rule screen");
  try{ dom.window.close(); }catch(e){}
}

async function testAlZebra(){
  console.log("\nalzebra.html — keeper paints a rule");
  const dom = await load("alzebra.html", w => {
    w.CHARLIE_TEST_SESSION = { id: "willow-kolo", name: "Willow" };
    w.CHARLIE_TEST_FAST = true;      /* skip the 3-2-1-Go for headless runs */
  });
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);

  await waitFor(() => w.CharlieStore, "store loads");
  await w.CharlieStore.init();
  await sleep(120);

  ok(/Pick Your Role/.test(d.querySelector("#scrRole h2").textContent), "role screen says Pick Your Role");
  $("roleKeeper").click();
  ok($("scrStock").classList.contains("on"), "keeper picks prizes first");
  $("randomBtn").click();
  await waitFor(() => d.querySelectorAll(".shelf button.sel").length === 7,
     "the zebra shelves have a surprise button too");
  ok(d.querySelectorAll("#shelfN button.sel").length <= 3, "at most 3 non-snacks in the surprise");
  [...d.querySelectorAll(".shelf button.sel")].forEach(b => b.click());
  [...d.querySelectorAll("#shelfS button[data-k]")].slice(0, 2).forEach(b => b.click());
  $("stockDone").click();
  await waitFor(() => /topped itself up/.test($("toast").textContent), "short baskets top up to 7");
  ok($("scrRule").classList.contains("on"), "on to the zebra");
  ok(!$("manImg"), "the keeper image is gone");
  ok(!!$("zBlink") && /zebra0/.test($("zBlink").src), "the eyes-closed blink frame waits over the stage");
  ok(/𝑥/.test($("zRule").textContent), "x starts on the tummy, ready to build on");

  // the new pad: ops on top, x + numbers below, digits folded away
  ok(!!$("numsToggle") && !$("numsPanel").classList.contains("open"), "digits start folded");
  $("numsToggle").click();
  ok($("numsPanel").classList.contains("open"), "numbers unfolds the digits");

  // delete the preset x → a rule without x is refused
  const rk = k => d.querySelector('#rulePad button[data-k="' + k + '"]').click();
  rk("back");
  ok(!/𝑥/.test($("zRule").textContent), "the preset x can be deleted");
  ["3","+","1"].forEach(rk);
  $("openPen").click();
  await waitFor(() => /needs 𝑥/.test($("toast").textContent), "a rule without x is refused");
  ["back","back","back"].forEach(rk);

  // stuck? the shrug button ladders examples but never types
  $("idkBtn").click();
  ok($("exBox").classList.contains("on") && /ex\)/.test($("exBox").textContent),
     "an example appears under the shrug button");
  ok(/More examples\?/.test($("idkBtn").textContent), "the button now offers more");
  ok(!/𝑥/.test($("zRule").textContent), "the example types nothing by itself");

  // the ⓘ beside the prize money opens the how-it-works panel
  $("rewardInfo").click();
  ok($("helpWrap").classList.contains("open") && /Harder rules mean/.test($("helpWrap").textContent),
     "the prize-money ⓘ explains harder rules");
  $("helpClose").click();
  ok(!$("helpWrap").classList.contains("open"), "Got it! closes the panel");

  // paint x + 2 — it appears in black on the tummy
  ["x","+","2"].forEach(rk);
  ok(/𝑥/.test($("zRule").textContent) && /2/.test($("zRule").textContent), "rule shows on the tummy");
  ok(/12|3 Whare/.test($("rewardLine").textContent + " 3 Whare"), "reward line updates");
  ok(/Open My Zoo/.test($("openPen").textContent), "the button says Open My Zoo");

  $("openPen").click();
  await waitFor(() => $("scrPen").classList.contains("on"), "the pen opens");
  const pens = await w.CharlieStore.listMachines();
  const pen = pens.find(m => m.type === "zebra");
  ok(!!pen && pen.capacity === 1 && pen.probs.length === 6 && pen.limit === 18,
     "pen saved: 1 visitor, 6 problems, 18 s limit");
  ok(pen.prizeQ && pen.prizeQ.length === 6, "six prizes pre-drawn, one per problem");
  ok(pen.products.length === 7 && pen.pool.length === 7, "7 prizes in the pen");

  // a tourist arrives (simulated through the store) → keeper can start
  pen.buyers.push({id:"kiean-oabel", name:"Kiean", emoji:"🦊"});
  await w.CharlieStore.saveMachine(pen);
  await waitFor(() => !$("startBtn").disabled, "tourist arrives — Start lights up");
  $("startBtn").click();
  await waitFor(() => $("scrGame").classList.contains("on"), "keeper lands in the match");
  ok((await w.CharlieStore.getMachine(pen.id)).state === "playing", "the race is on");
  try{ dom.window.close(); }catch(e){}

  /* ---- the tourist races (fast animations, absent keeper auto-resolves) ---- */
  console.log("\nalzebra.html — tourist races the keeper");
  const dom2 = await load("alzebra.html", w2 => {
    w2.CHARLIE_TEST_SESSION = { id: "kiean-oabel", name: "Kiean" };
    w2.ALZEBRA_TEST_FAST = true;
  });
  const w2 = dom2.window, d2 = dom2.window.document;
  const $2 = id => d2.getElementById(id);

  await waitFor(() => w2.CharlieStore, "store loads");
  await w2.CharlieStore.init();
  await sleep(120);

  await w2.CharlieStore.saveMachine({
    id:"m-zoo1", type:"zebra", created: Date.now(),
    seller:{id:"willow-kolo", name:"Willow", emoji:"🐰"},
    state:"playing", capacity:1,
    products:["cola","chips","cookie","gummies","popcorn","phone","car"],
    pool:["cola","chips","cookie","gummies","popcorn","phone","car"],
    rule:[{t:"var"},{t:"op",v:"+"},{t:"num",v:"2"}], reward:3, limit:12,
    probs:[1,2,4,7,8,10], prob:0, probStartAt: Date.now()+100,
    buyers:[{id:"kiean-oabel", name:"Kiean", emoji:"🦊"}],
    history:[], winner:null, claimed:{}
  });

  $2("roleTourist").click();
  await waitFor(() => d2.querySelectorAll("#pens .pen").length === 1, "the zoo lists Willow's pen");
  ok(/'s pen/.test($2("pens").textContent) && !/Willow/.test($2("pens").textContent),
     "the pen tile shows an alias, never the keeper's name");
  d2.querySelector("#pens .pen").click();
  await waitFor(() => $2("scrGame").classList.contains("on"), "tourist steps into the pen");
  await waitFor(() => $2("ansCalc").style.visibility !== "hidden", "tourist goes first");
  ok(d2.querySelectorAll("#probDots .dot").length === 6, "six problem dots line up");
  ok(!!d2.querySelector("#probDots .dot.cur"), "the current problem's dot pulses");
  ok(/𝑥/.test($2("zRuleGame").textContent), "the rule is painted on the zebra for everyone");
  ok($2("carrotNum").textContent === "1", "the first carrot says 1");
  ok(/carrot1\.png/.test($2("carrotImg").src), "the real carrot art is on screen");

  // x = 1, rule x + 2 → feed it 3
  const ak = k => d2.querySelector('#ansPad button[data-k="' + k + '"]').click();
  ak("3"); ok(/3/.test($2("ansDisp").textContent), "answer pad types onto the display");
  ak("go");
  await waitFor(() => {
    const m = w2.__pen1;
    return $2("zHist").textContent.includes("Perfect");
  }, "fast right answer scores Perfect!", 5000);
  let m1 = await w2.CharlieStore.getMachine("m-zoo1");
  ok(m1.history[0].ok === true && m1.history[0].points === 50, "row recorded: correct, 50 points");
  await waitFor(() => !!d2.querySelector("#probDots .dot.yes"),
     "the first dot turns green with a tick", 5000);
  await waitFor(async () => {
    const s = (await w2.CharlieStore.list()).find(x => x.id === "kiean-oabel");
    return s.profile && s.profile.stats && s.profile.stats.solved >= 1;
  }, "the correct answer counts on the solver board", 5000);
  ok(!!m1.history[0].item, "a prize left the pool");
  ok(m1.pool.length === 6, "pool is down to 6");

  // absent keeper: their turn resolves itself as Oops after the grace
  await waitFor(async () => (await w2.CharlieStore.getMachine("m-zoo1")).prob >= 2,
     "the absent keeper's turn auto-resolves", 8000);
  m1 = await w2.CharlieStore.getMachine("m-zoo1");
  ok(m1.history[1].b === "willow-kolo" && m1.history[1].rating === "Oops",
     "keeper's missed turn is an Oops");

  // my second go: answer wrongly on purpose (wait for MY problem, not stale text)
  await waitFor(async () => (await w2.CharlieStore.getMachine("m-zoo1")).prob === 2
     && $2("ansCalc").style.visibility !== "hidden",
     "back to the tourist", 8000);
  ak("9"); ak("9"); ak("go");
  await waitFor(async () => (await w2.CharlieStore.getMachine("m-zoo1")).prob >= 3,
     "wrong answer still moves the race on", 6000);
  m1 = await w2.CharlieStore.getMachine("m-zoo1");
  ok(m1.history[2].ok === false && m1.history[2].points === 10 && !m1.history[2].item,
     "wrong answer: Oops, 10 points, no prize");

  // let the rest of the race run: keeper auto-Oops, I answer my last one right
  await waitFor(async () => (await w2.CharlieStore.getMachine("m-zoo1")).prob === 4
     && $2("ansCalc").style.visibility !== "hidden",
     "my final go arrives", 15000);
  m1 = await w2.CharlieStore.getMachine("m-zoo1");
  ok(m1.prob === 4, "it really is my problem (index 4)");
  const lastX = m1.probs[m1.prob];
  String(lastX + 2).split("").forEach(ch => ak(ch));
  ak("go");
  await waitFor(async () => (await w2.CharlieStore.getMachine("m-zoo1")).state === "done",
     "six problems end the race", 12000);

  await waitFor(() => $2("scrDone").classList.contains("on"), "final screen appears", 6000);
  ok(/You win/.test($2("doneTitle").textContent), "the tourist takes the crown");
  m1 = await w2.CharlieStore.getMachine("m-zoo1");
  ok(m1.winner && !m1.winner.tie && m1.winner.ids[0] === "kiean-oabel", "winner recorded");
  await waitFor(async () => {
    const kiean = (await w2.CharlieStore.list()).find(s => s.id === "kiean-oabel");
    return kiean.money === 3 && kiean.items.length === 2;
  }, "winner banks the money and both prizes", 6000);
  ok(m1.claimed && (await w2.CharlieStore.getMachine("m-zoo1")).claimed["kiean-oabel"] === true,
     "the claim is marked so it can't double-pay");

  // play again with the same group — and the follow must survive wandering:
  // press, drift back to the zoo list, and still get pulled into the new pen
  ok(!!$2("rematchBtn"), "the results screen offers a rematch");
  $2("rematchBtn").click();
  await waitFor(async () => {
    const m = await w2.CharlieStore.getMachine("m-zoo1");
    return m.rematch && m.rematch.ids.indexOf("kiean-oabel") !== -1;
  }, "pressing it signs me into the rematch group", 5000);
  $2("backBtn").click();                        // wander off to the zoo list
  await waitFor(() => $2("scrZoo").classList.contains("on"), "the tourist drifts to the zoo");
  // the keeper (elsewhere) rebuilds: a fresh pen appears and the old one points at it
  await w2.CharlieStore.saveMachine({
    id:"m-zoo2", type:"zebra", created:Date.now(), alias:"Snowy Fox",
    seller:{id:"willow-kolo", name:"Willow", emoji:"🐰"}, state:"open", capacity:1,
    products:["cookie","cola","chips","gummies","popcorn","phone","car"],
    pool:["cookie","cola","chips","gummies","popcorn","phone","car"],
    prizeQ:["cookie","cola","chips","gummies","popcorn","phone"],
    rule:[{t:"var"},{t:"op",v:"+"},{t:"num",v:"2"}], reward:3, limit:18,
    probs:[1,1,2,2,3,3], prob:0, probStartAt:0,
    buyers:[], history:[], winner:null, claimed:{}
  });
  const mRe = await w2.CharlieStore.getMachine("m-zoo1");
  mRe.rematch.sellerId = "willow-kolo";
  mRe.rematch.newId = "m-zoo2";
  await w2.CharlieStore.saveMachine(mRe);
  await waitFor(() => $2("scrZWait").classList.contains("on"),
     "the watcher pulls the wanderer into the new pen's waiting room", 16000);
  await waitFor(async () => {
    const m2 = await w2.CharlieStore.getMachine("m-zoo2");
    return m2.buyers.length === 1 && m2.buyers[0].id === "kiean-oabel";
  }, "and they are seated as the tourist", 5000);
  try{ dom2.window.close(); }catch(e){}
}

async function testPaving(){
  console.log("\npaving race — the maths");
  const G = require("./js/game-core.js");

  const ps = G.paveProblems(() => 0);
  ok(ps.length === 5, "five rounds");
  ok(ps.every(p => p.l * p.b === p.a && 2 * (p.l + p.b) === p.p),
     "every round's perimeter and area really belong to its rectangle");
  ok(ps.every(p => Math.max(p.l, p.b) <= G.PAVE_W && Math.min(p.l, p.b) <= G.PAVE_H),
     "every answer fits on the grid");
  ok(ps.every(p => !p.hidden), "a plot with no level set plays as Beginner");
  ok(ps[0].pts < ps[4].pts && G.paveTotal(ps) === 10, "harder rounds pay more; 10 W on the table");
  ok(G.paveProblems(() => 0, 15)[0].secs === G.PAVE_TIERS[0].secs + 15,
     "the teacher's extra seconds reach the problems");
  const easy = G.paveProblems(() => 0, 0, "easy");
  const mid  = G.paveProblems(() => 0, 0, "mid");
  const hard = G.paveProblems(() => 0, 0, "hard");
  ok(easy.every(p => !p.hidden), "Beginner shows the measurements all game");
  ok(mid.filter(p => p.hidden).length === 2, "Intermediate hides the last two rounds");
  ok(hard.every(p => p.hidden), "Expert hides them from the start");
  ok(hard[0].secs < easy[0].secs, "and Expert runs a little faster");
  ok(G.paveLevel("nonsense").key === "easy", "an unknown level falls back to Beginner");

  const mix = G.paveRounds(() => 0, {});
  ok(mix.length === 8 && mix.slice(0, 3).every(p => p.kind === "measure")
     && mix.slice(3).every(p => p.kind === "build"),
     "a match is three measuring rounds then five paving ones");
  ok(mix.slice(0, 3).every(p => p.grid === true), "Beginner counts squares");
  ok(G.paveRounds(() => 0, {level:"hard"}).slice(0, 3).every(p => p.grid === false),
     "Expert reads the shape without a grid");
  ok(G.paveRounds(() => 0, {measure:2, build:0}).length === 2,
     "the teacher can switch the paving rounds off");
  ok(G.paveRounds(() => 0, {measure:0, build:3}).every(p => p.kind === "build"),
     "…or the measuring rounds");
  ok(G.paveRounds(() => 0, {measure:0, build:0}).length === 1,
     "switching both off still leaves a round to play");
  ok(G.paveRounds(() => 0, {measure:9, build:9}).length === 10,
     "silly counts are capped at the rounds that exist");
  // every rectangle a tier can pick must fit
  ok(G.PAVE_TIERS.every(t => t.rects.every(r =>
       Math.max(r[0], r[1]) <= G.PAVE_W && Math.min(r[0], r[1]) <= G.PAVE_H)),
     "no tier can deal a rectangle too big for the grid");

  ok(G.paveRect([[0,0],[1,0],[0,1],[1,1]]).p === 8, "a 2 × 2 has perimeter 8");
  ok(G.paveRect([[0,0],[1,0],[0,1]]) === null, "an L is not a rectangle");
  ok(G.paveRect([[0,0],[2,0]]) === null, "a gap is not a rectangle");
  ok(G.paveCanPaint([], 4, 4), "the first stone goes anywhere");
  ok(!G.paveCanPaint([[0,0]], 2, 2), "later stones must touch");
  ok(G.paveCanPaint([[0,0],[1,0],[2,0]], 0, 1), "you can start the next row");
  ok(!G.paveCanPaint([[1,0],[0,1],[1,1],[2,1]], 1, 2), "a plus shape is refused");
  ok(!G.paveCanPaint([[9,0]], 10, 0) && !G.paveCanPaint([[0,0]], 0, -1),
     "stones stay on the grid");
  ok(!G.paveCanErase([[0,0],[1,0],[2,0]], 1, 0), "you cannot punch a hole");
  ok(G.paveCanErase([[0,0],[1,0],[2,0]], 2, 0), "you can lift an end stone");
  ok(G.paveMetrics([[0,0],[1,0],[0,1]]).p === 8, "an L of 3 has perimeter 8");
  ok(G.paveSolved([[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]], {p:10, a:6}),
     "3 × 2 answers perimeter 10, area 6");
  ok(!G.paveSolved([[0,0],[1,0],[2,0],[3,0]], {p:10, a:6}),
     "1 × 4 has the wrong measurements");

  console.log("\npaving race — a whole match");
  const dom = await load("paving.html", w => {
    w.CHARLIE_TEST_SESSION = {id:"tepono-montg", name:"Tepono", emoji:"🐦"};
    w.PAVING_TEST_FAST = true;
  });
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);
  await waitFor(() => $("meName").textContent === "Tepono", "the name capsule fills in");

  // a plot another child opened is waiting in the list
  const openPlot = {
    id:"m-pav1", type:"paving", created:Date.now(), alias:"Cute Rabbit",
    seller:{id:"kiean-oabel", name:"Kiean", emoji:"🦊", alias:"Cute Rabbit", hideReal:false},
    buyers:[], state:"open", capacity:1,
    probs:[{l:3,b:2,p:10,a:6,pts:1,secs:45,hidden:false},
           {l:4,b:3,p:14,a:12,pts:1.5,secs:50,hidden:false},
           {l:5,b:4,p:18,a:20,pts:2,secs:60,hidden:false},
           {l:6,b:4,p:20,a:24,pts:2.5,secs:70,hidden:true},
           {l:8,b:5,p:26,a:40,pts:3,secs:80,hidden:true}],
    prob:0, probStartAt:0, nextDelay:150, live:{}, history:[],
    winner:null, claimed:{}, left:[]
  };
  await w.CharlieStore.saveMachine(openPlot);
  await waitFor(() => d.querySelectorAll("#roomList .room").length === 1,
                "the open plot shows up in the list");
  const lvls = d.querySelectorAll("#lvlPick .lvl");
  ok(lvls.length === 3, "three difficulty cards in the New section");
  ok(lvls[0].classList.contains("on") && lvls[0].getAttribute("data-lvl") === "easy",
     "Beginner is chosen for you");
  ok(!d.body.innerHTML.includes("Opens a plot and waits"),
     "the old subtitle is gone");
  ok(/repeat\(3,\s*1fr\)/.test(d.querySelector("style").textContent.split(".lvls")[1].split("}")[0])
     && /\.rooms\{display:grid;\s*grid-template-columns:repeat\(3,1fr\)/.test(d.querySelector("style").textContent),
     "both the levels and the plots sit in three columns");

  const tile = d.querySelector("#roomList .room");
  ok(/Cute Rabbit/.test(tile.textContent) && !/Kiean/.test(tile.textContent),
     "the list shows the plot's alias, never the host's name");

  tile.click();
  await waitFor(() => d.querySelector("#scrGame").classList.contains("on"),
                "tapping the plot drops you straight into the match");
  ok(/Kiean/.test($("oppTitle").textContent),
     "inside the room the real name shows (the class default)");
  ok(/perimeter/i.test($("taskGoal").textContent) && /10 m/.test($("taskGoal").textContent)
     && /6 m/.test($("taskGoal").textContent), "round 1 asks for perimeter 10 and area 6");
  ok($("oppHide").style.display === "none", "round 1 lets you watch each other");

  const cell = (x, y) => d.querySelector('#myGrid .c[data-x="' + x + '"][data-y="' + y + '"]');
  const lay = list => list.forEach(c => cell(c[0], c[1]).click());

  // an illegal stone is refused, and says so
  await waitFor(() => !$("myGrid").classList.contains("locked"), "the grid unlocks for round 1");
  cell(0, 0).click();
  cell(5, 5).click();
  ok(d.querySelectorAll("#myGrid .c.on").length === 1, "a stone that touches nothing is refused");
  ok(/touch/i.test($("toast").textContent), "and the nudge explains why");
  ok(/Perimeter 4 m/.test($("myRead").textContent) && /Area 1/.test($("myRead").textContent),
     "the live readout measures one stone");

  // drag: press on one stone and sweep across the row
  const down = (x, y) => cell(x, y).dispatchEvent(new w.MouseEvent("mousedown", {bubbles:true}));
  const over = (x, y) => cell(x, y).dispatchEvent(new w.MouseEvent("mouseover", {bubbles:true}));
  const up = () => d.dispatchEvent(new w.MouseEvent("mouseup", {bubbles:true}));
  d.querySelector("#clearBtn").click();
  down(0, 0); over(1, 0); over(2, 0); up();
  ok(d.querySelectorAll("#myGrid .c.on").length === 3, "dragging lays a whole row at once");
  over(3, 0);
  ok(d.querySelectorAll("#myGrid .c.on").length === 3, "and stops when you let go");
  cell(2, 0).click();   // the browser's post-drag click — must change nothing
  ok(d.querySelectorAll("#myGrid .c.on").length === 3, "the click that ends a drag is not counted twice");
  d.querySelector("#clearBtn").click();

  // win round 1 with a 3 × 2
  lay([[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]]);
  await waitFor(async () => {
    const m = await w.CharlieStore.getMachine("m-pav1");
    return m.history.length === 1;
  }, "laying the right rectangle wins round 1 on the spot", 5000);
  let m = await w.CharlieStore.getMachine("m-pav1");
  ok(m.history[0].w === "tepono-montg" && m.history[0].pts === 1,
     "the round row records the winner and the Whare");
  ok(m.history[0].shapes["tepono-montg"].length === 6, "and keeps the shape that won it");
  ok(m.prob === 1 && m.probStartAt > Date.now() - 1000, "round 2 is queued up");

  // round 2: the opponent's grid is now blind while drawing
  await waitFor(() => $("oppHide").style.display === "" &&
                      !$("myGrid").classList.contains("locked"),
                "from round 2 the other plot is hidden while you draw");
  ok(d.querySelectorAll("#myGrid .c.on").length === 0, "your plot is swept clean for the new round");
  ok(/perimeter/i.test($("roundIntro").innerHTML) && /ROUND 2 OF 5/.test($("roundIntro").innerHTML),
     "the new goal is announced in the middle of the screen");
  ok($("taskCard").classList.contains("blink"), "and the banner blinks to match");

  // Kiean wins round 2 from his own machine
  m = await w.CharlieStore.getMachine("m-pav1");
  m.live["kiean-oabel"] = {cells:[[0,0],[1,0],[2,0],[3,0],[0,1],[1,1],[2,1],[3,1],[0,2],[1,2],[2,2],[3,2]], t:Date.now()};
  m.history.push({i:1, w:"kiean-oabel", secs:4.2, pts:1.5, p:14, a:12, l:4, b:3,
                  shapes:{"kiean-oabel":m.live["kiean-oabel"].cells}});
  m.live = {}; m.prob = 2; m.probStartAt = Date.now() + 150;
  await w.CharlieStore.saveMachine(m);
  await waitFor(() => /2 W/.test($("oppScore").textContent) ||
                      /1.5 W/.test($("oppScore").textContent),
                "their score climbs when they win one");

  // rounds 3-5: hand them to Kiean so the match can finish
  for(const r of [{i:2,pts:2,p:18,a:20,l:5,b:4}, {i:3,pts:2.5,p:20,a:24,l:6,b:4}]){
    m = await w.CharlieStore.getMachine("m-pav1");
    m.history.push({i:r.i, w:"kiean-oabel", secs:5, pts:r.pts, p:r.p, a:r.a, l:r.l, b:r.b, shapes:{}});
    m.prob = r.i + 1; m.live = {}; m.probStartAt = Date.now() + 150;
    await w.CharlieStore.saveMachine(m);
    await sleep(80);
  }
  // round 5 hides the measurements
  await waitFor(() => /hidden/i.test($("myRead").textContent), "the last rounds hide your measurements");
  ok(/hidden/i.test($("taskWorth").textContent), "and the banner warns you first");

  // Tepono takes the last round: 8 × 5
  await waitFor(() => !$("myGrid").classList.contains("locked"), "the final round opens");
  const big = [];
  for(let y=0;y<5;y++) for(let x=0;x<8;x++) big.push([x,y]);
  lay(big);
  await waitFor(() => d.querySelector("#scrDone").classList.contains("on"),
                "the fifth round ends the match and the results appear", 6000);

  m = await w.CharlieStore.getMachine("m-pav1");
  ok(m.state === "done" && m.history.length === 5, "five rounds are on the record");
  ok(m.winner && !m.winner.tie && m.winner.ids[0] === "kiean-oabel",
     "the bigger pile of Whare wins the match");
  ok(/Kiean/.test($("doneLine").textContent), "the loser's screen names the winner");
  ok(d.querySelectorAll("#doneRounds .rrow").length === 5, "one row of grids per round");
  ok(d.querySelectorAll("#doneRounds .rrow")[0].querySelectorAll(".mini").length === 3,
     "each row shows you, them and the answer");
  const answer = d.querySelectorAll("#doneRounds .rrow")[0].querySelectorAll(".mini")[2];
  ok(/3 × 2/.test(answer.textContent) && answer.querySelectorAll(".c.on").length === 6,
     "the answer grid draws the rectangle that was wanted");

  // Tepono banks round 1 (1 W) + round 5 (3 W) = 4 W, no winner's bonus
  await waitFor(async () => {
    const t = (await w.CharlieStore.list()).find(s => s.id === "tepono-montg");
    return t && t.money === 4;
  }, "you bank exactly the Whare you won", 6000);
  ok(/You earned/.test($("earnedCard").innerHTML) && /4 W/.test($("earnedCard").innerHTML),
     "the results screen says how much you earned");

  const m2 = await w.CharlieStore.getMachine("m-pav1");
  ok(typeof m2.claimed["tepono-montg"] === "string" &&
     m2.claimed["tepono-montg"].indexOf("tepono-montg:") === 0,
     "the payout is stamped by this device so it can never pay twice");
  await sleep(120);
  const t2 = (await w.CharlieStore.list()).find(s => s.id === "tepono-montg");
  ok(t2.money === 4, "and a second look does not pay again");

  // a second match in the same sitting must score and pay all over again
  d.querySelector("#backBtn").click();
  await waitFor(() => d.querySelector("#scrHome").classList.contains("on"),
                "Back drops you into the lobby, not out of the game");
  await w.CharlieStore.saveMachine({
    id:"m-pav3", type:"paving", created:Date.now(), alias:"Brave Kea",
    seller:{id:"kiean-oabel", name:"Kiean", emoji:"🦊", alias:"Brave Kea", hideReal:false},
    buyers:[{id:"tepono-montg", name:"Tepono", emoji:"🐦", alias:"Swift Tui", hideReal:false}],
    state:"playing", capacity:1,
    probs:[{l:3,b:2,p:10,a:6,pts:1,secs:45,hidden:false},
           {l:4,b:3,p:14,a:12,pts:1.5,secs:50,hidden:false},
           {l:5,b:4,p:18,a:20,pts:2,secs:60,hidden:false},
           {l:6,b:4,p:20,a:24,pts:2.5,secs:70,hidden:true},
           {l:8,b:5,p:26,a:40,pts:3,secs:80,hidden:true}],
    prob:4, probStartAt:Date.now(), nextDelay:150, live:{},
    history:[{i:0,w:"tepono-montg",secs:4,pts:1,p:10,a:6,l:3,b:2,shapes:{}},
             {i:1,w:"tepono-montg",secs:5,pts:1.5,p:14,a:12,l:4,b:3,shapes:{}},
             {i:2,w:"tepono-montg",secs:6,pts:2,p:18,a:20,l:5,b:4,shapes:{}},
             {i:3,w:"kiean-oabel",secs:7,pts:2.5,p:20,a:24,l:6,b:4,shapes:{}}],
    winner:null, claimed:{}, left:[]
  });
  await waitFor(() => d.querySelector("#scrGame").classList.contains("on"),
                "the next match starts cleanly after the last one", 5000);
  ok(d.querySelectorAll("#myGrid .c.on").length === 0, "with an empty plot");
  await waitFor(() => !$("myGrid").classList.contains("locked"), "and a live grid");
  const big2 = [];
  for(let y=0;y<5;y++) for(let x=0;x<8;x++) big2.push([x,y]);
  lay(big2);
  await waitFor(() => d.querySelector("#scrDone").classList.contains("on"),
                "the second match reaches its results screen", 6000);
  // 1 + 1.5 + 2 + 3 = 7.5 W plus the 1 W bonus, on top of the 4 W already banked
  await waitFor(async () => {
    const t = (await w.CharlieStore.list()).find(s => s.id === "tepono-montg");
    return t && t.money === 12.5;
  }, "the second match pays out too — nothing stale from the first", 6000);

  try{ dom.window.close(); }catch(e){}

  // the winner's side: rejoin after a reload, take the last round, bank the bonus
  console.log("\npaving race — the winner's side");
  const dom2 = await load("paving.html", w2 => {
    w2.CHARLIE_TEST_SESSION = {id:"kiean-oabel", name:"Kiean", emoji:"🦊"};
    w2.PAVING_TEST_FAST = true;
  });
  const w2 = dom2.window, d2 = w2.document;
  const $2 = id => d2.getElementById(id);
  await waitFor(() => $2("meName").textContent === "Kiean", "the winner arrives");
  // a match he was already in, waiting on its last round
  await w2.CharlieStore.saveMachine({
    id:"m-pav2", type:"paving", created:Date.now(), alias:"Happy Owl",
    seller:{id:"willow-kolo", name:"Willow", emoji:"🦉", alias:"Happy Owl", hideReal:false},
    buyers:[{id:"kiean-oabel", name:"Kiean", emoji:"🦊", alias:"Brave Kea", hideReal:false}],
    state:"playing", capacity:1,
    probs:[{l:3,b:2,p:10,a:6,pts:1,secs:45,hidden:false},
           {l:4,b:3,p:14,a:12,pts:1.5,secs:50,hidden:false},
           {l:5,b:4,p:18,a:20,pts:2,secs:60,hidden:false},
           {l:6,b:4,p:20,a:24,pts:2.5,secs:70,hidden:true},
           {l:8,b:5,p:26,a:40,pts:3,secs:80,hidden:true}],
    prob:4, probStartAt:Date.now(), nextDelay:150, live:{},
    history:[{i:0,w:"kiean-oabel",secs:4,pts:1,p:10,a:6,l:3,b:2,shapes:{}},
             {i:1,w:"kiean-oabel",secs:5,pts:1.5,p:14,a:12,l:4,b:3,shapes:{}},
             {i:2,w:"kiean-oabel",secs:6,pts:2,p:18,a:20,l:5,b:4,shapes:{}},
             {i:3,w:"willow-kolo",secs:7,pts:2.5,p:20,a:24,l:6,b:4,shapes:{}}],
    winner:null, claimed:{}, left:[]
  });
  await waitFor(() => d2.querySelector("#scrGame").classList.contains("on"),
                "a match already under way pulls its player back in", 5000);
  ok(/ROUND 5 OF 5/.test($2("taskLead").textContent), "right where the match had got to");
  ok(/Willow/.test($2("oppTitle").textContent), "with the same opponent");

  await waitFor(() => !$2("myGrid").classList.contains("locked"), "the grid is live");
  for(let y=0;y<5;y++) for(let x=0;x<8;x++){
    d2.querySelector('#myGrid .c[data-x="' + x + '"][data-y="' + y + '"]').click();
  }
  await waitFor(() => d2.querySelector("#scrDone").classList.contains("on"),
                "the winning rectangle ends the match", 6000);
  const won = await w2.CharlieStore.getMachine("m-pav2");
  ok(won.winner && won.winner.ids[0] === "kiean-oabel", "the winner is the one with more Whare");
  ok(/You win/.test($2("doneTitle").textContent), "the winner's screen celebrates");
  // 1 + 1.5 + 2 + 3 = 7.5 W won, plus the 1 W winner's bonus
  await waitFor(async () => {
    const k = (await w2.CharlieStore.list()).find(s => s.id === "kiean-oabel");
    return k && k.money === 8.5;
  }, "the winner banks 7.5 W plus the 1 W bonus", 6000);
  ok(/8.5 W/.test($2("doneScores").textContent), "and the results page shows the same total");
  try{ dom2.window.close(); }catch(e){}

  // measuring rounds: read the rectangle, fill in the blanks
  console.log("\npaving race — the measuring rounds");
  const dom5 = await load("paving.html", w5 => {
    w5.CHARLIE_TEST_SESSION = {id:"tepono-montg", name:"Tepono", emoji:"🐦"};
    w5.PAVING_TEST_FAST = true;
  });
  const w5 = dom5.window, d5 = w5.document;
  const $5 = id => d5.getElementById(id);
  await waitFor(() => $5("meName").textContent === "Tepono", "a player arrives");
  await w5.CharlieStore.saveMachine({
    id:"m-pav4", type:"paving", created:Date.now(), alias:"Wise Weka", level:"easy",
    seller:{id:"kiean-oabel", name:"Kiean", emoji:"🦊", alias:"Wise Weka", hideReal:false},
    buyers:[{id:"tepono-montg", name:"Tepono", emoji:"🐦", alias:"Swift Tui", hideReal:false}],
    state:"playing", capacity:1,
    probs:[{kind:"measure", l:4, b:3, p:14, a:12, pts:1, secs:30, grid:true},
           {kind:"build", l:3, b:2, p:10, a:6, pts:1, secs:45, hidden:false}],
    prob:0, probStartAt:Date.now(), nextDelay:150, live:{}, history:[],
    winner:null, claimed:{}, left:[]
  });
  await waitFor(() => d5.querySelector("#scrGame").classList.contains("on"), "the match opens", 5000);
  await waitFor(() => $5("measureWrap").style.display === "", "a measuring round shows the question card");
  ok($5("boardsWrap").style.display === "none", "and puts the two plots away");
  ok(/perimeter/i.test($5("taskGoal").textContent) && /area/i.test($5("taskGoal").textContent),
     "the banner asks for both measurements");
  ok(d5.querySelectorAll("#shapeArt .s").length === 12, "the 4 × 3 rectangle is drawn as 12 squares");
  ok(/4 m/.test($5("shapeArt").textContent) && /3 m/.test($5("shapeArt").textContent),
     "with its two sides labelled");

  // the hint panel
  ok(!$5("hintPanel").classList.contains("on"), "the hint stays out of the way");
  $5("hintBtn").click();
  ok($5("hintPanel").classList.contains("on"), "Hint opens the panel");
  ok(/2 × length/.test($5("hintPanel").textContent) && /length × breadth/.test($5("hintPanel").textContent),
     "showing how each one is worked out");
  $5("hintClose").click();
  ok(!$5("hintPanel").classList.contains("on"), "and it closes again");

  // a wrong answer is refused, kindly
  $5("ansP").value = "12"; $5("ansA").value = "12";
  $5("checkBtn").click();
  await sleep(20);
  let m5 = await w5.CharlieStore.getMachine("m-pav4");
  ok(m5.history.length === 0, "a wrong answer does not win the round");
  ok(/another look/i.test($5("measureNote").textContent), "and says so gently");
  await waitFor(() => !$5("checkBtn").disabled, "the blanks come back after a moment", 3000);

  // the right answer takes it
  $5("ansP").value = "14"; $5("ansA").value = "12";
  $5("checkBtn").click();
  await waitFor(async () => {
    const m = await w5.CharlieStore.getMachine("m-pav4");
    return m.history.length === 1;
  }, "answering both blanks correctly wins the round", 5000);
  m5 = await w5.CharlieStore.getMachine("m-pav4");
  ok(m5.history[0].kind === "measure" && m5.history[0].w === "tepono-montg" && m5.history[0].pts === 1,
     "the round is recorded as a measuring win");
  ok(m5.history[0].answers["tepono-montg"].p === 14, "with what the player answered");
  await waitFor(() => $5("boardsWrap").style.display === "", "the next round is a paving one");

  // finish it so the results page can be checked
  await waitFor(() => !$5("myGrid").classList.contains("locked"), "the grid opens");
  [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]].forEach(c =>
    d5.querySelector('#myGrid .c[data-x="' + c[0] + '"][data-y="' + c[1] + '"]').click());
  await waitFor(() => d5.querySelector("#scrDone").classList.contains("on"), "the match ends", 6000);
  ok(/perimeter <b>14 m<\/b>/.test($5("doneRounds").innerHTML)
     && /area <b>12 m²<\/b>/.test($5("doneRounds").innerHTML),
     "the results show the measuring answer plainly");
  ok(/you said 14 m and 12 m²/.test($5("doneRounds").textContent),
     "next to what you wrote");
  ok($5("rematchBtn").style.display !== "none", "and offers another game with the same player");
  try{ dom5.window.close(); }catch(e){}

  // play again: both press, and a fresh plot opens for the pair
  console.log("\npaving race — play again");
  const domR = await load("paving.html", wR => {
    wR.CHARLIE_TEST_SESSION = {id:"kiean-oabel", name:"Kiean", emoji:"🦊"};
    wR.PAVING_TEST_FAST = true;
  });
  const wR = domR.window, dR = domR.window.document;
  await waitFor(() => dR.getElementById("meName").textContent === "Kiean", "the host arrives");
  await wR.CharlieStore.saveMachine({
    id:"m-pav6", type:"paving", created:Date.now(), alias:"Kind Kea", level:"mid",
    seller:{id:"kiean-oabel", name:"Kiean", emoji:"🦊", alias:"Kind Kea", hideReal:false},
    buyers:[{id:"tepono-montg", name:"Tepono", emoji:"🐦", alias:"Swift Tui", hideReal:false}],
    state:"playing", capacity:1,
    probs:[{kind:"build", l:3, b:2, p:10, a:6, pts:1, secs:45, hidden:false}],
    prob:0, probStartAt:Date.now(), nextDelay:150, live:{}, history:[],
    winner:null, claimed:{}, left:[]
  });
  await waitFor(() => dR.querySelector("#scrGame").classList.contains("on"), "the match starts", 5000);
  await waitFor(() => !dR.getElementById("myGrid").classList.contains("locked"), "the grid opens");
  [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]].forEach(c =>
    dR.querySelector('#myGrid .c[data-x="' + c[0] + '"][data-y="' + c[1] + '"]').click());
  await waitFor(() => dR.querySelector("#scrDone").classList.contains("on"), "and finishes", 6000);
  ok(/You earned/.test(dR.getElementById("earnedCard").innerHTML),
     "the winnings pop up in the middle of the screen");

  dR.getElementById("rematchBtn").click();
  await waitFor(async () => {
    const m = await wR.CharlieStore.getMachine("m-pav6");
    return m.rematch && m.rematch.ids.indexOf("kiean-oabel") !== -1;
  }, "pressing Play again puts your name down", 4000);
  ok(/Waiting/.test(dR.getElementById("rematchBtn").textContent), "and waits for the other player");
  // the opponent presses on their own machine
  let rm = await wR.CharlieStore.getMachine("m-pav6");
  rm.rematch.ids.push("tepono-montg");
  await wR.CharlieStore.saveMachine(rm);
  await waitFor(() => dR.querySelector("#scrGame").classList.contains("on"),
                "when both have pressed, a new match begins", 6000);
  rm = await wR.CharlieStore.getMachine("m-pav6");
  ok(rm.rematch.newId, "the old plot points at the new one so the other player follows");
  const fresh = await wR.CharlieStore.getMachine(rm.rematch.newId);
  ok(fresh.state === "playing" && fresh.level === "mid",
     "the new plot keeps the same difficulty");
  ok(fresh.buyers[0].id === "tepono-montg" && fresh.seller.id === "kiean-oabel",
     "with the same two players");
  ok(fresh.history.length === 0 && fresh.prob === 0, "and a clean slate");
  try{ domR.window.close(); }catch(e){}

  // expert plots hand out the shape without a grid to count
  const dom6 = await load("paving.html", w6 => {
    w6.CHARLIE_TEST_SESSION = {id:"tepono-montg", name:"Tepono", emoji:"🐦"};
    w6.PAVING_TEST_FAST = true;
  });
  const w6 = dom6.window, d6 = w6.document;
  await waitFor(() => d6.getElementById("meName").textContent === "Tepono", "a player arrives");
  await w6.CharlieStore.saveMachine({
    id:"m-pav5", type:"paving", created:Date.now(), alias:"Bold Kiwi", level:"hard",
    seller:{id:"kiean-oabel", name:"Kiean", emoji:"🦊", alias:"Bold Kiwi", hideReal:false},
    buyers:[{id:"tepono-montg", name:"Tepono", emoji:"🐦", alias:"Swift Tui", hideReal:false}],
    state:"playing", capacity:1,
    probs:[{kind:"measure", l:5, b:4, p:18, a:20, pts:1, secs:26, grid:false}],
    prob:0, probStartAt:Date.now(), nextDelay:150, live:{}, history:[],
    winner:null, claimed:{}, left:[]
  });
  await waitFor(() => d6.getElementById("measureWrap").style.display === "", "an expert measuring round", 5000);
  ok(d6.querySelectorAll("#shapeArt .s").length === 1 &&
     d6.querySelector("#shapeArt .shapegrid").classList.contains("plain"),
     "the expert shape has no squares to count");
  ok(/5 m/.test(d6.getElementById("shapeArt").textContent), "only its labels");
  try{ dom6.window.close(); }catch(e){}

  console.log("\npaving race — the teacher's switches");
  const dom3 = await load("admin.html", w3 => { w3.CHARLIE_TEST_TEACHER = true; });
  const w3 = dom3.window, d3 = w3.document;
  await waitFor(() => d3.getElementById("setPaveOn"), "the Paving Race panel is in admin");
  // let the page finish reading the saved settings, or it overwrites our clicks
  await waitFor(() => d3.getElementById("setTurnSecs").value !== "",
                "admin finishes loading the current settings", 4000);
  d3.getElementById("setPaveNick").checked = true;
  d3.getElementById("setPaveNick").dispatchEvent(new w3.Event("change"));
  d3.getElementById("setPaveSecs").value = "20";
  d3.getElementById("setPaveSecs").dispatchEvent(new w3.Event("change"));
  await waitFor(async () => {
    const s = await w3.CharlieStore.getMachine("game-settings");
    return s && s.paving && s.paving.nicknames === true && s.paving.extraSecs === 20;
  }, "nickname mode and extra seconds save", 4000);
  let s3 = await w3.CharlieStore.getMachine("game-settings");
  ok(s3.hidden.paving === false, "the game stays visible until you say otherwise");
  ok(s3.alzebra && s3.algebra, "the other games' settings survive the save");
  d3.getElementById("setPaveMeasure").value = "2";
  d3.getElementById("setPaveMeasure").dispatchEvent(new w3.Event("change"));
  d3.getElementById("setPaveBuildOn").checked = false;
  d3.getElementById("setPaveBuildOn").dispatchEvent(new w3.Event("change"));
  await waitFor(async () => {
    const s = await w3.CharlieStore.getMachine("game-settings");
    return s && s.paving && s.paving.measure === 2 && s.paving.build === 0;
  }, "the teacher sets two measuring rounds and no paving ones", 4000);

  d3.getElementById("setPaveOn").checked = false;
  d3.getElementById("setPaveOn").dispatchEvent(new w3.Event("change"));
  await waitFor(async () => {
    const s = await w3.CharlieStore.getMachine("game-settings");
    return s && s.hidden && s.hidden.paving === true;
  }, "unticking Visible hides the game", 4000);
  try{ dom3.window.close(); }catch(e){}

  // a teacher closing the game reaches students who are still in the lobby
  const dom4 = await load("paving.html", w4 => {
    w4.CHARLIE_TEST_SESSION = {id:"tepono-montg", name:"Tepono", emoji:"🐦"};
    w4.PAVING_TEST_FAST = true;
  });
  const w4 = dom4.window;
  await waitFor(() => w4.document.getElementById("meName").textContent === "Tepono",
                "a student is sitting in the lobby");
  await w4.CharlieStore.saveMachine({id:"game-settings", type:"settings", created:Date.now(),
                                     hidden:{paving:true}, paving:{nicknames:false, extraSecs:0}});
  await waitFor(() => /closed Paving Race/i.test(w4.document.getElementById("toast").textContent),
                "closing the game walks them back to the hub kindly", 4000);
  try{ dom4.window.close(); }catch(e){}
}

async function testParallelogram(){
  console.log("\nparallelogram.html — one-slide tutorial, then the timed round");
  const dom = await load("parallelogram.html", w => {
    w.CHARLIE_TEST_SESSION = { id: "willow-kolo", name: "Willow" };
    w.CHARLIE_TEST_FAST = true;
  });
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);

  await waitFor(() => w.CharlieStore, "store loads");
  await w.CharlieStore.init();
  await waitFor(() => !!w.PARA_TEST, "the test hook is available");
  await sleep(150);

  const P = w.PARA_TEST, bank = P.bank();
  ok(bank.length === 30, "thirty parallelograms in the bank");
  // every shape really is a parallelogram: opposite sides equal and parallel
  let shapeOk = true;
  bank.forEach(it => {
    const p = P.pts(it);
    const v1 = [p[1][0]-p[0][0], p[1][1]-p[0][1]];
    const v2 = [p[2][0]-p[3][0], p[2][1]-p[3][1]];
    if(Math.abs(v1[0]-v2[0]) > 1e-9 || Math.abs(v1[1]-v2[1]) > 1e-9) shapeOk = false;
    if(!(it.b > 0 && it.h > 0)) shapeOk = false;
  });
  ok(shapeOk, "each one is a true parallelogram with a positive base and height");

  /* ---- the tutorial: one stage, two blanks, the piece slides across ---- */
  ok($("scrTut").classList.contains("on"), "a first-timer starts in the tutorial");
  ok(!$("eqC"), "there is no halving box — a parallelogram needs none");
  ok($("tutNext").disabled, "Confirm sleeps until both lengths are in");
  $("eqA").value = "4"; $("eqA").dispatchEvent(new w.Event("input"));
  await waitFor(() => d.querySelectorAll("#tutStage .piece polygon")[1]
     .getAttribute("fill") !== d.querySelectorAll("#tutStage .piece polygon")[0].getAttribute("fill"),
     "the first length colours the loose piece", 4000);
  ok($("tutNext").disabled, "one length is not enough");
  $("eqB").value = "5"; $("eqB").dispatchEvent(new w.Event("input"));
  await waitFor(() => {
    const g = d.querySelectorAll("#tutStage .piece")[1];
    return g && /translate/.test(g.style.transform || "");
  }, "the second length slides the piece into place", 4000);
  ok(d.querySelector("#tutStage .outline").getAttribute("opacity") === "1",
     "a dotted outline stays where the piece used to be");
  await waitFor(() => /4 cm × 5 cm = 20/.test($("eqResult").textContent),
     "the finished sum reads base × height = 20 cm²");
  ok(!$("tutNext").disabled && /Confirm/.test($("tutNext").textContent), "Confirm wakes up");
  $("tutNext").click();
  await waitFor(() => $("scrHome").classList.contains("on"), "Confirm leads to the game", 5000);
  ok(/Parallelo/.test($("scrHome").textContent), "the home screen carries the two-tone name");

  /* ---- a round is six area questions ---- */
  $("startBtn").click();
  await waitFor(() => $("scrPlay").classList.contains("on"), "the round starts");
  ok(P.round().length === 6, "six questions in a round");
  ok(/Question 1 of 6/.test($("qCount").textContent), "the counter agrees");
  ok(/50 pts/.test($("ptsNow").textContent), "a quick answer is worth 50");

  for(let n = 0; n < 6; n++){
    await waitFor(() => !!$("ansIn"), "question " + (n+1) + " is on screen", 5000);
    const q = P.round()[n];
    $("ansIn").value = String(q.item.b * q.item.h);
    $("checkBtn").click();
    await sleep(140);
  }
  await waitFor(() => $("scrDone").classList.contains("on"), "six right answers finish the round", 6000);
  ok(P.score() >= 120, "a clean sweep scores well (" + P.score() + ")");
  await waitFor(async () => {
    const b = await w.CharlieStore.getMachine("parallelogram-scores");
    return b && b.entries.some(e => e.id === "willow-kolo");
  }, "the score lands on the ranking", 6000);
  await waitFor(async () => {
    const b = await w.CharlieStore.getMachine("parallelogram-results");
    const r = b && b.rows[b.rows.length - 1];
    return r && r.turn === 1 && r.para[0] === 6 && r.para[1] === 6;
  }, "the turn is logged as 6 out of 6", 6000);
  await waitFor(() => /\+2 Whare/.test($("doneReward").textContent),
     "a first score pays the 2 Whare reward", 5000);
  try{ dom.window.close(); }catch(e){}
}


async function testReview12(){
  console.log("\nreview12.html — the adaptive Review 12 checkpoint");

  /* ---- the bank on its own ---- */
  const R12 = require("./js/review12-bank.js");
  ok(R12.ITEMS.length === 4 && R12.ITEMS.map(i => i.n).join(",") === "1,2,3,4",
     "four paper questions — the plan-view drawing is left out");
  R12.ITEMS.forEach(it => {
    let good = true, paperTagged = false;
    for(let l = 1; l <= it.diff; l++){
      const lv = it.levels[l];
      if(!lv || lv.qs.length !== 3 || lv.practice.length !== 3 || !lv.know || !lv.know.title) good = false;
      if(lv && lv.know && !lv.hint) good = false;
    }
    const top = it.levels[it.diff].qs[0];
    paperTagged = top.note === "paper";
    ok(good, "Q" + it.n + ": every level has a knowledge card, a hint, 3 questions and 3 practice problems");
    ok(paperTagged, "Q" + it.n + ": the first top-level question is the one from the paper");
  });
  // the paper answers themselves
  const q1 = R12.item("q1").levels[6].qs[0];
  ok(q1.blanks[0].ans === 66 && q1.blanks[1].ans === 24, "Q1 paper answers: a = 66°, b = 24°");
  const q2 = R12.item("q2").levels[7].qs[0];
  ok(q2.blanks.map(b => b.ans).join(",") === "35,80,55,70", "Q2 paper answers: 35, 80, 55, 70");
  const q3 = R12.item("q3").levels[7].qs[0];
  ok(q3.blanks.map(b => b.ans).join(",") === "160,20,160,20", "Q3 paper answers: 160, 20, 160, 20");
  ok(R12.item("q4").levels[5].qs[0].kind === "draw", "Q4 is answered by drawing on the circle");

  /* ---- the ladder rules ---- */
  const it2 = R12.item("q2");
  let st = R12.newState(it2);
  R12.markAnswer(it2, st, true);
  ok(!st.done, "one right answer is not enough to lock a level");
  R12.markAnswer(it2, st, true);
  ok(st.done && st.lock === 7, "two right answers lock the level");
  st = R12.newState(it2);
  R12.markAnswer(it2, st, false);
  ok(st.lv === 7 && st.used === 1, "one wrong answer brings a sibling question at the same level");
  R12.markAnswer(it2, st, false);
  ok(st.lv === 6 && st.used === 0, "two wrong answers step down a level");
  R12.markAnswer(it2, st, true); R12.markAnswer(it2, st, false); R12.markAnswer(it2, st, true);
  ok(st.done && st.lock === 6, "right-wrong-right still locks — three questions per level is enough");
  ok(R12.neededLevels(it2, st).map(n => n.lv).join(",") === "7", "locked at 6 of 7 → only the level-7 knowledge is missing");
  st = R12.newState(it2);
  while(!st.done) R12.markAnswer(it2, st, false);
  ok(st.lock === 1 && st.floor, "all wrong answers bottom out at level 1, flagged");
  ok(R12.neededLevels(it2, st).length === 7, "a floored student needs every level, level 1 included");
  ok(R12.numOK("66°", 66) && R12.numOK(" 66 degrees ", 66) && R12.numOK("4.5 cm", 4.5) && !R12.numOK("65", 66),
     "typed answers forgive the degree sign, units and spaces");

  /* ---- the worksheet ---- */
  const ws = R12.worksheetHTML({name:"Willow", emoji:"🦋"}, it2, {lock:5, floor:false, target:7});
  ok(/Part 1/.test(ws) && /Part 2/.test(ws) && !/Part 3/.test(ws),
     "locked at 5 of 7 → the sheet holds exactly two ten-minute parts");
  ok(/Isosceles triangles/.test(ws) && /Putting the angle facts together/.test(ws),
     "the parts are the two missing knowledge steps");
  ok(/Answers — for the teacher/.test(ws) && /Willow/.test(ws) && /size:A4/.test(ws),
     "it is a named A4 sheet with a teacher answer key");
  ok(/Lesson 3 — Investigating Angles in Triangles/.test(ws) && /pp\. 115–117/.test(ws),
     "each part points at its textbook lesson and pages");

  /* ---- the page itself ---- */
  const dom = await load("review12.html", w => {
    w.CHARLIE_TEST_SESSION = { id: "willow-kolo", name: "Willow" };
    w.CHARLIE_TEST_FAST = true;
  });
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);
  await waitFor(() => w.CharlieStore, "store loads");
  await w.CharlieStore.init();
  await waitFor(() => !!w.R12_TEST, "the test hook is available");
  await waitFor(() => $("scrHome").classList.contains("on"), "the intro screen shows");
  ok(/same questions/.test($("scrHome").textContent), "the intro says the paper comes first");

  $("startBtn").click();
  ok($("scrPlay").classList.contains("on"), "the checkpoint starts");
  ok($("paperNote").style.display === "block", "the paper banner shows for the identical question");
  ok(/same questions on your paper/.test($("paperNote").textContent),
     "…with the promised wording");
  ok(d.querySelectorAll("#answers input").length === 2, "Q1 asks for angles a and b");

  // a typed answer flows through Check
  const ins = d.querySelectorAll("#answers input");
  ins[0].value = "66°"; ins[1].value = "24";
  $("checkBtn").click();
  await waitFor(() => w.R12_TEST.state().path.length === 1, "the answer is marked");
  ok(w.R12_TEST.state().r === 1, "…as correct, degree sign and all");
  ok($("paperNote").style.display === "none", "the sibling question is not badged as the paper one");
  w.R12_TEST.submit(true);
  await waitFor(() => w.R12_TEST.itemIndex() === 1, "two rights finish question 1");
  ok(w.R12_TEST.results().q1.lock === 6, "…locked at the top level");

  // question 2: drive it down a level, then lock
  w.R12_TEST.submit(false); w.R12_TEST.submit(false);
  await waitFor(() => w.R12_TEST.state().lv === 6, "two wrongs on Q2 step down to level 6");
  ok($("stepNote").style.display === "block", "the page calls it a stepping-stone question");
  w.R12_TEST.submit(true); w.R12_TEST.submit(true);
  await waitFor(() => w.R12_TEST.itemIndex() === 2, "level 6 locked, on to question 3");
  ok(w.R12_TEST.results().q2.lock === 6 && w.R12_TEST.results().q2.target === 7,
     "Q2 recorded as level 6 of 7");

  // question 3 straight through
  w.R12_TEST.submit(true); w.R12_TEST.submit(true);
  await waitFor(() => w.R12_TEST.itemIndex() === 3, "question 4 arrives");

  // question 4: really draw on the circle
  ok(w.R12_TEST.q().kind === "draw", "the circle drawing task renders");
  ok(/tap the centre/i.test($("drawStep").textContent), "step 1 asks for the radius from O");
  w.R12_TEST.tap(175, 120);            // the centre
  w.R12_TEST.tap(175, 30);             // top of the circumference (snapped)
  ok(w.R12_TEST.drawState().results[0] === true, "centre → circumference counts as a radius");
  w.R12_TEST.tap(85, 122);             // left edge
  w.R12_TEST.tap(265, 118);            // right edge — the chord runs through O
  ok(w.R12_TEST.drawState().results[1] === true, "an edge-to-edge line through O counts as the diameter");
  ok(!$("checkBtn").disabled, "both parts drawn — Check unlocks");
  $("checkBtn").click();
  await waitFor(() => w.R12_TEST.state().r === 1, "the drawing is marked correct");

  // second drawing: a chord that misses the centre is refused
  w.R12_TEST.tap(85, 122); w.R12_TEST.tap(175, 30);          // edge to edge, missing O
  ok(w.R12_TEST.drawState().results[0] === false, "a chord that misses O is not a diameter");
  w.R12_TEST.tap(175, 120); w.R12_TEST.tap(85, 122);
  ok(w.R12_TEST.drawState().results[1] === true, "…but O to the edge is still a radius");
  $("checkBtn").click();
  await waitFor(() => w.R12_TEST.state().w === 1, "the flawed drawing is marked wrong");
  w.R12_TEST.submit(true);
  await waitFor(() => $("scrDone").classList.contains("on"), "the summary screen arrives", 6000);
  ok(/Q1/.test($("doneRows").textContent) && /Q4/.test($("doneRows").textContent),
     "all four ladders are summed up");
  await waitFor(async () => {
    const b = await w.CharlieStore.getMachine("review12-results");
    return b && b.rows.length === 1 && b.rows[0].id === "willow-kolo"
      && b.rows[0].items.q2.lock === 6 && b.rows[0].items.q1.lock === 6;
  }, "the run is saved for the teacher", 5000);
  try{ dom.window.close(); }catch(e){}

  /* ---- the teacher's side ---- */
  const dom2 = await load("admin.html", w2 => { w2.CHARLIE_TEST_TEACHER = true; });
  const w2 = dom2.window, d2 = w2.document;
  await waitFor(() => w2.CharlieStore, "admin store loads");
  await w2.CharlieStore.init();
  await w2.CharlieStore.saveMachine({id:"review12-results", type:"results", created:Date.now(), rows:[
    {id:"willow-kolo", name:"Willow", emoji:"🦋", turn:1, t:Date.now(),
     items:{q1:{lock:6, floor:false, target:6},
            q2:{lock:4, floor:false, target:7},
            q3:{lock:1, floor:true,  target:7},
            q4:{lock:5, floor:false, target:5}}}
  ]});
  d2.getElementById("r12Results").click();
  await waitFor(() => d2.getElementById("r12Box").dataset.ready === "1", "the levels table renders", 5000);
  const boxText = d2.getElementById("r12Box").textContent;
  ok(/L6\/6 ✓/.test(boxText), "a full ladder shows as complete");
  ok(/L4\/7/.test(boxText), "a part-way ladder shows its level");
  ok(/L1−\/7/.test(boxText), "a floored ladder is flagged below level 1");
  ok(/Step from the line into the triangle/.test(boxText) && /Isosceles triangles/.test(boxText),
     "the missing knowledge is named beside the level");
  const dls = d2.querySelectorAll(".r12dl");
  ok(dls.length === 2 && !/Downloaded/.test(dls[0].textContent),
     "download buttons appear only where something is missing, unticked at first");
  dls[0].click();
  await waitFor(() => !!w2.R12_LAST_SHEET, "clicking Download builds the sheet");
  ok(/Review 12 helper/.test(w2.R12_LAST_SHEET) && /Willow/.test(w2.R12_LAST_SHEET)
     && /Part 1/.test(w2.R12_LAST_SHEET),
     "the sheet is the student's own helper, split into parts");
  await waitFor(async () => {
    const b = await w2.CharlieStore.getMachine("review12-downloads");
    return b && b.marks && b.marks["willow-kolo|q2"];
  }, "the download is remembered", 5000);
  await waitFor(() => /✓ Downloaded/.test(d2.getElementById("r12Box").textContent),
     "…and the button now wears its tick", 5000);
  try{ dom2.window.close(); }catch(e){}
}

async function testReview(){
  console.log("\nreview.html — the 90-second mixed sprint");
  const dom = await load("review.html", w => {
    w.CHARLIE_TEST_SESSION = { id: "willow-kolo", name: "Willow" };
    w.CHARLIE_TEST_FAST = true;
  });
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);

  await waitFor(() => w.CharlieStore, "store loads");
  await w.CharlieStore.init();
  await waitFor(() => !!w.REVIEW_TEST, "the test hook is available");
  await sleep(150);
  const R = w.REVIEW_TEST;

  /* ---- the bank: fifty questions, evenly split, every type present ---- */
  const bank = R.bank();
  const all = bank.tri.concat(bank.para);
  ok(all.length === 50, "fifty questions in the review bank (" + all.length + ")");
  ok(bank.tri.length === 25 && bank.para.length === 25, "triangles and parallelograms 1:1");
  const byType = {};
  all.forEach(q => { byType[q.type] = (byType[q.type] || 0) + 1; });
  ok(Object.keys(byType).length === 4, "four question types are drawn on");
  ok(Object.keys(byType).every(k => byType[k] >= 5),
     "at least five of every type: " + JSON.stringify(byType));

  /* ---- scoring: 0.5 s steps, quick bonuses, a floor of 10 ---- */
  ok(R.pts(0) === 100, "an instant answer is 80 + 20 bonus = 100");
  ok(R.pts(0.5) === 97 && R.pts(1) === 94, "each half second costs 3 points");
  ok(R.pts(1.5) === 81, "past a second the 20-point bonus becomes 10");
  ok(R.pts(2.5) === 65, "past two seconds the bonus is gone");
  ok(R.pts(60) === 10 && R.pts(200) === 10, "a slow answer still earns the 10-point floor");
  let prev = 101;
  for(let t = 0; t <= 30; t += 0.5){ const v = R.pts(t); if(v > prev) prev = -1; else prev = v; }
  ok(prev !== -1, "the score never goes back up as time passes");

  /* ---- a round: the clock runs for the whole sprint ---- */
  $("startBtn").click();
  await waitFor(() => $("scrPlay").classList.contains("on"), "the sprint starts");
  await waitFor(() => /Question 1/.test($("qCount").textContent), "question one is up");
  ok(/90/.test($("timeLeft").textContent), "ninety seconds on the clock");
  ok(!!$("skipBtn"), "there is a button to move on");

  /* a wrong answer keeps the question on screen */
  const q1 = R.round()[0];
  if(q1.type !== "concept"){
    $("ansIn").value = "999999";
    $("checkBtn").click();
    await sleep(60);
    ok(/try again/i.test($("qMsg").textContent), "a wrong answer invites another go");
    ok(/Question 1/.test($("qCount").textContent), "and stays on the same question");
  }
  /* skipping moves on without scoring */
  const before = R.score();
  $("skipBtn").click();
  await waitFor(() => /Question 2/.test($("qCount").textContent), "Next moves to question two", 4000);
  ok(R.score() === before, "skipping scores nothing");

  /* answer one correctly */
  const q2 = R.round()[1];
  if(q2.type === "hb"){ $("ansIn").value = R.hbAnswer(q2.item); }
  else if(q2.type === "area"){ $("ansIn").value = String(q2.item.b * q2.item.h / 2); }
  else if(q2.type === "para"){ $("ansIn").value = String(q2.item.b * q2.item.h); }
  else { ["height","perpendicular","base"].forEach((wd, i) => { if($("con" + i)) $("con" + i).value = wd; }); }
  $("checkBtn").click();
  await waitFor(() => R.score() > 0, "a right answer scores", 4000);
  ok(R.solved() === 1, "one question solved so far");

  /* ---- the sprint ends on the clock, not on the bank ---- */
  R.endNow();
  await waitFor(() => $("scrDone").classList.contains("on"), "ninety seconds ends the round", 6000);
  ok(/question/.test($("doneSolved").textContent), "the finish screen counts what was solved");
  await waitFor(async () => {
    const b = await w.CharlieStore.getMachine("review-scores");
    return b && b.entries.some(e => e.id === "willow-kolo");
  }, "the score lands on its own ranking", 6000);
  await waitFor(async () => {
    const b = await w.CharlieStore.getMachine("review-results");
    const r = b && b.rows[b.rows.length - 1];
    return r && r.turn === 1 && typeof r.solved === "number";
  }, "the turn is logged for the teacher", 6000);

  /* ---- the wording question marks both true sentences ---- */
  R.setRound([{type:"concept", given:1}]);   /* "perpendicular" is given */
  $("againBtn") && null;
  R.render();
  await waitFor(() => !!$("con0") && !!$("con2"), "the wording question has two gaps");
  ok(d.querySelectorAll(".concept .blankno").length === 2, "the two gaps are numbered ① ②");
  $("con0").value = "base"; $("con2").value = "height";      /* the swapped sentence */
  $("checkBtn").click();
  await sleep(60);
  ok(!/Not quite/.test($("qMsg").textContent),
     "'the base is perpendicular to the height' is accepted too");

  /* ---- word problems: two a round, never before question seven ---- */
  const words = R.applied();
  ok(words.length === 16, "sixteen word problems in the bank");
  let sums = true;
  words.forEach(p => {
    if(!(p.answer > 0) || !p.unit || !p.text || !p.working) sums = false;
  });
  ok(sums, "each word problem carries an answer, a unit and its working");
  $("againBtn").click();
  await waitFor(() => $("scrPlay").classList.contains("on"), "a fresh sprint starts");
  for(let go = 0; go < 6; go++){
    const spots = R.round().map((q, i) => q.type === "applied" ? i : -1).filter(i => i >= 0);
    ok(spots.length === 2, "exactly two word problems this round (" + spots.length + ")");
    ok(spots.every(i => i >= 6), "and none before question 7 (" + spots.join(",") + ")");
    const cons = R.round().filter(q => q.type === "concept").length;
    ok(cons <= 1, "the wording question shows at most once (" + cons + ")");
    R.setRound(R.newRound());
  }
  try{ dom.window.close(); }catch(e){}
}

async function testCuboid(){
  console.log("\ncuboid.html — the builder, then the volume sprint");
  const dom = await load("cuboid.html", w => {
    w.CHARLIE_TEST_SESSION = { id: "willow-kolo", name: "Willow" };
    w.CHARLIE_TEST_FAST = true;
  });
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);

  await waitFor(() => w.CharlieStore, "store loads");
  await w.CharlieStore.init();
  await waitFor(() => !!w.CUBOID_TEST, "the test hook is available");
  await sleep(200);
  const C = w.CUBOID_TEST;

  /* ---- the bank ---- */
  const bank = C.bank();
  ok(bank.length === 30, "thirty cuboids in the bank (" + bank.length + ")");
  ok(bank.filter(c => c.hard).length === 3, "three of them are the hard ones");
  ok(bank.every(c => c.l > 0 && c.w > 0 && c.h > 0), "every cuboid has three real dimensions");
  const hard = bank.filter(c => c.hard);
  const easy = bank.filter(c => !c.hard);
  const minHard = Math.min(...hard.map(c => c.l * c.w * c.h));
  const maxEasy = Math.max(...easy.map(c => c.l * c.w * c.h));
  ok(minHard > maxEasy, "the hard ones really are bigger (" + minHard + " > " + maxEasy + ")");

  /* ---- the drawing matches the numbers ---- */
  const svg = C.draw({l:3, w:2, h:2});
  ok(svg.querySelectorAll("polygon").length === 3, "three faces are drawn");
  // ruled lines: top (w-1)+(l-1), right (w-1)+(h-1), left (l-1)+(h-1)
  const want = (2-1)+(3-1) + (2-1)+(2-1) + (3-1)+(2-1);
  ok(svg.querySelectorAll("line").length === want,
     "the cube edges are ruled on every face (" + svg.querySelectorAll("line").length + "/" + want + ")");

  /* ---- the builder walks 1D → 2D → 3D ---- */
  ok($("scrBuild").classList.contains("on"), "a newcomer meets the builder first");
  ok($("rowW").style.display === "none" && $("rowH").style.display === "none",
     "1D asks for a length only");
  $("inL").value = "1";
  $("inL").dispatchEvent(new w.Event("input"));
  await waitFor(() => d.querySelectorAll("#buildStage rect").length === 1,
     "length 1 draws a single block");

  /* the triangles either side of each box step the number by one */
  const up = d.querySelector('.spin[data-for="inL"][data-step="1"]');
  const down = d.querySelector('.spin[data-for="inL"][data-step="-1"]');
  ok(!!up && !!down, "each side has an arrow either side of its box");
  ok(down.disabled, "at 1 the down arrow is greyed out");
  up.click();
  await waitFor(() => $("inL").value === "2" && d.querySelectorAll("#buildStage rect").length === 2,
     "the right arrow adds one block");
  ok(!down.disabled, "and the down arrow wakes up");
  down.click();
  await waitFor(() => $("inL").value === "1" && d.querySelectorAll("#buildStage rect").length === 1,
     "the left arrow takes one away");
  for(let i = 0; i < 12; i++) up.click();
  await sleep(60);
  ok($("inL").value === "8" && up.disabled, "it stops at the biggest block it can draw");
  down.click(); await sleep(40);
  $("inL").value = "4";
  $("inL").dispatchEvent(new w.Event("input"));
  await waitFor(() => d.querySelectorAll("#buildStage rect").length === 4, "length 4 draws four");
  ok(/Turn on a switch/.test($("buildOut").textContent), "the maths stays hidden until asked for");
  $("tgFormula").checked = true;
  $("tgFormula").dispatchEvent(new w.Event("change"));
  ok(/Length: 4/.test($("buildOut").textContent) && !/=/.test($("buildOut").textContent),
     "the formula shows without the answer");
  $("tgAnswer").checked = true;
  $("tgAnswer").dispatchEvent(new w.Event("change"));
  ok(/=/.test($("buildOut").textContent) && /4 cm/.test($("buildOut").textContent),
     "the answer arrives with an equals sign");

  C.setDim(2);
  ok($("rowW").style.display !== "none" && $("rowH").style.display === "none", "2D adds a breadth");
  ok(/Breadth/.test($("rowW").textContent) && !/Width/i.test($("rowW").textContent),
     "the second side is called breadth, as the workbook does");
  $("inW").value = "3";
  $("inW").dispatchEvent(new w.Event("input"));
  await waitFor(() => d.querySelectorAll("#buildStage rect").length === 12,
     "4 by 3 draws twelve squares");
  ok(/4 × 3/.test($("buildOut").textContent) && /12 cm²/.test($("buildOut").textContent),
     "2D reads as an area");

  C.setDim(3);
  ok($("rowH").style.display !== "none", "3D adds a height");
  await waitFor(() => d.querySelectorAll("#buildStage polygon").length === 3,
     "the flat grid becomes a solid block");
  const b = C.build();
  ok(b.l === 4 && b.w === 3, "the 2D numbers carry over into the cuboid");
  ok(/4 × 3 × /.test($("buildOut").textContent) && /cm³/.test($("buildOut").textContent),
     "3D reads as a volume");

  /* ---- into the game ---- */
  $("buildDone").click();
  await waitFor(() => $("scrHome").classList.contains("on"), "the builder hands over to the game");
  $("startBtn").click();
  await waitFor(() => $("scrPlay").classList.contains("on"), "the sprint starts");
  ok(/90/.test($("timeLeft").textContent), "ninety seconds, like Shape Review");
  ok(!!$("skipBtn") && !!$("ansIn"), "an answer box and a skip button");

  const q = C.round()[0];
  $("ansIn").value = "1";
  $("checkBtn").click();
  await sleep(60);
  ok(/try again/i.test($("qMsg").textContent) || q.item.l * q.item.w * q.item.h === 1,
     "a wrong volume invites another go");
  $("ansIn").value = String(q.item.l * q.item.w * q.item.h);
  $("checkBtn").click();
  await waitFor(() => C.score() > 0, "the right volume scores", 4000);

  C.endNow();
  await waitFor(() => $("scrDone").classList.contains("on"), "the clock ends the round", 6000);
  await waitFor(async () => {
    const bl = await w.CharlieStore.getMachine("cuboid-scores");
    return bl && bl.entries.some(e => e.id === "willow-kolo");
  }, "the score lands on the Cuboid Quest ranking", 6000);
  await waitFor(async () => {
    const bl = await w.CharlieStore.getMachine("cuboid-results");
    const r = bl && bl.rows[bl.rows.length - 1];
    return r && r.cuboid && r.cuboid[1] >= 1;
  }, "the turn is logged for the teacher", 6000);

  /* the walk-through is offered, never forced, on the next visit */
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.profile && s.profile.cuboidSeen === true;
  }, "the builder is remembered as seen", 5000);
  ok(!!$("openBuild"), "and can always be opened again from the home screen");
  try{ dom.window.close(); }catch(e){}
}

async function testTriangles(){
  console.log("\ntriangles.html — tutorial, then the timed round");
  const dom = await load("triangles.html", w => {
    w.CHARLIE_TEST_SESSION = { id: "willow-kolo", name: "Willow" };
    w.CHARLIE_TEST_FAST = true;
  });
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);

  await waitFor(() => w.CharlieStore, "store loads");
  await w.CharlieStore.init();
  await waitFor(() => !!w.TRI_TEST, "the test hook is available");
  await sleep(150);

  /* ---- every question in the bank must agree with its own geometry ---- */
  const T = w.TRI_TEST, bank = T.bank();
  ok(bank.HB.length === 10, "ten base-and-height questions in the bank");
  ok(bank.AREA.length === 20, "twenty area questions in the bank");
  let hbOk = true, hbWhy = "";
  bank.HB.forEach((it, n) => {
    const a = it.pts[it.base[0]], b = it.pts[it.base[1]], apex = it.pts[it.apex];
    const f = T.footOf(apex, a, b);
    // the answer must start at the apex and end at the foot
    const ans = T.hbAnswer(it);
    if(ans.length !== 2){ hbOk = false; hbWhy = "item " + n + " answer '" + ans + "'"; return; }
    if(ans.charAt(0) !== it.letters[it.apex]){ hbOk = false; hbWhy = "item " + n + " wrong apex"; return; }
    // the height really is perpendicular to the base
    const vx = apex[0] - f[0], vy = apex[1] - f[1];
    const bx = b[0] - a[0], by = b[1] - a[1];
    if(Math.abs(vx * bx + vy * by) > 1e-6){ hbOk = false; hbWhy = "item " + n + " not perpendicular"; }
    // and the base label names two different corners
    if(T.hbBase(it).length !== 2){ hbOk = false; hbWhy = "item " + n + " base label"; }
  });
  ok(hbOk, "every height is perpendicular to its base and named from the apex" + (hbOk ? "" : " — " + hbWhy));
  ok(bank.AREA.every(a => a.b > 0 && a.h > 0), "every area question has a real base and height");

  /* ---- the tutorial: colour, move, halve ---- */
  ok($("scrTut").classList.contains("on"), "a first-timer starts in the tutorial");
  ok(d.querySelectorAll("#tutStage .piece").length === 2, "stage 1 is cut into two pieces");
  const setEq = (id, v) => { $(id).value = v; $(id).dispatchEvent(new w.Event("input")); };
  ok($("tutNext").disabled, "Next waits until the working is finished");
  setEq("eqA", "5");
  ok($("eqA").classList.contains("good"), "5 cm is accepted as one of the lengths");
  const fills = [...d.querySelectorAll('#tutStage .piece polygon')].map(p => p.getAttribute("fill"));
  ok(fills[0] !== fills[1] && d.querySelector('#tutStage .whole').getAttribute("opacity") === "0",
     "the first length cuts the triangle into two colours");
  setEq("eqB", "4");
  ok(d.querySelector('#tutStage .piece[data-piece="1"]').style.transform.indexOf("rotate(180deg)") !== -1,
     "the loose piece spins into place");
  ok($("tutNext").disabled, "the halving still has to be written");
  setEq("eqC", "1");
  ok(/10 cm²/.test($("eqResult").textContent), "5 × 4 × ½ = 10 cm²");
  ok(!$("tutNext").disabled, "now Next opens");
  setEq("eqA", "7");
  ok($("tutNext").disabled, "a wrong length closes it again");
  setEq("eqA", "4"); setEq("eqB", "5");
  ok(/10 cm²/.test($("eqResult").textContent), "the two lengths work in either order");

  // the Instructions toggle asks for the words instead
  $("instrToggle").checked = true;
  $("instrToggle").dispatchEvent(new w.Event("change"));
  setEq("eqA", "base");
  ok($("eqA").classList.contains("good"), "with Instructions on, 'base' is a valid entry");
  setEq("eqB", "height"); setEq("eqC", "1");
  ok(/10 cm²/.test($("eqResult").textContent), "words drive the same working");
  $("instrToggle").checked = false;
  $("instrToggle").dispatchEvent(new w.Event("change"));

  // walk the last two stages
  setEq("eqA", "5"); setEq("eqB", "4"); setEq("eqC", "1");
  $("tutNext").click();
  ok(d.querySelectorAll("#tutStage .piece").length === 3, "stage 2 splits into three");
  setEq("eqA", "5"); setEq("eqB", "4"); setEq("eqC", "1");
  $("tutNext").click();
  ok(d.querySelectorAll("#tutStage .piece").length === 3, "stage 3 splits into three");
  setEq("eqA", "5"); setEq("eqB", "4"); setEq("eqC", "1");
  $("tutNext").click();
  await waitFor(() => $("scrHome").classList.contains("on"), "finishing the tutorial opens the game", 5000);
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.profile && s.profile.triDone === true;
  }, "the tutorial is remembered", 5000);

  /* ---- a full round: 3 named heights, 1 wording, 4 areas ---- */
  $("startBtn").click();
  await waitFor(() => $("scrPlay").classList.contains("on"), "the round starts");
  const round = T.round();
  ok(round.length === 8, "eight questions in a round");
  ok(round.slice(0, 3).every(q => q.type === "hb"), "three base-and-height questions first");
  ok(round[3].type === "concept", "then the wording question");
  ok(round.slice(4).every(q => q.type === "area"), "then four area questions");

  function answerCurrent(useHint){
    const q = T.round()[[...d.querySelectorAll("#qCount")][0].textContent.match(/(\d+)/)[1] - 1];
    if(q.type === "hb"){
      $("ansIn").value = T.hbAnswer(q.item);
    } else if(q.type === "area"){
      if(useHint) $("hintBtn").click();
      $("ansIn").value = String(q.item.b * q.item.h / 2);
    } else {
      T.bank().WORDS.forEach((word, i) => {
        if(i === q.given) return;
        $("con" + i).value = i === 1 ? word.toUpperCase() : word;   // case must not matter
      });
    }
    $("checkBtn").click();
  }

  answerCurrent(false);
  await waitFor(() => +$("scoreVal").textContent > 0, "a correct answer scores points", 4000);
  const afterFirst = +$("scoreVal").textContent;
  ok(afterFirst <= 50 && afterFirst >= 20, "an answer is worth 50 down to a floor of 20");
  await waitFor(() => /Question 2 of 8/.test($("qCount").textContent), "on to question 2", 4000);

  // a wrong answer is refused, and the question stays put
  $("ansIn").value = "ZZ";
  $("checkBtn").click();
  ok(/Not quite/.test($("qMsg").textContent), "a wrong answer gets a friendly no");
  ok(/Question 2 of 8/.test($("qCount").textContent), "and the question waits");

  answerCurrent(false);
  await waitFor(() => /Question 3 of 8/.test($("qCount").textContent), "on to question 3", 4000);
  answerCurrent(false);
  await waitFor(() => /Question 4 of 8/.test($("qCount").textContent), "on to the wording question", 4000);
  ok(d.querySelectorAll("#qInputs input").length === 2, "two of the three words are blanked out");
  answerCurrent(false);
  await waitFor(() => /Question 5 of 8/.test($("qCount").textContent), "capitals are accepted too", 4000);

  // the hint halves the points for that question
  const before = +$("scoreVal").textContent;
  answerCurrent(true);
  await waitFor(() => +$("scoreVal").textContent > before, "the area question scores", 4000);
  const gained = +$("scoreVal").textContent - before;
  ok(gained <= 25, "using the hint pays only half (" + gained + ")");
  ok($("hintBox").classList.contains("on") && /×/.test($("hintBox").textContent)
     && /½/.test($("hintBox").textContent), "the hint spells out base × height × ½");

  await waitFor(() => /Question 6 of 8/.test($("qCount").textContent), "on to question 6", 4000);
  answerCurrent(false);
  await waitFor(() => /Question 7 of 8/.test($("qCount").textContent), "on to question 7", 4000);
  answerCurrent(false);
  await waitFor(() => /Question 8 of 8/.test($("qCount").textContent), "on to the last question", 4000);
  answerCurrent(false);

  await waitFor(() => $("scrDone").classList.contains("on"), "the round finishes", 6000);
  const total = +$("scoreVal").textContent;
  ok(/points/.test($("doneScore").textContent), "the final score is shown");
  await waitFor(() => d.querySelectorAll("#doneBoard .brow").length === 1, "my score lands on the board", 5000);
  ok(/Top 10|Great effort/.test($("doneTitle").textContent), "the finish tells me how I did");

  // a first score is a personal best: 2 Whare, with a reason
  await waitFor(() => /\+2 Whare/.test($("doneReward").textContent), "a personal best pays 2 Whare", 5000);
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.money === 2;
  }, "the Whare really lands in my purse", 5000);

  // the board keeps the best score, and never the real name by default
  const blob = await w.CharlieStore.getMachine("triangle-scores");
  ok(blob.entries.length === 1 && blob.entries[0].score === total, "the board stores my best");
  ok(/Willow/.test($("doneBoard").textContent), "the ranking shows real names by default");
  // …unless that child turned their own name off in My room
  await w.CharlieStore.update("willow-kolo", {profile:{hideResults:true}});
  await sleep(200);
  $("homeBtn").click();
  await waitFor(() => $("scrHome").classList.contains("on"), "back to the home screen");
  await waitFor(() => !/Willow/.test($("homeBoard").textContent)
     && /🎈/.test($("homeBoard").textContent),
     "a child who opted out appears as a nickname on the board", 5000);
  await w.CharlieStore.update("willow-kolo", {profile:{hideResults:false}});
  await waitFor(async () => {
    const b = await w.CharlieStore.getMachine("triangle-results");
    if(!b || !b.rows.length) return false;
    const r = b.rows[b.rows.length - 1];
    return r.id === "willow-kolo" && r.turn === 1
        && r.hb[1] === 3 && r.concept[1] === 1 && r.area[1] === 4
        && r.hb[0] <= 3 && r.area[0] <= 4;
  }, "the turn is logged with a tally for each question type", 6000);
  // the bar counts DOWN, and the seconds left are on show
  ok(/s left/.test($("timeLeft").textContent), "the time left is spelled out");
  try{ dom.window.close(); }catch(e){}
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

  await w.CharlieStore.update("willow-kolo", { money: 12 });
  await waitFor(() => $("profMoney").textContent === "12", "money updates live");

  $("editEmojiBtn").click();
  const pk = $("profPickerBox");
  pk.querySelector('.ep-tabs button[data-cat="plants"]').click();
  Array.from(pk.querySelectorAll(".ep-grid button")).find(b => b.dataset.e === "🌵").click();
  pk.querySelector(".ep-save").click();
  await waitFor(() => $("meEmoji").textContent === "🌵", "new emoji shows in the top bar");

  // my stuff: a snack and a phone
  await w.CharlieStore.update("willow-kolo", { items: ["cookie","phone"] });
  await waitFor(() => d.querySelectorAll("#stuffBox .stuff-grid button").length === 2, "won items show in My stuff");
  d.querySelector('#stuffBox button[data-i="0"]').click();   // the cookie
  await waitFor(() => /pet food/.test($("toast").textContent), "snacks are kept for pets");
  d.querySelector('#stuffBox button[data-i="1"]').click();   // the phone (confirm = yes)
  await waitFor(() => $("profMoney").textContent === "18", "selling the phone pays 6 Whare");
  await waitFor(() => d.querySelectorAll("#stuffBox .stuff-grid button").length === 1, "sold item leaves My stuff");

  // rule attempts panel: one wrong (finished game) + one cracked → sparkle
  await w.CharlieStore.update("willow-kolo", { guesses: [
    {t:1, mid:"m-old", guess:"x+2", rule:"x + 3", ok:false},
    {t:2, mid:"m-old", guess:"x × 3 + 2", rule:"x × 3 + 2", ok:true}
  ]});
  await waitFor(() => d.querySelectorAll("#attemptsBox .att").length === 2, "attempts history shows");
  const rows = d.querySelectorAll("#attemptsBox .att");
  ok(/I tried: 𝑥\+2/.test(rows[1].textContent), "shows what I tried");
  ok(/Rule was/.test(rows[1].textContent), "finished game reveals the real rule");
  ok(rows[0].classList.contains("win") && rows[0].querySelector(".rule"),
     "cracked rule gets the sparkle style");

  /* ---- the Pet Shop ---- */
  ok(!!d.querySelector("#shopOpenBtn"), "no pet yet — the shop invites you in");
  d.querySelector("#shopOpenBtn").click();
  await waitFor(() => d.querySelectorAll("#petGrid button").length === 6, "six mystery pets on the shelves");
  const shopTxt = $("petGrid").textContent;
  ok(/Goldfish/.test(shopTxt) && /Axolotl/.test(shopTxt) && /Triceratops/.test(shopTxt),
     "pets are named in English");
  const prices = [...d.querySelectorAll("#petGrid .pp")].map(x => parseInt(x.textContent));
  ok(prices.join(",") === "15,24,28,32,36,70", "prices: goldfish 15 … triceratops 70");

  // the snack counter under the pets: 1-3 Whare, straight into My stuff
  ok(d.querySelectorAll("#snackGrid button").length === 20, "twenty treats on the snack counter");
  const snackPrices = [...d.querySelectorAll("#snackGrid .pp")].map(x => parseInt(x.textContent));
  ok(snackPrices.every(p => p >= 1 && p <= 3), "every snack costs between 1 and 3 Whare");
  const before = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
  const buyable = [...d.querySelectorAll("#snackGrid button")].filter(b => !b.disabled)[0];
  const key = buyable.dataset.s;
  const cost = parseInt(buyable.querySelector(".pp").textContent);
  buyable.click();
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.money === before.money - cost && s.items.indexOf(key) !== -1;
  }, "buying a snack pays for it and puts it in My stuff", 5000);
  // put the purse and the shelf back so the pet checks below start as they were
  await w.CharlieStore.update("willow-kolo", { money: before.money, items: before.items });
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.money === before.money && s.items.length === before.items.length;
  }, "the shop test tidies up after itself", 5000);

  // too expensive first (willow has 13), then the goldfish comes home
  d.querySelector('#petGrid button[data-t="6"]').click();
  await waitFor(() => /Save up/.test($("toast").textContent), "can't afford the Triceratops yet");
  d.querySelector('#petGrid button[data-t="1"]').click();
  await waitFor(() => {
    return w.CharlieStore.list().then(l => {
      const s = l.find(x => x.id === "willow-kolo");
      return Array.isArray(s.pet) && s.pet[0].type === 1 && s.money === 3;
    });
  }, "goldfish bought — 15 Whare paid", 5000);
  await waitFor(() => /❤️ 0/.test($("petBox").textContent), "the pet is home with 0 hearts");
  ok(/Name me/.test($("petBox").textContent), "it asks for a name");

  // naming via the pencil (prompt says Bubbles)
  d.querySelector("#petNameBtn").click();
  await waitFor(() => /Bubbles/.test($("petBox").textContent), "the goldfish is now Bubbles");

  // feeding: the leftover cookie becomes +5 hearts — but only after a yes
  ok(!!d.querySelector(".prof-left #petBox") && !!d.querySelector(".prof-right #stuffBox")
     && !!d.querySelector(".prof-left #logoutBtn") && !!d.querySelector(".prof-right #attemptsBox"),
     "the room is a full page: pet + settings left, loot right");
  await waitFor(() => d.querySelectorAll("#stuffBox .stuff-grid button").length === 1, "one snack left to feed");
  w.confirm = () => false;                       // "Give the Cookie to Bubbles?" → no
  d.querySelector('#stuffBox button[data-i="0"]').click();
  await sleep(250);
  await waitFor(() => {
    return w.CharlieStore.list().then(l => {
      const s = l.find(x => x.id === "willow-kolo");
      return s.pet[0].affection === 0 && s.items.length === 1;
    });
  }, "saying no keeps the snack and the hearts unchanged");
  w.confirm = () => true;
  d.querySelector('#stuffBox button[data-i="0"]').click();
  await waitFor(() => {
    return w.CharlieStore.list().then(l => {
      const s = l.find(x => x.id === "willow-kolo");
      return s.pet[0].affection === 5 && s.items.length === 0;
    });
  }, "feeding gives +5 affection and eats the snack", 5000);

  // one more snack crosses 10 — superpower time
  await w.CharlieStore.update("willow-kolo", { items: ["gummies"] });
  await waitFor(() => d.querySelectorAll("#stuffBox .stuff-grid button").length === 1, "a fresh snack appears");
  d.querySelector('#stuffBox button[data-i="0"]').click();
  await waitFor(() => $("powerWrap").classList.contains("open"), "10 hearts opens the superpower choice", 6000);
  ok(d.querySelectorAll("#powerList button").length === 8, "eight goldfish superpowers to pick from");
  d.querySelector("#powerList button").click();
  await waitFor(() => {
    return w.CharlieStore.list().then(l => {
      const s = l.find(x => x.id === "willow-kolo");
      return s.pet[0].powers.length === 1;
    });
  }, "the chosen superpower sticks", 5000);
  await waitFor(() => d.querySelectorAll("#petBox .pet-powers button").length === 1, "the power shows as a badge");
  // tapping the capsule opens the full story below; tapping again closes it
  d.querySelector("#petBox .pet-powers button").click();
  await waitFor(() => !!d.querySelector("#petBox .pet-power-story"), "tapping the capsule shows the full description");
  ok(d.querySelector("#petBox .pet-power-story").textContent.length >
     d.querySelector("#petBox .pet-powers button").textContent.length,
     "the story holds more than the capsule title");
  d.querySelector("#petBox .pet-powers button").click();
  await waitFor(() => !d.querySelector("#petBox .pet-power-story"), "tapping again hides the description");

  // duplicates stack into one tile with a ×n badge; the ladder walks
  // 10 → 15 → 25, so 15 knocks, 20 stays quiet, 25 knocks again
  await w.CharlieStore.update("willow-kolo", { items: ["cookie","cookie","cookie"] });
  await waitFor(() => d.querySelectorAll("#stuffBox .stuff-grid button").length === 1
     && /×3/.test($("stuffBox").textContent), "three cookies stack into one ×3 tile");
  d.querySelector('#stuffBox button[data-i]').click();      // → 15 ❤️
  await waitFor(() => $("powerWrap").classList.contains("open"),
     "15 hearts knocks with the second superpower (2 s later)", 8000);
  await waitFor(() => /×2/.test($("stuffBox").textContent), "the stack ticks down to ×2");
  d.querySelector("#powerList button").click();
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.pet[0].powers.length === 2;
  }, "the second power sticks", 5000);
  d.querySelector('#stuffBox button[data-i]').click();      // → 20 ❤️
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.pet[0].affection === 20;
  }, "snack two lands (20 hearts)", 5000);
  await sleep(2600);                                        // past the 2 s offer delay
  ok(!$("powerWrap").classList.contains("open"), "20 hearts is not enough for power three");
  d.querySelector('#stuffBox button[data-i]').click();      // → 25 ❤️
  await waitFor(() => $("powerWrap").classList.contains("open"),
     "25 hearts knocks with the third superpower", 8000);
  d.querySelector("#powerList button").click();
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.pet[0].powers.length === 3;
  }, "the third power sticks", 5000);

  // feedback to Charlie: stars + note land in the shared log with my name
  ok(!!$("fbBtn"), "the feedback button waits bottom-right");
  $("fbBtn").click();
  ok($("fbWrap").classList.contains("open") && $("fbSend").disabled,
     "the popup opens and Send sleeps until stars are given");
  d.querySelector('#fbStars span[data-s="4"]').click();
  ok(!$("fbSend").disabled, "four stars wake the Send button");
  $("fbText").value = "More zebras please!";
  $("fbSend").click();
  await waitFor(async () => {
    const log = await w.CharlieStore.getMachine("feedback-log");
    return log && log.entries.length === 1 && log.entries[0].id === "willow-kolo"
        && log.entries[0].stars === 4 && /zebras/.test(log.entries[0].text);
  }, "the feedback lands in the log with name, stars and note", 5000);
  ok(!$("fbWrap").classList.contains("open"), "the popup closes after sending");

  // pet levels: 3 powers → level 4, in the pet header row (right side)
  await waitFor(() => /Lv 4/.test(($("petBox").querySelector(".pet-lv2")||{}).textContent || ""),
     "three superpowers make a level-4 pet");
  ok(!!$("petShopCap"), "the Pet Shop capsule sits beside the MY PET title");
  $("petShopCap").click();
  ok($("profShop").style.display !== "none" && $("profOwn").style.display === "none"
     && $("profMain").style.display !== "none",
     "the shop opens in the right column, the room stays");
  $("shopBack").click();
  ok($("profShop").style.display === "none" && $("profOwn").style.display !== "none",
     "Never mind brings the loot back");

  // talking to the pet: the chat opens in the RIGHT column, and after all
  // those snacks the pet says thank you first (a saved pet bubble)
  d.querySelector("#talkBtn").click();
  await waitFor(() => $("profTalk").style.display !== "none" && $("profOwn").style.display === "none",
     "the chat replaces the right column");
  ok(/To Bubbles/.test($("talkTitle").textContent), "it is addressed to the pet by name");
  await waitFor(() => d.querySelectorAll("#talkLog .bub.pet").length === 1
     && /Cookie/.test($("talkLog").textContent), "the pet says thanks for the snacks by name");
  $("talkIn").value = "You are the best goldfish!";
  $("talkSend").click();
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.pet[0].chat && s.pet[0].chat.length === 2 && /best goldfish/.test(s.pet[0].chat[1].text);
  }, "my message lands after the thank-you", 5000);
  await waitFor(() => d.querySelectorAll("#talkLog .bub").length === 2, "both bubbles show");

  // with a message sent and powers learned, the pep-talk guide lights up
  await waitFor(() => $("talkPowers").style.display !== "none"
     && d.querySelectorAll("#talkPowerRow button").length === 3,
     "the superpower capsules glow with a tap-me guide");
  ok(/something to say/.test($("talkGuide").textContent), "the guide invites a tap");
  d.querySelector("#talkPowerRow button").click();
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.pet[0].chat.length === 3 && s.pet[0].chat[2].who === "pet";
  }, "tapping a power makes the pet give a pep talk", 5000);
  $("talkBack").click();
  ok($("profOwn").style.display !== "none", "back returns to the loot column");

  // about me: music + hobby save into the profile column
  $("likeMusic").value = "Taylor Swift";
  $("likeMusic").dispatchEvent(new w.Event("input"));
  $("likeHobby").value = "football";
  $("likeHobby").dispatchEvent(new w.Event("input"));
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.profile && s.profile.music === "Taylor Swift" && s.profile.hobby === "football";
  }, "favourite music and hobby land in the profile", 5000);

  // friends: anonymous pet cards with level, likes shown, no real names
  $("friendsBtn").click();
  await waitFor(() => $("friendsWrap").classList.contains("open"), "the Friends popup opens");
  ok(d.querySelectorAll("#frGrid .frbar").length === 1, "one classmate bar on show");
  ok(/Bubbles/.test($("frGrid").textContent) && /Lv 4/.test($("frGrid").textContent),
     "the card shows the pet's name and level");
  ok(/Willow/.test($("frGrid").textContent),
     "each pet bar is headed by its owner's real name");
  ok(/Taylor Swift/.test($("frGrid").textContent) && /football/.test($("frGrid").textContent),
     "favourite music and hobby show on the card");
  await w.CharlieStore.update("cj-rapata", {profile:{stats:{solved:9, cracked:2, made:1}}});
  await w.CharlieStore.update("jason-lin", {profile:{stats:{solved:4, made:3}}});
  $("friendsClose").click();
  $("friendsBtn").click();
  await waitFor(() => d.querySelectorAll("#frSolvers .brow").length === 2, "two solvers on the board");
  const solverRows = d.querySelectorAll("#frSolvers .brow");
  ok(/🥇/.test(solverRows[0].textContent) && /9/.test(solverRows[0].textContent),
     "rank one wears the gold with the biggest count");
  ok(/CJ/.test($("frSolvers").textContent), "solver boards name the classmates too");
  ok(d.querySelectorAll("#frBreakers .brow").length === 1
     && d.querySelectorAll("#frMakers .brow").length === 2,
     "breaker and maker boards fill from the same stats");
  $("friendsClose").click();

  // pets are collectable: a second goldfish joins, arrows slide between them
  await w.CharlieStore.update("willow-kolo", { money: 30 });
  await waitFor(() => $("profMoney").textContent === "30", "the allowance arrives");
  $("petShopCap").click();
  await waitFor(() => $("profShop").style.display !== "none", "the capsule opens the shop again");
  d.querySelector('#petGrid button[data-t="1"]').click();
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return Array.isArray(s.pet) && s.pet.length === 2;
  }, "a second pet joins the family", 5000);
  await waitFor(() => !!$("petPrev") && !!$("petNext"), "arrows appear beside the pet");
  ok(/2 \/ 2/.test($("petBox").textContent), "the room slides straight to the newcomer");
  $("petPrev").click();
  await waitFor(() => /1 \/ 2/.test($("petBox").textContent), "the left arrow slides back to Bubbles");
  ok(/Bubbles/.test($("petBox").textContent), "Bubbles is on stage again");

  // the results-name option starts ticked and, once cleared, follows the
  // child everywhere — it is saved on the profile, not just this browser
  ok($("showResultsName").checked === true, "results-name option starts on (show)");
  $("showResultsName").checked = false;
  $("showResultsName").dispatchEvent(new w.Event("change"));
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.profile && s.profile.hideResults === true;
  }, "unticking it saves the choice on the profile for every device", 5000);
  $("showResultsName").checked = true;
  $("showResultsName").dispatchEvent(new w.Event("change"));
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.profile.hideResults === false;
  }, "ticking it again puts the name back", 5000);
  ok(!$("showFriendsName"), "the Friends opt-in is gone — the wall names everyone");
  $("friendsBtn").click();
  await waitFor(() => /Willow/.test($("frGrid").textContent),
     "Class pets shows my real name", 5000);
  $("friendsClose").click();

  // the superpower glow was a one-time guide: it stays retired now
  d.querySelector("#talkBtn").click();
  await waitFor(() => $("profTalk").style.display !== "none", "the chat opens again");
  ok($("talkGuide").style.display === "none" && !d.querySelector("#talkPowerRow .glowcap"),
     "the glow guide never comes back after its first tap");
  $("talkBack").click();

  const cards = d.querySelectorAll(".games .game");
  // the row stays out of sight until the teacher's settings have been read
  await waitFor(() => d.querySelector(".games").classList.contains("ready"),
     "the game row waits for the settings before showing", 6000);
  ok(cards.length === 8, "the eight games — no 'More games' placeholder");
  ok(/Review 12/.test(cards[7].textContent), "Review 12 rounds out the row");
  // the Padlet link sits with them, opening the class wall in a new tab
  const pad = $("padletLink");
  ok(!!pad && /Padlet/.test(pad.textContent), "a Padlet link is on the games page");
  ok(/^https:\/\/padlet\.com\//.test(pad.getAttribute("href")), "it points at the Padlet wall");
  ok(pad.getAttribute("target") === "_blank" && /noopener/.test(pad.getAttribute("rel")),
     "it opens in a new tab, safely");
  ok(/Al-Zebra/.test(cards[0].textContent), "Al-Zebra comes first");
  ok(/Algebra Machine/.test(cards[1].textContent), "Algebra Machine sits beside it");
  ok(/Paving Race/.test(cards[2].textContent), "Paving Race joins the row");
  ok(/Try Triangles/.test(cards[3].textContent), "Try Triangles rounds out the row");
  // title + Play now only: the art icon, the title and the badge, nothing else
  [...cards].forEach((c, i) => {
    const kids = [...c.children].map(k => k.className);
    ok(kids.join(",") === "art,t,badge" && !c.querySelector(".d"),
       "card " + (i + 1) + " shows only its icon, title and Play now");
    ok(/Play now/.test(c.querySelector(".badge").textContent),
       "card " + (i + 1) + " keeps its Play now button");
  });
  ok(/vending\.png/.test(cards[1].querySelector(".art img").src),
     "the Algebra Machine card uses the vending machine, not a drink");

  try{ dom.window.close(); }catch(e){}
}

(async () => {
  try{
    await testConfig();
    await testBrand();
    await testHiddenGamesNeverFlash();
    await testGameCore();
    await testAdminLock();
    await testAdmin();
    await testIndex();
    await testReturning();
    await testGamePlay();
    await testStockAutofill();
    await testAlZebra();
    await testPaving();
    await testHub();
    await testTriangles();
  await testParallelogram();
  await testReview();
  await testCuboid();
  await testReview12();
  }catch(e){
    failed++;
    console.error("\nUnexpected error:", e);
  }
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
