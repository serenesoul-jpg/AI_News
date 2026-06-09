(function () {
  'use strict';

  var state = {
    data: null,
    currentTab: 'tech',
    availableDates: []
  };

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderSources(sources) {
    if (!sources || !sources.length) return '';
    return sources.map(function (s) {
      return '<a class="source-link" href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener">' +
        escapeHtml(s.text) + '</a>';
    }).join('');
  }

  function renderNewsCard(item, index, commentLabel) {
    var sourcesHtml = renderSources(item.sources);
    var sourcesBlock = sourcesHtml
      ? '<div class="news-sources">' + sourcesHtml + '</div>'
      : '';

    return (
      '<article class="news-card">' +
        '<div class="news-index">' + (index + 1) + '</div>' +
        '<h2 class="news-title">' + escapeHtml(item.title) + '</h2>' +
        '<div class="news-body">' + escapeHtml(item.body) + '</div>' +
        sourcesBlock +
        '<div class="comment-toggle" role="button" tabindex="0" aria-expanded="false">' +
          '<span class="comment-label">' + escapeHtml(commentLabel) + '</span>' +
          '<span class="toggle-arrow" aria-hidden="true">▼</span>' +
        '</div>' +
        '<div class="comment-block">' +
          '<div class="comment-text">' + escapeHtml(item.comment) + '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function renderPage(data) {
    state.data = data;

    document.title = data.meta.title;
    document.getElementById('page-title').textContent = '冰块 AI 资讯日报';
    document.getElementById('date-line').textContent = data.date_display;

    var ogTitle = document.querySelector('meta[property="og:title"]');
    var ogDesc = document.querySelector('meta[property="og:description"]');
    var ogImage = document.querySelector('meta[property="og:image"]');
    if (ogTitle) ogTitle.setAttribute('content', data.meta.og_title);
    if (ogDesc) ogDesc.setAttribute('content', data.meta.og_description);
    if (ogImage) ogImage.setAttribute('content', data.meta.og_image);

    var tabOrder = ['tech', 'edu', 'culture'];
    var nav = document.getElementById('tab-nav');
    var container = document.getElementById('main-container');

    nav.innerHTML = '';
    container.innerHTML = '';

    tabOrder.forEach(function (sid, i) {
      var section = data.sections[sid];
      if (!section) return;

      var btn = document.createElement('button');
      btn.className = 'tab-btn' + (i === 0 ? ' active' : '');
      btn.setAttribute('data-tab', sid);
      btn.setAttribute('type', 'button');
      btn.innerHTML =
        '<span class="tab-icon">' + section.icon + '</span>' +
        '<span class="tab-label">' + escapeHtml(section.label) + '</span>';
      btn.addEventListener('click', function () { switchTab(sid); });
      nav.appendChild(btn);

      var panel = document.createElement('div');
      panel.className = 'tab-content' + (i === 0 ? ' active' : '');
      panel.id = 'tab-' + sid;

      var intro = '<div class="section-intro">' + escapeHtml(section.intro) + '</div>';
      var cards = (section.items || []).map(function (item, idx) {
        return renderNewsCard(item, idx, section.comment_label);
      }).join('');

      panel.innerHTML = intro + (cards || '<div class="empty-state">暂无内容</div>');
      container.appendChild(panel);
    });

    bindCommentToggles();
    state.currentTab = tabOrder[0];
  }

  function switchTab(tab) {
    state.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('.tab-content').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'tab-' + tab);
    });
  }

  function toggleComment(el) {
    var isOpen = el.classList.toggle('open');
    el.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    var block = el.nextElementSibling;
    if (block) block.classList.toggle('open', isOpen);
  }

  function bindCommentToggles() {
    document.querySelectorAll('.comment-toggle').forEach(function (el) {
      el.addEventListener('click', function () { toggleComment(el); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleComment(el);
        }
      });
    });
  }

  function populateDatePicker(dates, currentDate) {
    var select = document.getElementById('date-select');
    if (!select) return;

    select.innerHTML = dates.map(function (d) {
      var label = d.replace(/-/g, '/');
      var selected = d === currentDate ? ' selected' : '';
      return '<option value="' + d + '"' + selected + '>' + label + '</option>';
    }).join('');

    select.addEventListener('change', function () {
      loadDaily(select.value);
    });
  }

  function showLoading() {
    document.getElementById('main-container').innerHTML =
      '<div class="loading"><div class="loading-spinner"></div>加载中...</div>';
  }

  function showError(msg) {
    document.getElementById('main-container').innerHTML =
      '<div class="empty-state">' + escapeHtml(msg) + '</div>';
  }

  function loadDaily(date) {
    showLoading();
    var url = date ? '/api/daily/' + date : '/api/daily/latest';

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('加载失败');
        return res.json();
      })
      .then(function (data) {
        renderPage(data);
        var select = document.getElementById('date-select');
        if (select && select.value !== data.date) {
          select.value = data.date;
        }
      })
      .catch(function () {
        showError('内容加载失败，请稍后重试');
      });
  }

  function init() {
    fetch('/api/dates')
      .then(function (res) { return res.json(); })
      .then(function (dates) {
        state.availableDates = dates;
        var params = new URLSearchParams(window.location.search);
        var dateParam = params.get('date');
        populateDatePicker(dates, dateParam || dates[0]);
        loadDaily(dateParam || null);
      })
      .catch(function () {
        loadDaily(null);
      });
  }

  window.switchTab = switchTab;
  window.toggleComment = toggleComment;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
