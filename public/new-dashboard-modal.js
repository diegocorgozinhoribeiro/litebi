(function () {
  'use strict';

  var style = document.createElement('style');
  style.textContent = ''
    + '#newDashboardModal{position:fixed;inset:0;z-index:20;background:rgba(16,24,40,.48);display:none;align-items:center;justify-content:center;padding:18px}'
    + '#newDashboardModal.open{display:flex}'
    + '#newDashboardCard{position:relative;background:#fff;border-radius:18px;width:min(1080px,100%);height:min(860px,92vh);overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.28)}'
    + '#newDashboardFrame{display:block;width:100%;height:100%;border:0}'
    + '#newDashboardClose{position:absolute;right:12px;top:10px;z-index:2;width:34px;height:34px;border:0;border-radius:50%;background:rgba(255,255,255,.92);color:#667085;font-size:24px;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.12)}'
    + '@media(max-width:720px){#newDashboardModal{padding:0}#newDashboardCard{width:100%;height:100%;border-radius:0}}';
  document.head.appendChild(style);

  var modal = document.createElement('div');
  modal.id = 'newDashboardModal';
  modal.innerHTML = '<div id="newDashboardCard" role="dialog" aria-modal="true" aria-label="Novo dashboard">'
    + '<button id="newDashboardClose" type="button" aria-label="Fechar">×</button>'
    + '<iframe id="newDashboardFrame" title="Configurar novo dashboard"></iframe>'
    + '</div>';
  document.body.appendChild(modal);

  var frame = document.getElementById('newDashboardFrame');
  var returnFocus = null;
  function close() {
    modal.classList.remove('open');
    frame.src = 'about:blank';
    document.body.style.overflow = '';
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
  }
  function open(trigger) {
    returnFocus = trigger || document.activeElement;
    frame.src = '/builder?new=1&embedded=1';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('newDashboardClose').focus();
  }

  document.getElementById('newDashboardClose').onclick = close;
  modal.addEventListener('click', function (event) { if (event.target === modal) close(); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && modal.classList.contains('open')) close(); });
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href="/builder?new=1"]');
    if (!link) return;
    event.preventDefault();
    open(link);
  });
  window.addEventListener('message', function (event) {
    if (event.origin !== location.origin || !event.data || event.data.type !== 'litebi-dashboard-ready') return;
    close();
    location.href = '/builder?ready=1';
  });
})();
