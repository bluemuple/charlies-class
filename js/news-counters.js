/* Shared settings for the click and heart counters on news.html.
   The page reads them as window.NEWS_COUNTERS; js/snapshot-counts.js (Node) requires them.

   The numbers live on Abacus (https://abacus.jasoncameron.dev), a free counter API that needs
   no account: one counter per site for clicks ("v-…") and one for hearts ("h-…"), all inside
   the namespace below. To start everyone from zero again, change NS. */
(function(root){
  "use strict";
  var C = {
    NS: 'wharenui-news',
    API: 'https://abacus.jasoncameron.dev',
    /* counts.json is rebuilt by .github/workflows/counts.yml on the "counts" branch */
    SNAPSHOT: 'https://raw.githubusercontent.com/bluemuple/charlies-class/counts/counts.json',
    /* 'stuff.co.nz/sport' -> 'stuff-co-nz-sport'  (Abacus keys: 3–64 chars of letters, digits, - _ .) */
    slug: function(u){
      var s = String(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      return (s || 'site').slice(0, 60).replace(/-+$/, '');
    },
    keys: function(u){ var s = C.slug(u); return {views: 'v-' + s, hearts: 'h-' + s}; }
  };
  if(typeof module !== 'undefined' && module.exports) module.exports = C;
  else root.NEWS_COUNTERS = C;
})(typeof window !== 'undefined' ? window : this);
