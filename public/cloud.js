/* cloud.js — camada de conta + publicação sobre o builder do LiteBI. */
(function () {
  'use strict';
  var me = null, googleEnabled = false;

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }
  function api(method, url, body) {
    return fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, data: j }; }); });
  }

  // ---------- estilos ----------
  var css = ''
    + '#lb-bar{position:fixed;inset:0 0 auto;z-index:99999;height:72px;padding:0 max(22px,calc((100% - 1180px)/2));display:flex;gap:9px;align-items:center;background:rgba(255,255,255,.9);backdrop-filter:blur(16px);border-bottom:1px solid rgba(16,24,40,.07);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.lb-account{position:relative}.lb-account-menu{display:none;position:absolute;right:0;top:48px;width:190px;padding:8px;background:#fff;border:1px solid #e7ebf0;border-radius:13px;box-shadow:0 16px 40px rgba(0,0,0,.18);z-index:5}.lb-account-menu.open{display:grid;gap:4px}.lb-account-menu a,.lb-account-menu button{border:0;background:transparent;text-align:left;color:#182230;padding:10px;border-radius:8px;text-decoration:none;font:inherit;font-size:13px;cursor:pointer}.lb-account-menu a:hover,.lb-account-menu button:hover{background:#f7f9fc}'
    + 'body.lb-dark #lb-bar{background:rgba(18,25,34,.92);border-bottom-color:#2b3745;color:#e9eef5}body.lb-dark .lb-btn.lb-ghost{background:#202c39;color:#e9eef5;border-color:#2b3745}body.lb-dark .lb-account-menu{background:#1b2632;border-color:#2b3745}body.lb-dark .lb-account-menu a,body.lb-dark .lb-account-menu button{color:#e9eef5}body.lb-dark .lb-account-menu a:hover,body.lb-dark .lb-account-menu button:hover{background:#243241}body.lb-dark #lb-tools{background:rgba(27,38,50,.94);border-color:#2b3745}body.lb-dark .lb-chip{background:#202c39;color:#e9eef5;border-color:#2b3745}'
    + '.lb-brand{margin-right:auto;font-size:21px;font-weight:850;letter-spacing:-.05em;color:#182230;text-decoration:none}.lb-brand span{color:#5e9fe8}'
    + '.dash-toolbar{display:none!important}'
    + '#lb-tools{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99998;display:none;gap:8px;align-items:center;padding:9px;background:rgba(255,255,255,.92);backdrop-filter:blur(16px);border:1px solid #e7ebf0;border-radius:15px;box-shadow:0 14px 34px rgba(16,24,40,.16);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}'
    + '.lb-btn{border:0;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:transform .15s ease,filter .15s ease}.lb-btn:hover{transform:translateY(-1px);filter:brightness(.98)}'
    + '.lb-primary{background:linear-gradient(135deg,#5e9fe8,#72bc8f);color:#fff;box-shadow:0 5px 14px rgba(94,159,232,.22)}'
    + '.lb-ghost{background:#fff;color:#182230;border:1px solid #e7ebf0}.lb-ghost:hover{background:#f7f9fc}'
    + '.lb-chip{background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:999px;padding:5px 12px 5px 6px;display:flex;align-items:center;gap:8px;font-size:13px;color:#333}'
    + '.lb-chip img{width:24px;height:24px;border-radius:50%}'
    + '.lb-av{width:24px;height:24px;border-radius:50%;background:#5e9fe8;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}'
    + '.lb-modal{position:fixed;inset:0;z-index:100000;background:rgba(20,22,28,.45);display:none;align-items:center;justify-content:center;padding:18px}'
    + '.lb-modal.open{display:flex}'
    + '.lb-card{background:#fff;border-radius:16px;max-width:440px;width:100%;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:inherit}'
    + '.lb-card h3{margin:0 0 4px;font-size:19px;color:#1a1a1a}.lb-card p.sub{margin:0 0 18px;color:#6b7280;font-size:13px}'
    + '.lb-field{margin-bottom:14px}.lb-field label{display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:6px}'
    + '.lb-field input[type=text]{width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,.15);border-radius:9px;font-size:14px}'
    + '.lb-vis{display:flex;gap:10px}.lb-vis label{flex:1;border:1.5px solid rgba(0,0,0,.12);border-radius:11px;padding:11px;cursor:pointer;font-size:13px;display:flex;gap:8px;align-items:flex-start}'
    + '.lb-vis label.sel{border-color:#5e9fe8;background:#f3f9fd}.lb-vis input{margin-top:2px}'
    + '.lb-vis b{display:block;color:#1a1a1a}.lb-vis span{color:#6b7280;font-size:12px}'
    + '.lb-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:8px}'
    + '.lb-link{display:flex;gap:8px;margin-top:10px}.lb-link input{flex:1;padding:10px 12px;border:1px solid rgba(0,0,0,.15);border-radius:9px;font-size:13px;background:#f6f7f9}'
    + '.lb-x{background:none;border:0;font-size:22px;line-height:1;color:#9ca3af;cursor:pointer;float:right;margin-top:-6px}'
    + '.lb-msg{font-size:13px;margin-top:10px;min-height:16px}.lb-msg.err{color:#dc2626}.lb-msg.ok{color:#16a34a}';
  document.head.appendChild(el('style', null, css));

  // ---------- barra ----------
  var bar = el('div', { id: 'lb-bar' });
  // A barra superior antiga foi removida do builder; `bar` permanece apenas
  // como referência inerte para não duplicar navegação na página.
  var toolTray = el('div', { id: 'lb-tools' });
  document.body.appendChild(toolTray);

  function syncBarVisibility() {
    var embedded = new URLSearchParams(location.search).get('embedded') === '1';
    var builder = document.getElementById('screen-upload') || document.getElementById('screen-dashboard');
    var dashboard = document.getElementById('screen-dashboard');
    var isDashboard = dashboard && !dashboard.classList.contains('hidden');
    // O builder não usa navbar próprio. A navegação pertence às páginas do app;
    // manter esta barra aqui criava um segundo header visual no editor.
    bar.style.display = 'none';
    toolTray.style.display = isDashboard && !embedded ? 'flex' : 'none';
    document.body.style.paddingTop = '0';
  }
  syncBarVisibility();
  var screenObserver = new MutationObserver(syncBarVisibility);
  var uploadScreen = document.getElementById('screen-upload');
  if (uploadScreen) screenObserver.observe(uploadScreen, { attributes: true, attributeFilter: ['class'] });
  var previewScreen = document.getElementById('screen-preview');
  if (previewScreen) screenObserver.observe(previewScreen, { attributes: true, attributeFilter: ['class'] });
  var dashboardScreen = document.getElementById('screen-dashboard');
  if (dashboardScreen) screenObserver.observe(dashboardScreen, { attributes: true, attributeFilter: ['class'] });

  function initials(name, email) {
    var s = (name || email || '?').trim();
    return s ? s[0].toUpperCase() : '?';
  }

  function renderBar() {
    bar.innerHTML = '';
    toolTray.innerHTML = '';
    if (me) {
      function action(id, label, cls) {
        var button = el('button', { class: 'lb-btn lb-editor-action ' + (cls || 'lb-ghost') }, label);
        button.onclick = function () { var target = document.getElementById(id); if (target) target.click(); };
        return button;
      }
      var brand = el('a', { class: 'lb-brand', href: '/home' }, 'Lite<span>BI</span>');
      var home = el('a', { class: 'lb-btn lb-ghost', href: '/home' }, 'Início');
      var fresh = el('a', { class: 'lb-btn lb-primary', href: '/builder?new=1' }, '+ Novo dashboard');
      var account = el('div', { class: 'lb-account' });
      var accountToggle = el('button', { class: 'lb-btn lb-ghost' }, (me.name || 'Conta') + ' ⌄');
      var accountMenu = el('div', { class: 'lb-account-menu' });
      accountMenu.innerHTML = '<a href="/profile">Meu perfil</a><a href="/home#gallery">Dashboards publicados</a><button id="lb-theme">🌙 Modo escuro</button><button id="lb-logout">Sair</button>';
      account.appendChild(accountToggle); account.appendChild(accountMenu);
      accountToggle.onclick = function () { accountMenu.classList.toggle('open'); };
      accountMenu.querySelector('#lb-theme').onclick = function () { document.body.classList.toggle('lb-dark'); var d = document.body.classList.contains('lb-dark'); localStorage.setItem('litebi-theme', d ? 'dark' : 'light'); this.textContent = d ? '☀️ Modo claro' : '🌙 Modo escuro'; };
      if (localStorage.getItem('litebi-theme') === 'dark') document.body.classList.add('lb-dark');
      var pub = el('button', { class: 'lb-btn lb-primary', id: 'lb-publish' }, '✨ Publicar');
      pub.onclick = openPublish;
      var tools = [action('btnAddKpi', '+ KPI'), action('btnAddChart', '+ Gráfico'), action('btnAddTable', '+ Tabela'), action('btnAuto', '✨ IA'), action('btnDesign', 'Design')];
      var out = accountMenu.querySelector('#lb-logout');
      out.onclick = function () { api('POST', '/auth/logout').then(function () { location.reload(); }); };
      bar.appendChild(brand); bar.appendChild(home); bar.appendChild(fresh); bar.appendChild(account);
      tools.forEach(function (item) { toolTray.appendChild(item); });
    } else {
      bar.appendChild(el('a', { class: 'lb-btn lb-ghost', href: '/login' }, 'Entrar'));
      bar.appendChild(el('a', { class: 'lb-btn lb-primary', href: '/signup' }, 'Criar conta'));
    }
  }

  // ---------- modal de publicação ----------
  var modal = el('div', { class: 'lb-modal', id: 'lb-modal' });
  modal.innerHTML = ''
    + '<div class="lb-card" role="dialog" aria-modal="true" aria-labelledby="lb-publish-title">'
    + '<button class="lb-x" id="lb-close" aria-label="Fechar publicação">×</button>'
    + '<h3 id="lb-publish-title">Publicar dashboard</h3>'
    + '<p class="sub">Gere um link para compartilhar este dashboard.</p>'
    + '<div class="lb-field"><label for="lb-title">Título</label><input type="text" id="lb-title" name="dashboardTitle" placeholder="Meu Dashboard"></div>'
    + '<div class="lb-field"><label>Visibilidade</label><div class="lb-vis">'
    + '<label class="sel" id="lb-vis-pub"><input type="radio" name="lbvis" value="public" checked><span><b>Público</b><span>Qualquer pessoa com o link vê.</span></span></label>'
    + '<label id="lb-vis-priv"><input type="radio" name="lbvis" value="private"><span><b>Privado</b><span>Apenas você (logado) vê.</span></span></label>'
    + '</div></div>'
    + '<div class="lb-msg" id="lb-msg" role="status" aria-live="polite"></div>'
    + '<div id="lb-result" style="display:none"><div class="lb-link"><input type="text" id="lb-url" readonly><button class="lb-btn lb-ghost" id="lb-copy">Copiar</button></div></div>'
    + '<div class="lb-actions"><button class="lb-btn lb-primary" id="lb-save">Publicar</button></div>'
    + '</div>';
  document.body.appendChild(modal);

  var msg = modal.querySelector('#lb-msg');
  var publishReturnFocus = null;
  function setMsg(t, kind) { msg.textContent = t || ''; msg.className = 'lb-msg' + (kind ? ' ' + kind : ''); }
  modal.querySelector('#lb-close').onclick = closePublish;
  modal.querySelector('#lb-vis-pub').onclick = function () { sel('public'); };
  modal.querySelector('#lb-vis-priv').onclick = function () { sel('private'); };
  function sel(v) {
    modal.querySelector('#lb-vis-pub').classList.toggle('sel', v === 'public');
    modal.querySelector('#lb-vis-priv').classList.toggle('sel', v === 'private');
    modal.querySelector('input[name=lbvis][value="' + v + '"]').checked = true;
  }
  modal.querySelector('#lb-copy').onclick = function () {
    var inp = modal.querySelector('#lb-url'); inp.select();
    navigator.clipboard ? navigator.clipboard.writeText(inp.value) : document.execCommand('copy');
    setMsg('Link copiado!', 'ok');
  };

  function openPublish() {
    var b = window.__litebiBridge;
    if (!b || !b.hasComponents || !b.hasComponents()) {
      alert('Crie um dashboard com ao menos um componente antes de publicar.');
      return;
    }
    publishReturnFocus = document.activeElement;
    setMsg(''); modal.querySelector('#lb-result').style.display = 'none';
    modal.querySelector('#lb-save').style.display = '';
    modal.querySelector('#lb-save').textContent = (b.getCloudId && b.getCloudId()) ? 'Salvar alterações' : 'Publicar';
    modal.querySelector('#lb-title').value = (b.getTitle && b.getTitle()) || 'Meu Dashboard';
    sel('public');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    modal.querySelector('#lb-title').focus();
  }
  function closePublish() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if (publishReturnFocus && document.contains(publishReturnFocus)) publishReturnFocus.focus();
  }
  modal.addEventListener('click', function (event) { if (event.target === modal) closePublish(); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && modal.classList.contains('open')) closePublish(); });
  window.__litebiPublish = openPublish;

  modal.querySelector('#lb-save').onclick = function () {
    var b = window.__litebiBridge;
    var payload = b && b.getState && b.getState();
    var html = b && b.getExportHtml && b.getExportHtml();
    if (!payload || !html) { setMsg('Não foi possível ler o dashboard atual.', 'err'); return; }
    var title = modal.querySelector('#lb-title').value.trim() || 'Meu Dashboard';
    var visibility = modal.querySelector('input[name=lbvis]:checked').value;
    setMsg('Publicando…');
    var cloudId = b.getCloudId && b.getCloudId();
    api(cloudId ? 'PATCH' : 'POST', cloudId ? '/api/dashboards/' + encodeURIComponent(cloudId) : '/api/dashboards', { title: title, visibility: visibility, payload: payload, html: html })
      .then(function (r) {
        if (!r.ok) { setMsg((r.data && r.data.error) || 'Falha ao publicar.', 'err'); return; }
        var publishedPath = r.data.url || (r.data.dashboard && '/d/' + r.data.dashboard.slug) || '';
        var full = location.origin + publishedPath;
        modal.querySelector('#lb-url').value = full;
        modal.querySelector('#lb-result').style.display = '';
        modal.querySelector('#lb-save').style.display = 'none';
        setMsg(cloudId ? 'Dashboard atualizado!' : 'Dashboard publicado!', 'ok');
      })
      .catch(function () { setMsg('Erro de rede ao publicar.', 'err'); });
  };

  // ---------- init ----------
  api('GET', '/api/me').then(function (r) {
    me = r.data && r.data.user; googleEnabled = !!(r.data && r.data.googleEnabled);
    renderBar(); syncBarVisibility();
  }).catch(function () { renderBar(); syncBarVisibility(); });
})();
