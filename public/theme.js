(function () {
  var key = 'litebi-theme';
  var saved = localStorage.getItem(key);
  function applySavedTheme() {
    var dark = saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches);
    document.body.classList.toggle('dark', dark);
    document.body.classList.toggle('lb-dark', dark);
  }
  window.LiteBITheme = {
    toggle: function () {
      var dark = !document.body.classList.contains('dark');
      document.body.classList.toggle('dark', dark);
      document.body.classList.toggle('lb-dark', dark);
      localStorage.setItem(key, dark ? 'dark' : 'light');
      document.querySelectorAll('[data-theme-label]').forEach(function (el) { el.textContent = dark ? '☀️ Modo claro' : '🌙 Modo escuro'; });
    },
    sync: function () {
      var dark = document.body.classList.contains('dark');
      document.querySelectorAll('[data-theme-label]').forEach(function (el) { el.textContent = dark ? '☀️ Modo claro' : '🌙 Modo escuro'; });
      document.querySelectorAll('.theme-switch').forEach(function (el) { el.setAttribute('aria-checked', String(dark)); });
    }
  };
  function renderSwitches() {
    document.querySelectorAll('#themeToggle, [data-theme-toggle]').forEach(function (el) {
      el.classList.add('theme-switch');
      el.setAttribute('type', 'button');
      el.setAttribute('role', 'switch');
      el.setAttribute('aria-label', 'Alternar tema claro e escuro');
      el.innerHTML = '<span class="theme-switch-track" aria-hidden="true"><span class="theme-switch-thumb"></span></span><span class="theme-switch-caption">Tema</span>';
      el.onclick = function () { LiteBITheme.toggle(); LiteBITheme.sync(); };
    });
  }
  document.addEventListener('click', function (event) {
    var toggle = event.target.closest('[data-theme-toggle]');
    if (toggle) LiteBITheme.toggle();
    var close = event.target.closest('[data-menu-close]');
    if (close) close.closest('.account')?.classList.remove('open');
  });
  window.addEventListener('DOMContentLoaded', function () { applySavedTheme(); renderSwitches(); LiteBITheme.sync(); });
  if (window.MutationObserver) new MutationObserver(function () {
    if (document.querySelector('#themeToggle:not(.theme-switch), [data-theme-toggle]:not(.theme-switch)')) renderSwitches();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
