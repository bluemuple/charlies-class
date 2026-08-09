/* Charlie's Class — shared data layer.
   Every page talks to CharlieStore, never to Supabase or localStorage
   directly. With keys in js/config.js it uses Supabase (live across all
   Chromebooks); without keys it falls back to a per-browser demo store
   seeded from js/roster.js, so the pages work before any setup. */
window.CharlieStore = (function(){
  "use strict";

  var cfg = window.CHARLIE_CONFIG || {};
  var LS_KEY = 'charlies-class-v1';
  var CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

  var mode = 'local';          // 'local' | 'supabase'
  var client = null;
  var listeners = [];
  var readyPromise = null;

  function emit(){
    listeners.forEach(function(f){ try{ f(); }catch(e){} });
  }

  /* ---------------- local demo mode ---------------- */
  function seed(){
    return (window.CHARLIE_ROSTER || []).map(function(s){
      return {id:s.id, name:s.name, gender:s.gender, code:s.code, emoji:'', money:0};
    });
  }
  var memory = null;   // demo data survives here even when localStorage is blocked
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

  /* ---------------- helpers ---------------- */
  function sortByName(list){
    return list.slice().sort(function(a,b){ return a.name.localeCompare(b.name); });
  }
  function slugify(name){
    var base = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'student';
    return base + '-' + Math.random().toString(36).slice(2,6);
  }
  function newCode(taken){
    for(var i=0; i<9999; i++){
      var c = String(1000 + Math.floor(Math.random()*9000));
      if(/^(\d)\1{3}$/.test(c) || c==='1234' || c==='4321') continue;   // too easy to guess
      if(taken.indexOf(c) !== -1) continue;
      return c;
    }
    return '0000';
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
  function sbList(){
    return client.from('students').select('*').order('name').then(function(r){
      if(r.error) throw r.error;
      return r.data;
    });
  }

  /* ---------------- public API (same shape in both modes) ---------------- */
  var api = {
    /* resolves with 'supabase' or 'local' once the store is usable */
    init: function(){
      if(readyPromise) return readyPromise;
      if(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY){
        readyPromise = loadSdk().then(function(){
          client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
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
      return Promise.resolve(sortByName(localAll()));
    },

    add: function(name, gender){
      return api.list().then(function(all){
        var student = {
          id: slugify(name),
          name: name,
          gender: gender,
          code: newCode(all.map(function(s){ return s.code; })),
          emoji: '',
          money: 0
        };
        if(mode === 'supabase'){
          return client.from('students').insert(student).then(function(r){
            if(r.error) throw r.error;
            emit();
            return student;
          });
        }
        var d = localAll(); d.push(student); lsWrite(d);
        return student;
      });
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

    regenerateCode: function(id){
      return api.list().then(function(all){
        var code = newCode(all.map(function(s){ return s.code; }));
        return api.update(id, {code:code}).then(function(){ return code; });
      });
    },

    /* students type their 4-digit code to log in */
    verifyLogin: function(id, code){
      return api.list().then(function(all){
        var s = all.filter(function(x){ return x.id === id; })[0];
        return (s && s.code === String(code)) ? s : null;
      });
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
