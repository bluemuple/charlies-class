/* Charlie's Class — Review 12 checkpoint: question bank, adaptive ladder and
   worksheet builder (no DOM). Loaded by review12.html and admin.html as
   window.R12, and by test.js via require().

   Every paper question from Review 12 (Year 7 Phase 3B, Chapter 12) except the
   plan-view drawing has a ladder of levels. The top level IS the paper question;
   the levels underneath are the separate pieces of knowledge it is built from.
   Two right answers at a level locks it in; two wrong answers steps down one. */
(function(root){
  "use strict";

  /* ================= svg helpers (strings only, jsdom-safe) ================ */
  var INK = '#2b3a42', GIVEN = '#e05c5c', ASK = '#1f5a54';
  function pt(cx, cy, r, a){                       /* maths degrees, y up */
    var t = a * Math.PI / 180;
    return [cx + r * Math.cos(t), cy - r * Math.sin(t)];
  }
  function f1(n){ return Math.round(n * 10) / 10; }
  function seg(x1, y1, x2, y2, w, col){
    return '<line x1="' + f1(x1) + '" y1="' + f1(y1) + '" x2="' + f1(x2) + '" y2="' + f1(y2)
      + '" stroke="' + (col || INK) + '" stroke-width="' + (w || 2.4) + '" stroke-linecap="round"/>';
  }
  function ray(cx, cy, r, a, w, col){
    var p = pt(cx, cy, r, a);
    return seg(cx, cy, p[0], p[1], w, col);
  }
  function through(cx, cy, r, a, w){               /* a full line through the point */
    var p = pt(cx, cy, r, a), q = pt(cx, cy, r, a + 180);
    return seg(q[0], q[1], p[0], p[1], w);
  }
  function arc(cx, cy, r, a1, a2, col){
    var d = ((a2 - a1) % 360 + 360) % 360;
    var s = pt(cx, cy, r, a1), e = pt(cx, cy, r, a2);
    return '<path d="M' + f1(s[0]) + ' ' + f1(s[1]) + ' A' + r + ' ' + r + ' 0 '
      + (d > 180 ? 1 : 0) + ' 0 ' + f1(e[0]) + ' ' + f1(e[1])
      + '" fill="none" stroke="' + (col || GIVEN) + '" stroke-width="2"/>';
  }
  function lbl(x, y, t, col, size, italic){
    return '<text x="' + f1(x) + '" y="' + f1(y) + '" fill="' + (col || INK)
      + '" font-size="' + (size || 17) + '"' + (italic ? ' font-style="italic"' : '')
      + ' text-anchor="middle" dominant-baseline="middle" font-family="Trebuchet MS,sans-serif">'
      + t + '</text>';
  }
  function angLbl(cx, cy, r, a1, a2, t, col, italic){
    var mid = a1 + (((a2 - a1) % 360 + 360) % 360) / 2;
    var p = pt(cx, cy, r, mid);
    return lbl(p[0], p[1], t, col, 17, italic);
  }
  function sqMark(cx, cy, a){                      /* right-angle square between a and a+90 */
    var s = 13, p1 = pt(cx, cy, s, a), p3 = pt(cx, cy, s, a + 90);
    var p2 = [p1[0] + p3[0] - cx, p1[1] + p3[1] - cy];
    return '<path d="M' + f1(p1[0]) + ' ' + f1(p1[1]) + ' L' + f1(p2[0]) + ' ' + f1(p2[1])
      + ' L' + f1(p3[0]) + ' ' + f1(p3[1]) + '" fill="none" stroke="' + INK + '" stroke-width="2"/>';
  }
  function tick(x1, y1, x2, y2){                   /* one tick across the midpoint of a side */
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy);
    var nx = -dy / L * 7, ny = dx / L * 7;
    return seg(mx - nx, my - ny, mx + nx, my + ny, 2.2);
  }
  function wrap(w, h, inner){
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" '
      + 'style="max-width:100%;height:auto;display:block;margin:0 auto">' + inner + '</svg>';
  }

  /* ================= the figures ================= */
  function figFacts(){                             /* 90 / 180 / 360 side by side */
    var s = '';
    s += seg(20, 90, 90, 90) + seg(30, 90, 30, 20) + sqMark(30, 90, 0) + lbl(62, 40, '90°', GIVEN);
    s += seg(130, 90, 240, 90) + arc(185, 90, 26, 0, 180) + lbl(185, 48, '180°', GIVEN)
       + '<circle cx="185" cy="90" r="3" fill="' + INK + '"/>';
    s += '<circle cx="300" cy="62" r="30" fill="none" stroke="' + GIVEN + '" stroke-width="2"/>'
       + '<circle cx="300" cy="62" r="3" fill="' + INK + '"/>' + lbl(300, 112, '360°', GIVEN, 16);
    return wrap(360, 130, s);
  }
  function figRightSplit(g){
    var cx = 110, cy = 165, s = '';
    s += ray(cx, cy, 150, 0) + ray(cx, cy, 130, 90) + ray(cx, cy, 140, g) + sqMark(cx, cy, 0);
    s += arc(cx, cy, 42, 0, g) + angLbl(cx, cy, 62, 0, g, g + '°', GIVEN);
    s += arc(cx, cy, 34, g, 90, ASK) + angLbl(cx, cy, 54, g, 90, '?', ASK, true);
    return wrap(300, 185, s);
  }
  function figLinePair(g){
    var cx = 175, cy = 150, s = '';
    s += through(cx, cy, 160, 0) + ray(cx, cy, 125, g) + '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="' + INK + '"/>';
    s += arc(cx, cy, 40, 0, g) + angLbl(cx, cy, 60, 0, g, g + '°', GIVEN);
    s += arc(cx, cy, 32, g, 180, ASK) + angLbl(cx, cy, 51, g, 180, '?', ASK, true);
    return wrap(350, 175, s);
  }
  function figPoint3(a, b){
    var cx = 165, cy = 110, s = '';
    s += ray(cx, cy, 95, 0) + ray(cx, cy, 95, a) + ray(cx, cy, 95, a + b);
    s += arc(cx, cy, 34, 0, a) + angLbl(cx, cy, 54, 0, a, a + '°', GIVEN);
    s += arc(cx, cy, 26, a, a + b) + angLbl(cx, cy, 47, a, a + b, b + '°', GIVEN);
    s += arc(cx, cy, 20, a + b, 360, ASK) + angLbl(cx, cy, 40, a + b, 360, '?', ASK, true);
    return wrap(330, 220, s);
  }
  function figCross(g, ask){                       /* ask: 'opp' or 'adj' */
    var cx = 175, cy = 105, d1 = -14, s = '';
    s += through(cx, cy, 155, d1) + through(cx, cy, 130, d1 + g);
    s += arc(cx, cy, 34, d1, d1 + g) + angLbl(cx, cy, 54, d1, d1 + g, g + '°', GIVEN);
    if(ask === 'adj'){
      s += arc(cx, cy, 28, d1 + g, d1 + 180, ASK) + angLbl(cx, cy, 47, d1 + g, d1 + 180, '?', ASK, true);
    } else {
      s += arc(cx, cy, 34, d1 + 180, d1 + g + 180, ASK) + angLbl(cx, cy, 54, d1 + 180, d1 + g + 180, '?', ASK, true);
    }
    return wrap(350, 210, s);
  }
  /* paper Q1: two lines cross; a ray at a right angle to one of them */
  function figCrossPerp(g){
    var cx = 185, cy = 120, mu = -10;             /* M: shallow line, L: down arm at mu-g */
    var dn = mu - g, up = dn + 180, perp = dn + 90, s = '';
    s += through(cx, cy, 165, mu) + through(cx, cy, 150, dn) + ray(cx, cy, 120, perp);
    s += sqMark(cx, cy, perp);                     /* square between the ray and L's up arm */
    s += arc(cx, cy, 40, up, mu + 180) + angLbl(cx, cy, 62, up, mu + 180, g + '°', GIVEN);
    s += arc(cx, cy, 46, mu, perp, ASK) + angLbl(cx, cy, 66, mu, perp, 'a', ASK, true);
    s += arc(cx, cy, 40, dn, mu, ASK) + angLbl(cx, cy, 60, dn, mu, 'b', ASK, true);
    return wrap(370, 240, s);
  }
  function inter(p, d1, q, d2){                    /* intersection of two direction lines */
    var t1 = d1 * Math.PI / 180, t2 = d2 * Math.PI / 180;
    var a1 = Math.cos(t1), b1 = -Math.sin(t1), a2 = Math.cos(t2), b2 = -Math.sin(t2);
    var det = a1 * b2 - a2 * b1;
    var dx = q[0] - p[0], dy = q[1] - p[1];
    var t = (dx * b2 - dy * a2) / det;
    return [p[0] + a1 * t, p[1] + b1 * t];
  }
  function figTri(a, b){                           /* base angles a (left) and b (right) */
    var A = [55, 195], B = [305, 195];
    var T = inter(A, a, B, 180 - b);
    var s = seg(A[0], A[1], B[0], B[1]) + seg(A[0], A[1], T[0], T[1]) + seg(B[0], B[1], T[0], T[1]);
    s += (a === 90 ? sqMark(A[0], A[1], 0) : arc(A[0], A[1], 30, 0, a) + angLbl(A[0], A[1], 48, 0, a, a + '°', GIVEN));
    if(a === 90) s += angLbl(A[0], A[1], 50, 0, a, '90°', GIVEN);
    s += arc(B[0], B[1], 30, 180 - b, 180) + angLbl(B[0], B[1], 48, 180 - b, 180, b + '°', GIVEN);
    var dTA = Math.atan2(-(A[1] - T[1]), A[0] - T[0]) * 180 / Math.PI;
    var dTB = Math.atan2(-(B[1] - T[1]), B[0] - T[0]) * 180 / Math.PI;
    s += arc(T[0], T[1], 26, dTA, dTB, ASK) + angLbl(T[0], T[1], 44, dTA, dTB, '?', ASK, true);
    return wrap(360, 220, s);
  }
  function figTriLine(x){                          /* exterior angle x on the line at B */
    var B = [235, 190], A = [75, 190];
    var T = pt(B[0], B[1], 150, x), s = '';     /* interior = 180 − x, so BT points at x° */
    s += seg(15, 190, 345, 190);                   /* the straight line */
    s += seg(A[0], A[1], T[0], T[1]) + seg(B[0], B[1], T[0], T[1]);
    s += arc(B[0], B[1], 34, 0, x) + angLbl(B[0], B[1], 56, 0, x, x + '°', GIVEN);
    s += arc(B[0], B[1], 26, x, 180, ASK) + angLbl(B[0], B[1], 44, x, 180, '?', ASK, true);
    return wrap(360, 215, s);
  }
  function figIso(val, at, opts){                  /* at: 'base' (val = base angle) or 'apex' */
    opts = opts || {};
    var base = at === 'base' ? val : (180 - val) / 2;
    var half = 105, h = Math.min(half * Math.tan(base * Math.PI / 180), 175);
    var A = [70, 215], B = [70 + 2 * half, 215], T = [70 + half, 215 - h], s = '';
    s += seg(A[0], A[1], B[0], B[1]) + seg(A[0], A[1], T[0], T[1]) + seg(B[0], B[1], T[0], T[1]);
    s += tick(A[0], A[1], T[0], T[1]) + tick(B[0], B[1], T[0], T[1]);
    var dA = Math.atan2(h, half) * 180 / Math.PI;
    var la = at === 'base' ? val + '°' : '?', col = at === 'base' ? GIVEN : ASK;
    s += arc(A[0], A[1], 30, 0, dA, col) + angLbl(A[0], A[1], 50, 0, dA, la, col, at !== 'base');
    if(!opts.hideRight){
      var rl = opts.rightLbl || '?';
      s += arc(B[0], B[1], 30, 180 - dA, 180, ASK) + angLbl(B[0], B[1], 50, 180 - dA, 180, rl, ASK, true);
    }
    var dTA = Math.atan2(-(A[1] - T[1]), A[0] - T[0]) * 180 / Math.PI;
    var dTB = Math.atan2(-(B[1] - T[1]), B[0] - T[0]) * 180 / Math.PI;
    var lt = at === 'apex' ? val + '°' : (opts.apexLbl || '?'), ct = at === 'apex' ? GIVEN : ASK;
    s += arc(T[0], T[1], 24, dTA, dTB, ct) + angLbl(T[0], T[1], 44, dTA, dTB, lt, ct, at !== 'apex');
    return wrap(350, 240, s);
  }
  /* paper Q2(a): the triangle whose bottom-left corner is a crossing of two lines */
  function figCrossTri(g, top){
    var P = [95, 200], m = 10;                     /* rays of the triangle from P */
    var d1 = m, d2 = m + g;
    var Q = pt(P[0], P[1], 195, d2);               /* top vertex */
    var dQP = d2 + 180;
    var R = inter(P, d1, Q, dQP + top);            /* third side leaves Q at angle 'top' */
    var s = seg(P[0], P[1], R[0], R[1]) + seg(P[0], P[1], Q[0], Q[1]) + seg(Q[0], Q[1], R[0], R[1]);
    s += ray(P[0], P[1], 62, d1 + 180) + ray(P[0], P[1], 62, d2 + 180);   /* the crossing */
    s += arc(P[0], P[1], 26, d1 + 180, d2 + 180) + angLbl(P[0], P[1], 44, d1 + 180, d2 + 180, g + '°', GIVEN);
    s += arc(P[0], P[1], 30, d1, d2, ASK) + angLbl(P[0], P[1], 48, d1, d2, 'b', ASK, true);
    var dQR = Math.atan2(-(R[1] - Q[1]), R[0] - Q[0]) * 180 / Math.PI;
    s += arc(Q[0], Q[1], 26, dQP, dQR) + angLbl(Q[0], Q[1], 44, dQP, dQR, top + '°', GIVEN);
    var dRP = Math.atan2(-(P[1] - R[1]), P[0] - R[0]) * 180 / Math.PI;
    var dRQ = Math.atan2(-(Q[1] - R[1]), Q[0] - R[0]) * 180 / Math.PI;
    s += arc(R[0], R[1], 26, dRQ, dRP, ASK) + angLbl(R[0], R[1], 44, dRQ, dRP, 'c', ASK, true);
    return wrap(380, 235, s);
  }
  function figRatioLine(w, x){                     /* two angles sharing a straight line */
    var cx = 180, cy = 150, split = 180 * x / (w + x), s = '';
    s += through(cx, cy, 165, 0) + ray(cx, cy, 130, split) + '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="' + INK + '"/>';
    s += arc(cx, cy, 36, 0, split, ASK) + angLbl(cx, cy, 56, 0, split, 'x', ASK, true);
    s += arc(cx, cy, 28, split, 180, ASK) + angLbl(cx, cy, 48, split, 180, 'w', ASK, true);
    return wrap(360, 175, s);
  }
  /* paper Q3: crossing lines, w top / x right / y bottom / z left */
  function figCrossRatio(w, x){
    var cx = 185, cy = 115, half = (180 * x / (w + x)) / 2, s = '';
    var d1 = -half, d2 = half;                     /* x sits between them on the right */
    s += through(cx, cy, 165, d1) + through(cx, cy, 165, d2);
    s += arc(cx, cy, 40, d1, d2, ASK) + angLbl(cx, cy, 60, d1, d2, 'x', ASK, true);
    s += arc(cx, cy, 34, d2, d1 + 180, ASK) + angLbl(cx, cy, 53, d2, d1 + 180, 'w', ASK, true);
    s += arc(cx, cy, 40, d1 + 180, d2 + 180, ASK) + angLbl(cx, cy, 60, d1 + 180, d2 + 180, 'z', ASK, true);
    s += arc(cx, cy, 34, d2 + 180, d1 + 360, ASK) + angLbl(cx, cy, 53, d2 + 180, d1 + 360, 'y', ASK, true);
    return wrap(370, 230, s);
  }
  /* circles.  parts: list of {kind:'radius'|'diameter'|'chord', label, dir} */
  function figCircle(parts, arrowTo){
    var cx = 175, cy = 120, R = 92, s = '';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="none" stroke="' + INK + '" stroke-width="2.4"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="3.2" fill="' + INK + '"/>' + lbl(cx + 13, cy + 11, 'O', INK, 16);
    (parts || []).forEach(function(p){
      var a = p.dir || 40, e = pt(cx, cy, R, a), col = p.col || ASK;
      if(p.kind === 'radius'){
        s += seg(cx, cy, e[0], e[1], 2.4, col);
        var m = pt(cx, cy, R * 0.55, a); s += lbl(m[0] + 12, m[1] - 8, p.label || 'r', col, 17, true);
      } else if(p.kind === 'diameter'){
        var e2 = pt(cx, cy, R, a + 180);
        s += seg(e2[0], e2[1], e[0], e[1], 2.4, col);
        var m2 = pt(cx, cy, R * 0.55, a + 180); s += lbl(m2[0], m2[1] - 12, p.label || 'd', col, 17, true);
      } else if(p.kind === 'chord'){
        var c1 = pt(cx, cy, R, a), c2 = pt(cx, cy, R, p.dir2 || (a + 110));
        s += seg(c1[0], c1[1], c2[0], c2[1], 2.4, col);
        var mm = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
        s += lbl(mm[0] + 12, mm[1] - 8, p.label || '', col, 17, true);
      }
    });
    if(arrowTo){
      var tip = arrowTo === 'centre' ? [cx + 6, cy - 6] : pt(cx, cy, R + 2, 35);
      var tail = arrowTo === 'centre' ? [cx + 78, cy - 62] : pt(cx, cy, R + 58, 35);
      s += seg(tail[0], tail[1], tip[0], tip[1], 2.4, GIVEN)
        + '<circle cx="' + f1(tip[0]) + '" cy="' + f1(tip[1]) + '" r="4.6" fill="' + GIVEN + '"/>';
    }
    return wrap(350, 240, s);
  }

  /* ================= where each piece of knowledge lives in the textbook ====
     Maths — No Problem! Textbook Phase 3B (Whakawhitinga Edition).
     Chapter 12 (Geometry) spans textbook pp. 109–147; chapter 8 (Ratio) pp. 17–47. */
  var BK = {
    c12l1:'Chapter 12 · Lesson 1 — Investigating Vertically Opposite Angles · textbook pp. 110–112',
    c12l2:'Chapter 12 · Lesson 2 — Solving Problems Involving Angles · textbook pp. 113–114',
    c12l3:'Chapter 12 · Lesson 3 — Investigating Angles in Triangles · textbook pp. 115–117',
    c12l6:'Chapter 12 · Lesson 6 — Naming Parts of a Circle · textbook pp. 123–125',
    c8cmp:'Chapter 8 (Ratio) · Lessons 1–2 — Comparing Quantities · textbook chapter pp. 17–47',
    c8l4:'Chapter 8 (Ratio) · Lesson 4 — Finding Quantities from Ratios · textbook chapter pp. 17–47'
  };

  /* ================= tiny builders for questions ================= */
  function qB(fig, prompt, blanks, note){          /* typed blanks */
    return {kind:'blanks', fig:fig, prompt:prompt, blanks:blanks, note:note || ''};
  }
  function bl(pre, ans, post){ return {pre:pre, ans:ans, post:post === undefined ? '°' : post}; }
  function qC(fig, prompt, choices){               /* multiple choice */
    return {kind:'choice', fig:fig, prompt:prompt, choices:choices};
  }
  function qD(order, prompt, note){                /* the circle drawing task */
    return {kind:'draw', parts:order, prompt:prompt, note:note || ''};
  }
  function pr(fig, prompt, key, space){            /* a printed practice problem */
    return {fig:fig, prompt:prompt, key:key, space:space || 'box'};
  }

  /* ================= shared level factories ================= */
  function LFacts(qs, practice){
    return {
      know:{
        title:'Angle facts you can count on',
        book:BK.c12l2,
        pts:['A right angle (the little square) is 90°.',
             'Angles on a straight line add up to 180°.',
             'Angles all the way around a point add up to 360°.'],
        fig:figFacts()
      },
      hint:'Right angle 90° · straight line 180° · full turn 360°.',
      qs:qs, practice:practice
    };
  }
  function LLine(gs, ps){
    function q(g){ return qB(figLinePair(g), 'The two angles sit on a straight line. Find the missing angle.', [bl('? =', 180 - g)]); }
    return {
      know:{
        title:'Angles on a straight line',
        book:BK.c12l1,
        pts:['Angles that fit together on a straight line add up to 180°.',
             'So the missing angle is 180° minus the one you know.'],
        fig:figLinePair(110),
        worked:{text:'The known angle is 110°, so ? = 180° − 110° = 70°.'}
      },
      hint:'The two angles must add up to 180°.',
      qs:gs.map(q),
      practice:ps.map(function(g){ return pr(figLinePair(g), 'Find the missing angle.', (180 - g) + '°'); })
    };
  }
  function LVert(specs, ps){
    function q(sp){
      return qB(figCross(sp.v, sp.ask),
        sp.ask === 'adj'
          ? 'Two straight lines cross. Find the angle marked ?.'
          : 'Two straight lines cross. Find the angle vertically opposite the one marked.',
        [bl('? =', sp.ask === 'adj' ? 180 - sp.v : sp.v)]);
    }
    return {
      know:{
        title:'Vertically opposite angles',
        book:BK.c12l1,
        pts:['When two straight lines cross they make an X.',
             'The angles opposite each other in the X are called vertically opposite angles.',
             'Vertically opposite angles are always equal.'],
        fig:figCross(65, 'opp'),
        worked:{text:'The marked angle is 65°, so the angle opposite it is also 65°.'}
      },
      hint:'Angles opposite each other in the X are equal.',
      qs:specs.map(q),
      practice:ps.map(function(sp){
        return sp.full
          ? pr(figCross(sp.v, 'opp'), 'One angle is ' + sp.v + '°. Write down the sizes of the other three angles.',
               sp.v + '°, ' + (180 - sp.v) + '° and ' + (180 - sp.v) + '°', 'lines')
          : pr(figCross(sp.v, sp.ask), 'Find the angle marked ?.', (sp.ask === 'adj' ? 180 - sp.v : sp.v) + '°');
      })
    };
  }

  /* ================= the four ladders ================= */
  var ITEMS = [
  /* ---------- paper question 1 ---------- */
  {key:'q1', n:1, name:'Crossing lines with a right angle', diff:6, levels:{
    1: LFacts(
      [qB(null, 'How many degrees make a right angle?', [bl('A right angle =', 90)]),
       qB(null, 'Angles on a straight line add up to how many degrees?', [bl('They add up to', 180)]),
       qB(null, 'How many degrees is a full turn around a point?', [bl('A full turn =', 360)])],
      [pr(null, 'A quarter turn is how many degrees?', '90°'),
       pr(null, 'Half a turn is how many degrees?', '180°'),
       pr(null, 'Rangi spins all the way around. How many degrees did he turn?', '360°')]),
    2: {
      know:{
        title:'Two angles that make a right angle',
        book:BK.c12l2,
        pts:['The little square marks a right angle: exactly 90°.',
             'When a ray splits a right angle into two parts, the parts add up to 90°.',
             'So the missing part is 90° minus the part you know.'],
        fig:figRightSplit(30),
        worked:{text:'One part is 30°, so ? = 90° − 30° = 60°.'}
      },
      hint:'The two parts fit inside the square: they add up to 90°.',
      qs:[30, 54, 72].map(function(g){
        return qB(figRightSplit(g), 'The right angle is split into two parts. Find the missing part.', [bl('? =', 90 - g)]);
      }),
      practice:[25, 41, 63].map(function(g){
        return pr(figRightSplit(g), 'Find the missing part of the right angle.', (90 - g) + '°');
      })
    },
    3: LLine([110, 45, 76], [120, 35, 98]),
    4: {
      know:{
        title:'Angles at a point',
        book:BK.c12l2,
        pts:['Angles that fit all the way around a point add up to 360°.',
             'Add the angles you know, then take the total away from 360°.'],
        fig:figPoint3(150, 120),
        worked:{text:'150° + 120° = 270°, so ? = 360° − 270° = 90°.'}
      },
      hint:'All the angles around the point add up to 360°.',
      qs:[[150, 120], [200, 75], [95, 140]].map(function(p2){
        return qB(figPoint3(p2[0], p2[1]), 'The three angles fit around a point. Find the missing angle.', [bl('? =', 360 - p2[0] - p2[1])]);
      }),
      practice:[[100, 130], [215, 90], [160, 85]].map(function(p2){
        return pr(figPoint3(p2[0], p2[1]), 'Find the missing angle around the point.', (360 - p2[0] - p2[1]) + '°');
      })
    },
    5: LVert([{v:65, ask:'opp'}, {v:132, ask:'opp'}, {v:51, ask:'adj'}],
             [{v:74, ask:'opp'}, {v:145, ask:'opp'}, {v:60, full:true}]),
    6: {
      know:{
        title:'A right angle at the crossing',
        book:BK.c12l2,
        pts:['Take tricky diagrams one fact at a time.',
             'The square marks 90°, a straight line holds 180°, and vertically opposite angles are equal.',
             'Find the angle the ray splits off the 90°, then match the vertically opposite pair.'],
        fig:figCrossPerp(24),
        worked:{text:'With 24° given: angle a = 90° − 24° = 66°, and angle b is vertically opposite the 24°, so b = 24°.'}
      },
      hint:'Use the square (90°) for a, and the X (vertically opposite) for b.',
      qs:[24, 37, 52].map(function(g, i){
        return qB(figCrossPerp(g), 'Two lines cross, and the ray makes a right angle. Find angles a and b.',
                  [bl('Angle a =', 90 - g), bl('Angle b =', g)],
                  i === 0 ? 'paper' : '');
      }),
      practice:[31, 45, 68].map(function(g){
        return pr(figCrossPerp(g), 'Find angles a and b.', 'a = ' + (90 - g) + '°, b = ' + g + '°');
      })
    }
  }},
  /* ---------- paper question 2 ---------- */
  {key:'q2', n:2, name:'Angles in triangles', diff:7, levels:{
    1: LFacts(
      [qB(null, 'The little square in a corner marks an angle of how many degrees?', [bl('It marks', 90)]),
       qB(null, 'How many degrees do angles on a straight line add up to?', [bl('They add up to', 180)]),
       qB(null, 'How many degrees in a full turn?', [bl('A full turn =', 360)])],
      [pr(null, 'How many degrees is a quarter turn?', '90°'),
       pr(null, 'How many degrees is half a turn?', '180°'),
       pr(null, 'Three right angles together make how many degrees?', '270°')]),
    2: LLine([125, 62, 143], [105, 88, 24]),
    3: LVert([{v:40, ask:'opp'}, {v:126, ask:'opp'}, {v:75, ask:'adj'}],
             [{v:82, ask:'opp'}, {v:157, ask:'opp'}, {v:45, full:true}]),
    4: {
      know:{
        title:'Angles in a triangle add up to 180°',
        book:BK.c12l3,
        pts:['The three inside angles of any triangle always add up to 180°.',
             'Add the two angles you know, then take the total away from 180°.'],
        fig:figTri(60, 70),
        worked:{text:'60° + 70° = 130°, so the third angle = 180° − 130° = 50°.'}
      },
      hint:'The three angles of a triangle add up to 180°.',
      qs:[[60, 70], [90, 35], [25, 105]].map(function(p2){
        return qB(figTri(p2[0], p2[1]), 'Find the missing angle of the triangle.', [bl('? =', 180 - p2[0] - p2[1])]);
      }),
      practice:[[55, 65], [90, 45], [112, 20]].map(function(p2){
        return pr(figTri(p2[0], p2[1]), 'Find the missing angle of the triangle.', (180 - p2[0] - p2[1]) + '°');
      })
    },
    5: {
      know:{
        title:'Step from the line into the triangle',
        book:BK.c12l3,
        pts:['Sometimes the angle inside the triangle is not labelled — but the angle beside it on the straight line is.',
             'The two of them sit on a straight line, so they add up to 180°.',
             'Angle inside = 180° minus the angle on the line.'],
        fig:figTriLine(120),
        worked:{text:'The angle on the line is 120°, so the angle inside the triangle = 180° − 120° = 60°.'}
      },
      hint:'The marked angle and the ? sit together on a straight line.',
      qs:[120, 110, 95].map(function(x){
        return qB(figTriLine(x), 'The triangle sits on a straight line. Find the angle inside the triangle.', [bl('? =', 180 - x)]);
      }),
      practice:[130, 100, 116].map(function(x){
        return pr(figTriLine(x), 'Find the angle inside the triangle.', (180 - x) + '°');
      })
    },
    6: {
      know:{
        title:'Isosceles triangles',
        book:BK.c12l3,
        pts:['Tick marks show sides that are equal. Two equal sides make an isosceles triangle.',
             'The two angles sitting under the equal sides are equal too.',
             'All three angles still add up to 180°.'],
        fig:figIso(50, 'base'),
        worked:{text:'Both base angles are 50°, so the top angle = 180° − 50° − 50° = 80°.'}
      },
      hint:'The two base angles of an isosceles triangle are equal.',
      qs:[
        qB(figIso(50, 'base', {hideRight:true}), 'The tick marks show two equal sides. One base angle is 50°. Find the top angle.', [bl('Top angle =', 80)]),
        qB(figIso(40, 'apex'), 'The top angle is 40°. Find the size of each base angle.', [bl('Each base angle =', 70)]),
        qB(figIso(64, 'base', {hideRight:true}), 'One base angle is 64°. Find the top angle.', [bl('Top angle =', 52)])
      ],
      practice:[
        pr(figIso(45, 'base', {hideRight:true}), 'One base angle is 45°. Find the top angle.', '90°'),
        pr(figIso(100, 'apex'), 'The top angle is 100°. Find each base angle.', '40° each'),
        pr(figIso(72, 'base', {hideRight:true}), 'One base angle is 72°. Find the top angle.', '36°')
      ]
    },
    7: {
      know:{
        title:'Putting the angle facts together',
        book:BK.c12l3,
        pts:['Work around the diagram one step at a time.',
             'Crossing lines: vertically opposite angles are equal.',
             'Triangles: the three angles add up to 180°, and an isosceles triangle has equal base angles.'],
        fig:figCrossTri(35, 65),
        worked:{text:'b is vertically opposite 35°, so b = 35°. Then c = 180° − 65° − 35° = 80°.'}
      },
      hint:'Start with the X for b, then use 180° in the triangle for c. Ticks mean equal base angles.',
      qs:[
        {kind:'blanks2', prompt:'Fill in the blanks.',
         figA:figCrossTri(35, 65), figB:figIso(55, 'base', {rightLbl:'d', apexLbl:'e'}),
         blanks:[bl('∠b =', 35), bl('∠c =', 80), bl('∠d =', 55), bl('∠e =', 70)], note:'paper'},
        {kind:'blanks2', prompt:'Fill in the blanks.',
         figA:figCrossTri(28, 74), figB:figIso(62, 'base', {rightLbl:'d', apexLbl:'e'}),
         blanks:[bl('∠b =', 28), bl('∠c =', 78), bl('∠d =', 62), bl('∠e =', 56)], note:''},
        {kind:'blanks2', prompt:'Fill in the blanks.',
         figA:figCrossTri(47, 66), figB:figIso(48, 'base', {rightLbl:'d', apexLbl:'e'}),
         blanks:[bl('∠b =', 47), bl('∠c =', 67), bl('∠d =', 48), bl('∠e =', 84)], note:''}
      ],
      practice:[
        pr(figCrossTri(32, 70), 'Find ∠b and ∠c.', 'b = 32°, c = 78°'),
        pr(figIso(58, 'base', {rightLbl:'d', apexLbl:'e'}), 'The ticks show equal sides. Find ∠d (the other base angle) and ∠e (the top).', 'd = 58°, e = 64°'),
        pr(figCrossTri(41, 59), 'Find ∠b and ∠c.', 'b = 41°, c = 80°')
      ]
    }
  }},
  /* ---------- paper question 3 ---------- */
  {key:'q3', n:3, name:'Sharing angles in a ratio', diff:7, levels:{
    1: LFacts(
      [qB(null, 'Angles on a straight line add up to how many degrees?', [bl('They add up to', 180)]),
       qB(null, 'Angles around a point add up to how many degrees?', [bl('They add up to', 360)]),
       qB(null, 'A right angle measures how many degrees?', [bl('A right angle =', 90)])],
      [pr(null, 'How many degrees is half a turn?', '180°'),
       pr(null, 'How many degrees is a full turn?', '360°'),
       pr(null, 'Two right angles together make how many degrees?', '180°')]),
    2: {
      know:{
        title:'Reading and simplifying ratios',
        book:BK.c8cmp,
        pts:['A ratio compares two amounts: 8 : 1 means 8 parts to 1 part.',
             'Ratios stay equivalent when you multiply or divide both sides by the same number.',
             '6 : 2 simplifies to 3 : 1 (divide both sides by 2).'],
        worked:{text:'8 : 1 is equivalent to 80 : 10 and to 160 : 20 — multiply both sides by the same number.'}
      },
      hint:'Do the same thing to both sides of the ratio.',
      qs:[
        qB(null, 'Write 6 : 2 in its simplest form.', [bl('', 3, ':'), bl('', 1, '')]),
        qB(null, 'Fill in the blank: 5 : 1 is equivalent to 10 : ___', [bl('10 :', 2, '')]),
        qB(null, 'There are 4 apples for every 12 oranges. Write the ratio of apples to oranges in its simplest form.', [bl('', 1, ':'), bl('', 3, '')])
      ],
      practice:[
        pr(null, 'Write 9 : 3 in its simplest form.', '3 : 1'),
        pr(null, '8 : 1 is equivalent to 16 : ___', '2'),
        pr(null, 'Write 6 : 9 in its simplest form.', '2 : 3')
      ]
    },
    3: {
      know:{
        title:'Sharing an amount in a ratio',
        book:BK.c8l4,
        pts:['Add the parts of the ratio to see how many equal parts there are.',
             'Divide the amount by the number of parts to find one part.',
             'Multiply to build each share.'],
        worked:{text:'Share $36 in the ratio 5 : 1. Parts: 5 + 1 = 6. One part: $36 ÷ 6 = $6. Shares: 5 × $6 = $30 and 1 × $6 = $6.'}
      },
      hint:'Add the parts, divide the amount, then multiply.',
      qs:[
        qB(null, 'Share $36 between Mia and Ari in the ratio 5 : 1.', [bl('Mia gets $', 30, ''), bl('Ari gets $', 6, '')]),
        qB(null, 'Share 27 lollies in the ratio 8 : 1.', [bl('First share =', 24, ''), bl('Second share =', 3, '')]),
        qB(null, 'Share $40 in the ratio 3 : 1.', [bl('First share = $', 30, ''), bl('Second share = $', 10, '')])
      ],
      practice:[
        pr(null, 'Share 24 stickers in the ratio 5 : 1.', '20 and 4'),
        pr(null, 'Share $45 in the ratio 4 : 1.', '$36 and $9'),
        pr(null, 'Share 30 marbles in the ratio 2 : 3.', '12 and 18')
      ]
    },
    4: LLine([155, 68, 91], [134, 59, 12]),
    5: LVert([{v:155, ask:'opp'}, {v:38, ask:'opp'}, {v:25, ask:'adj'}],
             [{v:96, ask:'opp'}, {v:12, ask:'opp'}, {v:150, full:true}]),
    6: {
      know:{
        title:'Sharing 180° in a ratio',
        book:BK.c8l4,
        pts:['Two angles on a straight line share 180° between them.',
             'If they are in a ratio, share the 180° just like sharing money: add the parts, divide, multiply.'],
        fig:figRatioLine(2, 1),
        worked:{text:'∠w : ∠x = 2 : 1. Parts: 3. One part: 180° ÷ 3 = 60°. So w = 120° and x = 60°.'}
      },
      hint:'w and x add up to 180° — share it by the ratio.',
      qs:[[2, 1], [5, 1], [3, 2]].map(function(r2){
        var u = 180 / (r2[0] + r2[1]);
        return qB(figRatioLine(r2[0], r2[1]),
          'The ratio of ∠w : ∠x is ' + r2[0] + ' : ' + r2[1] + '. The angles sit on a straight line. Find them.',
          [bl('∠w =', u * r2[0]), bl('∠x =', u * r2[1])]);
      }),
      practice:[[4, 1], [1, 1], [7, 3]].map(function(r2){
        var u = 180 / (r2[0] + r2[1]);
        return pr(figRatioLine(r2[0], r2[1]), 'The ratio of ∠w : ∠x is ' + r2[0] + ' : ' + r2[1] + '. Find both angles.',
                  'w = ' + (u * r2[0]) + '°, x = ' + (u * r2[1]) + '°');
      })
    },
    7: {
      know:{
        title:'All four angles from one ratio',
        book:BK.c12l2,
        pts:['∠w and ∠x sit together on a straight line, so they share 180° in the given ratio.',
             '∠y is vertically opposite ∠w, and ∠z is vertically opposite ∠x — so they are equal to them.'],
        fig:figCrossRatio(8, 1),
        worked:{text:'8 : 1 makes 9 parts. 180° ÷ 9 = 20°. So w = 160°, x = 20°, then y = w = 160° and z = x = 20°.'}
      },
      hint:'w and x share 180° in the ratio; y and z are vertically opposite them.',
      qs:[[8, 1], [5, 1], [7, 2]].map(function(r2, i){
        var u = 180 / (r2[0] + r2[1]);
        return qB(figCrossRatio(r2[0], r2[1]),
          'The ratio of ∠w : ∠x is ' + r2[0] + ' : ' + r2[1] + '. Find all four angles.',
          [bl('∠w =', u * r2[0]), bl('∠x =', u * r2[1]), bl('∠y =', u * r2[0]), bl('∠z =', u * r2[1])],
          i === 0 ? 'paper' : '');
      }),
      practice:[[4, 1], [2, 1], [5, 4]].map(function(r2){
        var u = 180 / (r2[0] + r2[1]);
        return pr(figCrossRatio(r2[0], r2[1]), 'The ratio of ∠w : ∠x is ' + r2[0] + ' : ' + r2[1] + '. Find all four angles.',
                  'w = ' + (u * r2[0]) + '°, x = ' + (u * r2[1]) + '°, y = ' + (u * r2[0]) + '°, z = ' + (u * r2[1]) + '°');
      })
    }
  }},
  /* ---------- paper question 4 ---------- */
  {key:'q4', n:4, name:'Parts of a circle', diff:5, levels:{
    1: {
      know:{
        title:'Centre and circumference',
        book:BK.c12l6,
        pts:['The centre is the point exactly in the middle of the circle — we label it O.',
             'The circumference is the boundary of the circle: the distance all the way around the outside.'],
        fig:figCircle([], 'edge')
      },
      hint:'O is the centre; the way around the outside is the circumference.',
      qs:[
        qC(figCircle([], 'edge'), 'What is the part of the circle the arrow points to?',
           [{t:'The circumference', ok:true}, {t:'The centre'}, {t:'The diameter'}]),
        qC(figCircle([], 'centre'), 'What is the point O called?',
           [{t:'A corner'}, {t:'The centre', ok:true}, {t:'The circumference'}]),
        qC(null, 'The distance all the way around the outside of a circle is called…',
           [{t:'the diameter'}, {t:'the radius'}, {t:'the circumference', ok:true}])
      ],
      practice:[
        pr(figCircle([]), 'Label the centre O and draw an arrow to the circumference. Write both names.', 'O = centre; the outside boundary = circumference', 'lines'),
        pr(null, 'True or false: the centre sits exactly in the middle of the circle.', 'True'),
        pr(figCircle([]), 'Put a cross anywhere ON the circumference of this circle.', 'any point on the boundary')
      ]
    },
    2: {
      know:{
        title:'The radius, r',
        book:BK.c12l6,
        pts:['A radius joins the centre O to the circumference.',
             'Every radius of a circle is exactly the same length, whichever way it points.'],
        fig:figCircle([{kind:'radius', label:'r', dir:55}]),
        worked:{text:'If one radius is 4 cm, every radius of that circle is 4 cm.'}
      },
      hint:'A radius runs from the centre O out to the circumference.',
      qs:[
        qC(figCircle([{kind:'radius', label:'p', dir:110, col:INK}, {kind:'chord', label:'q', dir:-30, dir2:60, col:INK}]),
           'Which line is a radius of the circle?',
           [{t:'Line p', ok:true}, {t:'Line q'}, {t:'Neither of them'}]),
        qC(null, 'A radius joins the centre of a circle to…',
           [{t:'another circle'}, {t:'the circumference', ok:true}, {t:'the corner'}]),
        qB(null, 'One radius of a circle is 4 cm long. How long is every other radius of the same circle?', [bl('', 4, 'cm')])
      ],
      practice:[
        pr(figCircle([]), 'Draw a radius on this circle and label it r.', 'any line from O to the circumference'),
        pr(null, 'A circle has a radius of 7 cm. Kiri draws a different radius of the same circle. How long is it?', '7 cm'),
        pr(figCircle([{kind:'radius', label:'a', dir:150, col:INK}, {kind:'chord', label:'b', dir:20, dir2:95, col:INK}]), 'Circle the letter of the line that is a radius.', 'a')
      ]
    },
    3: {
      know:{
        title:'The diameter, d',
        book:BK.c12l6,
        pts:['A diameter goes from one side of the circumference to the other.',
             'It must pass through the centre O — a line that misses the centre is not a diameter.'],
        fig:figCircle([{kind:'diameter', label:'d', dir:15}]),
        worked:{text:'The line d touches the circumference twice and passes through O — that makes it a diameter.'}
      },
      hint:'A diameter crosses the whole circle through the centre O.',
      qs:[
        qC(figCircle([{kind:'diameter', label:'m', dir:25, col:INK}, {kind:'chord', label:'n', dir:80, dir2:170, col:INK}]),
           'Which line is a diameter of the circle?',
           [{t:'Line n'}, {t:'Line m', ok:true}, {t:'Both of them'}]),
        qC(null, 'A diameter must always pass through…',
           [{t:'the centre', ok:true}, {t:'the top of the circle'}, {t:'a corner'}]),
        qC(null, 'Which sentence is true about every diameter?',
           [{t:'It stops at the centre'}, {t:'It misses the centre'}, {t:'It passes right through the centre', ok:true}])
      ],
      practice:[
        pr(figCircle([]), 'Draw a diameter on this circle and label it d.', 'any line across the circle through O'),
        pr(null, 'True or false: every diameter passes through the centre of the circle.', 'True'),
        pr(figCircle([{kind:'chord', label:'g', dir:-40, dir2:75, col:INK}]), 'Line g touches the circumference twice. Is it a diameter? Explain.', 'No — it does not pass through the centre O', 'lines')
      ]
    },
    4: {
      know:{
        title:'The diameter is twice the radius',
        book:BK.c12l6,
        pts:['A diameter is made of two radii joined at the centre.',
             'So d = 2 × r, and r = d ÷ 2.'],
        fig:figCircle([{kind:'diameter', label:'d', dir:0}, {kind:'radius', label:'r', dir:90}]),
        worked:{text:'If r = 6 cm then d = 2 × 6 = 12 cm. If d = 18 cm then r = 18 ÷ 2 = 9 cm.'}
      },
      hint:'d = 2 × r.',
      qs:[
        qB(figCircle([{kind:'radius', label:'r', dir:60}]), 'The radius of the circle is 6 cm. Find the diameter.', [bl('d =', 12, 'cm')]),
        qB(figCircle([{kind:'diameter', label:'d', dir:20}]), 'The diameter of the circle is 18 cm. Find the radius.', [bl('r =', 9, 'cm')]),
        qB(null, 'A circle has a radius of 4.5 cm. Find its diameter.', [bl('d =', 9, 'cm')])
      ],
      practice:[
        pr(null, 'The radius is 8 cm. Find the diameter.', '16 cm'),
        pr(null, 'The diameter is 26 cm. Find the radius.', '13 cm'),
        pr(null, 'The radius is 2.5 cm. Find the diameter.', '5 cm')
      ]
    },
    5: {
      know:{
        title:'Drawing the radius and the diameter',
        book:BK.c12l6,
        pts:['Radius r: one straight line from the centre O to the circumference.',
             'Diameter d: one straight line right across the circle, passing through O.',
             'Label each line with its letter.'],
        fig:figCircle([{kind:'radius', label:'r', dir:90}, {kind:'diameter', label:'d', dir:0}])
      },
      hint:'The radius starts at O; the diameter must pass through O.',
      qs:[
        qD(['radius', 'diameter'], 'O is the centre of the circle. Draw and label the radius r, then the diameter d.', 'paper'),
        qD(['radius', 'diameter'], 'Draw and label the radius r, then the diameter d, on this circle.'),
        qD(['radius', 'diameter'], 'Show me a radius r and a diameter d on the circle.')
      ],
      practice:[
        pr(figCircle([]), 'Draw and label a radius r and a diameter d on this circle.', 'r: O to the edge; d: across the circle through O'),
        pr(null, 'Hemi joins a point on the circumference straight to O. What has he drawn?', 'a radius'),
        pr(null, 'The radius you drew is 5 cm. How long is the diameter you drew?', '10 cm')
      ]
    }
  }}];

  /* ================= answers ================= */
  function numOK(raw, ans){
    if(raw === null || raw === undefined) return false;
    var s = String(raw).toLowerCase().replace(/[^0-9.\-]/g, '');
    if(!s) return false;
    var n = parseFloat(s);
    return isFinite(n) && Math.abs(n - ans) < 0.01;
  }
  function checkBlanks(q, vals){
    if(!vals || vals.length !== q.blanks.length) return false;
    return q.blanks.every(function(b, i){ return numOK(vals[i], b.ans); });
  }

  /* ================= the adaptive ladder ================= */
  function item(key){
    for(var i = 0; i < ITEMS.length; i++) if(ITEMS[i].key === key) return ITEMS[i];
    return null;
  }
  function newState(it){
    return {key:it.key, lv:it.diff, used:0, r:0, w:0, done:false, lock:null, floor:false, path:[]};
  }
  function questionFor(it, st){
    return it.levels[st.lv].qs[st.used];
  }
  /* returns 'next' (same level), 'drop', or 'lock'.
     ONE right answer earns the level — even after a wrong sibling first.
     Two wrong answers at a level step down one. */
  function markAnswer(it, st, ok){
    st.path.push([st.lv, ok ? 1 : 0]);
    if(ok){
      st.r++;
      st.done = true; st.lock = st.lv; return 'lock';
    }
    st.w++;
    if(st.w >= 2){
      if(st.lv > 1){ st.lv--; st.used = 0; st.r = 0; st.w = 0; return 'drop'; }
      st.done = true; st.lock = 1; st.floor = true; return 'lock';
    }
    st.used++;
    return 'next';
  }
  /* which knowledge is still missing, lowest first */
  function neededLevels(it, res){
    var from = res.floor ? res.lock : res.lock + 1, out = [];
    for(var l = from; l <= it.diff; l++) out.push({lv:l, title:it.levels[l].know.title});
    return out;
  }

  /* ================= the printable helper sheet =================
     ONE sheet per student: every question's missing steps in a single A4 PDF.
     A tiny header, then straight into Part 1 — one knowledge step per page,
     two practice problems each, answers for the teacher on the last page. */
  function escT(s){
    return String(s).replace(/[&<>]/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;'}[c]; });
  }
  function worksheetHTML(stu, results){
    var partNo = 0, solid = [], body = '', keyRows = [];
    ITEMS.forEach(function(it){
      var r = results[it.key];
      if(!r) return;
      if(r.lock >= it.diff && !r.floor){ solid.push('Q' + it.n); return; }
      var need = neededLevels(it, r);
      body += '<div class="qstrip"><b>Question ' + it.n + '</b> · ' + escT(it.name)
        + '<span class="qs2">reached step ' + (r.floor ? '0' : r.lock) + ' of ' + it.diff + '</span></div>';
      need.forEach(function(nd){
        partNo++;
        var lvd = it.levels[nd.lv], k = lvd.know;
        var practice = lvd.practice.slice(0, 2);
        body += '<section class="part">';
        body += '<h2><span class="pn">Part ' + partNo + '</span> ' + escT(k.title) + '</h2>';
        if(k.book) body += '<div class="book">📖 ' + escT(k.book) + '</div>';
        body += '<div class="know">';
        body += '<ul>' + k.pts.map(function(p){ return '<li>' + escT(p) + '</li>'; }).join('') + '</ul>';
        if(k.fig) body += '<div class="kfig">' + k.fig + '</div>';
        if(k.worked) body += '<div class="worked"><b>Worked example.</b> ' + escT(k.worked.text) + '</div>';
        body += '</div>';
        body += '<ol class="practice">' + practice.map(function(p){
          return '<li><div class="pq">' + escT(p.prompt) + '</div>'
            + (p.fig ? '<div class="pfig">' + p.fig + '</div>' : '')
            + (p.space === 'lines' ? '<div class="lines"><div></div><div></div></div>' : '<div class="ansbox"></div>')
            + '</li>';
        }).join('') + '</ol>';
        body += '</section>';
        keyRows.push({no:partNo, title:k.title,
          keys:practice.map(function(p, i2){ return (i2 + 1) + ') ' + p.key; })});
      });
    });
    var keys = '<section class="keypage"><h2>Answers — for the teacher</h2>'
      + keyRows.map(function(kr){
          return '<p><b>Part ' + kr.no + ' · ' + escT(kr.title) + ':</b> '
            + kr.keys.map(escT).join(' &nbsp; ') + '</p>';
        }).join('') + '</section>';
    return '<!doctype html><html><head><meta charset="utf-8"><title>Review 12 helper — '
      + escT(stu.name) + '</title><style>'
      + '@page{size:A4;margin:11mm 14mm;}'
      + 'body{font-family:"Trebuchet MS","Avenir Next",sans-serif;color:#222;font-size:12pt;margin:0;}'
      + 'header{display:flex;justify-content:space-between;align-items:baseline;'
      + 'border-bottom:2.5px solid #1f5a54;padding-bottom:1.5mm;margin-bottom:3mm;}'
      + 'header h1{font-size:13pt;color:#1f5a54;margin:0;}'
      + 'header .who{font-size:11pt;} header .who b{font-size:12pt;}'
      + '.solid{font-size:9.5pt;color:#557;margin:0 0 2.5mm;}'
      + '.qstrip{background:#eef5f3;border-left:4px solid #1f5a54;border-radius:4px;'
      + 'padding:1.5mm 4mm;font-size:11pt;color:#1f5a54;margin:0 0 2.5mm;}'
      + '.qstrip .qs2{float:right;color:#8a6d00;font-size:9.5pt;}'
      + '.part{page-break-after:always;page-break-inside:avoid;margin:0;}'
      + '.part:last-of-type{page-break-after:auto;}'
      + '.part h2{background:#1f5a54;color:#fff;border-radius:8px;padding:3px 12px;font-size:13pt;margin:0 0 1.5mm;}'
      + '.part h2 .pn{background:#ffd640;color:#5a4a00;border-radius:12px;padding:1px 10px;font-size:10.5pt;margin-right:8px;}'
      + '.book{font-size:9pt;color:#666;margin:0 0 2mm 2mm;}'
      + '.know{border:2px solid #2f7d74;border-radius:10px;padding:2.5mm 4mm;display:flex;gap:5mm;align-items:center;flex-wrap:wrap;}'
      + '.know ul{margin:0;padding-left:5mm;flex:1;min-width:80mm;} .know li{margin:1mm 0;}'
      + '.know .kfig{width:48mm;flex:none;} .know svg{width:100%;height:auto;}'
      + '.worked{font-size:10.5pt;background:#fdf6e4;border-radius:6px;padding:1.5mm 3mm;flex-basis:100%;}'
      + '.practice{margin:2.5mm 0 0;padding-left:6mm;}'
      + '.practice li{margin:0 0 3mm;page-break-inside:avoid;}'
      + '.practice .pfig{width:52mm;margin:1mm 0;} .practice svg{width:100%;height:auto;}'
      + '.ansbox{border:1.5px solid #b9c6c3;border-radius:5px;height:13mm;margin-top:1.5mm;}'
      + '.lines div{border-bottom:1.2px solid #b9c6c3;height:8mm;}'
      + '.keypage{color:#444;font-size:10pt;}'
      + '.keypage h2{color:#1f5a54;font-size:12.5pt;margin:0 0 2mm;}'
      + '.keypage p{margin:1mm 0;}'
      + '</style></head><body>'
      + '<header><h1>📄 Review 12 helper</h1>'
      + '<div class="who"><b>' + escT(stu.emoji || '') + ' ' + escT(stu.name) + '</b> · Wharenui Maths · '
      + new Date().toLocaleDateString('en-NZ') + '</div></header>'
      + '<p class="solid">One part at a time with your teacher — about 10 minutes each.'
      + (solid.length ? ' &nbsp;✓ Already solid: ' + solid.join(', ') + ' — tino pai!' : '') + '</p>'
      + body + keys
      + '</body></html>';
  }

  var R12 = {
    ITEMS:ITEMS, item:item,
    newState:newState, questionFor:questionFor, markAnswer:markAnswer,
    numOK:numOK, checkBlanks:checkBlanks, neededLevels:neededLevels,
    worksheetHTML:worksheetHTML, figCircle:figCircle
  };
  if(typeof module !== 'undefined' && module.exports) module.exports = R12;
  else root.R12 = R12;
})(typeof window !== 'undefined' ? window : this);
