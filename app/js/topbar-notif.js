(function () {
  fetch('/api/notifications/unread-count')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var count = data.count || 0;
      if (!count) return;
      var dot = document.getElementById('topbar-notif-dot');
      if (dot) dot.style.display = 'block';
      var badge = document.getElementById('nav-notif-badge');
      if (badge) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.style.display = 'inline-block';
      }
    })
    .catch(function () {});
})();
