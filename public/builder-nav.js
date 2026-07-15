(function () {
  var toggle = document.getElementById('accountToggle');
  var menu = document.getElementById('accountMenu');
  if (toggle && menu) toggle.addEventListener('click', function () { menu.classList.toggle('open'); });
  document.addEventListener('click', function (event) {
    if (!event.target.closest('.account')) document.querySelectorAll('.account-menu.open').forEach(function (item) { item.classList.remove('open'); });
  });
  var logout = document.getElementById('logout');
  if (logout) logout.addEventListener('click', function () { fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }).then(function () { location.href = '/'; }); });
  var exportButton = document.getElementById('builderExportNav');
  if (exportButton) exportButton.addEventListener('click', function () { var target = document.getElementById('btnExport'); if (target) target.click(); });
  var publishButton = document.getElementById('builderPublishNav');
  if (publishButton) publishButton.addEventListener('click', function () { if (window.__litebiPublish) window.__litebiPublish(); });
  fetch('/api/me', { credentials: 'same-origin' }).then(function (response) { return response.json(); }).then(function (data) {
    if (data.user) document.getElementById('userName').textContent = data.user.name || data.user.email || 'Conta';
  }).catch(function () {});
})();
