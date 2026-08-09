/* Charlie's Class — Algebra Machine game logic (no DOM).
   Loaded by the pages as window.GameCore and by test.js via require(). */
(function(root){
  "use strict";

  /* ---------------- product catalogue ----------------
     The art is two 5×4 sprite sheets (assets/snacks.jpg, assets/non-snacks.jpg).
     weight  = how likely a buyer is to take it as a prize (snack = 1)
     sell    = Whare a buyer gets for selling it (null = can't sell; feeds pets) */
  var PRODUCTS = {};
  function P(key, name, sheet, col, row, cat, weight, sell){
    PRODUCTS[key] = {key:key, name:name, sheet:sheet, col:col, row:row, cat:cat, weight:weight, sell:sell};
  }
  // snacks — sheet 's'
  P('cola','Cola','s',0,0,'snack',1,null);            P('soda','Lemon Soda','s',1,0,'snack',1,null);
  P('water','Water','s',2,0,'snack',1,null);          P('juice','Orange Juice','s',3,0,'snack',1,null);
  P('energy','Energy Drink','s',4,0,'snack',1,null);  P('coffee','Iced Coffee','s',0,1,'snack',1,null);
  P('chocmilk','Choc Milk','s',1,1,'snack',1,null);   P('chips','Chips','s',2,1,'snack',1,null);
  P('cornchips','Corn Chips','s',3,1,'snack',1,null); P('pretzels','Pretzels','s',4,1,'snack',1,null);
  P('popcorn','Popcorn','s',0,2,'snack',1,null);      P('trailmix','Trail Mix','s',1,2,'snack',1,null);
  P('muesli','Muesli Bar','s',2,2,'snack',1,null);    P('noodles','Cup Noodles','s',3,2,'snack',1,null);
  P('cookie','Cookie','s',4,2,'snack',1,null);        P('biscuits','Choc Biscuits','s',0,3,'snack',1,null);
  P('wafers','Wafer Sticks','s',1,3,'snack',1,null);  P('gummies','Gummy Bears','s',2,3,'snack',1,null);
  P('chocolate','Chocolate','s',3,3,'snack',1,null);  P('mints','Mints','s',4,3,'snack',1,null);
  // non-snacks — sheet 'n'
  P('hoodie','Hoodie','n',0,0,'nonsnack',.5,4);        P('varsity','Varsity Jacket','n',1,0,'nonsnack',.5,4);
  P('dress','Dress','n',2,0,'nonsnack',.5,4);          P('skirt','Denim Skirt','n',3,0,'nonsnack',.5,4);
  P('sneakers','Sneakers','n',4,0,'nonsnack',.5,4);    P('greenhoodie','Green Hoodie','n',0,1,'nonsnack',.5,4);
  P('rugbytop','Rugby Jersey','n',1,1,'nonsnack',.5,4);P('bomber','Bomber Jacket','n',2,1,'nonsnack',.5,4);
  P('jeans','Jeans','n',3,1,'nonsnack',.5,4);          P('blacksneakers','Black Sneakers','n',4,1,'nonsnack',.5,4);
  P('rugbyball','Rugby Ball','n',0,2,'nonsnack',.5,4); P('cricket','Cricket Set','n',1,2,'nonsnack',.5,4);
  P('volleyball','Volleyball','n',2,2,'nonsnack',.5,4);P('soccer','Soccer Ball','n',3,2,'nonsnack',.5,4);
  P('surfboard','Surfboard','n',4,2,'nonsnack',.5,4);
  // bottom row: electronics + the car — the rarer, the better it sells
  P('phone','Smartphone','n',0,3,'elec',.40,6);
  P('laptop','Laptop','n',1,3,'elec',.30,8);
  P('switch','Game Console','n',2,3,'elec',.20,10);
  P('ps5','PlayStation','n',3,3,'elec',.10,12);
  P('car','Car','n',4,3,'elec',.05,15);

  var MAX_PICK = 7, MAX_NONSNACK = 3, PICK_SECONDS = 90;

  /* ---------------- rules (same token shape as the vending machine) ------- */
  function opGlyph(op){ return op==='*' ? '×' : op==='/' ? '÷' : op==='-' ? '−' : '+'; }
  function ruleOps(tokens){
    return tokens.filter(function(t){ return t.t==='op'; }).map(function(t){ return t.v; });
  }
  function hasVar(tokens){ return tokens.some(function(t){ return t.t==='var'; }); }
  function validRule(tokens){
    if(!tokens || !tokens.length) return false;
    if(tokens[tokens.length-1].t==='op') return false;
    if(ruleOps(tokens).length > 2) return false;
    return hasVar(tokens);
  }
  function evalRule(tokens, v){
    var expr = tokens.map(function(t){
      return t.t==='var' ? '('+v+')' : t.v;
    }).join('');
    try{
      var f = new Function('return ('+expr+');');
      var out = f();
      return (typeof out==='number' && isFinite(out)) ? out : null;
    }catch(e){ return null; }
  }
  function ruleText(tokens){
    return tokens.map(function(t){
      return t.t==='var' ? 'x' : t.t==='num' ? t.v : ' '+opGlyph(t.v)+' ';
    }).join('');
  }

  /* Harder rules pay the seller more: + < − < × < ÷, two ops harder still. */
  var OP_PRICE = {'+':3, '-':4, '*':5, '/':6};
  function reward(tokens){
    var ops = ruleOps(tokens);
    if(!ops.length) return 0;
    var sum = 0;
    ops.forEach(function(o){ sum += OP_PRICE[o] || 0; });
    return ops.length === 2 ? sum + 2 : sum;
  }

  /* ---------------- guessing (generous, like the vending machine) -------- */
  function normaliseGuess(str){
    var raw = (str||'').toLowerCase()
      .replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/–/g,'-')
      .replace(/input|output|money|[a-z]/g,'v')
      .replace(/\s+/g,'')
      .replace(/v+/g,'v');
    // kids write "3x" or "x(…)" meaning multiply — make it real maths
    raw = raw.replace(/(\d|\))(?=[v(])/g, '$1*').replace(/v(?=[\d(])/g, 'v*');
    return raw;
  }
  function checkGuess(tokens, guessStr){
    var raw = normaliseGuess(guessStr);
    if(!raw || !/^[0-9v+\-*/().]+$/.test(raw) || raw.indexOf('v') < 0) return false;
    var g;
    try{ g = new Function('v','return ('+raw+');'); g(1); }catch(e){ return false; }
    var pts=[0,1,2,3,5,10,-4,0.5,7.5], ok=true, compared=0;
    for(var i=0;i<pts.length;i++){
      var a = evalRule(tokens, pts[i]), b = null, threw = false;
      try{ b = g(pts[i]); }catch(e){ threw = true; }
      var bad = threw || typeof b !== 'number' || !isFinite(b);
      if(a===null && bad) continue;
      if(a===null || bad){ ok=false; break; }
      if(Math.abs(a-b) > 1e-9){ ok=false; break; }
      compared++;
    }
    return ok && compared >= 3;
  }

  /* ---------------- input ranges → products ----------------
     The 7 chosen products are shuffled onto 7 input ranges; putting a number
     in makes the machine drop the product for that range. */
  var RANGES = [
    {label:'0 or less', max:0},
    {label:'1 – 3',     max:3},
    {label:'4 – 6',     max:6},
    {label:'7 – 9',     max:9},
    {label:'10 – 12',   max:12},
    {label:'13 – 20',   max:20},
    {label:'21 +',      max:Infinity}
  ];
  function rangeIndexFor(v){
    for(var i=0;i<RANGES.length;i++){ if(v <= RANGES[i].max) return i; }
    return RANGES.length-1;
  }
  function assignRanges(productKeys, rnd){
    var keys = productKeys.slice();
    shuffle(keys, rnd);
    return keys;   // index i = product for RANGES[i]
  }

  /* ---------------- prizes ----------------
     Guess on your 1st or 2nd turn: all 7 · 3rd: 6 · 4th: 5 · 5th: 4 ·
     6th: 3 · 7th: 2 · later: 1. Which ones you get is a weighted draw —
     snacks are easy to win, electronics rare (the car rarest). */
  function prizeCount(personalTurn){
    if(personalTurn <= 2) return 7;
    if(personalTurn >= 8) return 1;
    return 9 - personalTurn;      // 3→6 … 7→2
  }
  function pickPrizes(productKeys, n, rnd){
    rnd = rnd || Math.random;
    if(n >= productKeys.length) return productKeys.slice();
    var pool = productKeys.slice(), out = [];
    while(out.length < n && pool.length){
      var total = 0;
      pool.forEach(function(k){ total += (PRODUCTS[k] ? PRODUCTS[k].weight : 1); });
      var r = rnd() * total, acc = 0, hit = 0;
      for(var i=0;i<pool.length;i++){
        acc += (PRODUCTS[pool[i]] ? PRODUCTS[pool[i]].weight : 1);
        if(r <= acc){ hit = i; break; }
      }
      out.push(pool.splice(hit,1)[0]);
    }
    return out;
  }

  /* ---------------- seller aliases ---------------- */
  var ADJ = ['Cute','Happy','Brave','Sunny','Clever','Lucky','Fluffy','Speedy',
             'Shiny','Jolly','Gentle','Mighty','Bouncy','Cheeky','Sparkly','Zippy'];
  var ANIMAL = ['Rabbit','Kiwi','Tiger','Panda','Dolphin','Fox','Owl','Koala',
                'Penguin','Lion','Turtle','Hedgehog','Falcon','Otter','Wombat','Gecko'];
  function alias(rnd){
    rnd = rnd || Math.random;
    return ADJ[Math.floor(rnd()*ADJ.length)] + ' ' + ANIMAL[Math.floor(rnd()*ANIMAL.length)];
  }

  /* ---------------- helpers ---------------- */
  function shuffle(a, rnd){
    rnd = rnd || Math.random;
    for(var i=a.length-1;i>0;i--){
      var j = Math.floor(rnd()*(i+1)), t = a[i]; a[i]=a[j]; a[j]=t;
    }
    return a;
  }
  function machineId(rnd){
    rnd = rnd || Math.random;
    var s = '', chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    for(var i=0;i<6;i++) s += chars[Math.floor(rnd()*chars.length)];
    return 'm-' + s;
  }

  var GameCore = {
    PRODUCTS:PRODUCTS, RANGES:RANGES,
    MAX_PICK:MAX_PICK, MAX_NONSNACK:MAX_NONSNACK, PICK_SECONDS:PICK_SECONDS,
    OP_PRICE:OP_PRICE,
    opGlyph:opGlyph, ruleOps:ruleOps, validRule:validRule, evalRule:evalRule,
    ruleText:ruleText, reward:reward,
    normaliseGuess:normaliseGuess, checkGuess:checkGuess,
    rangeIndexFor:rangeIndexFor, assignRanges:assignRanges,
    prizeCount:prizeCount, pickPrizes:pickPrizes,
    alias:alias, shuffle:shuffle, machineId:machineId
  };

  if(typeof module !== 'undefined' && module.exports) module.exports = GameCore;
  else root.GameCore = GameCore;
})(this);
