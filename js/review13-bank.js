/* Charlie's Class — Review 13 checkpoint: question bank, adaptive ladder and
   worksheet builder (no DOM). Loaded by review13.html and admin.html as
   window.R13, and by test.js via require().

   Chapter 13 (Year 7 Phase 3B): negative numbers on the number line and the
   coordinate grid. Every paper question sits at level 4 of a 1–6 ladder.
   Getting the level-4 (paper) question right sends the student UP to the
   harder levels 5 and 6; two wrong answers step DOWN to the easier building
   blocks. One right answer earns a level. */
(function(root){
  "use strict";

  /* ================= tiny svg helpers (strings only, jsdom-safe) ========= */
  var INK = '#2b3a42', GIVEN = '#e05c5c', ASK = '#1f5a54', GRID = '#d9e7e3', LAB = '#4c6b66';
  function f1(n){ return Math.round(n * 10) / 10; }
  function seg(x1, y1, x2, y2, w, col){
    return '<line x1="' + f1(x1) + '" y1="' + f1(y1) + '" x2="' + f1(x2) + '" y2="' + f1(y2)
      + '" stroke="' + (col || INK) + '" stroke-width="' + (w || 2.4) + '" stroke-linecap="round"/>';
  }
  function lbl(x, y, t, col, size, italic){
    return '<text x="' + f1(x) + '" y="' + f1(y) + '" fill="' + (col || INK)
      + '" font-size="' + (size || 16) + '"' + (italic ? ' font-style="italic"' : '')
      + ' font-weight="700" text-anchor="middle" dominant-baseline="middle"'
      + ' font-family="Trebuchet MS,sans-serif">' + t + '</text>';
  }
  function head(x, y, dir, col){
    col = col || INK; var a = 6.5, p;
    if(dir === 'r') p = [[x - a, y - a], [x, y], [x - a, y + a]];
    else if(dir === 'l') p = [[x + a, y - a], [x, y], [x + a, y + a]];
    else if(dir === 'u') p = [[x - a, y + a], [x, y], [x + a, y + a]];
    else p = [[x - a, y - a], [x, y], [x + a, y - a]];   /* 'd' */
    return '<path d="M' + f1(p[0][0]) + ' ' + f1(p[0][1]) + ' L' + f1(p[1][0]) + ' ' + f1(p[1][1])
      + ' L' + f1(p[2][0]) + ' ' + f1(p[2][1]) + '" fill="none" stroke="' + col
      + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function wrap(w, h, inner){
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" '
      + 'style="max-width:100%;height:auto;display:block;margin:0 auto">' + inner + '</svg>';
  }
  function seq(a, b, step){
    var out = [];
    for(var v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }

  /* ================= figures ================= */
  /* a horizontal number line.  vals: the tick values, evenly spaced.
     labels: which values to print.  marks: [{v, letter}] arrows above. */
  function figNumLine(vals, labels, marks){
    labels = labels || []; marks = marks || [];
    var n = vals.length, sp = Math.min(36, Math.round(460 / (n - 1))), M = 32, baseY = 96;
    var W = M * 2 + (n - 1) * sp, H = 150, pos = {};
    vals.forEach(function(v, i){ pos[v] = M + i * sp; });
    function X(v){ return pos[v]; }
    var s = seg(M - 16, baseY, W - M + 16, baseY, 2.4) + head(M - 16, baseY, 'l') + head(W - M + 16, baseY, 'r');
    vals.forEach(function(v, i){ var x = M + i * sp; s += seg(x, baseY - 7, x, baseY + 7, 2.2); });
    labels.forEach(function(v){ s += lbl(X(v), baseY + 26, String(v), INK, 16); });
    marks.forEach(function(mk){
      var x = X(mk.v);
      s += seg(x, baseY - 44, x, baseY - 13, 2.6, GIVEN) + head(x, baseY - 12, 'd', GIVEN)
        + lbl(x, baseY - 56, mk.letter, ASK, 18);
    });
    return wrap(W, H, s);
  }
  function lblOff(at){
    switch(at){
      case 'ur': return [13, -11]; case 'dl': return [-13, 15]; case 'dr': return [13, 15];
      case 'r': return [14, 4]; case 'l': return [-14, 4]; case 'd': return [0, 17]; case 'u': return [0, -15];
      default: return [-13, -11];   /* 'ul' */
    }
  }
  /* a coordinate grid.  R: half-range (axes run −R..R).
     pts:[{x,y,l,at}]  segs:[[x1,y1,x2,y2]]  arrow:[x1,y1,x2,y2] (dashed) */
  function figGrid(cfg){
    var R = cfg.R, c = cfg.cell || (R >= 6 ? 21 : R >= 5 ? 23 : 26);
    var ML = 24, MR = 20, MT = 16, MB = 24, span = 2 * R * c;
    var ox = ML + R * c, oy = MT + R * c, W = ML + span + MR, H = MT + span + MB, i;
    function X(g){ return ox + g * c; } function Y(g){ return oy - g * c; }
    var s = '';
    for(i = -R; i <= R; i++) s += seg(X(i), Y(R), X(i), Y(-R), 1, GRID) + seg(X(-R), Y(i), X(R), Y(i), 1, GRID);
    s += seg(X(-R) - 10, oy, X(R) + 10, oy, 2.2) + head(X(R) + 10, oy, 'r') + head(X(-R) - 10, oy, 'l');
    s += seg(ox, Y(-R) - 10, ox, Y(R) + 10, 2.2) + head(ox, Y(R) + 10, 'u') + head(ox, Y(-R) - 10, 'd');
    for(i = -R; i <= R; i++){
      if(i === 0) continue;
      s += lbl(X(i), oy + 13, String(i), LAB, 11) + lbl(ox - 12, Y(i), String(i), LAB, 11);
    }
    s += lbl(ox - 11, oy + 13, 'O', LAB, 12) + lbl(X(R) + 13, oy + 2, 'x', LAB, 13, true)
      + lbl(ox + 2, Y(R) + 11, 'y', LAB, 13, true);
    (cfg.segs || []).forEach(function(g){ s += seg(X(g[0]), Y(g[1]), X(g[2]), Y(g[3]), 2.4, INK); });
    if(cfg.arrow){
      var a = cfg.arrow;
      s += '<line x1="' + f1(X(a[0])) + '" y1="' + f1(Y(a[1])) + '" x2="' + f1(X(a[2])) + '" y2="' + f1(Y(a[3]))
        + '" stroke="' + GIVEN + '" stroke-width="2.2" stroke-dasharray="6 5"/>'
        + head(X(a[2]), Y(a[3]), a[2] > a[0] ? 'r' : a[2] < a[0] ? 'l' : a[3] > a[1] ? 'u' : 'd', GIVEN);
    }
    (cfg.pts || []).forEach(function(p){
      s += '<circle cx="' + f1(X(p.x)) + '" cy="' + f1(Y(p.y)) + '" r="5" fill="' + INK + '"/>';
      if(p.l){ var o = lblOff(p.at); s += lbl(X(p.x) + o[0], Y(p.y) + o[1], p.l, ASK, 16); }
    });
    return wrap(W, H, s);
  }

  /* ================= where each step lives in the textbook ================= */
  var BK = {
    line:  'Chapter 13 · Negative Numbers on a Number Line',
    scale: 'Chapter 13 · Reading Scales on a Number Line',
    coord: 'Chapter 13 · Reading Coordinates in Four Quadrants',
    rect:  'Chapter 13 · Shapes on the Coordinate Grid',
    trans: 'Chapter 13 · Translating Points and Shapes'
  };

  /* ================= question builders ================= */
  function qB(fig, prompt, blanks, note){ return {kind:'blanks', fig:fig, prompt:prompt, blanks:blanks, note:note || ''}; }
  function bl(pre, ans, post){ return {pre:pre, ans:ans, post:post === undefined ? '' : post}; }
  function co(pre, x, y){ return [bl(pre + ' (', x, ','), bl('', y, ')')]; }   /* a coordinate pair */
  function qC(fig, prompt, choices, note){ return {kind:'choice', fig:fig, prompt:prompt, choices:choices, note:note || ''}; }
  function pr(fig, prompt, key, space){ return {fig:fig, prompt:prompt, key:key, space:space || 'box'}; }
  function pt(x, y, l, at){ return {x:x, y:y, l:l, at:at}; }

  /* ================= the four ladders (paper question = level 4) ========= */
  var ITEMS = [

  /* ---------- paper question 1 : the number line ---------- */
  {key:'q1', n:1, name:'Number lines and integers', paper:4, top:6, levels:{
    1:{
      know:{title:'Reading a number line', book:BK.line,
        pts:['Each little mark on the line is one step.',
             'Start from a number you can see and count on to the arrow.'],
        fig:figNumLine(seq(0, 10, 1), [0, 5, 10], [{v:7, letter:'A'}]),
        worked:{text:'From 5, count on two marks: the arrow lands on 7.'}},
      hint:'Count the marks on from a number you know.',
      qs:[7, 3, 9].map(function(v){ return qB(figNumLine(seq(0, 10, 1), [0, 5, 10], [{v:v, letter:'A'}]),
        'What number is the arrow A pointing to?', [bl('A =', v)]); }),
      practice:[8, 2, 5].map(function(v){ return pr(figNumLine(seq(0, 10, 1), [0, 5, 10], [{v:v, letter:'A'}]),
        'What number is the arrow pointing to?', String(v)); })
    },
    2:{
      know:{title:'Negative numbers on the line', book:BK.line,
        pts:['Zero sits in the middle. Numbers to the LEFT of 0 are negative.',
             'The further left you go, the smaller the number: −5 is less than −1.'],
        fig:figNumLine(seq(-5, 5, 1), seq(-5, 5, 1), [{v:-3, letter:'A'}]),
        worked:{text:'The arrow is 3 steps left of 0, so A = −3.'}},
      hint:'Left of zero is negative. Count the steps from 0.',
      qs:[-3, -1, 4].map(function(v){ return qB(figNumLine(seq(-5, 5, 1), seq(-5, 5, 1), [{v:v, letter:'A'}]),
        'What number is the arrow A pointing to?', [bl('A =', v)]); }),
      practice:[-4, 2, -5].map(function(v){ return pr(figNumLine(seq(-5, 5, 1), seq(-5, 5, 1), [{v:v, letter:'A'}]),
        'What number is the arrow pointing to?', String(v)); })
    },
    3:{
      know:{title:'How far apart? The difference', book:BK.line,
        pts:['To find the difference, count the steps from one arrow to the other.',
             'It is the same as the bigger number take away the smaller one.'],
        fig:figNumLine(seq(0, 10, 1), [0, 5, 10], [{v:3, letter:'A'}, {v:8, letter:'B'}]),
        worked:{text:'From A at 3 to B at 8 is 5 steps: 8 − 3 = 5.'}},
      hint:'Count the steps from one arrow to the other.',
      qs:[
        qB(figNumLine(seq(0, 10, 1), [0, 5, 10], [{v:3, letter:'A'}, {v:8, letter:'B'}]),
           'How many steps is it from A to B?', [bl('Difference =', 5)]),
        qB(figNumLine(seq(0, 10, 1), [0, 5, 10], [{v:1, letter:'A'}, {v:7, letter:'B'}]),
           'How many steps is it from A to B?', [bl('Difference =', 6)]),
        qB(figNumLine(seq(-5, 5, 1), seq(-5, 5, 1), [{v:-2, letter:'A'}, {v:3, letter:'B'}]),
           'How many steps is it from A to B?', [bl('Difference =', 5)])
      ],
      practice:[
        pr(figNumLine(seq(0, 10, 1), [0, 5, 10], [{v:2, letter:'A'}, {v:6, letter:'B'}]), 'How far is it from A to B?', '4'),
        pr(figNumLine(seq(0, 10, 1), [0, 5, 10], [{v:2, letter:'A'}, {v:8, letter:'B'}]), 'How far is it from A to B?', '6'),
        pr(figNumLine(seq(-5, 5, 1), seq(-5, 5, 1), [{v:-3, letter:'A'}, {v:4, letter:'B'}]), 'How far is it from A to B?', '7')
      ]
    },
    4:{
      know:{title:'Reading and comparing on the line', book:BK.line,
        pts:['Find zero first, then count LEFT for negatives and RIGHT for positives.',
             'The difference between two values is how far apart they are: the bigger take away the smaller.'],
        fig:figNumLine(seq(-7, 7, 1), [-1, 0, 1], [{v:-7, letter:'A'}, {v:-3, letter:'B'}, {v:5, letter:'C'}]),
        worked:{text:'A = −7 and C = 5, so the difference is 5 − (−7) = 12.'}},
      hint:'Count from 0 for each value; the difference is the bigger take away the smaller.',
      qs:[
        qB(figNumLine(seq(-7, 7, 1), [-1, 0, 1], [{v:-7, letter:'A'}, {v:-3, letter:'B'}, {v:5, letter:'C'}]),
           'Find the values of A, B and C, then the two differences.',
           [bl('A =', -7), bl('B =', -3), bl('C =', 5), bl('A to C =', 12), bl('A to B =', 4)], 'paper'),
        qB(figNumLine(seq(-7, 7, 1), [-1, 0, 1], [{v:-6, letter:'A'}, {v:-2, letter:'B'}, {v:4, letter:'C'}]),
           'Find the values of A, B and C, then the two differences.',
           [bl('A =', -6), bl('B =', -2), bl('C =', 4), bl('A to C =', 10), bl('A to B =', 4)]),
        qB(figNumLine(seq(-7, 7, 1), [-1, 0, 1], [{v:-5, letter:'A'}, {v:2, letter:'B'}, {v:6, letter:'C'}]),
           'Find the values of A, B and C, then the two differences.',
           [bl('A =', -5), bl('B =', 2), bl('C =', 6), bl('A to C =', 11), bl('A to B =', 7)])
      ],
      practice:[
        pr(figNumLine(seq(-7, 7, 1), [-1, 0, 1], [{v:-4, letter:'A'}, {v:-1, letter:'B'}, {v:5, letter:'C'}]),
           'Find A, B and C, then the difference A to C and A to B.', 'A=−4, B=−1, C=5; A→C=9, A→B=3'),
        pr(figNumLine(seq(-7, 7, 1), [-1, 0, 1], [{v:-6, letter:'A'}, {v:1, letter:'B'}, {v:5, letter:'C'}]),
           'Find A, B and C, then the difference A to C and A to B.', 'A=−6, B=1, C=5; A→C=11, A→B=7'),
        pr(figNumLine(seq(-7, 7, 1), [-1, 0, 1], [{v:-3, letter:'A'}, {v:-1, letter:'B'}, {v:4, letter:'C'}]),
           'Find A, B and C, then the difference A to C and A to B.', 'A=−3, B=−1, C=4; A→C=7, A→B=2')
      ]
    },
    5:{
      know:{title:'When each step is worth more than 1', book:BK.scale,
        pts:['Check the scale first: see how much the numbers climb between two labels.',
             'Here every small step is worth 2, so count on in twos.'],
        fig:figNumLine(seq(0, 20, 2), [0, 10, 20], [{v:14, letter:'A'}]),
        worked:{text:'From the 10, two steps of 2 land the arrow on 14.'}},
      hint:'One small step is worth 2 — count on in twos.',
      qs:[
        qB(figNumLine(seq(0, 20, 2), [0, 10, 20], [{v:14, letter:'A'}]),
           'Every step is worth 2. What number is A?', [bl('A =', 14)]),
        qB(figNumLine(seq(0, 20, 2), [0, 10, 20], [{v:6, letter:'A'}]),
           'Every step is worth 2. What number is A?', [bl('A =', 6)]),
        qB(figNumLine(seq(0, 20, 2), [0, 10, 20], [{v:6, letter:'A'}, {v:16, letter:'B'}]),
           'Every step is worth 2. How far is it from A to B?', [bl('Difference =', 10)])
      ],
      practice:[
        pr(figNumLine(seq(0, 20, 2), [0, 10, 20], [{v:12, letter:'A'}]), 'Each step is worth 2. What number is A?', '12'),
        pr(figNumLine(seq(0, 20, 2), [0, 10, 20], [{v:18, letter:'A'}]), 'Each step is worth 2. What number is A?', '18'),
        pr(figNumLine(seq(0, 20, 2), [0, 10, 20], [{v:4, letter:'A'}, {v:12, letter:'B'}]), 'Each step is worth 2. How far is A to B?', '8')
      ]
    },
    6:{
      know:{title:'Steps smaller than 1, and below zero', book:BK.scale,
        pts:['The scale can climb in halves — two small steps make one whole.',
             'Below zero the same scale keeps going: −0.5, −1, −1.5, …'],
        fig:figNumLine(seq(0, 3, 0.5), [0, 1, 2, 3], [{v:2.5, letter:'A'}]),
        worked:{text:'Halfway between 2 and 3 is 2.5.'}},
      hint:'Each step is a half (0.5). Count carefully across zero.',
      qs:[
        qB(figNumLine(seq(0, 3, 0.5), [0, 1, 2, 3], [{v:2.5, letter:'A'}]),
           'Every step is worth a half. What number is A?', [bl('A =', 2.5)]),
        qB(figNumLine(seq(0, 3, 0.5), [0, 1, 2, 3], [{v:1.5, letter:'A'}]),
           'Every step is worth a half. What number is A?', [bl('A =', 1.5)]),
        qB(figNumLine(seq(-2, 2, 0.5), [-2, -1, 0, 1, 2], [{v:-1.5, letter:'A'}]),
           'Every step is worth a half. What number is A?', [bl('A =', -1.5)])
      ],
      practice:[
        pr(figNumLine(seq(0, 3, 0.5), [0, 1, 2, 3], [{v:0.5, letter:'A'}]), 'Each step is a half. What number is A?', '0.5'),
        pr(figNumLine(seq(0, 3, 0.5), [0, 1, 2, 3], [{v:2.5, letter:'A'}]), 'Each step is a half. What number is A?', '2.5'),
        pr(figNumLine(seq(-2, 2, 0.5), [-2, -1, 0, 1, 2], [{v:-0.5, letter:'A'}]), 'Each step is a half. What number is A?', '-0.5')
      ]
    }
  }},

  /* ---------- paper question 2 : reading coordinates ---------- */
  {key:'q2', n:2, name:'Reading coordinates', paper:4, top:6, levels:{
    1:{
      know:{title:'How far across', book:BK.coord,
        pts:['The first number of a coordinate is how far ACROSS (the x-direction).',
             'Start at O in the middle and count along the bottom axis.'],
        fig:figGrid({R:5, pts:[pt(3, 2, 'P', 'ur')]}),
        worked:{text:'This point is 3 across, so its first number is 3.'}},
      hint:'Count across the bottom from O to under the point.',
      qs:[[3, 2], [5, 1], [2, 4]].map(function(p){ return qB(figGrid({R:5, pts:[pt(p[0], p[1], 'P', 'ur')]}),
        'How far across is point P? (its first number)', [bl('Across =', p[0])]); }),
      practice:[[4, 3], [1, 5], [3, 3]].map(function(p){ return pr(figGrid({R:5, pts:[pt(p[0], p[1], 'P', 'ur')]}),
        'How far across is point P?', String(p[0])); })
    },
    2:{
      know:{title:'Writing a coordinate: (across, up)', book:BK.coord,
        pts:['A coordinate is two numbers in brackets: (across, up).',
             'Always count ACROSS first, then UP.'],
        fig:figGrid({R:5, pts:[pt(3, 2, 'P', 'ur')]}),
        worked:{text:'3 across and 2 up is written (3, 2).'}},
      hint:'(across, up) — count across first, then up.',
      qs:[[2, 3], [4, 1], [1, 5]].map(function(p){ return qB(figGrid({R:5, pts:[pt(p[0], p[1], 'P', 'ur')]}),
        'Write the coordinates of point P.', co('P =', p[0], p[1])); }),
      practice:[[3, 4], [5, 2], [2, 2]].map(function(p){ return pr(figGrid({R:5, pts:[pt(p[0], p[1], 'P', 'ur')]}),
        'Write the coordinates of P.', '(' + p[0] + ', ' + p[1] + ')'); })
    },
    3:{
      know:{title:'On the axes, and to the left', book:BK.coord,
        pts:['On the up-axis the across number is 0; on the across-axis the up number is 0.',
             'Left of 0 the across number is negative.'],
        fig:figGrid({R:5, pts:[pt(-2, 3, 'P', 'ur')]}),
        worked:{text:'2 left and 3 up is (−2, 3).'}},
      hint:'Left of O makes the first number negative.',
      qs:[[-2, 3], [0, 4], [-4, 2]].map(function(p){ return qB(figGrid({R:5, pts:[pt(p[0], p[1], 'P', 'ur')]}),
        'Write the coordinates of point P.', co('P =', p[0], p[1])); }),
      practice:[[-3, 1], [3, 0], [-1, 4]].map(function(p){ return pr(figGrid({R:5, pts:[pt(p[0], p[1], 'P', 'ur')]}),
        'Write the coordinates of P.', '(' + p[0] + ', ' + p[1] + ')'); })
    },
    4:(function(){
      function four(list){
        var pts = list.map(function(p){ return pt(p[1], p[2], p[0], p[3]); });
        var bs = []; list.forEach(function(p){ bs = bs.concat(co(p[0] + ' =', p[1], p[2])); });
        return {pts:pts, bs:bs};
      }
      var A = four([['F', -2, 3, 'ur'], ['G', 2, 1, 'ur'], ['H', -3, -2, 'ul'], ['I', 3, -3, 'dr']]);
      var B = four([['F', -4, 2, 'ur'], ['G', 1, 4, 'ur'], ['H', -1, -3, 'ul'], ['I', 3, -1, 'dr']]);
      var C = four([['F', -3, 4, 'ur'], ['G', 4, 3, 'ur'], ['H', -2, -4, 'ul'], ['I', 2, -2, 'dr']]);
      return {
        know:{title:'Coordinates in all four parts of the grid', book:BK.coord,
          pts:['Across can be negative (left) and up can be negative (down).',
               'Read across first (right +, left −), then up (up +, down −).'],
          fig:figGrid({R:4, pts:A.pts}),
          worked:{text:'H is 3 left and 2 down, so H = (−3, −2).'}},
        hint:'Across first (left is −), then up (down is −).',
        qs:[
          qB(figGrid({R:4, pts:A.pts}), 'Write the coordinates of F, G, H and I.', A.bs, 'paper'),
          qB(figGrid({R:4, pts:B.pts}), 'Write the coordinates of F, G, H and I.', B.bs),
          qB(figGrid({R:4, pts:C.pts}), 'Write the coordinates of F, G, H and I.', C.bs)
        ],
        practice:[[-2, -3, 'ul'], [3, -2, 'dr'], [-4, 1, 'ur']].map(function(p){
          return pr(figGrid({R:4, pts:[pt(p[0], p[1], 'P', p[2])]}), 'Write the coordinates of P.',
            '(' + p[0] + ', ' + p[1] + ')'); })
      };
    })(),
    5:(function(){
      var pts = [pt(-3, 2, 'P', 'ul'), pt(2, -3, 'Q', 'dr'), pt(3, 1, 'R', 'ur'), pt(-2, -2, 'S', 'dl')];
      var fig = figGrid({R:4, pts:pts});
      return {
        know:{title:'Finding the point from its coordinates', book:BK.coord,
          pts:['To place a coordinate, go across first, then up.',
               'The point further LEFT has the smaller across-number; the point higher UP has the bigger up-number.'],
          fig:fig,
          worked:{text:'(2, −3): go 2 right, then 3 down — that is point Q.'}},
        hint:'Go across first, then up. Left is smaller; up is bigger.',
        qs:[
          qC(fig, 'Which point is at (2, −3)?',
             [{t:'Point P'}, {t:'Point Q', ok:true}, {t:'Point R'}, {t:'Point S'}], 'paper'),
          qC(fig, 'Which point is at (−2, −2)?',
             [{t:'Point P'}, {t:'Point Q'}, {t:'Point R'}, {t:'Point S', ok:true}]),
          qC(fig, 'Which point is the highest up?',
             [{t:'Point P', ok:true}, {t:'Point Q'}, {t:'Point R'}, {t:'Point S'}])
        ],
        practice:[
          pr(fig, 'Which point is at (3, 1)?', 'R'),
          pr(fig, 'Which point is at (−3, 2)?', 'P'),
          pr(fig, 'Which point is the furthest to the left?', 'P')
        ]
      };
    })(),
    6:{
      know:{title:'Using coordinates to measure', book:BK.coord,
        pts:['Two points on the same level (same up-number): the distance is the difference of the across-numbers.',
             'Two points in the same column (same across-number): use the difference of the up-numbers.'],
        fig:figGrid({R:6, pts:[pt(-2, 3, 'A', 'ul'), pt(4, 3, 'B', 'ur')], segs:[[-2, 3, 4, 3]]}),
        worked:{text:'A(−2, 3) and B(4, 3) are level, so AB = 4 − (−2) = 6.'}},
      hint:'Same level? Subtract the across-numbers. Same column? Subtract the up-numbers.',
      qs:[
        qB(figGrid({R:6, pts:[pt(-2, 3, 'A', 'ul'), pt(4, 3, 'B', 'ur')], segs:[[-2, 3, 4, 3]]}),
           'A and B are on the same level. How long is AB?', [bl('AB =', 6)], 'paper'),
        qB(figGrid({R:6, pts:[pt(2, -3, 'A', 'dr'), pt(2, 4, 'B', 'ur')], segs:[[2, -3, 2, 4]]}),
           'A and B are in the same column. How long is AB?', [bl('AB =', 7)]),
        qB(figGrid({R:6, pts:[pt(-4, -1, 'A', 'dl'), pt(3, -1, 'B', 'dr')], segs:[[-4, -1, 3, -1]]}),
           'A and B are on the same level. How long is AB?', [bl('AB =', 7)])
      ],
      practice:[
        pr(figGrid({R:6, pts:[pt(-1, 2, 'A', 'ul'), pt(5, 2, 'B', 'ur')], segs:[[-1, 2, 5, 2]]}), 'How long is AB?', '6'),
        pr(figGrid({R:6, pts:[pt(3, -5, 'A', 'dr'), pt(3, 1, 'B', 'ur')], segs:[[3, -5, 3, 1]]}), 'How long is AB?', '6'),
        pr(figGrid({R:6, pts:[pt(-3, -2, 'A', 'dl'), pt(4, -2, 'B', 'dr')], segs:[[-3, -2, 4, -2]]}), 'How long is AB?', '7')
      ]
    }
  }},

  /* ---------- paper question 3 : coordinates & rectangles ---------- */
  {key:'q3', n:3, name:'Coordinates and rectangles', paper:4, top:6, levels:{
    1:{
      know:{title:'Reading a coordinate', book:BK.coord,
        pts:['A coordinate is (across, up).', 'Count across first, then up.'],
        fig:figGrid({R:5, pts:[pt(3, 2, 'P', 'ur')]}),
        worked:{text:'3 across, 2 up is (3, 2).'}},
      hint:'(across, up) — across first.',
      qs:[[3, 2], [1, 4], [4, 4]].map(function(p){ return qB(figGrid({R:5, pts:[pt(p[0], p[1], 'P', 'ur')]}),
        'Write the coordinates of point P.', co('P =', p[0], p[1])); }),
      practice:[[2, 5], [5, 3], [3, 1]].map(function(p){ return pr(figGrid({R:5, pts:[pt(p[0], p[1], 'P', 'ur')]}),
        'Write the coordinates of P.', '(' + p[0] + ', ' + p[1] + ')'); })
    },
    2:{
      know:{title:'Coordinates with negatives', book:BK.coord,
        pts:['Left of O the across-number is negative.', 'Below O the up-number is negative.'],
        fig:figGrid({R:5, pts:[pt(-2, 3, 'P', 'ur')]}),
        worked:{text:'2 left and 3 up is (−2, 3).'}},
      hint:'Left is −; down is −.',
      qs:[[-2, 3], [3, -1], [-4, -2]].map(function(p){ return qB(figGrid({R:5, pts:[pt(p[0], p[1], 'P', p[1] < 0 ? 'dr' : 'ur')]}),
        'Write the coordinates of point P.', co('P =', p[0], p[1])); }),
      practice:[[-1, 2], [2, -3], [-3, -1]].map(function(p){ return pr(figGrid({R:5, pts:[pt(p[0], p[1], 'P', 'ur')]}),
        'Write the coordinates of P.', '(' + p[0] + ', ' + p[1] + ')'); })
    },
    3:(function(){
      /* three corners of an axis-aligned rectangle, given in order; find the 4th */
      function fig(c){ return figGrid({R:5, pts:[pt(c[0][0], c[0][1], '', 0), pt(c[1][0], c[1][1], '', 0), pt(c[2][0], c[2][1], '', 0)],
        segs:[[c[0][0], c[0][1], c[1][0], c[1][1]], [c[1][0], c[1][1], c[2][0], c[2][1]]]}); }
      var Q = [
        {c:[[1, 1], [5, 1], [5, 3]], ans:[1, 3]},
        {c:[[-2, 1], [3, 1], [3, 4]], ans:[-2, 4]},
        {c:[[-3, -1], [-3, 2], [2, 2]], ans:[2, -1]}
      ];
      return {
        know:{title:'The fourth corner of a rectangle', book:BK.rect,
          pts:['A rectangle has square corners, so its sides are level or upright.',
               'Two corners share an across-number; two share an up-number. Match them up to find the last corner.'],
          fig:fig(Q[0].c),
          worked:{text:'Corners (1,1), (5,1) and (5,3): the fourth is (1, 3).'}},
        hint:'The fourth corner lines up under one corner and across from another.',
        qs:Q.map(function(q){ return qB(fig(q.c), 'Three corners of a rectangle are shown. Find the fourth corner.',
          co('4th corner =', q.ans[0], q.ans[1])); }),
        practice:Q.map(function(q){ return pr(fig(q.c), 'Find the fourth corner of the rectangle.',
          '(' + q.ans[0] + ', ' + q.ans[1] + ')'); })
      };
    })(),
    4:(function(){
      function fig(a, cc){ return figGrid({R:6, pts:[pt(a[0], a[1], 'A', 'ur'), pt(cc[0], cc[1], 'C', 'dr')]}); }
      var Q = [
        {a:[2, 4], c:[5, -2], B:[5, 4], D:[2, -2]},
        {a:[-3, 2], c:[1, -1], B:[1, 2], D:[-3, -1]},
        {a:[-2, -3], c:[3, 1], B:[3, -3], D:[-2, 1]}
      ];
      return {
        know:{title:'From a diagonal to the missing corners', book:BK.rect,
          pts:['A and C are opposite corners — a diagonal apart.',
               'B shares A\'s up-number and C\'s across-number; D shares A\'s across-number and C\'s up-number.'],
          fig:fig(Q[0].a, Q[0].c),
          worked:{text:'A(2,4) and C(5,−2): B = (5, 4) and D = (2, −2).'}},
        hint:'B takes C\'s across and A\'s up; D takes A\'s across and C\'s up.',
        qs:Q.map(function(q, i){ return qB(fig(q.a, q.c),
          'ABCD is a rectangle. A and C are opposite corners. Find corners B and D.',
          co('B =', q.B[0], q.B[1]).concat(co('D =', q.D[0], q.D[1])), i === 0 ? 'paper' : ''); }),
        practice:[
          {a:[1, 3], c:[4, -1], B:[4, 3], D:[1, -1]},
          {a:[-4, 2], c:[0, -2], B:[0, 2], D:[-4, -2]},
          {a:[-1, 4], c:[3, 1], B:[3, 4], D:[-1, 1]}
        ].map(function(q){ return pr(fig(q.a, q.c), 'A and C are opposite corners of rectangle ABCD. Find B and D.',
          'B=(' + q.B[0] + ', ' + q.B[1] + '), D=(' + q.D[0] + ', ' + q.D[1] + ')'); })
      };
    })(),
    5:(function(){
      function fig(a, cc){ return figGrid({R:6, pts:[pt(a[0], a[1], 'A', 'ur'), pt(cc[0], cc[1], 'C', 'dr')]}); }
      function mk(a, cc){ var w = Math.abs(cc[0] - a[0]), h = Math.abs(a[1] - cc[1]);
        return {a:a, c:cc, B:[cc[0], a[1]], D:[a[0], cc[1]], w:w, h:h}; }
      var Q = [mk([1, 3], [6, -1]), mk([-4, 2], [2, -3]), mk([-1, 4], [4, 0])];
      return {
        know:{title:'The missing corners and the side lengths', book:BK.rect,
          pts:['Find B and D as before.',
               'The width is the difference of the across-numbers; the height is the difference of the up-numbers.'],
          fig:fig(Q[0].a, Q[0].c),
          worked:{text:'A(1,3), C(6,−1): width = 6 − 1 = 5, height = 3 − (−1) = 4.'}},
        hint:'Width = across difference, height = up difference.',
        qs:Q.map(function(q){ return qB(fig(q.a, q.c),
          'A and C are opposite corners of rectangle ABCD. Find B, D and the side lengths.',
          co('B =', q.B[0], q.B[1]).concat(co('D =', q.D[0], q.D[1]))
            .concat([bl('width =', q.w), bl('height =', q.h)])); }),
        practice:Q.map(function(q){ return pr(fig(q.a, q.c), 'Find B, D, the width and the height.',
          'B=(' + q.B[0] + ', ' + q.B[1] + '), D=(' + q.D[0] + ', ' + q.D[1] + '), w=' + q.w + ', h=' + q.h); })
      };
    })(),
    6:(function(){
      function fig(a, cc){ return figGrid({R:6, pts:[pt(a[0], a[1], 'A', 'ur'), pt(cc[0], cc[1], 'C', 'dr')]}); }
      function mk(a, cc){ var w = Math.abs(cc[0] - a[0]), h = Math.abs(a[1] - cc[1]);
        return {a:a, c:cc, B:[cc[0], a[1]], D:[a[0], cc[1]], area:w * h}; }
      var Q = [mk([2, 4], [5, -2]), mk([-3, 3], [1, -2]), mk([-2, -3], [4, 1])];
      return {
        know:{title:'The area inside the rectangle', book:BK.rect,
          pts:['Find the width and height from the corners.',
               'Area = width × height (in square units).'],
          fig:fig(Q[0].a, Q[0].c),
          worked:{text:'A(2,4), C(5,−2): width 3 × height 6 = 18 square units.'}},
        hint:'Area = width × height.',
        qs:Q.map(function(q){ return qB(fig(q.a, q.c),
          'A and C are opposite corners of rectangle ABCD. Find B, D and the area inside.',
          co('B =', q.B[0], q.B[1]).concat(co('D =', q.D[0], q.D[1]))
            .concat([bl('Area =', q.area, 'sq units')])); }),
        practice:Q.map(function(q){ return pr(fig(q.a, q.c), 'Find B, D and the area of the rectangle.',
          'B=(' + q.B[0] + ', ' + q.B[1] + '), D=(' + q.D[0] + ', ' + q.D[1] + '), area=' + q.area); })
      };
    })()
  }},

  /* ---------- paper question 4 : translation ---------- */
  {key:'q4', n:4, name:'Translating shapes', paper:4, top:6, levels:{
    1:{
      know:{title:'Reading a coordinate', book:BK.coord,
        pts:['A coordinate is (across, up).', 'Left is negative across; down is negative up.'],
        fig:figGrid({R:5, pts:[pt(-2, 3, 'P', 'ur')]}),
        worked:{text:'2 left and 3 up is (−2, 3).'}},
      hint:'(across, up) — left is −, down is −.',
      qs:[[-2, 3], [3, 2], [-1, -4]].map(function(p){ return qB(figGrid({R:5, pts:[pt(p[0], p[1], 'P', p[1] < 0 ? 'dr' : 'ur')]}),
        'Write the coordinates of point P.', co('P =', p[0], p[1])); }),
      practice:[[-3, 2], [4, -1], [-2, -3]].map(function(p){ return pr(figGrid({R:5, pts:[pt(p[0], p[1], 'P', 'ur')]}),
        'Write the coordinates of P.', '(' + p[0] + ', ' + p[1] + ')'); })
    },
    2:{
      know:{title:'Sliding a point across', book:BK.trans,
        pts:['Moving RIGHT makes the across-number bigger; moving LEFT makes it smaller.',
             'The up-number does not change.'],
        fig:figGrid({R:6, pts:[pt(2, 3, 'P', 'ul')], arrow:[2, 3, 6, 3]}),
        worked:{text:'(2, 3) moved 4 right becomes (6, 3).'}},
      hint:'Only the across-number changes. Right +, left −.',
      qs:[
        qB(figGrid({R:6, pts:[pt(1, 2, 'P', 'ul')]}), 'Move point P 4 units to the RIGHT. Where does it land?', co('New point =', 5, 2)),
        qB(figGrid({R:6, pts:[pt(-2, 3, 'P', 'ul')]}), 'Move point P 3 units to the RIGHT. Where does it land?', co('New point =', 1, 3)),
        qB(figGrid({R:6, pts:[pt(3, -1, 'P', 'dr')]}), 'Move point P 5 units to the LEFT. Where does it land?', co('New point =', -2, -1))
      ],
      practice:[
        pr(figGrid({R:6, pts:[pt(0, 1, 'P', 'ul')]}), 'Move P 3 units right. New coordinates?', '(3, 1)'),
        pr(figGrid({R:6, pts:[pt(-3, 2, 'P', 'ul')]}), 'Move P 5 units right. New coordinates?', '(2, 2)'),
        pr(figGrid({R:6, pts:[pt(4, -2, 'P', 'dr')]}), 'Move P 6 units left. New coordinates?', '(-2, -2)')
      ]
    },
    3:{
      know:{title:'Sliding a point up or down', book:BK.trans,
        pts:['Moving UP makes the up-number bigger; moving DOWN makes it smaller.',
             'The across-number does not change.'],
        fig:figGrid({R:6, pts:[pt(2, 1, 'P', 'ur')], arrow:[2, 1, 2, -2]}),
        worked:{text:'(2, 1) moved 3 down becomes (2, −2).'}},
      hint:'Only the up-number changes. Up +, down −.',
      qs:[
        qB(figGrid({R:6, pts:[pt(2, 1, 'P', 'ur')]}), 'Move point P 3 units DOWN. Where does it land?', co('New point =', 2, -2)),
        qB(figGrid({R:6, pts:[pt(-1, -2, 'P', 'dl')]}), 'Move point P 4 units UP. Where does it land?', co('New point =', -1, 2)),
        qB(figGrid({R:6, pts:[pt(3, 2, 'P', 'ur')]}), 'Move point P 5 units DOWN. Where does it land?', co('New point =', 3, -3))
      ],
      practice:[
        pr(figGrid({R:6, pts:[pt(1, 2, 'P', 'ur')]}), 'Move P 4 units down. New coordinates?', '(1, -2)'),
        pr(figGrid({R:6, pts:[pt(-2, -1, 'P', 'dl')]}), 'Move P 3 units up. New coordinates?', '(-2, 2)'),
        pr(figGrid({R:6, pts:[pt(4, 1, 'P', 'ur')]}), 'Move P 5 units down. New coordinates?', '(4, -4)')
      ]
    },
    4:(function(){
      function fig(e, f, g){ return figGrid({R:6, pts:[pt(e[0], e[1], 'E', 'ur'), pt(f[0], f[1], 'F', 'dr'), pt(g[0], g[1], 'G', 'dl')],
        segs:[[e[0], e[1], f[0], f[1]], [f[0], f[1], g[0], g[1]], [g[0], g[1], e[0], e[1]]]}); }
      function tr(p, dx, dy){ return [p[0] + dx, p[1] + dy]; }
      var Q = [
        {e:[-3, 6], f:[-2, 2], g:[-5, 1], dx:5, dy:-4, w:'5 units to the right and 4 units down'},
        {e:[-4, 5], f:[-1, 3], g:[-3, -1], dx:4, dy:-2, w:'4 units to the right and 2 units down'},
        {e:[-2, 4], f:[1, 1], g:[-3, -2], dx:3, dy:-3, w:'3 units to the right and 3 units down'}
      ];
      return {
        know:{title:'Sliding across and up/down together', book:BK.trans,
          pts:['Do the across move and the up/down move one at a time.',
               '5 right and 4 down: add 5 to the across-number, take 4 off the up-number.'],
          fig:fig(Q[0].e, Q[0].f, Q[0].g),
          worked:{text:'E(−3, 6) moved 5 right, 4 down lands on (2, 2).'}},
        hint:'Change the across-number, then the up-number, one step at a time.',
        qs:Q.map(function(q, i){
          var e2 = tr(q.e, q.dx, q.dy), f2 = tr(q.f, q.dx, q.dy), g2 = tr(q.g, q.dx, q.dy);
          return qB(fig(q.e, q.f, q.g),
            'Triangle EFG is translated ' + q.w + '. Find the new coordinates of E, F and G.',
            co('E →', e2[0], e2[1]).concat(co('F →', f2[0], f2[1])).concat(co('G →', g2[0], g2[1])),
            i === 0 ? 'paper' : '');
        }),
        practice:[
          {p:[-4, 5], k:'(1, 1)'}, {p:[-1, 2], k:'(4, -2)'}, {p:[0, 3], k:'(5, -1)'}
        ].map(function(o){ return pr(figGrid({R:6, pts:[pt(o.p[0], o.p[1], 'P', 'ur')]}),
          'Translate the point 5 right and 4 down. New coordinates?', o.k); })
      };
    })(),
    5:{
      know:{title:'Sliding left and up', book:BK.trans,
        pts:['LEFT takes away from the across-number; UP adds to the up-number.',
             'Watch the signs carefully when the numbers are already negative.'],
        fig:figGrid({R:6, pts:[pt(-1, 2, 'P', 'ur')], arrow:[-1, 2, -4, 4]}),
        worked:{text:'(−1, 2) moved 3 left and 2 up becomes (−4, 4).'}},
      hint:'Left − across, up + up. Take the moves one at a time.',
      qs:[
        qB(figGrid({R:6, pts:[pt(2, -1, 'P', 'dr')]}), 'Move point P 4 units LEFT and 3 units UP. Where does it land?', co('New point =', -2, 2)),
        qB(figGrid({R:6, pts:[pt(-2, 3, 'P', 'ur')]}), 'Move point P 3 units LEFT and 4 units DOWN. Where does it land?', co('New point =', -5, -1)),
        qB(figGrid({R:6, pts:[pt(1, -3, 'P', 'dr')]}), 'Move point P 5 units LEFT and 5 units UP. Where does it land?', co('New point =', -4, 2))
      ],
      practice:[
        pr(figGrid({R:6, pts:[pt(3, 0, 'P', 'ur')]}), 'Move P 4 left and 2 up. New coordinates?', '(-1, 2)'),
        pr(figGrid({R:6, pts:[pt(-1, -1, 'P', 'dl')]}), 'Move P 3 left and 3 up. New coordinates?', '(-4, 2)'),
        pr(figGrid({R:6, pts:[pt(2, 2, 'P', 'ur')]}), 'Move P 5 left and 4 down. New coordinates?', '(-3, -2)')
      ]
    },
    6:{
      know:{title:'Describing a translation', book:BK.trans,
        pts:['Compare the two across-numbers: the change tells you right (+) or left (−).',
             'Compare the two up-numbers: the change tells you up (+) or down (−).'],
        fig:figGrid({R:6, pts:[pt(-1, 2, 'A', 'ul'), pt(4, -1, 'B', 'dr')], arrow:[-1, 2, 4, -1]}),
        worked:{text:'A(−1, 2) to B(4, −1): 4 − (−1) = 5 right, and −1 − 2 = 3 down.'}},
      hint:'Across change = B across − A across. Up change = B up − A up. Right/up are +.',
      qs:[
        qB(figGrid({R:6, pts:[pt(-1, 2, 'A', 'ul'), pt(4, -1, 'B', 'dr')], arrow:[-1, 2, 4, -1]}),
           'A slides to B. Right is +, left is −; up is +, down is −. Find the across change and the up change.',
           [bl('Across change =', 5), bl('Up change =', -3)], 'paper'),
        qB(figGrid({R:6, pts:[pt(3, -2, 'A', 'dr'), pt(-1, 1, 'B', 'ul')], arrow:[3, -2, -1, 1]}),
           'A slides to B. Right is +, left is −; up is +, down is −. Find the across change and the up change.',
           [bl('Across change =', -4), bl('Up change =', 3)]),
        qB(figGrid({R:6, pts:[pt(-3, -1, 'A', 'dl'), pt(2, -4, 'B', 'dr')], arrow:[-3, -1, 2, -4]}),
           'A slides to B. Right is +, left is −; up is +, down is −. Find the across change and the up change.',
           [bl('Across change =', 5), bl('Up change =', -3)])
      ],
      practice:[
        pr(figGrid({R:6, pts:[pt(-2, 1, 'A', 'ul'), pt(2, 4, 'B', 'ur')], arrow:[-2, 1, 2, 4]}),
           'A slides to B. Describe it: across change (+ right) and up change (+ up).', 'across +4, up +3'),
        pr(figGrid({R:6, pts:[pt(4, 2, 'A', 'ur'), pt(-1, 2, 'B', 'ul')], arrow:[4, 2, -1, 2]}),
           'A slides to B. Describe it: across change (+ right) and up change (+ up).', 'across -5, up 0'),
        pr(figGrid({R:6, pts:[pt(0, -3, 'A', 'dl'), pt(3, 2, 'B', 'ur')], arrow:[0, -3, 3, 2]}),
           'A slides to B. Describe it: across change (+ right) and up change (+ up).', 'across +3, up +5')
      ]
    }
  }}];

  /* ================= answers ================= */
  function numOK(raw, ans){
    if(raw === null || raw === undefined) return false;
    var s = String(raw).toLowerCase().replace(/[^0-9.\-]/g, '');
    if(!s || s === '-' || s === '.') return false;
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
    return {key:it.key, lv:it.paper, used:0, r:0, w:0, done:false,
            lock:null, floor:false, passed:null, failed:null, path:[]};
  }
  function questionFor(it, st){
    return it.levels[st.lv].qs[st.used];
  }
  /* Start at the paper level.  ONE right answer earns the level and sends the
     student UP to a harder one (until the top is reached).  Two wrong answers
     step DOWN to an easier one.  When a passed level meets a failed level, that
     is the student's ceiling and the run for this question stops.
     Returns 'up', 'drop', 'next' or 'lock'. */
  function markAnswer(it, st, ok){
    st.path.push([st.lv, ok ? 1 : 0]);
    if(ok){
      st.r++;
      st.passed = st.lv;
      if(st.failed !== null){ st.done = true; st.lock = st.lv; return 'lock'; }   /* found the ceiling */
      if(st.lv < it.top){ st.lv++; st.used = 0; st.r = 0; st.w = 0; return 'up'; }  /* climb to a harder one */
      st.done = true; st.lock = it.top; return 'lock';                             /* topped out */
    }
    st.w++;
    if(st.w >= 2){
      st.failed = st.lv;
      if(st.passed !== null){ st.done = true; st.lock = st.passed; return 'lock'; } /* ceiling found */
      if(st.lv > 1){ st.lv--; st.used = 0; st.r = 0; st.w = 0; return 'drop'; }      /* step down */
      st.done = true; st.lock = 0; st.floor = true; return 'lock';                  /* even level 1 too hard */
    }
    st.used++;
    return 'next';
  }
  /* which building blocks a student still needs to reach the paper standard.
     A student who reached the paper level (or higher) needs nothing — the
     harder levels were their reward on screen, not homework. */
  function neededLevels(it, res){
    if(!res.floor && res.lock >= it.paper) return [];
    var from = res.floor ? 1 : res.lock + 1, out = [];
    for(var l = from; l <= it.paper; l++) out.push({lv:l, title:it.levels[l].know.title});
    return out;
  }

  /* ================= the printable helper sheet =================
     ONE A4 sheet per student: each missing building block on its own page,
     with two practice problems, and a teacher answer key at the end. */
  function escT(s){
    return String(s).replace(/[&<>]/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;'}[c]; });
  }
  function worksheetHTML(stu, results){
    var partNo = 0, solid = [], body = '', keyRows = [];
    ITEMS.forEach(function(it){
      var r = results[it.key];
      if(!r) return;
      if(!r.floor && r.lock >= it.paper){ solid.push('Q' + it.n); return; }
      var need = neededLevels(it, r);
      body += '<div class="qstrip"><b>Question ' + it.n + '</b> · ' + escT(it.name)
        + '<span class="qs2">reached level ' + (r.floor ? '0' : r.lock) + ' of ' + it.top + '</span></div>';
      need.forEach(function(nd){
        partNo++;
        var lvd = it.levels[nd.lv], k = lvd.know;
        var practice = lvd.practice.slice(0, 2);
        body += '<section class="part">';
        body += '<h2><span class="pn">Part ' + partNo + '</span> ' + escT(k.title) + '</h2>';
        if(k.book) body += '<div class="book">📖 ' + escT(k.book) + '</div>';
        body += '<div class="know"><ul>' + k.pts.map(function(p){ return '<li>' + escT(p) + '</li>'; }).join('') + '</ul>';
        if(k.fig) body += '<div class="kfig">' + k.fig + '</div>';
        if(k.worked) body += '<div class="worked"><b>Worked example.</b> ' + escT(k.worked.text) + '</div>';
        body += '</div>';
        body += '<ol class="practice">' + practice.map(function(p){
          return '<li><div class="pq">' + escT(p.prompt) + '</div>'
            + (p.fig ? '<div class="pfig">' + p.fig + '</div>' : '')
            + (p.space === 'lines' ? '<div class="lines"><div></div><div></div></div>' : '<div class="ansbox"></div>')
            + '</li>';
        }).join('') + '</ol></section>';
        keyRows.push({no:partNo, title:k.title, keys:practice.map(function(p, i2){ return (i2 + 1) + ') ' + p.key; })});
      });
    });
    var keys = '<section class="keypage"><h2>Answers — for the teacher</h2>'
      + keyRows.map(function(kr){
          return '<p><b>Part ' + kr.no + ' · ' + escT(kr.title) + ':</b> '
            + kr.keys.map(escT).join(' &nbsp; ') + '</p>';
        }).join('') + '</section>';
    return '<!doctype html><html><head><meta charset="utf-8"><title>Review 13 helper — '
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
      + '.know .kfig{width:54mm;flex:none;} .know svg{width:100%;height:auto;}'
      + '.worked{font-size:10.5pt;background:#fdf6e4;border-radius:6px;padding:1.5mm 3mm;flex-basis:100%;}'
      + '.practice{margin:2.5mm 0 0;padding-left:6mm;}'
      + '.practice li{margin:0 0 3mm;page-break-inside:avoid;}'
      + '.practice .pfig{width:58mm;margin:1mm 0;} .practice svg{width:100%;height:auto;}'
      + '.ansbox{border:1.5px solid #b9c6c3;border-radius:5px;height:13mm;margin-top:1.5mm;}'
      + '.lines div{border-bottom:1.2px solid #b9c6c3;height:8mm;}'
      + '.keypage{color:#444;font-size:10pt;} .keypage h2{color:#1f5a54;font-size:12.5pt;margin:0 0 2mm;}'
      + '.keypage p{margin:1mm 0;}'
      + '</style></head><body>'
      + '<header><h1>📄 Review 13 helper</h1>'
      + '<div class="who"><b>' + escT(stu.emoji || '') + ' ' + escT(stu.name) + '</b> · Wharenui Maths · '
      + new Date().toLocaleDateString('en-NZ') + '</div></header>'
      + '<p class="solid">One part at a time with your teacher — about 10 minutes each.'
      + (solid.length ? ' &nbsp;✓ Already solid: ' + solid.join(', ') + ' — tino pai!' : '') + '</p>'
      + body + keys + '</body></html>';
  }

  var R13 = {
    ITEMS:ITEMS, item:item,
    newState:newState, questionFor:questionFor, markAnswer:markAnswer,
    numOK:numOK, checkBlanks:checkBlanks, neededLevels:neededLevels,
    worksheetHTML:worksheetHTML, figGrid:figGrid, figNumLine:figNumLine
  };
  if(typeof module !== 'undefined' && module.exports) module.exports = R13;
  else root.R13 = R13;
})(typeof window !== 'undefined' ? window : this);
