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
      if(t.t==='var') return '('+v+')';
      if(t.t==='num') return '('+Number(t.v)+')';   // "012" means twelve, not octal
      return t.v;
    }).join('');
    try{
      var f = new Function('return ('+expr+');');
      var out = f();
      return (typeof out==='number' && isFinite(out)) ? out : null;
    }catch(e){ return null; }
  }
  /* a rule must actually work for enough inputs — x ÷ 0 fails everywhere */
  var EVAL_PTS = [0,1,2,3,5,10,-4,0.5,7.5];
  function evaluableRule(tokens){
    var okCount = 0;
    for(var i=0;i<EVAL_PTS.length;i++){
      if(evalRule(tokens, EVAL_PTS[i]) !== null) okCount++;
    }
    return okCount >= 3;
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

  /* ---------------- Al-Zebra (beginners): answer the outputs fast -------- */
  /* time to answer one problem, set by the hardest operation in the rule */
  var ZEBRA_LIMITS = {'+':18, '-':22, '*':28, '/':32};   /* beginner-friendly defaults; the admin page can tighten them */
  function zebraTimeLimit(tokens, over){
    /* the teacher can retune seconds per operation from the admin page */
    var table = {};
    for(var k in ZEBRA_LIMITS) table[k] = (over && over[k] > 0) ? +over[k] : ZEBRA_LIMITS[k];
    var lim = table['+'] || 12;
    ruleOps(tokens).forEach(function(o){
      if((table[o]||lim) > lim) lim = table[o];
    });
    return lim;
  }
  /* speed → rating; a wrong answer or timeout is always Oops */
  var ZEBRA_RATINGS = [
    {label:'Perfect!', points:50, max:3},
    {label:'Great',    points:40, max:5},
    {label:'Good',     points:30, max:8},
    {label:'Nice',     points:20, max:Infinity}
  ];
  function zebraRating(secs, limit, correct){
    if(!correct || secs > limit) return {label:'Oops', points:10};
    for(var i=0;i<ZEBRA_RATINGS.length;i++){
      if(secs <= Math.min(ZEBRA_RATINGS[i].max, limit))
        return {label:ZEBRA_RATINGS[i].label, points:ZEBRA_RATINGS[i].points};
    }
    return {label:'Nice', points:20};
  }
  /* six inputs: start at 1, grow by 1–4 each time */
  function zebraProblems(rnd){
    rnd = rnd || Math.random;
    var xs = [], x = 1;
    for(var i=0;i<6;i++){
      xs.push(x);
      x += 1 + Math.floor(rnd()*4);
    }
    return xs;
  }

  /* ---------------- seller aliases ---------------- */
  var ADJ = ['Cute','Happy','Brave','Sunny','Clever','Lucky','Fluffy','Speedy',
             'Shiny','Jolly','Gentle','Mighty','Bouncy','Cheeky','Sparkly','Zippy'];
  var ANIMAL = ['Rabbit','Kiwi','Tiger','Panda','Dolphin','Fox','Owl','Koala',
                'Penguin','Lion','Turtle','Hedgehog','Falcon','Otter','Wombat','Gecko'];
  /* stable pseudonym for a given id — same kid, same animal, every render */
  function aliasFor(seed){
    var h = 2166136261;
    String(seed).split('').forEach(function(c){
      h ^= c.charCodeAt(0);
      h = (h * 16777619) >>> 0;
    });
    return ADJ[h % ADJ.length] + ' ' + ANIMAL[(h >>> 4) % ANIMAL.length];
  }
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

  /* ================= Paving Race =================
     Matua Henare's allotment: 1 m² paving stones on a grid. A round names a
     perimeter and an area; the first player to lay a rectangle with exactly
     those measurements wins the round. Whare IS the score — no conversion. */

  var PAVE_W = 10, PAVE_H = 8;

  /* five rounds, easy → hard. Each tier offers a few rectangles so no two
     matches feel the same; every one fits inside the 10 × 8 grid. */
  var PAVE_TIERS = [
    {pts:1,   secs:45, rects:[[2,3],[3,3],[2,4],[2,5]]},
    {pts:1.5, secs:50, rects:[[3,4],[4,4],[2,6],[3,5]]},
    {pts:2,   secs:60, rects:[[4,5],[3,6],[5,5],[2,8]]},
    {pts:2.5, secs:70, rects:[[4,6],[4,7],[3,8],[5,6]]},
    {pts:3,   secs:80, rects:[[5,8],[4,9],[6,7],[5,7]]}
  ];
  /* the live perimeter/area readout switches off for the last two rounds */
  var PAVE_OPEN_ROUNDS = 3;

  function paveProblems(rnd, extraSecs){
    rnd = rnd || Math.random;
    var add = extraSecs || 0;
    return PAVE_TIERS.map(function(t, i){
      var r = t.rects[Math.floor(rnd() * t.rects.length)];
      var l = Math.max(r[0], r[1]), b = Math.min(r[0], r[1]);
      return {l:l, b:b, p:2*l + 2*b, a:l*b, pts:t.pts, secs:t.secs + add,
              hidden:i >= PAVE_OPEN_ROUNDS};
    });
  }
  function paveTotal(probs){
    return (probs || []).reduce(function(s, p){ return s + p.pts; }, 0);
  }

  function paveKey(c){ return c[0] + ',' + c[1]; }
  function paveHas(cells, x, y){
    for(var i=0;i<cells.length;i++) if(cells[i][0]===x && cells[i][1]===y) return true;
    return false;
  }
  function paveBox(cells){
    var x0=cells[0][0], x1=x0, y0=cells[0][1], y1=y0;
    cells.forEach(function(c){
      if(c[0]<x0) x0=c[0]; if(c[0]>x1) x1=c[0];
      if(c[1]<y0) y0=c[1]; if(c[1]>y1) y1=c[1];
    });
    return {x0:x0, y0:y0, x1:x1, y1:y1, w:x1-x0+1, h:y1-y0+1};
  }

  /* a finished rectangle: the cells fill their bounding box exactly */
  function paveRect(cells){
    if(!cells || !cells.length) return null;
    var seen = {};
    for(var i=0;i<cells.length;i++){
      var k = paveKey(cells[i]);
      if(seen[k]) return null;
      seen[k] = 1;
    }
    var b = paveBox(cells);
    if(b.w * b.h !== cells.length) return null;
    var l = Math.max(b.w, b.h), s = Math.min(b.w, b.h);
    return {x:b.x0, y:b.y0, w:b.w, h:b.h, l:l, b:s, a:b.w*b.h, p:2*b.w + 2*b.h};
  }

  /* work-in-progress shapes: a rectangle, or a rectangle with one row (or one
     column) part-laid — that is how you build one stone at a time. Blobs,
     L-plus-L shapes and diagonals are refused, so the drawing always heads
     somewhere sensible. */
  function paveShapeOk(cells){
    if(!cells || !cells.length) return true;
    var b = paveBox(cells), i, j;
    function lines(byRow){
      var out = [], span = byRow ? b.w : b.h;
      var from = byRow ? b.y0 : b.x0, to = byRow ? b.y1 : b.x1;
      for(var v=from; v<=to; v++){
        var vals = [];
        for(i=0;i<cells.length;i++){
          if((byRow ? cells[i][1] : cells[i][0]) === v) vals.push(byRow ? cells[i][0] : cells[i][1]);
        }
        vals.sort(function(m,n){ return m-n; });
        out.push(vals);
      }
      return {list:out, span:span};
    }
    function fits(byRow){
      var L = lines(byRow), partial = 0;
      for(var k=0;k<L.list.length;k++){
        var vals = L.list[k];
        if(!vals.length) return false;
        if(vals.length === L.span) continue;
        partial++;
        if(partial > 1) return false;
        for(var q=1;q<vals.length;q++) if(vals[q] !== vals[q-1] + 1) return false;
      }
      return true;
    }
    return fits(true) || fits(false);
  }

  /* may this stone go down? inside the grid, touching what is already laid,
     and the result still on its way to a rectangle */
  function paveCanPaint(cells, x, y, w, h){
    w = w || PAVE_W; h = h || PAVE_H;
    if(x < 0 || y < 0 || x >= w || y >= h) return false;
    if(paveHas(cells, x, y)) return false;
    if(cells.length){
      var touch = paveHas(cells, x-1, y) || paveHas(cells, x+1, y)
               || paveHas(cells, x, y-1) || paveHas(cells, x, y+1);
      if(!touch) return false;
    }
    return paveShapeOk(cells.concat([[x, y]]));
  }
  function paveCanErase(cells, x, y){
    if(!paveHas(cells, x, y)) return false;
    var rest = cells.filter(function(c){ return !(c[0]===x && c[1]===y); });
    return paveShapeOk(rest);
  }

  /* live readout — works for any shape, not just rectangles */
  function paveMetrics(cells){
    var n = (cells || []).length, shared = 0;
    for(var i=0;i<n;i++){
      if(paveHas(cells, cells[i][0]+1, cells[i][1])) shared++;
      if(paveHas(cells, cells[i][0], cells[i][1]+1)) shared++;
    }
    return {a:n, p:4*n - 2*shared};
  }
  function paveSolved(cells, prob){
    var r = paveRect(cells);
    return !!(r && prob && r.p === prob.p && r.a === prob.a);
  }

  var GameCore = {
    PRODUCTS:PRODUCTS, RANGES:RANGES,
    PAVE_W:PAVE_W, PAVE_H:PAVE_H, PAVE_TIERS:PAVE_TIERS, PAVE_OPEN_ROUNDS:PAVE_OPEN_ROUNDS,
    paveProblems:paveProblems, paveTotal:paveTotal, paveRect:paveRect,
    paveShapeOk:paveShapeOk, paveCanPaint:paveCanPaint, paveCanErase:paveCanErase,
    paveMetrics:paveMetrics, paveSolved:paveSolved, paveHas:paveHas, paveBox:paveBox,
    MAX_PICK:MAX_PICK, MAX_NONSNACK:MAX_NONSNACK, PICK_SECONDS:PICK_SECONDS,
    OP_PRICE:OP_PRICE,
    opGlyph:opGlyph, ruleOps:ruleOps, validRule:validRule, evalRule:evalRule,
    evaluableRule:evaluableRule, ruleText:ruleText, reward:reward,
    normaliseGuess:normaliseGuess, checkGuess:checkGuess,
    rangeIndexFor:rangeIndexFor, assignRanges:assignRanges,
    prizeCount:prizeCount, pickPrizes:pickPrizes,
    zebraTimeLimit:zebraTimeLimit, zebraRating:zebraRating, zebraProblems:zebraProblems,
    alias:alias, aliasFor:aliasFor, shuffle:shuffle, machineId:machineId
  };

  if(typeof module !== 'undefined' && module.exports) module.exports = GameCore;
  else root.GameCore = GameCore;
})(this);
