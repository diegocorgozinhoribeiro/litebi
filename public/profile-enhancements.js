(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var api = function (method, url, body) { return fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); }); };
  var id = new URLSearchParams(location.search).get('user') || ((location.pathname.match(/^\/u\/(\d+)/) || [])[1]);

  document.querySelectorAll('.field').forEach(function (field) {
    var label = field.querySelector('label');
    var control = field.querySelector('input, textarea, select');
    if (label && control && control.id) label.htmlFor = control.id;
  });
  var profileMessage = $('#profileMsg');
  if (profileMessage) { profileMessage.setAttribute('role', 'status'); profileMessage.setAttribute('aria-live', 'polite'); }

  api('GET', '/api/me').then(function (r) {
    var toggle = document.getElementById('accountToggle');
    if (toggle && r.data && r.data.user && toggle.firstChild) toggle.firstChild.nodeValue = (r.data.user.name || 'Conta') + ' ⌄';
  });

  var css = document.createElement('style');
  css.textContent = '.avatar{position:relative;overflow:hidden;cursor:pointer}.avatar-edit{position:absolute;inset:auto 0 0;padding:7px 4px;border:0;background:rgba(15,23,42,.72);color:#fff;font-size:11px;font-weight:700;cursor:pointer;opacity:0;transition:opacity .18s}.avatar:hover .avatar-edit,.avatar:focus-within .avatar-edit{opacity:1}.avatar-edit span{font-size:13px;margin-right:3px}.avatar img{display:block}.friend-state{display:flex;align-items:center;gap:9px;margin-top:12px}.friend-state .btn{padding:8px 11px;font-size:12px}.friend-badge{display:inline-flex;align-items:center;gap:5px;padding:8px 11px;border-radius:999px;background:#eef9f2;color:#28794d;font-size:12px;font-weight:750}.friend-note{font-size:12px;color:#667085}.profile-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}body.dark input,body.dark textarea,body.dark select{background:#202c39;color:#e9eef5;border-color:#2b3745}body.dark .dash-link,body.dark .panel,body.dark .profile-card{color:#e9eef5}body.dark .dash-link{background:#1b2632}body.dark .footer{border-color:#2b3745}';
  document.head.appendChild(css);

  function enhanceOwnAvatar() {
    var avatar = $('#avatar');
    if (!avatar || id) return;
    var input = $('#avatarInput');
    if (input) input.style.display = 'none';
    if (!avatar.querySelector('.avatar-edit')) {
      var button = document.createElement('button');
      button.type = 'button'; button.className = 'avatar-edit'; button.innerHTML = '<span>📷</span> Alterar foto';
      button.onclick = function (event) { event.stopPropagation(); var file = $('#avatarInput'); if (file) file.click(); };
      avatar.appendChild(button);
    }
  }
  var avatar = $('#avatar');
  if (avatar && !id) {
    new MutationObserver(enhanceOwnAvatar).observe(avatar, { childList: true });
    enhanceOwnAvatar();
  }

  var search = $('#search');
  if (search && search.oninput) {
    search.setAttribute('aria-label', 'Buscar pessoa por nome ou e-mail');
    search.placeholder = 'Buscar pessoa…';
    var originalSearch = search.oninput;
    var searchTimer;
    search.oninput = function (event) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { originalSearch.call(search, event); }, 250);
    };
  }

  function renderFriendAction(friendship, profileId) {
    var panel = $('#editPanel');
    if (!panel) return;
    panel.style.display = 'block';
    if (!friendship || friendship.status === 'rejected') {
      panel.innerHTML = '<h2>Conectar</h2><p>Adicione este perfil à sua rede.</p><div class="friend-state"><button class="btn primary" id="requestFriend">Adicionar amigo</button><span class="friend-note" id="friendMsg"></span></div>';
      $('#requestFriend').onclick = function () {
        $('#requestFriend').disabled = true;
        api('POST', '/api/friends/' + encodeURIComponent(profileId)).then(function (r) {
          if (!r.ok) { $('#friendMsg').textContent = r.data.error || 'Não foi possível enviar o pedido.'; $('#requestFriend').disabled = false; return; }
          $('#requestFriend').outerHTML = '<span class="friend-badge">✓ Pedido enviado</span>';
        });
      };
      return;
    }
    if (friendship.status === 'accepted') {
      panel.innerHTML = '<h2>Conexão</h2><p>Vocês já fazem parte da mesma rede.</p><div class="friend-state"><span class="friend-badge">✓ Amigos</span></div>';
    } else if (String(friendship.requester_id) === String(profileId)) {
      panel.innerHTML = '<h2>Pedido de amizade</h2><p>Este perfil enviou um pedido para você.</p><div class="friend-state"><button class="btn primary" id="acceptFriend">Aceitar</button><button class="btn ghost" id="rejectFriend">Recusar</button><span class="friend-note" id="friendMsg"></span></div>';
      function answer(status) { api('PATCH', '/api/friends/' + friendship.id, { status: status }).then(function (r) { if (r.ok) renderFriendAction({ status: status }, profileId); else $('#friendMsg').textContent = r.data.error || 'Não foi possível atualizar o pedido.'; }); }
      $('#acceptFriend').onclick = function () { answer('accepted'); };
      $('#rejectFriend').onclick = function () { answer('rejected'); };
    } else {
      panel.innerHTML = '<h2>Conexão</h2><p>Seu pedido de amizade está aguardando resposta.</p><div class="friend-state"><span class="friend-badge">⏳ Pedido enviado</span></div>';
    }
  }

  if (id) {
    api('GET', '/api/public/profile/' + encodeURIComponent(id)).then(function (r) {
      if (r.ok) renderFriendAction(r.data.friendship, id);
    });
  }
})();
