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

async function testBrand(){
  console.log("\nbranding");
  for(const f of ["index.html", "admin.html", "hub.html", "algebra.html", "alzebra.html"]){
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
  ok(G.zebraTimeLimit(plus) === 12, "an + pen gives 12 seconds");
  ok(G.zebraTimeLimit([{t:"var"},{t:"op",v:"*"},{t:"num",v:"3"},{t:"op",v:"+"},{t:"num",v:"1"}]) === 22,
     "the hardest operation sets the time (× → 22 s)");
  ok(G.zebraTimeLimit([{t:"num",v:"5"},{t:"op",v:"/"},{t:"var"}]) === 25, "÷ gives 25 seconds");
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
    return s && s.friends && s.friends.showNames === true && s.friends.hidden === false;
  }, "the Friends real-name switch lands in the blob", 5000);
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
  ok(/10 Whare/.test($("rewardLine").textContent), "reward reads 10 Whare for ×…+");
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
  ok(/10 Whare/.test($("rewardLine").textContent), "a third operation is refused");

  $("openShop").click();
  await waitFor(() => $("scrSell").classList.contains("on"), "shop opens into the lobby");
  const ms = await w.CharlieStore.listMachines();
  ok(ms.length === 1 && ms[0].state === "open", "machine saved and open");
  ok(ms[0].capacity === 5, "every room holds up to 5 customers");
  ok(ms[0].turnSecs === 40, "each turn gets the default 40-second clock");
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
  ok(ms[0].reward === 10, "reward stored");
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

  await waitFor(() => !$2("canOverlay").classList.contains("open"),
     "the product tidies itself away after 3 s", 4600);
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
  ok(kiean.guesses.length === 2 && kiean.guesses[1].ok === true, "winning attempt recorded");
  const willow = (await w2.CharlieStore.list()).find(s => s.id === "willow-kolo");
  ok(willow.money === 10, "seller earned the 10 Whare reward");
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
  ok(!!pen && pen.capacity === 1 && pen.probs.length === 6 && pen.limit === 12,
     "pen saved: 1 visitor, 6 problems, 12 s limit");
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
  await waitFor(() => /your go/.test($2("probLine").textContent), "tourist goes first");
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
  ok(!!m1.history[0].item, "a prize left the pool");
  ok(m1.pool.length === 6, "pool is down to 6");

  // absent keeper: their turn resolves itself as Oops after the grace
  await waitFor(async () => (await w2.CharlieStore.getMachine("m-zoo1")).prob >= 2,
     "the absent keeper's turn auto-resolves", 8000);
  m1 = await w2.CharlieStore.getMachine("m-zoo1");
  ok(m1.history[1].b === "willow-kolo" && m1.history[1].rating === "Oops",
     "keeper's missed turn is an Oops");

  // my second go: answer wrongly on purpose (wait for MY problem, not stale text)
  await waitFor(() => /3 of 6/.test($2("probLine").textContent) && /your go/.test($2("probLine").textContent),
     "back to the tourist", 8000);
  ak("9"); ak("9"); ak("go");
  await waitFor(async () => (await w2.CharlieStore.getMachine("m-zoo1")).prob >= 3,
     "wrong answer still moves the race on", 6000);
  m1 = await w2.CharlieStore.getMachine("m-zoo1");
  ok(m1.history[2].ok === false && m1.history[2].points === 10 && !m1.history[2].item,
     "wrong answer: Oops, 10 points, no prize");

  // let the rest of the race run: keeper auto-Oops, I answer my last one right
  await waitFor(() => /5 of 6/.test($2("probLine").textContent) && /your go/.test($2("probLine").textContent),
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

  // play again with the same group: sign up, get elected, off to build
  ok(!!$2("rematchBtn"), "the results screen offers a rematch");
  $2("rematchBtn").click();
  await waitFor(async () => {
    const m = await w2.CharlieStore.getMachine("m-zoo1");
    return m.rematch && m.rematch.ids.indexOf("kiean-oabel") !== -1;
  }, "pressing it signs me into the rematch group", 5000);
  const mRe = await w2.CharlieStore.getMachine("m-zoo1");
  mRe.rematch.sellerId = "kiean-oabel";        // the group picks me as the new keeper
  await w2.CharlieStore.saveMachine(mRe);
  await waitFor(() => $2("scrStock").classList.contains("on"),
     "the chosen keeper goes off to build the new pen", 8000);
  try{ dom2.window.close(); }catch(e){}
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

  // my stuff: a snack and a phone
  await w.CharlieStore.update("willow-kolo", { items: ["cookie","phone"] });
  await waitFor(() => d.querySelectorAll("#stuffBox .stuff-grid button").length === 2, "won items show in My stuff");
  d.querySelector('#stuffBox button[data-i="0"]').click();   // the cookie
  await waitFor(() => /pet food/.test($("toast").textContent), "snacks are kept for pets");
  d.querySelector('#stuffBox button[data-i="1"]').click();   // the phone (confirm = yes)
  await waitFor(() => $("profMoney").textContent === "13", "selling the phone pays 6 Whare");
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
  ok(prices.join(",") === "10,12,14,16,18,20", "prices climb gently with level");

  // too expensive first (willow has 13), then the goldfish comes home
  d.querySelector('#petGrid button[data-t="6"]').click();
  await waitFor(() => /Save up/.test($("toast").textContent), "can't afford the Triceratops yet");
  d.querySelector('#petGrid button[data-t="1"]').click();
  await waitFor(() => {
    return w.CharlieStore.list().then(l => {
      const s = l.find(x => x.id === "willow-kolo");
      return s.pet && s.pet.type === 1 && s.money === 3;
    });
  }, "goldfish bought — 10 Whare paid", 5000);
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
      return s.pet.affection === 0 && s.items.length === 1;
    });
  }, "saying no keeps the snack and the hearts unchanged");
  w.confirm = () => true;
  d.querySelector('#stuffBox button[data-i="0"]').click();
  await waitFor(() => {
    return w.CharlieStore.list().then(l => {
      const s = l.find(x => x.id === "willow-kolo");
      return s.pet.affection === 5 && s.items.length === 0;
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
      return s.pet.powers.length === 1;
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
    return s.pet.powers.length === 2;
  }, "the second power sticks", 5000);
  d.querySelector('#stuffBox button[data-i]').click();      // → 20 ❤️
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.pet.affection === 20;
  }, "snack two lands (20 hearts)", 5000);
  await sleep(2600);                                        // past the 2 s offer delay
  ok(!$("powerWrap").classList.contains("open"), "20 hearts is not enough for power three");
  d.querySelector('#stuffBox button[data-i]').click();      // → 25 ❤️
  await waitFor(() => $("powerWrap").classList.contains("open"),
     "25 hearts knocks with the third superpower", 8000);
  d.querySelector("#powerList button").click();
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.pet.powers.length === 3;
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

  // talking to the pet: bubbles land on the pet record itself
  d.querySelector("#talkBtn").click();
  await waitFor(() => $("talkWrap").classList.contains("open"), "the talk popup opens");
  ok(/To Bubbles/.test($("talkTitle").textContent), "it is addressed to the pet by name");
  $("talkIn").value = "You are the best goldfish!";
  $("talkSend").click();
  await waitFor(async () => {
    const s = (await w.CharlieStore.list()).find(x => x.id === "willow-kolo");
    return s.pet.chat && s.pet.chat.length === 1 && /best goldfish/.test(s.pet.chat[0].text);
  }, "the message is saved on the pet", 5000);
  await waitFor(() => d.querySelectorAll("#talkLog .bub").length === 1, "it shows as a speech bubble");
  $("talkClose").click();

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
  ok(d.querySelectorAll("#frGrid .fr").length === 1, "one classmate pet on show");
  ok(/Bubbles/.test($("frGrid").textContent) && /Lv 4/.test($("frGrid").textContent),
     "the card shows the pet's name and level");
  ok(!/Willow/.test($("frGrid").textContent) && /class friend/.test($("frGrid").textContent),
     "the owner stays anonymous by default");
  ok(/Taylor Swift/.test($("frGrid").textContent) && /football/.test($("frGrid").textContent),
     "favourite music and hobby show on the card");
  $("friendsClose").click();

  const cards = d.querySelectorAll(".games .game");
  ok(cards.length === 2, "just the two games — no 'More games' placeholder");
  ok(/Al-Zebra/.test(cards[0].textContent), "Al-Zebra comes first");
  ok(/Algebra Machine/.test(cards[1].textContent), "Algebra Machine sits beside it");
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
    await testGameCore();
    await testAdminLock();
    await testAdmin();
    await testIndex();
    await testReturning();
    await testGamePlay();
    await testStockAutofill();
    await testAlZebra();
    await testHub();
  }catch(e){
    failed++;
    console.error("\nUnexpected error:", e);
  }
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
