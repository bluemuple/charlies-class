/* Charlie's Class — shared data layer.
   Every page talks to CharlieStore, never to Supabase or localStorage
   directly. With keys in js/config.js it uses Supabase (live across all
   Chromebooks); without keys it falls back to a per-browser demo store
   seeded from js/roster.js, so the pages work before any setup.

   Secret codes: students choose their own on first login. A student row
   handed to the pages NEVER carries the code itself — only `codeSet`,
   so no browser ever receives the whole class's passwords. */
window.CharlieStore = (function(){
  "use strict";

  var cfg = window.CHARLIE_CONFIG || {};
  var LS_KEY = 'charlies-class-v3';   // v3: students choose their own code
  /* Pinned on purpose: a floating @2 could ship a breaking change on a school
     morning. Verified working with the sb_publishable_… key format. */
  var CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.2/dist/umd/supabase.min.js';

  /* Everything except `code`. code_set is a generated column (code is not null). */
  var ROSTER_COLS = 'id,name,gender,emoji,money,code_set';

  /* Supabase shows several URLs on its dashboard; accept any of them and
     reduce to the project origin the client actually wants. */
  function baseUrl(u){
    return String(u || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  }

  var mode = 'local';          // 'local' | 'supabase'
  var client = null;
  var legacy = false;          // true if the database predates code_set
  var listeners = [];
  var readyPromise = null;

  function emit(){
    listeners.forEach(function(f){ try{ f(); }catch(e){} });
  }

  /* ---------------- shaping ---------------- */
  /* the only place a row becomes a student object the pages may hold */
  function shape(row){
    return {
      id: row.id,
      name: row.name,
      gender: row.gender,
      emoji: row.emoji || '',
      money: row.money || 0,
      codeSet: ('code_set' in row) ? !!row.code_set : !!(row.code && String(row.code).length)
    };
  }
  function sortByName(list){
    return list.slice().sort(function(a,b){ return a.name.localeCompare(b.name); });
  }
  function slugify(name){
    var base = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'student';
    return base + '-' + Math.random().toString(36).slice(2,6);
  }
  function validCode(c){ return /^[0-9]{4}$/.test(String(c)); }

  /* ---------------- local demo mode ---------------- */
  var memory = null;   // demo data survives here even when localStorage is blocked
  function seed(){
    return (window.CHARLIE_ROSTER || []).map(function(s){
      return {id:s.id, name:s.name, gender:s.gender, code:null, emoji:'', money:0};
    });
  }
  function lsRead(){
    if(memory) return memory;
    try{
      var raw = localStorage.getItem(LS_KEY);
      if(raw){ memory = JSON.parse(raw); return memory; }
    }catch(e){}
    return null;
  }
  function lsWrite(students){
    memory = students;
    try{ localStorage.setItem(LS_KEY, JSON.stringify(students)); }catch(e){}
    emit();
  }
  function localAll(){
    var d = lsRead();
    if(!d){ d = seed(); lsWrite(d); }
    return d;
  }

  /* ---------------- supabase mode ---------------- */
  function loadSdk(){
    return new Promise(function(resolve, reject){
      if(window.supabase && window.supabase.createClient){ resolve(); return; }
      var s = document.createElement('script');
      s.src = CDN;
      s.onload = function(){ resolve(); };
      s.onerror = function(){ reject(new Error('could not load supabase-js')); };
      document.head.appendChild(s);
    });
  }
  /* the database may not have had supabase/migrations run against it yet */
  function missingCodeSet(err){
    return /code_set/.test((err && (err.message||'') + (err.details||'') + (err.hint||'')) || '');
  }
  function cols(){ return legacy ? '*' : ROSTER_COLS; }

  function sbList(){
    return client.from('students').select(cols()).order('name').then(function(r){
      if(r.error){
        if(!legacy && missingCodeSet(r.error)){ legacy = true; return sbList(); }
        throw r.error;
      }
      return r.data.map(shape);
    });
  }

  /* ---------------- public API (same shape in both modes) ---------------- */
  var api = {
    /* resolves with 'supabase' or 'local' once the store is usable */
    init: function(){
      if(readyPromise) return readyPromise;
      if(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY){
        readyPromise = loadSdk().then(function(){
          client = window.supabase.createClient(baseUrl(cfg.SUPABASE_URL), cfg.SUPABASE_ANON_KEY);
          mode = 'supabase';
          client.channel('students-live')
            .on('postgres_changes', {event:'*', schema:'public', table:'students'}, emit)
            .subscribe();
          return mode;
        }).catch(function(){
          mode = 'local';                    // offline / CDN blocked — still usable
          return mode;
        });
      } else {
        readyPromise = Promise.resolve(mode);
      }
      return readyPromise;
    },

    mode: function(){ return mode; },

    list: function(){
      if(mode === 'supabase') return sbList();
      return Promise.resolve(sortByName(localAll()).map(shape));
    },

    add: function(name, gender){
      var student = {id:slugify(name), name:name, gender:gender, emoji:'', money:0};
      if(mode === 'supabase'){
        return client.from('students').insert(student).then(function(r){
          if(r.error) throw r.error;
          emit();
          return shape(student);
        });
      }
      var d = localAll();
      d.push({id:student.id, name:name, gender:gender, code:null, emoji:'', money:0});
      lsWrite(d);
      return Promise.resolve(shape(student));
    },

    update: function(id, patch){
      if(mode === 'supabase'){
        return client.from('students').update(patch).eq('id', id).then(function(r){
          if(r.error) throw r.error;
          emit();
        });
      }
      var d = localAll();
      d.forEach(function(s){
        if(s.id === id) Object.keys(patch).forEach(function(k){ s[k] = patch[k]; });
      });
      lsWrite(d);
      return Promise.resolve();
    },

    remove: function(id){
      if(mode === 'supabase'){
        return client.from('students').delete().eq('id', id).then(function(r){
          if(r.error) throw r.error;
          emit();
        });
      }
      lsWrite(localAll().filter(function(s){ return s.id !== id; }));
      return Promise.resolve();
    },

    /* first login — the student picks their own code.
       Resolves with the student, or null if they already had one. */
    setCode: function(id, code){
      if(!validCode(code)) return Promise.resolve(null);
      code = String(code);
      if(mode === 'supabase'){
        return client.from('students').update({code:code})
          .eq('id', id).is('code', null).select(cols())
          .then(function(r){
            if(r.error) throw r.error;
            emit();
            return r.data.length ? shape(r.data[0]) : null;
          });
      }
      var d = localAll(), hit = null;
      d.forEach(function(s){ if(s.id === id && !s.code){ s.code = code; hit = s; } });
      lsWrite(d);
      return Promise.resolve(hit ? shape(hit) : null);
    },

    /* teacher clears a forgotten code; the student sets a new one next login */
    resetCode: function(id){
      return api.update(id, {code:null});
    },

    /* students type their 4-digit code to log in */
    verifyLogin: function(id, code){
      code = String(code);
      if(mode === 'supabase'){
        return client.from('students').select(cols())
          .eq('id', id).eq('code', code)
          .then(function(r){
            if(r.error){
              if(!legacy && missingCodeSet(r.error)){ legacy = true; return api.verifyLogin(id, code); }
              throw r.error;
            }
            return r.data.length ? shape(r.data[0]) : null;
          });
      }
      var s = localAll().filter(function(x){ return x.id === id; })[0];
      return Promise.resolve((s && s.code === code) ? shape(s) : null);
    },

    onChange: function(fn){
      listeners.push(fn);
      /* another tab on the same computer edited the demo store */
      try{
        window.addEventListener('storage', function(e){
          if(e.key === LS_KEY) fn();
        });
      }catch(e){}
    }
  };

  return api;
})();
