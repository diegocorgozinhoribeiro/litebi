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
    + '#lb-bar{position:fixed;inset:0 0 auto;z-index:99999;height:72px;padding:0 max(22px,calc((100% - 1180px)/2));display:flex;gap:9px;align-items:center;background:rgba(255,255,255,.9);backdrop-filter:blur(16px);border-bottom:1px solid rgba(16,24,40,.07);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}'
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
  document.body.appendChild(bar);
  var toolTray = el('div', { id: 'lb-tools' });
  document.body.appendChild(toolTray);

  function syncBarVisibility() {
    var builder = document.getElementById('screen-upload') || document.getElementById('screen-dashboard');
    var dashboard = document.getElementById('screen-dashboard');
    var isDashboard = dashboard && !dashboard.classList.contains('hidden');
    bar.style.display = builder ? 'flex' : 'none';
    toolTray.style.display = isDashboard ? 'flex' : 'none';
    document.body.style.paddingTop = builder ? '72px' : '0';
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
      var profile = el('a', { class: 'lb-btn lb-ghost', href: '/profile' }, 'Perfil');
      var fresh = el('a', { class: 'lb-btn lb-primary', href: '/builder?new=1' }, 'Novo dashboard');
      var pub = el('button', { class: 'lb-btn lb-primary', id: 'lb-publish' }, '✨ Publicar');
      pub.onclick = openPublish;
      var tools = [action('btnAddKpi', '+ KPI'), action('btnAddChart', '+ Gráfico'), action('btnAddTable', '+ Tabela'), action('btnAuto', '✨ IA'), action('btnExport', 'Exportar')];
      var chip = el('div', { class: 'lb-chip' });
      if (me.avatar_url) chip.appendChild(el('img', { src: me.avatar_url, alt: '' }));
      else chip.appendChild(el('div', { class: 'lb-av' }, initials(me.name, me.email)));
      chip.appendChild(el('span', null, (me.name || me.email)));
      var out = el('button', { class: 'lb-btn lb-ghost', title: 'Sair' }, 'Sair');
      out.onclick = function () { api('POST', '/auth/logout').then(function () { location.reload(); }); };
      bar.appendChild(brand); bar.appendChild(home); bar.appendChild(profile); bar.appendChild(fresh); bar.appendChild(chip); bar.appendChild(out);
      tools.forEach(function (item) { toolTray.appendChild(item); }); toolTray.appendChild(pub);
    } else {
      bar.appendChild(el('a', { class: 'lb-btn lb-ghost', href: '/login' }, 'Entrar'));
      bar.appendChild(el('a', { class: 'lb-btn lb-primary', href: '/signup' }, 'Criar conta'));
    }
  }

  // ---------- modal de publicação ----------
  var modal = el('div', { class: 'lb-modal', id: 'lb-modal' });
  modal.innerHTML = ''
    + '<div class="lb-card">'
    + '<button class="lb-x" id="lb-close">×</button>'
    + '<h3>Publicar dashboard</h3>'
    + '<p class="sub">Gere um link para compartilhar este dashboard.</p>'
    + '<div class="lb-field"><label>Título</label><input type="text" id="lb-title" placeholder="Meu Dashboard"></div>'
    + '<div class="lb-field"><label>Visibilidade</label><div class="lb-vis">'
    + '<label class="sel" id="lb-vis-pub"><input type="radio" name="lbvis" value="public" checked><span><b>Público</b><span>Qualquer pessoa com o link vê.</span></span></label>'
    + '<label id="lb-vis-priv"><input type="radio" name="lbvis" value="private"><span><b>Privado</b><span>Apenas você (logado) vê.</span></span></label>'
    + '</div></div>'
    + '<div class="lb-msg" id="lb-msg"></div>'
    + '<div id="lb-result" style="display:none"><div class="lb-link"><input type="text" id="lb-url" readonly><button class="lb-btn lb-ghost" id="lb-copy">Copiar</button></div></div>'
    + '<div class="lb-actions"><button class="lb-btn lb-ghost" id="lb-cancel">Fechar</button><button class="lb-btn lb-primary" id="lb-save">Publicar</button></div>'
    + '</div>';
  document.body.appendChild(modal);

  var msg = modal.querySelector('#lb-msg');
  function setMsg(t, kind) { msg.textContent = t || ''; msg.className = 'lb-msg' + (kind ? ' ' + kind : ''); }
  modal.querySelector('#lb-close').onclick = closePublish;
  modal.querySelector('#lb-cancel').onclick = closePublish;
  modal.onclick = function (e) { if (e.target === modal) closePublish(); };
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
    setMsg(''); modal.querySelector('#lb-result').style.display = 'none';
    modal.querySelector('#lb-save').style.display = '';
    modal.querySelector('#lb-save').textContent = (b.getCloudId && b.getCloudId()) ? 'Salvar alterações' : 'Publicar';
    modal.querySelector('#lb-title').value = (b.getTitle && b.getTitle()) || 'Meu Dashboard';
    sel('public');
    modal.classList.add('open');
  }
  function closePublish() { modal.classList.remove('open'); }

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
