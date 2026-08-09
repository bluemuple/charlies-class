/* Charlie's Class — emoji avatar picker.
   CharlieEmoji.mount(container, {initial, saveLabel, onSave}) builds the
   picker UI inside `container`. People and Gestures get a skin-colour row;
   Animals and Plants don't. Styles are injected once so index.html and
   hub.html share one look. */
window.CharlieEmoji = (function(){
  "use strict";

  var TONES = ['', '🏻', '🏼', '🏽', '🏾', '🏿'];

  var CATS = [
    {key:'people', label:'🧑 People', tones:true, list:[
      '🧑','👦','👧','🧒','👶','👨','👩','👴','👵','👱',
      '👸','🤴','🦸','🦹','🧙','🧚','🧛','🧜','🧝','🥷']},
    {key:'animals', label:'🐶 Animals', tones:false, list:[
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
      '🦁','🐮','🐷','🐸','🐵','🐔','🐧','🦆','🦉','🐺',
      '🦄','🐴','🐢','🐍','🦖','🦕','🐙','🦀','🐬','🐳',
      '🦈','🐝','🦋','🐞','🦩','🦜']},
    {key:'plants', label:'🌱 Plants', tones:false, list:[
      '🌵','🎄','🌲','🌳','🌴','🌱','🌿','☘️','🍀','🎍',
      '🎋','🍁','🍂','🍃','🌾','💐','🌸','🌺','🌻','🌹',
      '🌷','🌼','🍄','🌰']},
    {key:'gestures', label:'👋 Gestures', tones:true, list:[
      '👋','🤚','✋','🖖','👌','🤏','✌️','🤞','🤟','🤘',
      '🤙','👈','👉','👆','👇','👍','👎','✊','👊','🤛',
      '🤜','👏','🙌','👐','🤲','🙏','💪']}
  ];

  /* skin tone goes on the base emoji (variation selector removed first) */
  function applyTone(base, tone){
    if(!tone) return base;
    return base.split('️').join('') + tone;
  }

  var cssDone = false;
  function injectCss(){
    if(cssDone) return; cssDone = true;
    var st = document.createElement('style');
    st.textContent =
      '.ep{background:#fff;border-radius:18px;padding:16px;box-shadow:0 4px 16px rgba(31,90,84,.16);text-align:center;}' +
      '.ep-tabs{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;}' +
      '.ep-tabs button{border:2px solid #d7e5e2;background:#f6fbfa;border-radius:20px;padding:7px 14px;font-size:15px;font-weight:700;color:#5c7671;cursor:pointer;}' +
      '.ep-tabs button.active{border-color:#2e7d74;background:#e3f4f0;color:#1f5a54;}' +
      '.ep-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:6px;max-height:36vh;overflow-y:auto;padding:2px;}' +
      '.ep-grid button{border:2px solid transparent;background:#f9fbfa;border-radius:12px;font-size:30px;padding:6px 0;cursor:pointer;line-height:1.2;}' +
      '.ep-grid button:hover{background:#fdf6e3;transform:scale(1.08);}' +
      '.ep-grid button.sel{border-color:#2e7d74;background:#e3f4f0;}' +
      '.ep-tones{margin-top:10px;display:none;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;}' +
      '.ep-tones.on{display:flex;}' +
      '.ep-tones span{font-size:13px;font-weight:700;color:#7a8f8b;margin-right:4px;}' +
      '.ep-tones button{border:2px solid transparent;background:#f9fbfa;border-radius:12px;font-size:26px;padding:4px 7px;cursor:pointer;}' +
      '.ep-tones button.sel{border-color:#2e7d74;background:#e3f4f0;}' +
      '.ep-foot{margin-top:14px;display:flex;align-items:center;justify-content:center;gap:14px;}' +
      '.ep-preview{font-size:44px;min-width:56px;}' +
      '.ep-save{border:0;border-radius:12px;padding:11px 26px;font-size:16px;font-weight:800;background:#2a9d34;color:#fff;cursor:pointer;}' +
      '.ep-save:hover{background:#217a29;}' +
      '.ep-save:disabled{background:#c6d6d2;cursor:default;}';
    document.head.appendChild(st);
  }

  function mount(container, opts){
    opts = opts || {};
    injectCss();

    var cat = CATS[0];
    var base = '';
    var tone = '';
    if(opts.initial){ base = opts.initial; }   // editing an existing avatar

    container.innerHTML =
      '<div class="ep">' +
        '<div class="ep-tabs"></div>' +
        '<div class="ep-grid"></div>' +
        '<div class="ep-tones"><span>Skin colour:</span></div>' +
        '<div class="ep-foot">' +
          '<div class="ep-preview"></div>' +
          '<button class="ep-save" disabled>' + (opts.saveLabel || "That's me!") + '</button>' +
        '</div>' +
      '</div>';

    var tabsEl = container.querySelector('.ep-tabs');
    var gridEl = container.querySelector('.ep-grid');
    var tonesEl = container.querySelector('.ep-tones');
    var prevEl = container.querySelector('.ep-preview');
    var saveEl = container.querySelector('.ep-save');

    function current(){ return base ? applyTone(base, cat.tones ? tone : '') : ''; }

    function renderTabs(){
      tabsEl.innerHTML = CATS.map(function(c){
        return '<button data-cat="' + c.key + '"' + (c === cat ? ' class="active"' : '') + '>' + c.label + '</button>';
      }).join('');
    }
    function renderGrid(){
      gridEl.innerHTML = cat.list.map(function(e){
        return '<button data-e="' + e + '"' + (e === base ? ' class="sel"' : '') + '>' + e + '</button>';
      }).join('');
    }
    function renderTones(){
      var show = cat.tones && !!base;
      tonesEl.className = 'ep-tones' + (show ? ' on' : '');
      if(!show){ return; }
      tonesEl.innerHTML = '<span>Skin colour:</span>' + TONES.map(function(t){
        return '<button data-t="' + t + '"' + (t === tone ? ' class="sel"' : '') + '>' + applyTone(base, t) + '</button>';
      }).join('');
    }
    function renderFoot(){
      prevEl.textContent = current() || '❔';
      saveEl.disabled = !base;
    }
    function renderAll(){ renderTabs(); renderGrid(); renderTones(); renderFoot(); }

    tabsEl.addEventListener('click', function(e){
      var b = e.target.closest('button[data-cat]'); if(!b) return;
      cat = CATS.filter(function(c){ return c.key === b.dataset.cat; })[0];
      base = ''; tone = '';
      renderAll();
    });
    gridEl.addEventListener('click', function(e){
      var b = e.target.closest('button[data-e]'); if(!b) return;
      base = b.dataset.e; tone = '';
      renderGrid(); renderTones(); renderFoot();
    });
    tonesEl.addEventListener('click', function(e){
      var b = e.target.closest('button[data-t]'); if(!b) return;
      tone = b.dataset.t;
      renderTones(); renderFoot();
    });
    saveEl.addEventListener('click', function(){
      if(base && opts.onSave) opts.onSave(current());
    });

    renderAll();
  }

  return { mount: mount, CATS: CATS, applyTone: applyTone };
})();
