(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var api = function (method, url, body) { return fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); }); };
  var active = null;
  function openManagedTeam(team) {
    active = team;
    $('#teamModalTitle').textContent = team.name;
    $('#teamModalSub').textContent = 'Gerencie participantes e permissões deste canal.';
    $('#teamForm').style.display = 'none'; $('#memberArea').style.display = 'block'; $('#memberMsg').textContent = '';
    var canManage = team.role === 'owner' || team.role === 'admin';
    var oldActions = $('#teamManageActions'); if (oldActions) oldActions.remove();
    $('#memberArea').insertAdjacentHTML('beforeend', '<div id="teamManageActions" class="team-manage-actions">' + (team.role === 'owner' ? '<button type="button" class="btn ghost mini danger" id="deleteTeam">Excluir canal</button>' : '') + '</div>');
    api('GET', '/api/teams/' + team.id + '/members').then(function (r) {
      if (!r.ok) { $('#memberMsg').textContent = r.data.error || 'Não foi possível carregar participantes.'; return; }
      $('#memberList').innerHTML = (r.data.members || []).map(function (m) {
        var owner = m.role === 'owner';
        var controls = canManage && !owner ? '<span class="member-controls"><select data-role="' + m.id + '"><option value="member"' + (m.role === 'member' ? ' selected' : '') + '>Visualizador</option><option value="editor"' + (m.role === 'editor' ? ' selected' : '') + '>Editor</option></select><button class="btn ghost mini danger" data-remove-member="' + m.id + '">Remover</button></span>' : '<span class="member-role">' + (owner ? 'Dono' : m.role === 'editor' ? 'Editor' : 'Visualizador') + '</span>';
        return '<div class="member"><div><b>' + esc(m.name || m.email) + '</b><small>' + esc(m.email) + '</small></div>' + controls + '</div>';
      }).join('');
      var deleteButton = $('#deleteTeam');
      if (deleteButton) deleteButton.onclick = function () { if (!confirm('Excluir este canal e remover seus compartilhamentos?')) return; api('DELETE', '/api/teams/' + team.id).then(function (x) { if (!x.ok) { $('#memberMsg').textContent = x.data.error; return; } $('#teamModal').classList.remove('open'); location.reload(); }); };
    });
    $('#teamModal').classList.add('open');
  }
  var style = document.createElement('style'); style.textContent = '.team-manage-actions{display:flex;justify-content:flex-end;margin-top:14px}.member-controls{display:flex;align-items:center;gap:7px}.member-controls select{padding:6px 8px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:11px}.member-role{font-size:11px;color:var(--muted)}body.dark input,body.dark select{background:#202c39;color:#e9eef5;border-color:#2b3745}body.dark .empty{background:#1b2632;border-color:#2b3745}body.dark .stat,body.dark .dash-card,body.dark .team-card{background:#1b2632;border-color:#2b3745}body.dark .modal-card{background:#1b2632;color:#e9eef5}body.dark .modal-card .close{color:#aab6c5}'; document.head.appendChild(style);
  document.addEventListener('click', function (event) {
    var teamButton = event.target.closest('[data-team]');
    if (teamButton) { event.preventDefault(); event.stopImmediatePropagation(); api('GET', '/api/teams').then(function (r) { var team = (r.data.teams || []).find(function (t) { return String(t.id) === teamButton.dataset.team; }); if (team) openManagedTeam(team); }); return; }
    var select = event.target.closest('[data-role]');
    if (select) { api('PATCH', '/api/teams/' + active.id + '/members/' + select.dataset.role, { role: select.value }).then(function (r) { if (!r.ok) alert(r.data.error || 'Não foi possível alterar a permissão.'); }); return; }
    var remove = event.target.closest('[data-remove-member]');
    if (remove) { if (!confirm('Remover este participante do canal?')) return; api('DELETE', '/api/teams/' + active.id + '/members/' + remove.dataset.removeMember).then(function (r) { if (!r.ok) { $('#memberMsg').textContent = r.data.error; return; } openManagedTeam(active); }); }
  }, true);
  document.addEventListener('change', function (event) {
    var select = event.target.closest('[data-role]');
    if (!select || !active) return;
    api('PATCH', '/api/teams/' + active.id + '/members/' + select.dataset.role, { role: select.value }).then(function (r) { if (!r.ok) alert(r.data.error || 'Não foi possível alterar a permissão.'); });
  }, true);
})();
