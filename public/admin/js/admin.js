(function () {
  'use strict';

  var SECTIONS = {
    tech: { label: 'AI 科技', commentLabel: '深度解读' },
    edu: { label: 'AI + 教育', commentLabel: '教育观察' },
    culture: { label: 'AI + 文化', commentLabel: '文化观察' }
  };

  var state = {
    currentSection: 'tech',
    data: null,
    token: localStorage.getItem('admin_token') || '',
    loadSeq: 0
  };

  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function $(id) { return document.getElementById(id); }

  function showToast(msg, type) {
    var el = $('toast');
    el.textContent = msg;
    el.className = 'toast show' + (type ? ' ' + type : '');
    setTimeout(function () { el.className = 'toast'; }, 2800);
  }

  function api(path, options) {
    options = options || {};
    var headers = { 'Content-Type': 'application/json' };
    if (state.token && !options.skipAuth) {
      headers['Authorization'] = 'Bearer ' + state.token;
    }
    return fetch('/admin/api' + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = {};
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (e) {
            throw new Error('服务器响应异常，请刷新页面后重试');
          }
        }
        if (!res.ok) throw new Error(data.error || '请求失败（' + res.status + '）');
        return data;
      });
    }).catch(function (err) {
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error('无法连接服务器，请联系管理员检查服务是否运行');
      }
      throw err;
    });
  }

  function formatDateDisplay(dateStr) {
    var p = dateStr.split('-');
    var d = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
    return p[0] + ' 年 ' + parseInt(p[1]) + ' 月 ' + parseInt(p[2]) + ' 日 · ' + WEEKDAYS[d.getDay()];
  }

  function formatOgTitle(dateStr) {
    var p = dateStr.split('-');
    return '冰块AI资讯日报 · ' + parseInt(p[1]) + '月' + parseInt(p[2]) + '日';
  }

  function emptyItem() {
    return { title: '', body: '', sources: [], comment: '' };
  }

  function defaultData(date) {
    return {
      date: date,
      date_display: formatDateDisplay(date),
      meta: {
        title: '冰块AI资讯日报 | ' + date,
        og_title: formatOgTitle(date),
        og_description: 'AI科技 × AI+教育 × AI+文化，三大板块一键切换',
        og_image: 'https://www.coze.cn/s/A10awpVKceE/'
      },
      sections: {
        tech: {
          label: 'AI 科技', icon: '🌐', intro: '前沿动态与深度解读',
          comment_label: '深度解读', items: []
        },
        edu: {
          label: 'AI + 教育', icon: '📖', intro: 'AI 教育与青年成长',
          comment_label: '教育观察', items: []
        },
        culture: {
          label: 'AI + 文化', icon: '✒️', intro: 'AI 重塑文化发展',
          comment_label: '文化观察', items: []
        }
      }
    };
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function hasContent(data) {
    if (!data || !data.sections) return false;
    return ['tech', 'edu', 'culture'].some(function (sid) {
      return (data.sections[sid].items || []).some(function (item) {
        return item.title || item.body || item.comment;
      });
    });
  }

  function activateSection(section) {
    state.currentSection = section;
    document.querySelectorAll('.admin-tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.getAttribute('data-section') === section);
    });
  }

  function createNewDaily(date, options) {
    options = options || {};
    date = date || todayStr();
    if (!date) {
      showToast('请先选择日期', 'error');
      return;
    }

    if (!options.force && state.data && hasContent(state.data)) {
      if (!window.confirm('当前内容尚未保存，确定要新建空白日报吗？')) return;
    }

    state.loadSeq += 1;
    $('edit-date').value = date;
    state.data = defaultData(date);
    activateSection('tech');
    updateCounts();
    renderNewsList();

    if (options.autoFirstItem !== false) {
      state.data.sections.tech.items.push(emptyItem());
      updateCounts();
      renderNewsList();
      var firstInput = document.querySelector('#news-list [data-field="title"]');
      if (firstInput) firstInput.focus();
    }

    if (!options.silent) {
      showToast('已创建 ' + date + ' 空白日报，请开始填写', 'success');
    }
  }

  function showPage(loggedIn) {
    $('login-page').classList.toggle('hidden', loggedIn);
    $('admin-page').classList.toggle('hidden', !loggedIn);
  }

  function switchSection(section) {
    if (section !== state.currentSection) {
      collectFormData();
    }
    state.currentSection = section;
    document.querySelectorAll('.admin-tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.getAttribute('data-section') === section);
    });
    renderNewsList();
  }

  function updateCounts() {
    if (!state.data) return;
    ['tech', 'edu', 'culture'].forEach(function (sid) {
      var el = $('count-' + sid);
      if (el) el.textContent = (state.data.sections[sid].items || []).length;
    });
  }

  function collectFormData() {
    if (!state.data) return;
    var section = state.currentSection;
    var cards = document.querySelectorAll('#news-list .news-editor');
    if (!cards.length) return;

    var items = [];
    cards.forEach(function (card) {
      var titleEl = card.querySelector('[data-field="title"]');
      var bodyEl = card.querySelector('[data-field="body"]');
      var commentEl = card.querySelector('[data-field="comment"]');
      if (!titleEl || !bodyEl || !commentEl) return;

      var title = titleEl.value.trim();
      var body = bodyEl.value.trim();
      var comment = commentEl.value.trim();
      var sources = [];

      card.querySelectorAll('.source-row').forEach(function (row) {
        var textEl = row.querySelector('[data-field="source-text"]');
        var urlEl = row.querySelector('[data-field="source-url"]');
        if (!textEl || !urlEl) return;
        var text = textEl.value.trim();
        var url = urlEl.value.trim();
        if (text || url) sources.push({ text: text, url: url });
      });

      items.push({ title: title, body: body, sources: sources, comment: comment });
    });

    state.data.sections[section].items = items;
    updateCounts();
  }

  function renderSourceRow(source, idx) {
    source = source || { text: '', url: '' };
    return (
      '<div class="source-row" data-source-idx="' + idx + '">' +
        '<input type="text" data-field="source-text" placeholder="来源名称，如：来源：头条新闻" value="' + esc(source.text) + '">' +
        '<input type="text" data-field="source-url" placeholder="链接地址 https://..." value="' + esc(source.url) + '">' +
        '<button type="button" class="btn-remove" title="删除来源">&times;</button>' +
      '</div>'
    );
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderNewsCard(item, index) {
    var cfg = SECTIONS[state.currentSection];
    var sourcesHtml = (item.sources && item.sources.length)
      ? item.sources.map(function (s, i) { return renderSourceRow(s, i); }).join('')
      : '';

    return (
      '<div class="news-editor" data-index="' + index + '">' +
        '<div class="news-editor-header">' +
          '<span class="index-badge">' + (index + 1) + '</span>' +
          '<button type="button" class="btn btn-danger btn-sm btn-remove-news">删除本条</button>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>新闻标题</label>' +
          '<input type="text" data-field="title" placeholder="输入新闻标题" value="' + esc(item.title) + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label>新闻正文</label>' +
          '<textarea data-field="body" rows="5" placeholder="粘贴或输入新闻正文（纯文字即可）">' + esc(item.body) + '</textarea>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>来源链接</label>' +
          '<div class="sources-list">' + sourcesHtml + '</div>' +
          '<button type="button" class="btn btn-outline btn-sm btn-add-source">+ 添加来源</button>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>' + cfg.commentLabel + '</label>' +
          '<textarea data-field="comment" rows="4" placeholder="输入' + cfg.commentLabel + '内容">' + esc(item.comment) + '</textarea>' +
        '</div>' +
      '</div>'
    );
  }

  function renderNewsList() {
    if (!state.data) return;
    var section = state.currentSection;
    var items = state.data.sections[section].items || [];
    var list = $('news-list');

    if (!items.length) {
      list.innerHTML = '<p class="empty-hint">暂无新闻，点击下方「添加一条新闻」开始填写</p>';
      return;
    }

    list.innerHTML = items.map(function (item, i) { return renderNewsCard(item, i); }).join('');
    bindNewsEvents();
  }

  function bindNewsEvents() {
    document.querySelectorAll('.btn-remove-news').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.news-editor');
        var idx = parseInt(card.getAttribute('data-index'), 10);
        collectFormData();
        state.data.sections[state.currentSection].items.splice(idx, 1);
        renderNewsList();
      });
    });

    document.querySelectorAll('.btn-add-source').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var list = btn.previousElementSibling;
        var idx = list.querySelectorAll('.source-row').length;
        list.insertAdjacentHTML('beforeend', renderSourceRow({}, idx));
        bindSourceRemove(list);
      });
    });

    document.querySelectorAll('.sources-list').forEach(bindSourceRemove);
  }

  function bindSourceRemove(container) {
    container.querySelectorAll('.btn-remove').forEach(function (btn) {
      btn.onclick = function () {
        btn.closest('.source-row').remove();
      };
    });
  }

  function addNewsItem() {
    if (!state.data) {
      showToast('请先点击「新建今日」或「加载」创建日报', 'error');
      return;
    }
    collectFormData();
    if (!state.data.sections[state.currentSection].items) {
      state.data.sections[state.currentSection].items = [];
    }
    state.data.sections[state.currentSection].items.push(emptyItem());
    updateCounts();
    renderNewsList();
    var cards = document.querySelectorAll('#news-list .news-editor');
    if (cards.length) {
      var last = cards[cards.length - 1];
      var titleInput = last.querySelector('[data-field="title"]');
      if (titleInput) titleInput.focus();
      last.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function loadDaily(date, options) {
    options = options || {};
    if (!date) {
      showToast('请先选择日期', 'error');
      return;
    }
    var seq = ++state.loadSeq;

    api('/daily/' + date).then(function (data) {
      if (seq !== state.loadSeq) return;
      state.data = data;
      $('edit-date').value = date;
      activateSection(state.currentSection);
      renderNewsList();
      updateCounts();
      showToast('已加载 ' + date, 'success');
    }).catch(function (err) {
      if (seq !== state.loadSeq) return;
      if (err.message.indexOf('not found') >= 0 || err.message.indexOf('404') >= 0) {
        createNewDaily(date, { force: true, silent: true });
        showToast('该日期暂无内容，已创建空白模板', 'success');
      } else {
        showToast(err.message, 'error');
      }
    });
  }

  function publish(publishLatest) {
    if (!state.data) {
      showToast('没有可保存的内容', 'error');
      return;
    }
    collectFormData();
    var date = $('edit-date').value;
    if (!date) { showToast('请选择日期', 'error'); return; }

    // 发布上线时过滤掉完全空白的新闻条，保存草稿时保留
    if (publishLatest !== false) {
      ['tech', 'edu', 'culture'].forEach(function (sid) {
        state.data.sections[sid].items = (state.data.sections[sid].items || []).filter(function (item) {
          return item.title || item.body || item.comment;
        });
      });
      updateCounts();
      renderNewsList();
    }

    state.data.date = date;
    state.data.date_display = formatDateDisplay(date);
    state.data.meta.title = '冰块AI资讯日报 | ' + date;
    state.data.meta.og_title = formatOgTitle(date);

    api('/daily', {
      method: 'POST',
      body: { data: state.data, publish: publishLatest !== false }
    }).then(function (res) {
      var isToday = date === todayStr();
      if (publishLatest !== false) {
        showToast(
          isToday ? '发布成功！前台已更新为今日日报' : '历史日报已保存，前台默认仍显示当天日报',
          'success'
        );
      } else {
        showToast('草稿已保存', 'success');
      }
    }).catch(function (err) {
      showToast(err.message, 'error');
    });
  }

  function copyFromYesterday() {
    var date = $('edit-date').value;
    api('/copy-from/' + date).then(function (data) {
      state.data = data;
      switchSection(state.currentSection);
      updateCounts();
      showToast('已从最近一期复制，请修改内容后发布', 'success');
    }).catch(function (err) {
      showToast(err.message, 'error');
    });
  }

  function parseHtmlClient(html) {
    html = html.replace(/\xa0/g, ' ');
    var sections = {};
    var configs = {
      tech: { label: 'AI 科技', icon: '🌐', intro: '前沿动态与深度解读', comment_label: '深度解读' },
      edu: { label: 'AI + 教育', icon: '📖', intro: 'AI 教育与青年成长', comment_label: '教育观察' },
      culture: { label: 'AI + 文化', icon: '✒️', intro: 'AI 重塑文化发展', comment_label: '文化观察' }
    };

    ['tech', 'edu', 'culture'].forEach(function (sid) {
      var pattern = new RegExp('<div class="tab-content[^"]*" id="tab-' + sid + '">([\\s\\S]*?)(?=<div class="tab-content"|</div>\\s*</div>\\s*<div class="footer">)');
      var m = html.match(pattern);
      var sectionHtml = m ? m[1] : '';
      var items = [];
      var parts = sectionHtml.split('<div class="news-card">');

      for (var i = 1; i < parts.length; i++) {
        var part = parts[i];
        var titleM = part.match(/<div class="news-title">([\s\S]*?)<\/div>/);
        var bodyM = part.match(/<div class="news-body">([\s\S]*?)<\/div>/);
        var commentM = part.match(/<div class="comment-text">([\s\S]*?)<\/div>/);
        if (!titleM) continue;

        var title = titleM[1].replace(/<[^>]+>/g, '').trim();
        var bodyHtml = bodyM ? bodyM[1] : '';
        var comment = commentM ? commentM[1].replace(/<[^>]+>/g, '').trim() : '';
        var sources = [];
        var linkRe = /<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
        var lm;
        while ((lm = linkRe.exec(bodyHtml)) !== null) {
          sources.push({ url: lm[1], text: lm[2].trim() });
        }
        var body = bodyHtml.replace(/<a[^>]*>[^<]*<\/a>/g, '').replace(/<[^>]+>/g, '').trim();
        items.push({ title: title, body: body, sources: sources, comment: comment });
      }

      sections[sid] = Object.assign({}, configs[sid], { items: items });
    });

    var dateM = html.match(/<div class="date">([^<]+)<\/div>/);
    var date = $('edit-date').value || todayStr();

    return {
      date: date,
      date_display: dateM ? dateM[1].trim() : formatDateDisplay(date),
      meta: {
        title: '冰块AI资讯日报 | ' + date,
        og_title: formatOgTitle(date),
        og_description: 'AI科技 × AI+教育 × AI+文化，三大板块一键切换',
        og_image: 'https://www.coze.cn/s/A10awpVKceE/'
      },
      sections: sections
    };
  }

  function initEvents() {
    $('login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = e.target.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      api('/login', {
        method: 'POST',
        skipAuth: true,
        body: {
          username: $('username').value.trim(),
          password: $('password').value
        }
      }).then(function (res) {
        state.token = res.token;
        localStorage.setItem('admin_token', res.token);
        showPage(true);
        loadDaily(todayStr());
      }).catch(function (err) {
        showToast(err.message, 'error');
      }).finally(function () {
        if (btn) btn.disabled = false;
      });
    });

    $('btn-logout').addEventListener('click', function () {
      api('/logout', { method: 'POST' }).catch(function () {});
      state.token = '';
      localStorage.removeItem('admin_token');
      showPage(false);
    });

    document.querySelectorAll('.admin-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        switchSection(tab.getAttribute('data-section'));
      });
    });

    $('btn-add-news').addEventListener('click', addNewsItem);
    $('btn-load').addEventListener('click', function () {
      var date = $('edit-date').value;
      if (!date) {
        $('edit-date').value = todayStr();
        date = $('edit-date').value;
      }
      loadDaily(date);
    });
    $('btn-new').addEventListener('click', function () {
      var date = $('edit-date').value || todayStr();
      $('edit-date').value = date;
      createNewDaily(date);
    });
    $('btn-copy').addEventListener('click', copyFromYesterday);
    $('btn-publish').addEventListener('click', function () { publish(true); });
    $('btn-save-draft').addEventListener('click', function () { publish(false); });

    $('btn-import').addEventListener('click', function () {
      $('import-modal').classList.remove('hidden');
    });
    $('btn-import-cancel').addEventListener('click', function () {
      $('import-modal').classList.add('hidden');
    });
    $('html-file').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) { $('html-content').value = ev.target.result; };
      reader.readAsText(file, 'UTF-8');
    });
    $('btn-import-confirm').addEventListener('click', function () {
      var html = $('html-content').value.trim();
      if (!html) { showToast('请粘贴或上传 HTML 内容', 'error'); return; }
      try {
        state.data = parseHtmlClient(html);
        $('edit-date').value = state.data.date;
        switchSection(state.currentSection);
        updateCounts();
        $('import-modal').classList.add('hidden');
        $('html-content').value = '';
        showToast('HTML 解析成功，请检查内容后发布', 'success');
      } catch (err) {
        showToast('解析失败：' + err.message, 'error');
      }
    });
  }

  function checkAuth() {
    if (!state.token) {
      showPage(false);
      return;
    }
    api('/me').then(function () {
      showPage(true);
      $('edit-date').value = todayStr();
      loadDaily(todayStr());
    }).catch(function () {
      state.token = '';
      localStorage.removeItem('admin_token');
      showPage(false);
      showToast('登录已过期，请重新登录', 'error');
    });
  }

  initEvents();
  checkAuth();
})();
