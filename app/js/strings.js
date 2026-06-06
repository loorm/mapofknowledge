/* ══════════════════════════════════════════════
   UI STRINGS  —  js/strings.js
   ──────────────────────────────────────────────
   Loads localised UI strings from /api/strings.

   Usage:
     t('btn.learn_this')          → 'Learn this'  (or the key if not found)
     t('sidebar.your_knowledge')  → 'Your Knowledge'

   Locale resolution order:
     1. window._uiLocale (set by settings loader when ui_locale key exists)
     2. <html lang="..."> attribute
     3. 'en' default

   Strings are loaded once on page load. If the settings fetch resolves
   a different locale after initial load, call window.reloadStrings().
   ══════════════════════════════════════════════ */

(function () {

  var _strings = {};

  window.t = function (key) {
    return _strings[key] !== undefined ? _strings[key] : key;
  };

  window.reloadStrings = function () {
    var locale = window._uiLocale
               || document.documentElement.getAttribute('lang')
               || 'en';
    fetch('/api/strings?locale=' + encodeURIComponent(locale))
      .then(function (r) { return r.json(); })
      .then(function (d) { _strings = d; })
      .catch(function () {});
  };

  window.reloadStrings();

})();
