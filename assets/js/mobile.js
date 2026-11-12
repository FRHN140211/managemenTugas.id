/* ============================================================
   mobile.js — UX sentuh & pola navigasi mobile
   Swipe sidebar, pull-to-refresh, touch feedback, bottom nav.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  if (!MT.mobile) MT.mobile = {};

  /* ---------------- Utilitas ---------------- */

  function isMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function isSidebarOpen() {
    var sb = document.getElementById('sidebar');
    return sb && sb.classList.contains('is-open');
  }

  function openSidebar() {
    var sb = document.getElementById('sidebar');
    var sc = document.querySelector('.sidebar-scrim');
    if (sb) sb.classList.add('is-open');
    if (sc) sc.hidden = false;
    var closeBtn = document.querySelector('.sidebar-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeSidebar() {
    var sb = document.getElementById('sidebar');
    var sc = document.querySelector('.sidebar-scrim');
    if (sb) sb.classList.remove('is-open');
    if (sc) sc.hidden = true;
  }

  /* ---------------- Swipe gestures untuk sidebar ---------------- */

  var touchStartX = 0;
  var touchStartY = 0;
  var touchCurrentX = 0;
  var isSwiping = false;
  var isTracking = false;

  function onTouchStart(e) {
    if (!isMobile()) return;
    var t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchCurrentX = touchStartX;
    isTracking = true;

    if (touchStartX < 24 && !isSidebarOpen()) {
      isSwiping = true;
    } else if (isSidebarOpen()) {
      isSwiping = true;
    } else {
      isSwiping = false;
    }
  }

  function onTouchMove(e) {
    if (!isTracking || !isSwiping) return;
    var t = e.touches[0];
    touchCurrentX = t.clientX;
    var deltaX = touchCurrentX - touchStartX;
    var deltaY = Math.abs(t.clientY - touchStartY);

    // Batalkan jika dominan vertikal
    if (deltaY > Math.abs(deltaX) && Math.abs(deltaX) < 10) {
      isSwiping = false;
      return;
    }

    if (!isSidebarOpen() && deltaX > 0) {
      if (deltaX > 50) e.preventDefault();
    } else if (isSidebarOpen() && deltaX < 0) {
      if (Math.abs(deltaX) > 20) e.preventDefault();
    }
  }

  function onTouchEnd(e) {
    if (!isTracking) return;
    isTracking = false;
    if (!isSwiping) return;

    var deltaX = touchCurrentX - touchStartX;
    if (!isSidebarOpen() && deltaX > 60) {
      openSidebar();
    } else if (isSidebarOpen() && deltaX < -60) {
      closeSidebar();
    }
    isSwiping = false;
  }

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: true });

  /* ---------------- Pull-to-refresh ---------------- */

  var pullStartY = 0;
  var isPulling = false;
  var pullIndicator = null;
  var refreshThreshold = 80;

  function createPullIndicator() {
    if (pullIndicator) return pullIndicator;
    pullIndicator = document.createElement('div');
    pullIndicator.className = 'pull-refresh-indicator';
    pullIndicator.setAttribute('aria-hidden', 'true');
    pullIndicator.innerHTML =
      '<span class="pull-refresh-spinner"></span>' +
      '<span class="pull-refresh-text">Muat ulang...</span>';
    document.body.appendChild(pullIndicator);
    return pullIndicator;
  }

  function showPullIndicator() {
    var el = createPullIndicator();
    el.classList.add('is-visible');
  }

  function hidePullIndicator() {
    if (!pullIndicator) return;
    pullIndicator.classList.remove('is-visible', 'is-ready');
  }

  function triggerRefresh() {
    var event = new CustomEvent('mobile:refresh', { bubbles: true });
    document.dispatchEvent(event);
    if (typeof MT.renderRute === 'function') {
      MT.renderRute();
    }
  }

  var elContent = document.getElementById('konten');

  function onContentTouchStart(e) {
    if (!isMobile()) return;
    if (!elContent) return;
    if (elContent.scrollTop > 0) return;
    if (isSidebarOpen()) return;
    pullStartY = e.touches[0].clientY;
    isPulling = true;
  }

  function onContentTouchMove(e) {
    if (!isPulling || !isMobile()) return;
    if (!elContent || elContent.scrollTop > 0) {
      isPulling = false;
      hidePullIndicator();
      return;
    }
    var deltaY = e.touches[0].clientY - pullStartY;
    if (deltaY > 0 && elContent.scrollTop <= 0) {
      showPullIndicator();
      if (deltaY > refreshThreshold) {
        pullIndicator.classList.add('is-ready');
      } else {
        pullIndicator.classList.remove('is-ready');
      }
    }
  }

  function onContentTouchEnd(e) {
    if (!isPulling || !isMobile()) return;
    isPulling = false;
    if (!elContent) return;
    var endY = (e.changedTouches[0] && e.changedTouches[0].clientY) || pullStartY;
    var deltaY = endY - pullStartY;
    if (deltaY > refreshThreshold && elContent.scrollTop <= 0) {
      triggerRefresh();
    }
    hidePullIndicator();
  }

  if (elContent) {
    elContent.addEventListener('touchstart', onContentTouchStart, { passive: true });
    elContent.addEventListener('touchmove', onContentTouchMove, { passive: false });
    elContent.addEventListener('touchend', onContentTouchEnd, { passive: true });
  }

  /* ---------------- Touch feedback ---------------- */

  document.addEventListener('touchstart', function (e) {
    var target = e.target.closest(
      'button, a, .nav-item, .rail-item, .dash-quick-btn, .quick-action, ' +
      '.dropdown-item, .fg-item, .page-btn, .bottom-nav-item, .link-button, .user-chip, .switch'
    );
    if (target) target.classList.add('touch-active');
  }, { passive: true });

  function clearTouchActive(e) {
    var target = e.target.closest(
      'button, a, .nav-item, .rail-item, .dash-quick-btn, .quick-action, ' +
      '.dropdown-item, .fg-item, .page-btn, .bottom-nav-item, .link-button, .user-chip, .switch'
    );
    if (target) target.classList.remove('touch-active');
  }

  document.addEventListener('touchend', clearTouchActive, { passive: true });
  document.addEventListener('touchcancel', clearTouchActive, { passive: true });

  /* ---------------- Bottom navigation (mobile) ---------------- */

  function renderBottomNav() {
    var bottomNav = document.getElementById('bottom-nav');
    if (!bottomNav) return;

    var items = [
      { nama: 'dashboard', label: 'Dashboard', ikon: 'dashboard' },
      { nama: 'tugas', label: 'Tugas', ikon: 'tasks' },
      { nama: 'pengingat', label: 'Pengingat', ikon: 'reminder' },
      { nama: 'pengguna', label: 'Akun', ikon: 'users' }
    ];

    var hash = (location.hash.replace(/^#\/?/, '').split('/')[0] || 'dashboard');
    var html = '';
    items.forEach(function (item) {
      var active = (hash === item.nama) ? ' is-active' : '';
      html +=
        '<a class="bottom-nav-item' + active + '" href="#/' + item.nama + '" data-nav="' + item.nama + '">' +
          '<span class="bottom-nav-icon">' + MT.icon(item.ikon) + '</span>' +
          '<span class="bottom-nav-label">' + MT.esc(item.label) + '</span>' +
        '</a>';
    });
    bottomNav.innerHTML = html;
  }

  function updateBottomNav() {
    var hash = (location.hash.replace(/^#\/?/, '').split('/')[0] || 'dashboard');
    document.querySelectorAll('.bottom-nav-item').forEach(function (el) {
      var nama = el.getAttribute('data-nav');
      el.classList.toggle('is-active', nama === hash);
    });
  }

  renderBottomNav();
  window.addEventListener('hashchange', updateBottomNav);

  // Tutup sidebar saat navigasi bottom diklik di mobile
  document.addEventListener('click', function (e) {
    if (!isMobile()) return;
    var target = e.target.closest('.bottom-nav-item');
    if (target && isSidebarOpen()) {
      closeSidebar();
    }
  });

  /* ---------------- Expose API ---------------- */

  MT.mobile = {
    isMobile: isMobile,
    openSidebar: openSidebar,
    closeSidebar: closeSidebar,
    updateBottomNav: updateBottomNav
  };

})(window.MT);
