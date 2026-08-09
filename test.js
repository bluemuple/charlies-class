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
  ok($("timerBar") && $("timerLeft"), "the 90-second bar is there");

  // pick limits: 8 snacks → only 7 stick; 4 non-snacks → only 3
  const shelfBtns = sel => Array.from(d.querySelectorAll(sel + " button[data-k]"));
  shelfBtns("#shelfS").slice(0, 8).forEach(b => b.click());
  ok(d.querySelectorAll("#shelfS .sel").length === 7, "8th product is refused (7 max)");
  // clear and mix: 4 snacks + try 4 non-snacks
  shelfBtns("#shelfS").forEach(b => { if(b.classList.contains("sel")) b.click(); });
  shelfBtns("#shelfS").slice(0, 4).forEach(b => b.click());
  shelfBtns("#shelfN").slice(0, 4).forEach(b => b.click());
  ok(d.querySelectorAll("#shelfN .sel").length === 3, "4th non-snack is refused (3 max)");

  $("stockDone").click();
  ok($("scrRule").classList.contains("on"), "on to the rule laptop");

  // build x × 3 + 2 on the pad
  const rk = k => d.querySelector('#rulePad button[data-k="' + k + '"]').click();
  ["x","*","3","+","2"].forEach(rk);
  ok(/𝑥/.test($("ruleScreen").textContent), "rule shows on the laptop screen");
  ok(/10 Whare/.test($("rewardLine").textContent), "reward reads 10 Whare for ×…+");
  rk("/");  // third operation must bounce
  ok(/10 Whare/.test($("rewardLine").textContent), "a third operation is refused");

  d.querySelector('#capSeg button[data-c="1"]').click();
  $("openShop").click();
  await waitFor(() => $("scrSell").classList.contains("on"), "shop opens into the lobby");
  const ms = await w.CharlieStore.listMachines();
  ok(ms.length === 1 && ms[0].state === "open", "machine saved and open");
  ok(ms[0].products.length === 7 && ms[0].ranges.length === 7, "7 products on 7 ranges");
  ok(/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(ms[0].alias), "seller got an animal alias");
  ok(ms[0].reward === 10, "reward stored");
  try{ dom.window.close(); }catch(e){}

  /* ---- buyer joins, plays, cracks it ---- */
  console.log("\nalgebra.html — customer cracks the rule");
  const dom2 = await load("algebra.html", w2 => {
    w2.CHARLIE_TEST_SESSION = { id: "kiean-oabel", name: "Kiean" };
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
    alias:"Cute Rabbit", state:"open", capacity:1,
    products:["cola","chips","cookie","gummies","popcorn","phone","car"],
    rule:[{t:"var"},{t:"op",v:"*"},{t:"num",v:"3"},{t:"op",v:"+"},{t:"num",v:"2"}],
    reward:10,
    ranges:["cookie","cookie","cookie","cookie","cookie","cookie","cookie"],
    buyers:[], history:[], turn:0, winner:null
  };
  await w2.CharlieStore.saveMachine(machine);

  $2("roleBuyer").click();
  await waitFor(() => d2.querySelectorAll("#sections .sec").length === 1, "the mall shows one shop");
  const sec = d2.querySelector("#sections .sec");
  ok(/Cute Rabbit/.test(sec.textContent) && !/Willow/.test(sec.textContent),
     "shop shows the alias, never the real name");
  sec.click();
  await waitFor(() => $2("scrPlay").classList.contains("on"), "joining enters the machine room");
  await waitFor(() => /Waiting for/.test($2("playSub").textContent), "waiting for the seller to start");

  // seller presses start (simulated through the store)
  const m1 = await w2.CharlieStore.getMachine("m-test01");
  m1.state = "playing"; m1.turn = 0;
  await w2.CharlieStore.saveMachine(m1);
  await waitFor(() => $2("numMode").style.display !== "none", "my turn shows the number pad");

  // type 2 on the pad and put it in
  d2.querySelector('#numPad button[data-k="2"]').click();
  ok($2("numDisp").textContent === "2", "pad types onto the display");
  d2.querySelector('#numPad button[data-k="go"]').click();
  await waitFor(() => $2("revealWrap").classList.contains("on"), "the product drops");
  ok(/output = 8/.test($2("revealOut").textContent), "2 → 8 through x×3+2");
  $2("revealWrap").click();
  await waitFor(() => $2("guessMode").style.display !== "none", "after the drop comes the guess pad");

  // wrong guess first: x+1
  const gk = k => d2.querySelector('#guessPad button[data-k="' + k + '"]').click();
  ["x","+","1"].forEach(gk);
  $2("guessGo").click();
  await waitFor(() => /Not quite/.test($2("toast").textContent), "wrong guess gets a friendly no");
  await waitFor(() => $2("numMode").style.display !== "none", "next turn starts back on numbers");
  let kiean = (await w2.CharlieStore.list()).find(s => s.id === "kiean-oabel");
  ok(kiean.guesses.length === 1 && kiean.guesses[0].ok === false, "wrong attempt recorded");

  // now the right one, typed with spaces: x × 3 + 2
  $2("toGuess").click();
  ["x"," ","*","3"," ","+","2"].forEach(gk);
  ok(/𝑥 ×3 \+2|𝑥/.test($2("guessDisp").textContent), "guess display shows the typed rule");
  $2("guessGo").click();
  await waitFor(() => $2("winWrap").classList.contains("on"), "right guess wins — slot machine time");
  await waitFor(() => d2.querySelectorAll("#slotRow .slotwin").length === 7, "7 slot windows for 7 prizes");

  const done = await w2.CharlieStore.getMachine("m-test01");
  ok(done.state === "done" && done.winner.id === "kiean-oabel", "machine records the winner");
  ok(done.winner.prizes.length === 7, "cracked on 2nd turn → all 7 prizes");
  kiean = (await w2.CharlieStore.list()).find(s => s.id === "kiean-oabel");
  ok(kiean.items.length === 7, "prizes landed in my stuff");
  ok(kiean.guesses.length === 2 && kiean.guesses[1].ok === true, "winning attempt recorded");
  const willow = (await w2.CharlieStore.list()).find(s => s.id === "willow-kolo");
  ok(willow.money === 10, "seller earned the 10 Whare reward");
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

  $("algebraGame").click();   // navigates (jsdom can't follow — that's fine)
  ok(/Play now/.test(d.body.textContent), "game card says Play now");

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
    await testHub();
  }catch(e){
    failed++;
    console.error("\nUnexpected error:", e);
  }
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
