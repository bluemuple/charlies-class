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
  var ROSTER_COLS = 'id,name,gender,emoji,money,code_set,items,guesses';
  var LS_MACHINES = 'charlies-class-machines-v1';

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
      items: row.items || [],
      guesses: row.guesses || [],
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

  /* machines in demo mode — same memory-mirror trick as the roster */
  var memMachines = null;
  function machRead(){
    if(memMachines) return memMachines;
    try{
      var raw = localStorage.getItem(LS_MACHINES);
      if(raw){ memMachines = JSON.parse(raw); return memMachines; }
    }catch(e){}
    memMachines = {};
    return memMachines;
  }
  function machWrite(byId){
    memMachines = byId;
    try{ localStorage.setItem(LS_MACHINES, JSON.stringify(byId)); }catch(e){}
    emit();
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
    if(!err) return false;
    var blob = (err.message||'') + (err.details||'') + (err.hint||'');
    return /code_set|items|guesses/.test(blob);
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
          client.channel('machines-live')
            .on('postgres_changes', {event:'*', schema:'public', table:'machines'}, emit)
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

    /* -------- Algebra Machine game sessions --------
       A machine is one whole game as a plain object (see game-core / algebra
       page). Stored as a single jsonb blob per row — classroom scale, last
       write wins, callers re-read after writing anything contested. */
    listMachines: function(){
      var maxAge = Date.now() - 3*60*60*1000;   // ignore machines older than 3 h
      if(mode === 'supabase'){
        return client.from('machines').select('id,created_at,data')
          .order('created_at', {ascending:false}).limit(30)
          .then(function(r){
            if(r.error) throw r.error;
            return r.data.map(function(row){ return row.data; }).filter(function(m){
              return m && (m.created || 0) > maxAge;
            });
          });
      }
      var byId = machRead(), all = [];
      Object.keys(byId).forEach(function(k){ all.push(byId[k]); });
      all = all.filter(function(m){ return (m.created || 0) > maxAge; });
      all.sort(function(a,b){ return (b.created||0) - (a.created||0); });
      return Promise.resolve(JSON.parse(JSON.stringify(all)));
    },

    getMachine: function(id){
      if(mode === 'supabase'){
        return client.from('machines').select('data').eq('id', id).maybeSingle()
          .then(function(r){
            if(r.error) throw r.error;
            return r.data ? r.data.data : null;
          });
      }
      /* hand out a COPY — callers mutate then save, like the network mode */
      var m = machRead()[id];
      return Promise.resolve(m ? JSON.parse(JSON.stringify(m)) : null);
    },

    saveMachine: function(machine){
      if(mode === 'supabase'){
        return client.from('machines')
          .upsert({id:machine.id, data:machine}, {onConflict:'id'})
          .then(function(r){
            if(r.error) throw r.error;
            emit();
          });
      }
      var byId = machRead();
      byId[machine.id] = machine;
      machWrite(byId);
      return Promise.resolve();
    },

    /* contested game writes: save ONLY if the stored game is still on
       `expectedProb` — resolves true if this client won the write, false if
       someone else resolved the problem first (then just re-read). */
    saveMachineIf: function(machine, expectedProb){
      if(mode === 'supabase'){
        return client.from('machines')
          .update({data:machine})
          .eq('id', machine.id)
          .eq('data->>prob', String(expectedProb))
          .select('id')
          .then(function(r){
            if(r.error) throw r.error;
            var won = !!(r.data && r.data.length);
            if(won) emit();
            return won;
          });
      }
      var byId = machRead();
      var cur = byId[machine.id];
      if(!cur || cur.prob !== expectedProb) return Promise.resolve(false);
      byId[machine.id] = machine;
      machWrite(byId);
      return Promise.resolve(true);
    },

    onChange: function(fn){
      listeners.push(fn);
      /* another tab on the same computer edited the demo store */
      try{
        window.addEventListener('storage', function(e){
          if(e.key === LS_KEY || e.key === LS_MACHINES) fn();
        });
      }catch(e){}
    }
  };

  return api;
})();
