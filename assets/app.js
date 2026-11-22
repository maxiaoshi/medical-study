/* =====================================================================
 * 医学学习平台 · 应用引擎 v2
 * 依赖：pharm-outline.js(DB) / content-*.js(CONTENT) / questions-*.js(DB_QUESTIONS)
 *      / videos.js(DB_VIDEOS) / mech.js + mech-2.js(DB_MECH / DB_MECH2)
 *
 * v2 主要变化
 *  1) 诊断学 / 药理学 双科目独立目录：顶栏切换 + 侧栏科目卡 + 路由带科目前缀
 *  2) 学习步骤条改为「分步渲染」：每一步只渲染自己的内容面板，可前后切换、可跳步
 *  3) 性能：目录树按需重建并做签名比对、去掉 backdrop-filter、事件委托、避免整树重绘
 *  4) 主题：药理学用靛蓝，诊断学用深青，body.class 切换 CSS 变量
 *
 * 布局断点（与 app.css 严格一致）
 *   <768px      单列 + 底部 Tab + 目录抽屉
 *   768~1023px  两栏，.app.rail 可折叠图标条
 *   ≥1280px     正文 + 右侧信息栏双栏
 * ===================================================================== */
(function () {
  'use strict';

  /* ================= 1. 工具 ================= */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
  const dayKey = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate()); };
  const today = () => dayKey(new Date());
  const dayDiff = (a, b) => Math.floor((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  const shiftDay = (key, n) => { const d = new Date(key + 'T00:00:00'); d.setDate(d.getDate() + n); return dayKey(d); };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mmss = (sec) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60); return m + ':' + pad2(sec % 60); };
  const isMobile = () => window.matchMedia('(max-width:767.98px)').matches;

  /** 极简内联标记：**加粗** → <strong>，[[数值]] → 色块，`代码` 保持原样 */
  function inline(str) {
    let s = esc(str);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[\[(.+?)\]\]/g, '<span class="mark-num">$1</span>');
    return s;
  }

  let toastTimer = null;
  function toast(msg, ms) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), ms || 1900);
  }

  function raf(fn) { return window.requestAnimationFrame(fn); }

  /* ================= 2. 持久化 ================= */
  const KEY = 'med_learn_v1';
  const DEFAULT_STATE = {
    ver: 2,
    activeTab: 'learn',
    activeSubject: 'diag',
    section: {},
    cards: {},
    quiz: { records: {}, days: {}, streak: { last: '', days: 0 }, sessions: [] },
    wrong: {},
    fav: {},
    notes: {},
    videos: {},
    examDate: '',
    examDates: { diag: '', pharm: '' },
    night: false,
    mechStep: {},
    installTipDismissed: false,
    lastSection: '',
    lastSubjectSection: { diag: '', pharm: '' },
    stepOf: {}
  };

  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STATE));
      const obj = JSON.parse(raw);
      const merged = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), obj);
      if (!merged.lastSubjectSection) merged.lastSubjectSection = { diag: '', pharm: '' };
      if (!merged.stepOf) merged.stepOf = {};
      return merged;
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT_STATE)); }
  }
  let saveTimer = null;
  function save(now) {
    if (now) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} return; }
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
    }, 400);
  }

  /* ================= 3. 数据索引 ================= */
  const DB = window.DB || { subjects: [] };
  const QUESTIONS = (window.DB_QUESTIONS || []).slice();
  const VIDEOS = window.DB_VIDEOS || [];
  const MECHS = (window.DB_MECH || []).concat(window.DB_MECH2 || []);

  const IDX = {
    subjects: DB.subjects,
    sections: {}, secOrder: [],
    bySubject: {},
    questionsById: {},
    qBySection: {}, qByChapter: {}, qBySubject: {},
    vBySection: {},
    mechById: {},
    secBySubject: {}
  };

  DB.subjects.forEach((sub) => {
    IDX.bySubject[sub.id] = { sub: sub, chapters: sub.chapters };
    IDX.secBySubject[sub.id] = [];
    sub.chapters.forEach((ch) => {
      ch.subjectId = sub.id;
      ch.sections.forEach((sec) => {
        sec.subjectId = sub.id;
        sec.chapterId = ch.id;
        sec.chapterName = ch.name;
        sec.chapterNo = ch.no;
        IDX.sections[sec.id] = sec;
        IDX.secOrder.push(sec.id);
        IDX.secBySubject[sub.id].push(sec.id);
      });
    });
  });
  QUESTIONS.forEach((q) => {
    IDX.questionsById[q.id] = q;
    (IDX.qBySection[q.section] = IDX.qBySection[q.section] || []).push(q.id);
    const sec = IDX.sections[q.section];
    const cid = q.chapter || (sec && sec.chapterId);
    if (cid) (IDX.qByChapter[cid] = IDX.qByChapter[cid] || []).push(q.id);
    (IDX.qBySubject[q.sub] = IDX.qBySubject[q.sub] || []).push(q.id);
  });
  VIDEOS.forEach((v) => { (IDX.vBySection[v.section] = IDX.vBySection[v.section] || []).push(v); });
  MECHS.forEach((m) => { IDX.mechById[m.id] = m; });

  const SUBJECT_META = {
    diag: { name: '诊断学', short: '诊', hasVideo: false, desc: '症状学 · 体格检查 · 实验诊断 · 心电图' },
    pharm: { name: '药理学', short: '药', hasVideo: true, desc: '总论 · 传出神经 · 中枢 · 心血管 · 化疗药' }
  };

  /* ================= 4. 进度模型 ================= */
  const IVS = [1, 2, 4, 7, 15];

  function secState(id) {
    let st = S.section[id];
    if (!st) st = S.section[id] = {};
    if (!st.srs) st.srs = { iv: 0, due: '', ease: 1 };
    if (st.timeSec == null) st.timeSec = 0;
    if (!st.status) st.status = 'unlearned';
    if (!st.self) st.self = 'none';
    return st;
  }
  function qStats(qid) { return S.quiz.records[qid] || { right: 0, wrong: 0, lastAt: '' }; }

  function chapterAccuracy(chapterId) {
    const ids = IDX.qByChapter[chapterId] || [];
    let r = 0, w = 0;
    for (let i = 0; i < ids.length; i++) { const st = qStats(ids[i]); r += st.right; w += st.wrong; }
    return (r + w) ? r / (r + w) : null;
  }
  function sectionAccuracy(secId) {
    const ids = IDX.qBySection[secId] || [];
    let r = 0, w = 0;
    for (let i = 0; i < ids.length; i++) { const st = qStats(ids[i]); r += st.right; w += st.wrong; }
    return (r + w) ? r / (r + w) : null;
  }
  function sectionMastery(secId) {
    const st = secState(secId);
    const selfScore = st.self === 'mastered' ? 1 : st.self === 'seen' ? 0.55 : st.status === 'learning' ? 0.25 : 0;
    const acc = sectionAccuracy(secId);
    let m = selfScore * 0.55 + (acc === null ? selfScore * 0.45 : acc * 0.45);
    if (st.srs && st.srs.iv >= 3) m += 0.08;
    return clamp(m, 0, 1);
  }
  function learnProgress(subjectId) {
    const ids = IDX.secBySubject[subjectId] || [];
    let done = 0;
    ids.forEach((id) => {
      const st = secState(id);
      if (st.status === 'mastered' || st.self === 'mastered') done += 1;
      else if (st.status === 'learning') done += 0.45;
    });
    return { done: Math.round(done * 10) / 10, total: ids.length, pct: ids.length ? Math.round((done / ids.length) * 100) : 0 };
  }
  function subjectMastery(subjectId) {
    const ids = IDX.secBySubject[subjectId] || [];
    if (!ids.length) return 0;
    let sum = 0;
    ids.forEach((id) => { sum += sectionMastery(id); });
    return Math.round((sum / ids.length) * 100);
  }
  function findChapter(id) {
    for (let i = 0; i < DB.subjects.length; i++) {
      const chs = DB.subjects[i].chapters;
      for (let j = 0; j < chs.length; j++) if (chs[j].id === id) return chs[j];
    }
    return null;
  }
  function chapterMastery(chapterId) {
    const ch = findChapter(chapterId);
    if (!ch || !ch.sections.length) return 0;
    let s = 0;
    ch.sections.forEach((x) => { s += sectionMastery(x.id); });
    return s / ch.sections.length;
  }

  function touchStreak() {
    const t = today();
    if (S.quiz.streak.last === t) return;
    const last = S.quiz.streak.last;
    if (last && dayDiff(last, t) === 1) S.quiz.streak.days += 1;
    else S.quiz.streak.days = 1;
    S.quiz.streak.last = t;
    save();
  }
  function recordAnswer(qid, correct) {
    const rec = S.quiz.records[qid] = S.quiz.records[qid] || { right: 0, wrong: 0, lastAt: '' };
    if (correct) rec.right++; else rec.wrong++;
    rec.lastAt = new Date().toISOString();
    const d = S.quiz.days[today()] = S.quiz.days[today()] || { answered: 0, right: 0 };
    d.answered++; if (correct) d.right++;
    if (!correct) {
      const w = S.wrong[qid] = S.wrong[qid] || { at: '', times: 0, done: false };
      w.at = new Date().toISOString(); w.times++; w.done = false;
    }
    touchStreak();
    save();
  }

  /* ================= 5. 记忆卡片 ================= */
  const cardCache = {};
  function cardsOf(secId) {
    if (cardCache[secId]) return cardCache[secId];
    const sec = IDX.sections[secId];
    if (!sec) return [];
    let list = (sec.cards || []).map((c, i) => ({ id: secId + '#' + i, sec: secId, f: c.f, b: c.b }));
    if (list.length < 3) {
      const extra = [];
      (sec.exam || []).forEach((t, i) => extra.push({ id: secId + '#e' + i, sec: secId, f: sec.name + ' · 考点' + (i + 1), b: t }));
      (sec.preview || []).forEach((t, i) => extra.push({ id: secId + '#p' + i, sec: secId, f: sec.name + ' · 要点' + (i + 1), b: t }));
      list = list.concat(extra);
    }
    list = list.slice(0, 10);
    cardCache[secId] = list;
    return list;
  }
  function cardState(cid) {
    let c = S.cards[cid];
    if (!c) c = S.cards[cid] = { due: today(), iv: 0, ease: 1, hits: 0, miss: 0, lastAt: '' };
    return c;
  }
  let allCardsCache = null;
  function allCards() {
    if (allCardsCache) return allCardsCache;
    const out = [];
    IDX.secOrder.forEach((sid) => { cardsOf(sid).forEach((c) => out.push(c)); });
    allCardsCache = out;
    return out;
  }
  function dueCards(subjectId) {
    const t = today();
    return allCards().filter((c) => {
      if (subjectId && IDX.sections[c.sec] && IDX.sections[c.sec].subjectId !== subjectId) return false;
      const st = cardState(c.id);
      return !st.due || st.due <= t;
    });
  }
  function rateCard(cid, grade) {
    const st = cardState(cid);
    st.lastAt = today();
    if (grade === 0) { st.iv = 0; st.ease = Math.max(1, st.ease - 0.25); st.miss++; st.due = today(); }
    else if (grade === 1) {
      st.ease = Math.max(1, st.ease - 0.1);
      st.due = shiftDay(today(), Math.max(1, Math.round(IVS[Math.min(st.iv, 4)] / 2)));
      st.iv = Math.min(4, st.iv + 1);
    } else {
      st.ease = Math.min(3, st.ease + 0.08); st.hits++;
      st.iv = Math.min(4, st.iv + 1);
      st.due = shiftDay(today(), IVS[st.iv]);
    }
    save();
  }

  /* ================= 6. SRS 复习队列 ================= */
  function sectionDueList(subjectId) {
    const t = today();
    const out = [];
    const ids = subjectId ? (IDX.secBySubject[subjectId] || []) : IDX.secOrder;
    ids.forEach((sid) => {
      const st = secState(sid);
      if (st.status === 'unlearned' && !st.lastDay) return;
      if (!st.srs.due) {
        if (!st.lastDay) return;
        st.srs.iv = 0;
        st.srs.due = shiftDay(st.lastDay, 1);
      }
      if (st.srs.due <= t) out.push({ sec: IDX.sections[sid], st: st, overdue: dayDiff(st.srs.due, t) });
    });
    out.sort((a, b) => b.overdue - a.overdue);
    return out;
  }
  function rateSection(secId, grade) {
    const st = secState(secId);
    st.lastDay = today();
    if (grade === 0) { st.srs.iv = 0; st.srs.due = shiftDay(today(), 1); st.srs.ease = Math.max(1, st.srs.ease - 0.3); }
    else if (grade === 1) {
      st.srs.iv = Math.max(0, st.srs.iv - 1);
      st.srs.due = shiftDay(today(), Math.max(1, IVS[st.srs.iv] - 1));
      st.srs.ease = Math.max(1, st.srs.ease - 0.1);
    } else {
      st.srs.iv = Math.min(4, st.srs.iv + 1);
      st.srs.due = shiftDay(today(), IVS[st.srs.iv]);
      st.srs.ease = Math.min(3, st.srs.ease + 0.1);
    }
    save();
  }
  function markStudied(secId) {
    const st = secState(secId);
    st.lastAt = Date.now(); st.lastDay = today();
    if (st.status === 'unlearned') st.status = 'learning';
    if (!st.srs.due) { st.srs.iv = 0; st.srs.due = shiftDay(today(), 1); }
    cardsOf(secId).forEach((c) => cardState(c.id));
    save();
    treeSig = '';
  }

  /* ================= 7. 路由 ================= */
  const R = { route: 'home', secId: '', hl: '', term: '', subject: 'diag', quizMode: '' };

  function go(hash) {
    if (location.hash === hash) { render(); return; }
    location.hash = hash;
  }
  function parseHash() {
    const h = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
    const qi = h.indexOf('?');
    const p = qi >= 0 ? h.slice(0, qi) : h;
    const qs = qi >= 0 ? h.slice(qi + 1) : '';
    const parts = p.split('/').filter(Boolean);
    const q = new URLSearchParams(qs);
    R.hl = q.get('hl') || '';
    R.route = parts[0] || 'home';
    R.secId = '';
    R.quizMode = '';
    if (R.route === 'sec') R.secId = parts[1] || '';
    if (R.route === 'cards') R.cardFilter = parts[1] || '';
    if (R.route === 'quiz') R.quizMode = parts[1] || '';
    // 由路由反推当前科目
    if (R.secId && IDX.sections[R.secId]) {
      R.subject = IDX.sections[R.secId].subjectId;
    } else if (parts[0] && IDX.bySubject[parts[0]] && parts[0] !== 'sec') {
      R.subject = parts[0];
    } else {
      R.subject = preferredSubject();
    }
    if (!IDX.bySubject[R.subject]) R.subject = 'diag';
  }

  /* ================= 8. 主题 ================= */
  function applyTheme(subjectId) {
    const body = document.body;
    body.classList.toggle('theme-pharm', subjectId === 'pharm');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', subjectId === 'pharm' ? '#2B4C7E' : '#0E5A5A');
  }
  function applyNight() {
    const on = !!S.night;
    document.body.classList.toggle('night', on);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', on ? '#121A19' : (R.subject === 'pharm' ? '#2B4C7E' : '#0E5A5A'));
    const b = $('#btnNight');
    if (b) {
      b.setAttribute('title', on ? '切换到白天模式' : '切换到黑夜模式');
      b.innerHTML = on
        ? '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.6 8.6 0 1 0 10.7 10.7z"/></svg>';
    }
  }
  /* 「第一科」判定：首次进入（无任何学习记录）时总是先落到诊断学 */
  function preferredSubject() {
    const stored = S.activeSubject;
    if (stored && IDX.bySubject[stored]) {
      // 若上一次是被"进入药理学小节"带过去的，仍尊重记录；但全新用户默认诊断学
      return stored;
    }
    return 'diag';
  }

  /* ================= 9. 通用渲染片段 ================= */
  function levelTag(level) {
    const cls = level === '掌握' ? 'tag-master' : level === '熟悉' ? 'tag-familiar' : 'tag-know';
    return '<span class="chip ' + cls + '">' + esc(level || '了解') + '</span>';
  }
  function statusTag(secId) {
    const st = secState(secId);
    const acc = sectionAccuracy(secId);
    if (acc !== null && acc < 0.7) return '<span class="badge st-weak">薄弱</span>';
    if (st.status === 'mastered') return '<span class="badge st-mastered">已掌握</span>';
    if (st.status === 'learning') return '<span class="badge st-learning">学习中</span>';
    return '<span class="badge st-unlearned">未学</span>';
  }
  function bar(pct, accent) {
    return '<div class="bar"><i class="' + (accent ? 'accent' : '') + '" style="width:' + clamp(pct, 0, 100) + '%"></i></div>';
  }
  function barRow(label, pct, accent) {
    return '<div class="bar-row"><span class="lbl">' + esc(label) + '</span>' + bar(pct, accent) + '<span class="num">' + pct + '%</span></div>';
  }
  function emptyState(text, sub) {
    return '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2.6 2.6 0 0 0-2-1H4z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2.6 2.6 0 0 1 2-1h6z"/></svg><div class="t">' + esc(text) + '</div>' + (sub ? '<div style="font-size:var(--fs-xs);margin-top:4px">' + esc(sub) + '</div>' : '') + '</div>';
  }

  /* 内容块渲染 */
  function blockHTML(b, tables, cursor) {
    if (!b) return '';
    switch (b.t) {
      case 'h': return '<div style="font-weight:800;color:var(--c-primary-600);margin:16px 0 7px;font-size:var(--fs-h3)">' + inline(b.v) + '</div>';
      case 'p': return '<p>' + inline(b.v) + '</p>';
      case 'ul': return '<ul>' + b.v.map((x) => '<li>' + inline(x) + '</li>').join('') + '</ul>';
      case 'kv': return '<div class="kv">' + b.v.map((kv) => '<div><b>' + inline(kv[0]) + '：</b>' + inline(kv[1]) + '</div>').join('') + '</div>';
      case 'tip': return '<div class="exam-tip"><div class="ttl">💡 ' + esc(b.title || '记忆技巧') + '</div>' + inline(b.v) + '</div>';
      case 'tbl': {
        const list = tables || [];
        const idx = cursor ? cursor.n : 0;
        if (idx < list.length) { if (cursor) cursor.n = idx + 1; return tableHTML(list[idx], true); }
        return '';
      }
      default: return '';
    }
  }
  function tableHTML(tb, inlineMode) {
    if (!tb) return '';
    const head = tb.head || [];
    const rows = tb.rows || [];
    const thead = '<thead><tr>' + head.map((h) => '<th>' + esc(h) + '</th>').join('') + '</tr></thead>';
    const tbody = '<tbody>' + rows.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody>';
    const cards = '<div class="cmp-cards">' + rows.map((r) =>
      '<div class="cmp-card"><div class="ch">' + inline(r[0]) + '</div><dl>' +
      head.slice(1).map((h, i) => '<dt>' + esc(h) + '</dt><dd>' + inline(r[i + 1]) + '</dd>').join('') + '</dl></div>').join('') + '</div>';
    const title = tb.title ? '<div style="font-weight:800;margin:0 0 8px;color:var(--c-primary-600);font-size:var(--fs-sm)">' + esc(tb.title) + '</div>' : '';
    if (inlineMode) {
      return '<div style="margin:8px 0 16px">' + title + '<div class="cmp-table-wrap"><table class="cmp">' + thead + tbody + '</table></div>' + cards + '</div>';
    }
    return '<div style="margin-bottom:16px">' + title + '<div class="cmp-table-wrap"><table class="cmp">' + thead + tbody + '</table></div>' + cards + '</div>';
  }

  /* ================= 10. 目录树（增量更新，避免整树重建造成卡顿） ================= */
  const collapsed = { ch: {}, sub: {} };
  let treeSig = '';

  function subjectTabsHTML() {
    return DB.subjects.map((sub) => {
      const m = SUBJECT_META[sub.id] || { name: sub.name, short: '?', desc: '' };
      const lp = learnProgress(sub.id);
      return '<button class="subj-tab ' + sub.id + (R.subject === sub.id ? ' on' : '') + '" data-subj-open="' + sub.id + '">' +
        '<span class="ico">' + esc(m.short) + '</span>' +
        '<span class="txt"><span class="nm">' + esc(m.name) + '</span>' +
        '<span class="mt">' + lp.pct + '% · ' + lp.done + '/' + lp.total + ' 节</span>' +
        '<span class="bar"><i style="width:' + lp.pct + '%"></i></span></span>' +
        '</button>';
    }).join('');
  }

  function treeHTML(subjectId) {
    const sub = IDX.bySubject[subjectId];
    if (!sub) return '';
    const t = today();
    return sub.chapters.map((ch) => {
      const chAcc = chapterAccuracy(ch.id);
      const weak = chAcc !== null && chAcc < 0.7;
      const secs = ch.sections.map((sec) => {
        const st = secState(sec.id);
        const due = st.srs && st.srs.due && st.srs.due <= t;
        const acc = sectionAccuracy(sec.id);
        const isWeak = weak || (acc !== null && acc < 0.7);
        const dot = st.status === 'mastered' || st.self === 'mastered' ? 's-done'
          : st.status === 'learning' ? 's-doing' : '';
        return '<button class="sec-link ' + dot + (R.secId === sec.id ? ' active' : '') + (isWeak ? ' weak' : '') + '" data-goto="#/sec/' + sec.id + '">' +
          '<span class="pdot"></span><span class="nm">' + esc(sec.name) + '</span>' +
          (due ? '<span class="chip st-learning" style="padding:0 6px">待复习</span>' : '') +
          '</button>';
      }).join('');
      return '<div class="tree-chapter' + (collapsed.ch[ch.id] ? ' collapsed' : '') + '" data-ch="' + ch.id + '">' +
        '<button class="chap" data-toggle-ch="' + ch.id + '">' +
        '<svg class="caret" viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>' +
        '<span class="nm">' + esc(ch.name) + '</span>' +
        (weak ? '<span class="badge st-weak">薄弱</span>' : '') +
        '</button><div class="sections">' + secs + '</div></div>';
    }).join('');
  }

  function refreshTrees(force) {
    const lp = learnProgress(R.subject);
    // 签名覆盖会改变树外观的全部因素：科目、当前小节、总进度、折叠状态、各章正确率档位
    const sub = IDX.bySubject[R.subject];
    let accSig = '';
    if (sub) {
      sub.chapters.forEach((ch) => {
        const a = chapterAccuracy(ch.id);
        accSig += (a === null ? '-' : (a < 0.7 ? 'w' : a < 0.85 ? 'm' : 'g'));
      });
    }
    const sig = R.subject + '|' + R.secId + '|' + lp.pct + '|' + accSig + '|' +
      Object.keys(collapsed.ch).filter((k) => collapsed.ch[k]).join(',');
    if (!force && sig === treeSig) return;
    treeSig = sig;

    const tabs = subjectTabsHTML();
    const side = $('#sidebarSubjects');
    if (side) side.innerHTML = tabs;

    const tree = treeHTML(R.subject);
    const a = $('#treeDesktop');
    const b = $('#treeMobile');
    if (a) a.innerHTML = tree;
    if (b) b.innerHTML = '<div class="subj-tabs" style="padding:8px 2px 12px">' + tabs + '</div>' + tree;
    const title = $('#sidebarTitle');
    if (title) title.textContent = (SUBJECT_META[R.subject] || {}).name + ' · 章节目录';
    $$('#subjSwitch button').forEach((btn) => btn.classList.toggle('on', btn.dataset.subj === R.subject));
  }

  /* 只更新当前小节的 active 高亮，避免整树重建 */
  function markActiveSection() {
    $$('.sec-link').forEach((el) => {
      el.classList.toggle('active', el.dataset.goto === '#/sec/' + R.secId);
    });
  }

  /* ================= 11. 首页 ================= */
  function weakChapters(subjectId) {
    const sub = IDX.bySubject[subjectId];
    if (!sub) return [];
    const out = [];
    sub.chapters.forEach((ch) => {
      const a = chapterAccuracy(ch.id);
      if (a !== null && a < 0.7) out.push({ id: ch.id, name: ch.name, acc: a });
    });
    return out.sort((a, b) => a.acc - b.acc);
  }
  function suggestion(subjectId) {
    const t = today();
    const due = sectionDueList(subjectId);
    if (due.length) {
      const d = due[0];
      const days = dayDiff(d.st.lastDay || t, t);
      return { icon: '⏰', text: '「' + d.sec.name + '」已 ' + days + ' 天未复习，建议' + (days >= 7 ? '深度' : '标准') + '复习', go: '#/review' };
    }
    const wc = weakChapters(subjectId)[0];
    if (wc) return { icon: '📉', text: '「' + wc.name + '」正确率偏低，建议先做章节练习', go: '#/quiz' };
    const un = (IDX.secBySubject[subjectId] || []).find((id) => secState(id).status === 'unlearned');
    if (un) {
      const sec = IDX.sections[un];
      return { icon: '🚀', text: '下一站：' + sec.chapterName + '「' + sec.name + '」，约 ' + (sec.minutes || 20) + ' 分钟', go: '#/sec/' + un };
    }
    return { icon: '🎉', text: '本科目小节已全部学过，去复习巩固吧', go: '#/review' };
  }

  function viewHome() {
    const subj = R.subject;
    const meta = SUBJECT_META[subj];
    const lp = learnProgress(subj);
    const mst = subjectMastery(subj);
    const due = sectionDueList(subj);
    const s = suggestion(subj);
    const streak = S.quiz.streak.days || 0;
    const wc = weakChapters(subj).slice(0, 3);
    const lastSec = S.lastSubjectSection && S.lastSubjectSection[subj];

    // 双科目独立倒计时
    let cd = '';
    const dates = S.examDates || {};
    const dCnt = dates.diag ? Math.ceil((new Date(dates.diag + 'T08:00:00') - new Date()) / 86400000) : null;
    const pCnt = dates.pharm ? Math.ceil((new Date(dates.pharm + 'T08:00:00') - new Date()) / 86400000) : null;
    if ((dCnt !== null && dCnt >= 0) || (pCnt !== null && pCnt >= 0)) {
      cd = '<div class="card" style="margin-bottom:12px"><div class="card-hd"><h3>期末考试倒计时</h3><button class="btn btn-sm btn-ghost" data-goto="#/me">设置</button></div>' +
        '<div class="duo-count">' +
        '<div class="dc-box"><div class="nm">诊断学</div><div class="dd">' + (dCnt !== null && dCnt >= 0 ? dCnt : '—') + '<span style="font-size:.45em"> 天</span></div>' +
        '<div class="dt">' + (dates.diag || '未设置') + '</div></div>' +
        '<div class="dc-box"><div class="nm">药理学</div><div class="dd">' + (pCnt !== null && pCnt >= 0 ? pCnt : '—') + '<span style="font-size:.45em"> 天</span></div>' +
        '<div class="dt">' + (dates.pharm || '未设置') + '</div></div>' +
        '</div></div>';
    }

    const resume = lastSec && IDX.sections[lastSec]
      ? '<button class="card card-tap" style="margin-bottom:12px;width:100%;text-align:left;display:flex;align-items:center;gap:12px" data-goto="#/sec/' + lastSec + '">' +
        '<span style="flex:0 0 auto;width:42px;height:42px;border-radius:12px;background:var(--c-subject-soft);display:grid;place-items:center;color:var(--c-primary);font-weight:800">▶</span>' +
        '<span style="flex:1 1 auto;min-width:0"><span style="display:block;font-weight:800">继续学习</span>' +
        '<span style="display:block;font-size:var(--fs-xs);color:var(--c-ink-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(IDX.sections[lastSec].chapterName + ' · ' + IDX.sections[lastSec].name) + '</span></span>' +
        '<span class="chip st-learning">断点续学</span></button>'
      : '';

    return '<div class="view">' +
      '<div class="hero">' +
      '<h1>' + esc(meta.name) + '</h1>' +
      '<div class="sub">' + esc(meta.desc) + '</div>' +
      '<div class="duo">' +
      '<div><div class="lbl"><span>学习进度</span><span>' + lp.done + ' / ' + lp.total + ' 节</span></div>' + bar(lp.pct) + '</div>' +
      '<div><div class="lbl"><span>掌握度</span><span>' + mst + '%</span></div>' + bar(mst, true) + '</div>' +
      '</div></div>' +

      '<div class="banner" style="margin-top:12px"><span>' + s.icon + '</span><span class="grow">' + esc(s.text) + '</span><button data-goto="' + s.go + '">前往</button></div>' +
      resume + cd +

      '<div class="grid grid-3" style="margin-bottom:12px">' +
      '<div class="stat-tile"><div class="k">待复习小节</div><div class="v">' + due.length + '<small>节</small></div></div>' +
      '<div class="stat-tile"><div class="k">今日已答</div><div class="v">' + ((S.quiz.days[today()] || {}).answered || 0) + '<small>题</small></div></div>' +
      '<div class="stat-tile"><div class="k">错题本</div><div class="v">' + Object.keys(S.wrong).filter((k) => !S.wrong[k].done).length + '<small>题</small></div></div>' +
      '</div>' +

      '<div class="card" style="margin-bottom:12px"><div class="card-hd"><h3>薄弱章节 · 优先突破</h3><button class="btn btn-sm btn-ghost" data-goto="#/stats">全部统计</button></div>' +
      (wc.length
        ? '<div class="hbar">' + wc.map((w) => '<div class="row low"><span class="nm">' + esc(w.name) + '</span>' + bar(Math.round(w.acc * 100)) + '<span class="pc">' + Math.round(w.acc * 100) + '%</span></div>').join('') + '</div>'
        : '<div style="font-size:var(--fs-sm);color:var(--c-ink-3)">还没有足够答题数据，做几组练习后会自动识别薄弱章节。</div>') +
      '</div>' +

      '<div class="card"><div class="card-hd"><h3>本科目快捷入口</h3></div><div class="grid grid-2">' +
      '<button class="quick-card q1" data-goto="#/quiz"><span class="qi">✎</span><span><span class="qt">刷题中心</span><span class="qs">章节 / 随机 / 错题</span></span></button>' +
      '<button class="quick-card q2" data-goto="#/review"><span class="qi">↻</span><span><span class="qt">今日复习</span><span class="qs">艾宾浩斯 1/2/4/7/15</span></span></button>' +
      '<button class="quick-card q3" data-goto="#/cards"><span class="qi">▣</span><span><span class="qt">记忆卡片</span><span class="qs">翻转 + 三键评分</span></span></button>' +
      '<button class="quick-card q4" data-goto="#/me"><span class="qi">☰</span><span><span class="qt">我的笔记</span><span class="qs">按章节 / 视频归档</span></span></button>' +
      '</div></div>' +
      '</div>';
  }

  /* ================= 12. 学习页：分步渲染 ================= */
  const STEPS = ['预习提纲', '课本精读', '通俗讲解', '机制动画', '即时小测', '自评'];
  let secTimer = null, secEnterAt = 0, secTimerId = '';

  function stepIndex(secId) {
    const st = S.stepOf[secId];
    return clamp(st == null ? 0 : st, 0, 5);
  }
  function setStep(secId, i) {
    S.stepOf[secId] = clamp(i, 0, 5);
    secState(secId).progressStep = S.stepOf[secId];
    save();
  }

  function renderStepPanel(sec, idx) {
    const id = sec.id;
    switch (idx) {
      case 0: // 预习提纲
        return '<div class="step-panel on" data-panel="0">' +
          '<div class="card"><div class="card-hd"><h3>预习提纲</h3>' + levelTag(sec.level) + '</div>' +
          '<div style="display:grid;gap:10px">' +
          (sec.preview || []).map((p, i) =>
            '<div style="display:flex;gap:10px;align-items:flex-start">' +
            '<span style="flex:0 0 auto;width:22px;height:22px;border-radius:50%;background:var(--c-subject-soft);color:var(--c-primary);display:grid;place-items:center;font-size:11.5px;font-weight:800;margin-top:3px">' + (i + 1) + '</span>' +
            '<span style="flex:1;min-width:0;font-size:var(--fs-sm);line-height:1.8">' + inline(p) + '</span></div>').join('') +
          '</div>' +
          '<div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--c-line);font-size:var(--fs-xs);color:var(--c-ink-3)">' +
          '大纲对应：' + esc(sec.outlineRef || '—') + (sec.pages ? ' · 教材 ' + esc(sec.pages) : '') + '</div>' +
          '</div></div>';

      case 1: { // 课本精读
        const cursor = { n: 0 };
        const body = (sec.body || []).map((b) => blockHTML(b, sec.tables || [], cursor)).join('');
        const rest = (sec.tables || []).slice(cursor.n).map((tb) => tableHTML(tb)).join('');
        return '<div class="step-panel on" data-panel="1"><div class="card">' + body + rest + '</div></div>';
      }

      case 2: // 通俗讲解
        return '<div class="step-panel on" data-panel="2"><div class="card">' +
          '<div class="card-hd"><h3>通俗讲解</h3>' +
          '<div class="seg" id="plainSeg"><button class="on" data-plain="0">通俗版</button><button data-plain="1">教材版</button></div></div>' +
          '<div id="plainPlain">' + (sec.plain || []).map((p) => '<p>' + inline(p) + '</p>').join('') +
          (sec.analogy ? '<div class="kv" style="background:var(--c-accent-100);border-color:transparent"><b>打个比方：</b>' + inline(sec.analogy) + '</div>' : '') +
          '</div>' +
          '<div id="plainTextbook" hidden>' + (sec.body || []).map((b) => blockHTML(b, sec.tables || [])).join('') + '</div>' +
          '</div></div>';

      case 3: { // 机制动画
        const own = [];
        if (sec.mech && IDX.mechById[sec.mech]) own.push(IDX.mechById[sec.mech]);
        (sec.mechMore || []).forEach((id) => {
          const m = IDX.mechById[id];
          if (m && !own.some((o) => o.id === m.id)) own.push(m);
        });
        const rel = relatedMechs(sec.id).filter((m) => !own.some((o) => o.id === m.id));
        const list = own.concat(rel).slice(0, 2);
        if (!list.length) {
          return '<div class="step-panel on" data-panel="3"><div class="card">' +
            emptyState('本节暂无专属机制图', '可在「复习 → 机制图库」查看全部 ' + MECHS.length + ' 张机制解析') +
            '<button class="btn btn-ghost btn-block" style="margin-top:10px" data-goto="#/review">打开机制图库</button></div></div>';
        }
        return '<div class="step-panel on" data-panel="3">' + list.map((m, i) =>
          '<div class="card"' + (i ? ' style="margin-top:12px"' : '') + '>' +
          '<div class="card-hd"><h3>' + esc(m.title) + '</h3><span class="chip st-learning">可交互 · ' + m.nodes.length + ' 环节</span></div>' +
          '<div class="mech-host" data-mech="' + m.id + '"></div></div>').join('') +
          '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>全部机制图</h3><span class="chip st-unlearned">' + MECHS.length + ' 张</span></div>' +
          '<div class="grid grid-2">' + MECHS.map((m) =>
            '<button class="list-item" data-open-mech="' + m.id + '" style="margin-bottom:0"><span class="grow"><span class="t">' + esc(m.title) + '</span>' +
            '<span class="s">' + m.nodes.length + ' 个环节</span></span></button>').join('') + '</div></div>' +
          '</div>';
      }

      case 4: { // 即时小测
        const qids = (IDX.qBySection[sec.id] || []).slice(0, 5);
        return '<div class="step-panel on" data-panel="4"><div class="card">' +
          '<div class="card-hd"><h3>即时小测</h3><span class="chip st-unlearned">' + qids.length + ' 题</span></div>' +
          (qids.length ? '<div id="miniQuiz" data-sec="' + sec.id + '"></div>' : '<div style="font-size:var(--fs-sm);color:var(--c-ink-3)">本节暂无配套题目。</div>') +
          '</div></div>';
      }

      case 5: { // 自评
        const st = secState(sec.id);
        const acc = sectionAccuracy(sec.id);
        return '<div class="step-panel on" data-panel="5"><div class="card">' +
          '<div class="card-hd"><h3>自评掌握度</h3>' + statusTag(sec.id) + '</div>' +
          '<div style="font-size:var(--fs-sm);color:var(--c-ink-3);margin-bottom:12px">' +
          '本科目已学 ' + Math.round((st.timeSec || 0) / 60) + ' 分钟' +
          (acc === null ? ' · 本节尚无答题记录' : ' · 本节正确率 ' + Math.round(acc * 100) + '%') +
          ' · 当前掌握度 ' + Math.round(sectionMastery(sec.id) * 100) + '%</div>' +
          '<div class="rate-row" style="grid-template-columns:repeat(3,1fr)">' +
          '<button class="btn btn-plain' + (st.self === 'none' ? ' ' : '') + '" data-self="none">未学</button>' +
          '<button class="btn btn-plain" data-self="seen">学过</button>' +
          '<button class="btn" data-self="mastered">已掌握</button></div>' +
          '<div style="margin-top:12px;font-size:var(--fs-xs);color:var(--c-ink-3)">自评与答题正确率加权计算掌握度（自评 55% + 正确率 45%），并自动排入复习队列：明天第 1 次复习。</div>' +
          ((sec.exam || []).length ? '<div class="exam-tip" style="margin-bottom:0"><div class="ttl">🎯 考点提示 · ' + esc(sec.level) + '</div><ul>' +
            sec.exam.map((e) => '<li>' + inline(e) + '</li>').join('') + '</ul></div>' : '') +
          '</div></div>';
      }
      default: return '';
    }
  }

  function relatedMechs(secId) {
    // 按章节关键词粗略匹配，保证每个小节都能看到机制图
    const sec = IDX.sections[secId];
    if (!sec) return [];
    const key = sec.chapterName + sec.name;
    const map = [
      [/心脏|心音|杂音|瓣膜|血管/, 'mech-valve'],
      [/心衰|心力衰竭/, 'mech-heart-failure-signs'],
      [/杂音/, 'mech-murmur-timing'],
      [/胸膜|胸腔积液|肺/, 'mech-pleural-effusion'],
      [/腹部|腹水|门脉|肝硬/, 'mech-ascites'],
      [/肝硬/, 'mech-liver-cirrhosis'],
      [/黄疸/, 'mech-jaundice'],
      [/休克/, 'mech-shock-stages'],
      [/利尿/, 'mech-diuretic-sites'],
      [/凝血|抗凝|止血|血液/, 'mech-anticoagulant'],
      [/平喘|哮喘|呼吸系统/, 'mech-asthma-drugs'],
      [/糖尿病|降糖|胰岛素/, 'mech-diabetes-drugs'],
      [/抗菌|抗生素|内酰胺|化疗|耐药/, 'mech-antibiotic-targets'],
      [/β受体|肾上腺素受体阻断/, 'mech-betablock'],
      [/高血压|降压/, 'mech-bp'],
      [/青霉素|内酰胺/, 'mech-penicillin'],
      [/肝|黄疸/, 'mech-jaundice']
    ];
    for (let i = 0; i < map.length; i++) {
      if (map[i][0].test(key) && IDX.mechById[map[i][1]]) return [IDX.mechById[map[i][1]]];
    }
    return [];
  }

  function viewSection(id) {
    const sec = IDX.sections[id];
    if (!sec) return emptyState('小节不存在');
    const st = secState(id);
    st.lastAt = Date.now();
    st.lastDay = today();
    if (st.status === 'unlearned') { st.status = 'learning'; }
    S.lastSection = id;
    if (!S.lastSubjectSection) S.lastSubjectSection = {};
    S.lastSubjectSection[sec.subjectId] = id;
    S.activeSubject = sec.subjectId;
    R.subject = sec.subjectId;
    save(); treeSig = '';

    const cur = stepIndex(id);
    const stepbar = '<div class="stepbar" id="stepbar">' + STEPS.map((s, i) =>
      '<button class="sp ' + (i === cur ? 'on' : i < cur ? 'done' : '') + '" data-step="' + i + '">' +
      '<span class="n">' + (i < cur ? '✓' : (i + 1)) + '</span><span>' + s + '</span></button>').join('') + '</div>';

    const notes = S.notes['sec:' + id];
    const vids = IDX.vBySection[id] || [];
    const showVideo = SUBJECT_META[sec.subjectId] && SUBJECT_META[sec.subjectId].hasVideo && vids.length;

    const videoBlock = showVideo
      ? '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>配套网课</h3><span class="chip st-learning">B 站 · 需联网</span></div>' +
        vids.map(videoCardHTML).join('') + '</div>'
      : '';

    const side = '<div class="reading-side desk-only">' +
      '<div class="card"><div class="card-hd"><h3>考点速览</h3>' + levelTag(sec.level) + '</div>' +
      ((sec.exam || []).length
        ? sec.exam.slice(0, 4).map((e) => '<div style="font-size:var(--fs-sm);padding:7px 0;border-bottom:1px dashed var(--c-line)">' + inline(e) + '</div>').join('')
        : '<div style="font-size:var(--fs-xs);color:var(--c-ink-3)">暂无</div>') +
      '</div>' +
      '<div class="card"><div class="card-hd"><h3>我的笔记</h3></div>' +
      '<textarea class="ta" data-side-note="' + id + '" placeholder="随手记…">' + esc(notes ? notes.text : '') + '</textarea></div>' +
      '<div class="card"><div class="card-hd"><h3>本节卡片</h3><span class="chip st-unlearned">' + cardsOf(id).length + ' 张</span></div>' +
      cardsOf(id).slice(0, 3).map((c) => '<div style="font-size:var(--fs-xs);padding:6px 0;border-bottom:1px dashed var(--c-line)"><b>' + esc(c.f) + '</b></div>').join('') +
      '<button class="btn btn-ghost btn-sm btn-block" style="margin-top:9px" data-goto="#/cards">去翻转卡片</button></div>' +
      '</div>';

    return '<div class="view">' +
      '<div class="page-hd"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:7px">' +
      '<span class="chip st-unlearned">' + esc(sec.chapterNo) + ' ' + esc(sec.chapterName) + '</span>' + levelTag(sec.level) + statusTag(id) + '</div>' +
      '<h1>' + esc(sec.name) + '</h1>' +
      '<div class="sub">预计 ' + (sec.minutes || 20) + ' 分钟 · 已学 ' + Math.round((st.timeSec || 0) / 60) + ' 分钟' + (sec.pages ? ' · 教材 ' + esc(sec.pages) : '') + '</div></div>' +
      stepbar +
      '<div class="reading-wrap"><div>' +
      '<div id="stepBody">' + renderStepPanel(sec, cur) + '</div>' +
      '<div class="step-nav">' +
      '<button class="btn btn-plain btn-sm" data-step-nav="-1"' + (cur === 0 ? ' disabled' : '') + '>上一步</button>' +
      '<span class="chip st-unlearned" id="stepCounter">' + (cur + 1) + ' / 6</span>' +
      '<div class="grow"></div>' +
      '<button class="btn btn-sm" data-step-nav="1"' + (cur === 5 ? ' disabled' : '') + '>下一步</button>' +
      '</div>' +
      videoBlock +
      '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>我的笔记</h3><span class="chip st-unlearned">自动保存</span></div>' +
      '<textarea class="ta" id="secNote" placeholder="记下你的理解、老师强调的点、易错处……">' + esc(notes ? notes.text : '') + '</textarea>' +
      '<div style="font-size:var(--fs-xs);color:var(--c-ink-3);margin-top:6px">' + (notes ? '上次保存：' + esc(String(notes.at).slice(0, 16).replace('T', ' ')) : '尚未保存') + '</div></div>' +
      '<div class="bottom-bar desk-only" style="padding-left:0;padding-right:0"><button class="btn btn-plain" id="btnPrevSec">上一节</button><div class="grow"></div><button class="btn" id="btnNextSec">下一节</button></div>' +
      '</div>' + side + '</div></div>';
  }

  function videoCardHTML(v) {
    const st = S.videos[v.id] || {};
    const note = S.notes['vid:' + v.id];
    const src = 'https://player.bilibili.com/player.html?bvid=' + encodeURIComponent(v.bv) + (v.p ? '&page=' + v.p : '') + '&high_quality=1&danmaku=0&autoplay=0';
    return '<div class="card video-card" style="margin-bottom:10px">' +
      '<div class="video-frame" data-vid="' + v.id + '"><iframe loading="lazy" referrerpolicy="no-referrer" allowfullscreen src="' + src + '" title="' + esc(v.title) + '"></iframe></div>' +
      '<div class="video-info"><div class="vt">' + esc(v.title) + '</div>' +
      '<div class="vm"><span>' + esc(v.bv) + (v.p ? ' · P' + v.p : '') + '</span>' + (v.up ? '<span>UP：' + esc(v.up) + '</span>' : '') + '</div>' +
      '<div style="display:flex;gap:8px;margin-top:9px;flex-wrap:wrap">' +
      '<button class="btn btn-sm ' + (st.watched ? 'btn-plain' : 'btn-ghost') + '" data-vwatch="' + v.id + '">' + (st.watched ? '✓ 已看' : '标记已看') + '</button>' +
      '<a class="btn btn-sm btn-plain" href="https://www.bilibili.com/video/' + encodeURIComponent(v.bv) + (v.p ? '?p=' + v.p : '') + '" target="_blank" rel="noopener">去 B 站</a>' +
      '</div><div class="vnote"><textarea id="vnote-' + v.id + '" placeholder="视频笔记（与该视频绑定保存）">' + esc(note ? note.text : '') + '</textarea></div>' +
      '</div></div>';
  }

  /* 即时小测 */
  const mini = { secId: '', idx: 0, answers: {} };
  function renderMiniQuiz(secId) {
    const host = $('#miniQuiz');
    if (!host) return;
    if (mini.secId !== secId) { mini.secId = secId; mini.idx = 0; mini.answers = {}; }
    const qids = (IDX.qBySection[secId] || []).slice(0, 5);
    if (!qids.length) { host.innerHTML = '<div style="font-size:var(--fs-sm);color:var(--c-ink-3)">本节暂无题目。</div>'; return; }
    const idx = clamp(mini.idx, 0, qids.length - 1);
    const q = IDX.questionsById[qids[idx]];
    const chosen = mini.answers[q.id];
    const answered = chosen !== undefined;
    const rightN = qids.filter((qid) => { const qq = IDX.questionsById[qid]; return mini.answers[qid] === qq.a; }).length;

    host.innerHTML =
      '<div class="q-meta"><span class="chip st-unlearned">' + (idx + 1) + ' / ' + qids.length + '</span>' +
      '<span class="chip ' + (answered ? (chosen === q.a ? 'st-mastered' : 'st-weak') : 'st-learning') + '">已对 ' + rightN + '</span></div>' +
      '<div class="q-stem">' + inline(q.q) + '</div>' +
      '<div class="opts">' + q.o.map((o, i) =>
        '<button class="opt' + (answered ? (i === q.a ? ' right' : i === chosen ? ' wrong' : '') : '') + '" data-mini="' + i + '"' + (answered ? ' disabled' : '') + '>' +
        '<span class="k">' + 'ABCDE'[i] + '</span><span>' + inline(o) + '</span></button>').join('') + '</div>' +
      (answered ? '<div class="explain"><div class="eh">' + (chosen === q.a ? '<span class="ok">✓ 答对</span>' : '<span class="no">✗ 答错，正确答案 ' + 'ABCDE'[q.a] + '</span>') + '</div>' + inline(q.e) + '<div class="src">出处：' + esc(q.src || '') + '</div></div>' : '') +
      '<div style="display:flex;gap:9px;margin-top:12px">' +
      '<button class="btn btn-plain btn-sm" data-mini-prev' + (idx === 0 ? ' disabled' : '') + '>上一题</button>' +
      '<div style="flex:1"></div>' +
      '<button class="btn btn-sm" data-mini-next>' + (idx >= qids.length - 1 ? '完成本组' : '下一题') + '</button></div>';
  }

  /* ================= 13. 复习模式 ================= */
  const reviewState = { active: false, mode: 'standard', list: [], idx: 0, mechPage: 0 };
  const MECH_PER_PAGE = 8;

  function viewReview() {
    const subj = R.subject;
    const due = sectionDueList(subj);
    const wrongN = Object.keys(S.wrong).filter((k) => !S.wrong[k].done && IDX.questionsById[k] && IDX.questionsById[k].sub === subj).length;
    const dueCardsN = dueCards(subj).length;

    if (reviewState.active) return renderReviewRunner();

    return '<div class="view"><div class="page-hd"><h1>复习模式 · ' + esc(SUBJECT_META[subj].name) + '</h1>' +
      '<div class="sub">按艾宾浩斯遗忘曲线 1 / 2 / 4 / 7 / 15 天推送</div></div>' +

      '<div class="card" style="margin-bottom:12px"><div class="card-hd"><h3>复习强度</h3><span class="chip st-unlearned">今日 ' + due.length + ' 节待复习</span></div>' +
      '<div class="grid grid-3">' +
      [['quick', '快速过', '10 分钟 · 只看考点卡'], ['standard', '标准', '20–30 分钟 · 知识点 + 5 题'], ['deep', '深度', '错题重做 + 机制图重看']].map((m) =>
        '<button class="list-item" data-rmode="' + m[0] + '"' + (reviewState.mode === m[0] ? ' style="border-color:var(--c-primary);background:var(--c-subject-soft)"' : '') + '>' +
        '<span class="grow"><span class="t">' + m[1] + '</span><span class="s">' + m[2] + '</span></span></button>').join('') +
      '</div><button class="btn btn-block" style="margin-top:10px" data-rstart="due">开始复习（' + due.length + ' 节）</button></div>' +

      '<div class="grid grid-2" style="margin-bottom:12px">' +
      '<button class="card card-tap" data-goto="#/quiz/wrong"><div class="card-hd"><h3>错题重做</h3><span class="chip st-weak">' + wrongN + '</span></div><div style="font-size:var(--fs-xs);color:var(--c-ink-3)">按章节归类，可标记已掌握移出</div></button>' +
      '<button class="card card-tap" data-goto="#/cards"><div class="card-hd"><h3>记忆卡片</h3><span class="chip st-learning">' + dueCardsN + '</span></div><div style="font-size:var(--fs-xs);color:var(--c-ink-3)">今日到期的翻转卡片</div></button>' +
      '</div>' +

      // 机制图库（分页）
      (function () {
        const totalPages = Math.ceil(MECHS.length / MECH_PER_PAGE);
        const page = clamp(reviewState.mechPage, 0, totalPages - 1);
        reviewState.mechPage = page;
        const slice = MECHS.slice(page * MECH_PER_PAGE, (page + 1) * MECH_PER_PAGE);
        return '<div class="card" style="margin-bottom:12px"><div class="card-hd"><h3>机制图库</h3><span class="chip st-unlearned">' + MECHS.length + ' 张</span></div>' +
          '<div class="mech-grid">' + slice.map((m) =>
            '<button class="list-item" style="margin-bottom:0" data-open-mech="' + m.id + '"><span class="grow"><span class="t">' + esc(m.title) + '</span>' +
            '<span class="s">' + m.nodes.length + ' 个环节</span></span>' +
            '<svg class="go" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg></button>').join('') + '</div>' +
          (totalPages > 1 ? '<div class="mech-pager">' +
            '<button class="btn btn-sm btn-plain" data-mech-page="-1"' + (page === 0 ? ' disabled' : '') + '>上一页</button>' +
            '<span class="pnum">' + (page + 1) + ' / ' + totalPages + '</span>' +
            '<button class="btn btn-sm btn-plain" data-mech-page="1"' + (page >= totalPages - 1 ? ' disabled' : '') + '>下一页</button>' +
            '</div>' : '') +
          '</div>';
      })() +

      '<div class="card"><div class="card-hd"><h3>待复习清单</h3><span class="chip ' + (due.length ? 'st-weak' : 'st-mastered') + '">' + (due.length ? '需复习' : '已清空') + '</span></div>' +
      (due.length
        ? due.map((d) => '<button class="list-item" data-goto="#/sec/' + d.sec.id + '"><span class="grow"><span class="t">' + esc(d.sec.name) + (d.overdue > 0 ? ' <span class="chip st-weak" style="padding:0 6px">逾期 ' + d.overdue + ' 天</span>' : '') + '</span>' +
          '<span class="s">' + esc(d.sec.chapterName) + ' · 掌握度 ' + Math.round(sectionMastery(d.sec.id) * 100) + '%</span></span>' +
          '<svg class="go" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg></button>').join('')
        : emptyState('今天没有待复习的小节', '学完一节的第二天会自动排入复习队列')) +
      '</div></div>';
  }

  function renderReviewRunner() {
    const list = reviewState.list;
    if (!list.length) return '<div class="view"><div class="card">' + emptyState('复习队列为空') + '</div></div>';
    const cur = list[clamp(reviewState.idx, 0, list.length - 1)];
    const sec = IDX.sections[cur];
    const st = secState(cur);
    const qids = (IDX.qBySection[cur] || []).slice(0, 5);
    const showQ = reviewState.mode !== 'quick';
    const mech = reviewState.mode === 'deep' && sec.mech && IDX.mechById[sec.mech] ? IDX.mechById[sec.mech] : null;

    return '<div class="view"><div class="card" style="margin-bottom:12px">' +
      '<div class="card-hd"><h3>' + (reviewState.idx + 1) + ' / ' + list.length + ' · ' + esc(sec.name) + '</h3>' +
      '<button class="btn btn-sm btn-plain" data-rstop>结束</button></div>' +
      '<div style="font-size:var(--fs-xs);color:var(--c-ink-3);margin-bottom:10px">' + esc(sec.chapterName) + ' · ' + esc(sec.level) +
      ' · 掌握度 ' + Math.round(sectionMastery(cur) * 100) + '% · 下次间隔 ' + IVS[clamp(st.srs.iv, 0, 4)] + ' 天</div>' +
      ((sec.exam || []).length ? '<div class="exam-tip" style="margin:0 0 10px"><div class="ttl">🎯 考点卡</div><ul>' + sec.exam.map((e) => '<li>' + inline(e) + '</li>').join('') + '</ul></div>' : '') +
      (reviewState.mode !== 'quick' ? '<div class="fold open"><button class="fh">知识点回顾<svg class="caret" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg></button><div class="fb">' +
        (sec.body || []).slice(0, 4).map((b) => blockHTML(b, sec.tables || [])).join('') + '</div></div>' : '') +
      (mech ? '<div style="margin:0 0 10px"><div class="mech-host" data-mech="' + mech.id + '"></div></div>' : '') +
      (showQ && qids.length ? '<div style="font-weight:800;margin:12px 0 8px;color:var(--c-primary-600)">随堂 5 题</div><div id="miniQuiz" data-sec="' + cur + '"></div>' : '') +
      '<div style="margin-top:14px;font-weight:800;font-size:var(--fs-sm)">刚才这节，你记住了吗？</div>' +
      '<div class="rate-row" style="grid-template-columns:repeat(3,1fr)">' +
      '<button class="btn btn-plain" data-rrate="0">忘了</button>' +
      '<button class="btn btn-plain" data-rrate="1">模糊</button>' +
      '<button class="btn" data-rrate="2">记住了</button></div>' +
      '<div style="font-size:var(--fs-xs);color:var(--c-ink-3);margin-top:8px">模糊 → 下次间隔提前；忘了 → 重置为 1 天</div>' +
      '</div></div>';
  }

  function startReview() {
    const list = sectionDueList(R.subject).map((d) => d.sec.id);
    reviewState.list = list.length ? list : IDX.secOrder.filter((id) => IDX.sections[id].subjectId === R.subject && secState(id).status !== 'unlearned').slice(-3).reverse();
    if (!reviewState.list.length) { toast('还没有可复习的小节，先去学习吧'); return; }
    reviewState.active = true;
    reviewState.idx = 0;
    mini.secId = '';
    render();
  }

  /* ================= 14. 刷题中心 ================= */
  const qz = { active: false, kind: '', ids: [], idx: 0, picks: {}, submitted: {}, right: 0, wrong: 0, startedAt: 0, limitMin: 0, timer: null };

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function viewQuiz() {
    if (qz.active) return renderQuizRunner();
    const subj = R.subject;
    const sub = IDX.bySubject[subj];
    const wrongN = Object.keys(S.wrong).filter((k) => !S.wrong[k].done && IDX.questionsById[k] && IDX.questionsById[k].sub === subj).length;
    const total = (IDX.qBySubject[subj] || []).length;

    const cards = sub.chapters.map((ch) => {
      const n = (IDX.qByChapter[ch.id] || []).length;
      const acc = chapterAccuracy(ch.id);
      return '<button class="list-item" data-qzc="' + ch.id + '"><span class="grow">' +
        '<span class="t">' + esc(ch.name) + '</span>' +
        '<span class="s">' + n + ' 题' + (acc === null ? ' · 未练习' : ' · 正确率 ' + Math.round(acc * 100) + '%') + '</span></span>' +
        '<svg class="go" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg></button>';
    }).join('');

    return '<div class="view"><div class="page-hd"><h1>刷题中心 · ' + esc(SUBJECT_META[subj].name) + '</h1>' +
      '<div class="sub">共 ' + total + ' 题 · 即时判分 · 错题自动入本</div></div>' +
      '<div class="grid grid-3" style="margin-bottom:12px">' +
      '<button class="card card-tap" data-qzrandom="1"><div class="card-hd"><h3>随机模拟</h3><span class="chip st-learning">限时</span></div><div style="font-size:var(--fs-xs);color:var(--c-ink-3)">20 题 / 25 分钟</div></button>' +
      '<button class="card card-tap" data-qzwrong="1"><div class="card-hd"><h3>错题重做</h3><span class="chip st-weak">' + wrongN + '</span></div><div style="font-size:var(--fs-xs);color:var(--c-ink-3)">按章节筛选</div></button>' +
      '<button class="card card-tap" data-goto="#/stats"><div class="card-hd"><h3>统计面板</h3></div><div style="font-size:var(--fs-xs);color:var(--c-ink-3)">正确率 / 连续打卡</div></button>' +
      '</div>' +
      '<div class="card"><div class="card-hd"><h3>章节练习</h3><span class="chip st-unlearned">' + sub.chapters.length + ' 章</span></div>' + cards + '</div>' +
      '</div>';
  }

  function startQuiz(kind, opts) {
    opts = opts || {};
    let ids = [];
    if (kind === 'chapter') ids = shuffle((IDX.qByChapter[opts.chapter] || []).slice());
    else if (kind === 'random') ids = shuffle((IDX.qBySubject[R.subject] || []).slice()).slice(0, opts.n || 20);
    else if (kind === 'wrong') {
      ids = shuffle(Object.keys(S.wrong).filter((k) => !S.wrong[k].done && IDX.questionsById[k] && IDX.questionsById[k].sub === R.subject));
    } else if (kind === 'exam') ids = (opts.ids || []).slice();
    if (!ids.length) { toast('该范围暂无题目'); return; }
    qz.active = true; qz.kind = kind; qz.ids = ids; qz.idx = 0;
    qz.picks = {}; qz.submitted = {}; qz.right = 0; qz.wrong = 0;
    qz.startedAt = Date.now();
    qz.limitMin = kind === 'random' ? 25 : (opts.limitMin || 0);
    startQzTimer();
    render();
  }
  function startQzTimer() {
    clearInterval(qz.timer);
    if (!qz.limitMin) return;
    qz.timer = setInterval(() => {
      const left = qz.limitMin * 60 - Math.floor((Date.now() - qz.startedAt) / 1000);
      const el = $('#qzTimer');
      if (el) el.textContent = mmss(left);
      if (left <= 0) { clearInterval(qz.timer); finishQuiz(true); }
    }, 1000);
  }

  function renderQuizRunner() {
    const total = qz.ids.length;
    if (qz.idx >= total) return renderQuizResult();
    const q = IDX.questionsById[qz.ids[qz.idx]];
    const picked = qz.picks[q.id];
    const done = qz.submitted[q.id];
    const left = qz.limitMin ? qz.limitMin * 60 - Math.floor((Date.now() - qz.startedAt) / 1000) : 0;

    return '<div class="view quiz-page"><div class="card">' +
      '<div class="q-meta"><span class="chip st-unlearned">第 ' + (qz.idx + 1) + ' / ' + total + ' 题</span>' +
      (q.diff ? '<span class="chip st-unlearned">难度 ' + '★'.repeat(q.diff) + '</span>' : '') +
      (qz.limitMin ? '<span class="chip st-weak">⏱ <b id="qzTimer">' + mmss(left) + '</b></span>' : '') +
      '<span style="flex:1"></span><button class="btn btn-sm btn-plain" data-qzquit>退出</button></div>' +
      '<div class="q-stem"><span class="qn">' + (qz.idx + 1) + '.</span>' + inline(q.q) + '</div>' +
      '<div class="opts">' + q.o.map((o, i) =>
        '<button class="opt' + (done ? (i === q.a ? ' right' : i === picked ? ' wrong' : '') : picked === i ? ' sel' : '') + '" data-opt="' + i + '"' + (done ? ' disabled' : '') + '>' +
        '<span class="k">' + 'ABCDE'[i] + '</span><span>' + inline(o) + '</span></button>').join('') + '</div>' +
      (done ? '<div class="explain"><div class="eh">' + (picked === q.a ? '<span class="ok">✓ 回答正确</span>' : '<span class="no">✗ 回答错误，正确答案 ' + 'ABCDE'[q.a] + '</span>') + '</div>' + inline(q.e) +
        '<div class="src">出处：' + esc(q.src || '') + (q.tag && q.tag.length ? ' · 考点：' + esc(q.tag.join('、')) : '') + '</div></div>' : '') +
      '</div>' +
      '<div class="bottom-bar">' +
      '<button class="btn btn-plain btn-sm" data-qzprev' + (qz.idx === 0 ? ' disabled' : '') + '>上一题</button>' +
      '<div class="grow"></div>' +
      '<span style="font-size:var(--fs-xs);color:var(--c-ink-3)">✓' + qz.right + ' ✗' + qz.wrong + '</span>' +
      (done ? '<button class="btn" data-qznext>' + (qz.idx >= total - 1 ? '交卷' : '下一题') + '</button>'
        : '<button class="btn" data-qzsubmit>提交</button>') +
      '</div></div>';
  }

  function renderQuizResult() {
    clearInterval(qz.timer);
    const total = qz.ids.length;
    const acc = total ? Math.round((qz.right / total) * 100) : 0;
    const secs = Math.round((Date.now() - qz.startedAt) / 1000);
    const wrongIds = qz.ids.filter((id) => qz.picks[id] !== undefined && qz.picks[id] !== IDX.questionsById[id].a);
    S.quiz.sessions.unshift({ at: new Date().toISOString(), kind: qz.kind, total: total, right: qz.right, secs: secs });
    S.quiz.sessions = S.quiz.sessions.slice(0, 40);
    save(true);
    qz.active = false;

    return '<div class="view"><div class="card" style="text-align:center;padding:26px 16px">' +
      '<div style="font-size:var(--fs-xs);color:var(--c-ink-3)">本组成绩</div>' +
      '<div style="font-size:clamp(40px,7vw,62px);font-weight:800;line-height:1.1;color:' + (acc >= 80 ? 'var(--c-success)' : acc >= 60 ? 'var(--c-accent)' : 'var(--c-danger)') + '">' + acc + '<span style="font-size:.4em">%</span></div>' +
      '<div style="margin-top:6px;color:var(--c-ink-2)">答对 ' + qz.right + ' / ' + total + ' 题 · 用时 ' + mmss(secs) + '</div>' +
      '<div style="display:flex;gap:9px;margin-top:18px"><button class="btn btn-plain" style="flex:1" data-goto="#/quiz">返回</button>' +
      (wrongIds.length ? '<button class="btn" style="flex:1" data-qzretry="' + wrongIds.join(',') + '">重做错题(' + wrongIds.length + ')</button>' : '') +
      '</div></div>' +
      '<div class="card"><div class="card-hd"><h3>逐题回顾</h3></div>' +
      qz.ids.map((id, i) => {
        const q = IDX.questionsById[id];
        const picked = qz.picks[id];
        const ok = picked === q.a;
        return '<div class="fold"><button class="fh"><span class="chip ' + (ok ? 'st-mastered' : 'st-weak') + '">' + (ok ? '✓' : '✗') + '</span>' +
          '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (i + 1) + '. ' + esc(q.q) + '</span>' +
          '<svg class="caret" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg></button>' +
          '<div class="fb"><div class="opts">' + q.o.map((o, k) => '<div class="opt' + (k === q.a ? ' right' : k === picked ? ' wrong' : '') + '" style="cursor:default"><span class="k">' + 'ABCDE'[k] + '</span><span>' + inline(o) + '</span></div>').join('') + '</div>' +
          '<div class="explain">' + inline(q.e) + '<div class="src">出处：' + esc(q.src || '') + '</div></div></div></div>';
      }).join('') + '</div></div>';
  }

  function finishQuiz(auto) {
    qz.idx = qz.ids.length;
    clearInterval(qz.timer);
    render();
    if (auto) toast('时间到，已自动交卷');
  }

  /* ================= 15. 记忆卡片 ================= */
  const cardUI = { list: null, filter: '', idx: 0, flipped: false };

  function viewCards(filter) {
    const subj = filter || R.subject;
    if (!cardUI.list || cardUI.filter !== subj) {
      cardUI.filter = subj;
      let list = allCards().filter((c) => IDX.sections[c.sec] && IDX.sections[c.sec].subjectId === subj);
      const t = today();
      list = list.slice().sort((a, b) => {
        const A = cardState(a.id), B = cardState(b.id);
        const ad = A.due && A.due <= t ? 1 : 0, bd = B.due && B.due <= t ? 1 : 0;
        return bd - ad;
      });
      cardUI.list = list;
      cardUI.idx = 0;
      cardUI.flipped = false;
    }
    const list = cardUI.list;
    if (!list.length) return '<div class="view"><div class="page-hd"><h1>记忆卡片</h1></div><div class="card">' + emptyState('还没有卡片', '学完一节会自动生成 3~5 张') + '</div></div>';

    const i = clamp(cardUI.idx, 0, list.length - 1);
    const c = list[i];
    const sec = IDX.sections[c.sec];
    const known = list.filter((x) => cardState(x.id).iv >= 2).length;

    return '<div class="view"><div class="page-hd"><h1>记忆卡片 · ' + esc(SUBJECT_META[subj].name) + '</h1>' +
      '<div class="sub">第 ' + (i + 1) + ' / ' + list.length + ' 张 · 已掌握 ' + Math.round((known / list.length) * 100) + '% · 今日到期 ' + dueCards(subj).length + ' 张</div></div>' +
      '<div class="flip-wrap"><div class="flip' + (cardUI.flipped ? ' on' : '') + '" id="flipCard">' +
      '<div class="face front"><div class="cat">' + esc(sec ? sec.chapterName : '') + '</div>' +
      '<div class="term">' + esc(c.f) + '</div><div class="hint">点击卡片翻面</div></div>' +
      '<div class="face back"><span class="back-tag">核心要点</span><div class="pt">' + inline(c.b) + '</div><div class="hint">点击返回正面</div></div>' +
      '</div></div>' +
      '<div class="rate-row"><button class="btn btn-plain" data-crate="0">不认识</button><button class="btn btn-plain" data-crate="1">模糊</button><button class="btn" data-crate="2">认识</button></div>' +
      '<div style="display:flex;gap:9px;margin-top:10px"><button class="btn btn-plain btn-sm" data-cprev>上一张</button><div style="flex:1"></div><button class="btn btn-plain btn-sm" data-cnext>下一张</button></div>' +
      '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>按小节跳转</h3></div>' +
      (IDX.bySubject[subj] ? IDX.bySubject[subj].chapters.map((ch) => {
        const cnt = ch.sections.reduce((s, x) => s + cardsOf(x.id).length, 0);
        if (!cnt) return '';
        return '<div style="font-size:var(--fs-xs);color:var(--c-ink-3);font-weight:700;margin:10px 0 5px">' + esc(ch.name) + '</div>' +
          ch.sections.map((x) => {
            const n = cardsOf(x.id).length;
            if (!n) return '';
            const kn = cardsOf(x.id).filter((cc) => cardState(cc.id).iv >= 2).length;
            return '<button class="list-item" data-cardgo="' + x.id + '"><span class="grow"><span class="t">' + esc(x.name) + '</span>' +
              '<span class="s">掌握 ' + Math.round((kn / n) * 100) + '%</span></span><span class="chip st-unlearned">' + n + ' 张</span></button>';
          }).join('');
      }).join('') : '') + '</div></div>';
  }

  /* ================= 16. 机制图 ================= */
  function mechSVG(mech) {
    const mob = isMobile();
    const W = mob ? 360 : (mech.w || 900);
    let H = mob ? 0 : (mech.h || 480);
    const nodes = mech.nodes.map((n) => Object.assign({}, n));
    if (mob) {
      nodes.forEach((n, i) => { n._x = 16; n._y = 14 + i * 60; n._w = W - 32; n._h = 44; });
      H = 14 + nodes.length * 60 + 8;
    } else {
      nodes.forEach((n) => { n._x = n.x; n._y = n.y; n._w = n.w; n._h = n.h; });
    }
    const map = {};
    nodes.forEach((n) => { map[n.id] = n; });
    const edges = (mech.edges || []).map((e) => {
      const a = map[e[0]], b = map[e[1]];
      if (!a || !b) return '';
      if (mob) {
        return '<line x1="' + (a._x + a._w / 2) + '" y1="' + (a._y + a._h) + '" x2="' + (b._x + b._w / 2) + '" y2="' + b._y + '" marker-end="url(#arrow)"/>';
      }
      return '<line x1="' + (a._x + a._w / 2) + '" y1="' + (a._y + a._h / 2) + '" x2="' + (b._x + b._w / 2) + '" y2="' + (b._y + b._h / 2) + '" marker-end="url(#arrow)"/>';
    }).join('');
    const palette = { main: '#0E5A5A', sub: '#17706F', warm: '#E8710F', cool: '#345C86', gray: '#6A7B78' };
    const nodeSVG = nodes.map((n) => {
      const fill = palette[n.kind] || palette.main;
      const lines = String(n.label).split('\n');
      const fs = mob ? 12.5 : (n.fs || 14);
      const lh = fs + 4;
      const startY = n._y + n._h / 2 - ((lines.length - 1) * lh) / 2 + fs * 0.35;
      return '<g class="mnode" data-node="' + n.id + '" tabindex="0" role="button" aria-label="' + esc(n.label.replace(/\n/g, ' ')) + '">' +
        '<rect x="' + n._x + '" y="' + n._y + '" width="' + n._w + '" height="' + n._h + '" rx="' + (mob ? 11 : Math.min(14, n._h / 3.2)) + '" fill="' + fill + '" fill-opacity="' + (n.kind === 'gray' ? .62 : .94) + '"/>' +
        lines.map((ln, i) => '<text x="' + (n._x + n._w / 2) + '" y="' + (startY + i * lh) + '" text-anchor="middle" fill="#fff" font-size="' + fs + '" font-weight="700">' + esc(ln) + '</text>').join('') +
        '</g>';
    }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(mech.title) + '">' +
      '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#A8BEBC"/></marker></defs>' +
      '<g class="flow-arrows">' + edges + '</g>' + nodeSVG + '</svg>';
  }

  function mountMech(host) {
    const mech = IDX.mechById[host.dataset.mech];
    if (!mech) return;
    // 每次进入默认展示全部节点（可读性优先）；「上一步/下一步」仅影响本次浏览，不做持久化，
    // 避免上次留下的聚焦状态让下次进入时看到一堆灰节点。
    const step = -1;
    const totalSteps = (mech.steps || []).length || 1;
    host.innerHTML = '<div class="svg-stage"><div class="mechInner">' + mechSVG(mech) + '</div></div>' +
      '<div class="mzoom">' +
      '<button class="btn btn-sm btn-plain" data-mstep="prev"' + (step < 0 ? ' disabled' : '') + '>上一步</button>' +
      '<span class="chip st-learning" data-mstep-lbl>' + (step < 0 ? '全部' : (Math.min(step + 1, totalSteps) + ' / ' + totalSteps)) + '</span>' +
      '<button class="btn btn-sm btn-plain" data-mstep="next"' + (step >= totalSteps - 1 ? ' disabled' : '') + '>下一步</button>' +
      '<button class="btn btn-sm btn-plain" data-mzoom="+" title="放大">＋</button>' +
      '<button class="btn btn-sm btn-plain" data-mzoom="-" title="缩小">－</button></div>' +
      '<div class="mech-hint">' + (isMobile() ? '点击节点弹出说明；双指缩放拖动；可用「下一步」逐步聚焦' : '点击节点查看说明；「下一步」逐步聚焦；可用 ＋/－ 放大') + '</div>';

    const stage = host.querySelector('.svg-stage');
    const inner = host.querySelector('.mechInner');
    let zoom = 1, tx = 0, ty = 0, dragging = false, moved = false, lastX = 0, lastY = 0, pinchDist = 0;
    const apply = () => { inner.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + zoom + ')'; inner.style.transformOrigin = '0 0'; };

    host.querySelectorAll('[data-mzoom]').forEach((b) => b.addEventListener('click', () => {
      zoom = clamp(zoom + (b.dataset.mzoom === '+' ? 0.2 : -0.2), 0.7, 2.6); apply();
    }));

    const pts = new Map();
    stage.addEventListener('pointerdown', (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY; }
      if (pts.size === 2) { const a = Array.from(pts.values()); pinchDist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
    });
    stage.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const a = Array.from(pts.values());
        const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (pinchDist) { zoom = clamp(zoom * (d / pinchDist), 0.7, 2.6); apply(); }
        pinchDist = d; moved = true; return;
      }
      if (dragging) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        tx += dx; ty += dy; lastX = e.clientX; lastY = e.clientY;
        if (moved) apply();
      }
    });
    const endPtr = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinchDist = 0; if (pts.size === 0) dragging = false; };
    stage.addEventListener('pointerup', endPtr);
    stage.addEventListener('pointercancel', endPtr);
    stage.addEventListener('pointerleave', endPtr);

    host.querySelectorAll('.mnode').forEach((g) => {
      g.addEventListener('click', () => { if (moved) return; openMechNode(mech, g.dataset.node, host); });
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMechNode(mech, g.dataset.node, host); } });
    });

    host.querySelectorAll('[data-mstep]').forEach((b) => b.addEventListener('click', () => {
      const cur = (S.mechStep[mech.id] == null) ? -1 : S.mechStep[mech.id];
      let s2;
      if (b.dataset.mstep === 'next') s2 = cur < 0 ? 0 : cur + 1;
      else s2 = cur <= 0 ? -1 : cur - 1;
      s2 = clamp(s2, -1, totalSteps - 1);
      S.mechStep[mech.id] = s2; save();
      applyStep(mech, s2, host);
    }));

    applyStep(mech, step, host);
  }

  function applyStep(mech, step, host) {
    const totalSteps = (mech.steps || []).length || 1;
    const lbl = host.querySelector('[data-mstep-lbl]');
    if (lbl) lbl.textContent = step < 0 ? '全部' : (Math.min(step + 1, totalSteps) + ' / ' + totalSteps);
    const prevB = host.querySelector('[data-mstep="prev"]');
    const nextB = host.querySelector('[data-mstep="next"]');
    if (prevB) prevB.disabled = step < 0;
    if (nextB) nextB.disabled = step >= totalSteps - 1;
    host.querySelectorAll('.mnode').forEach((g) => g.classList.remove('dim'));
    if (!mech.steps || !mech.steps.length || step < 0) return;
    const visible = new Set();
    for (let i = 0; i <= step; i++) (mech.steps[i] || []).forEach((id) => visible.add(id));
    host.querySelectorAll('.mnode').forEach((g) => g.classList.toggle('dim', !visible.has(g.dataset.node)));
  }

  function openMechNode(mech, nid, host) {
    const n = (mech.nodes || []).find((x) => x.id === nid);
    if (!n) return;
    if (host) host.querySelectorAll('.mnode').forEach((g) => g.classList.toggle('active', g.dataset.node === nid));
    const html = '<div style="font-size:var(--fs-sm);line-height:1.85">' + inline(n.detail || '') + '</div>' +
      (n.exam ? '<div class="exam-tip" style="margin-top:10px"><div class="ttl">🎯 关联考点</div>' + inline(n.exam) + '</div>' : '');
    if (!isMobile()) {
      const side = $('.reading-side');
      if (side) {
        let box = $('#mechSideBox');
        if (!box) { box = document.createElement('div'); box.className = 'card'; box.id = 'mechSideBox'; side.insertBefore(box, side.firstChild); }
        box.innerHTML = '<div class="card-hd"><h3>' + esc(n.label.replace(/\n/g, ' ')) + '</h3><span class="chip st-learning">机制</span></div>' + html;
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
    }
    openSheet(n.label.replace(/\n/g, ' '), html);
  }

  function openMechLibrary(mechId) {
    const m = IDX.mechById[mechId];
    if (!m) return;
    const panel = '<div class="mech-host" data-mech="' + m.id + '"></div>';
    if (isMobile()) {
      openSheet(m.title, panel);
      const h = $('#sheetBody').querySelector('.mech-host');
      if (h) mountMech(h);
    } else {
      go('#/sec/' + (IDX.secOrder.find((id) => IDX.sections[id].mech === mechId) || IDX.secOrder[0]));
    }
  }

  /* ================= 17. 我的 / 统计 / 冲刺 ================= */
  function viewMe() {
    const notesArr = Object.keys(S.notes).map((k) => ({ k: k, n: S.notes[k] })).sort((a, b) => (a.n.at < b.n.at ? 1 : -1));
    const sessions = (S.quiz.sessions || []).slice(0, 6);
    return '<div class="view"><div class="page-hd"><h1>我的</h1><div class="sub">数据保存在本机浏览器（localStorage），换设备不会自动同步</div></div>' +

      '<div class="card" style="margin-bottom:12px"><div class="card-hd"><h3>双科目概览</h3><button class="btn btn-sm btn-plain" data-export>导出 JSON</button></div>' +
      DB.subjects.map((sub) => {
        const lp = learnProgress(sub.id), m = subjectMastery(sub.id);
        return '<button class="list-item" data-subj-open="' + sub.id + '"><span class="grow">' +
          '<span class="t">' + esc(SUBJECT_META[sub.id].name) + '</span>' +
          '<span class="s">学习 ' + lp.pct + '% · 掌握 ' + m + '%</span></span>' +
          '<span style="width:96px;flex:0 0 auto">' + bar(lp.pct) + '</span></button>';
      }).join('') +
      '</div>' +

      '<div class="grid grid-3" style="margin-bottom:12px">' +
      '<div class="stat-tile"><div class="k">记忆卡片</div><div class="v">' + allCards().length + '<small>张</small></div></div>' +
      '<div class="stat-tile"><div class="k">已答题目</div><div class="v">' + Object.keys(S.quiz.records).length + '<small>题</small></div></div>' +
      '<div class="stat-tile"><div class="k">已看视频</div><div class="v">' + Object.keys(S.videos).filter((k) => S.videos[k].watched).length + '<small>个</small></div></div>' +
      '</div>' +

      '<div class="card" style="margin-bottom:12px"><div class="card-hd"><h3>期末考试日期（双科目）</h3><span class="chip st-learning">首页倒计时</span></div>' +
      '<div class="field"><label>诊断学考试日期</label><input type="date" id="examDiag" value="' + esc((S.examDates || {}).diag || '') + '"></div>' +
      '<div class="field"><label>药理学考试日期</label><input type="date" id="examPharm" value="' + esc((S.examDates || {}).pharm || '') + '"></div>' +
      '<div style="display:flex;gap:9px"><button class="btn btn-sm" data-saveexam>保存</button><button class="btn btn-sm btn-plain" data-goto="#/sprint">进入冲刺模式</button></div></div>' +

      '<div class="card" style="margin-bottom:12px"><div class="card-hd"><h3>我的笔记</h3><span class="chip st-unlearned">' + notesArr.length + ' 条</span></div>' +
      (notesArr.length ? notesArr.slice(0, 12).map((x) => {
        const isVid = x.k.indexOf('vid:') === 0;
        const key = x.k.split(':')[1];
        const title = isVid ? ((VIDEOS.find((v) => v.id === key) || {}).title || key) : ((IDX.sections[key] || {}).name || key);
        return '<div class="note-item"><div class="nh"><span>' + (isVid ? '🎬 ' : '📖 ') + esc(title) + '</span><span>' + esc(String(x.n.at || '').slice(0, 10)) + '</span></div><div class="nb">' + esc(x.n.text) + '</div></div>';
      }).join('') : '<div style="font-size:var(--fs-sm);color:var(--c-ink-3)">还没有笔记。</div>') +
      '</div>' +

      '<div class="card" style="margin-bottom:12px"><div class="card-hd"><h3>最近练习</h3><button class="btn btn-sm btn-ghost" data-goto="#/stats">统计</button></div>' +
      (sessions.length ? sessions.map((s) => '<div class="list-item" style="margin-bottom:7px"><span class="grow">' +
        '<span class="t">' + esc(s.kind === 'chapter' ? '章节练习' : s.kind === 'random' ? '随机模拟' : s.kind === 'wrong' ? '错题重做' : '限时套卷') + ' · ' + s.right + '/' + s.total + '</span>' +
        '<span class="s">' + esc(String(s.at || '').slice(0, 16).replace('T', ' ')) + ' · 用时 ' + mmss(s.secs) + '</span></span></div>').join('')
        : '<div style="font-size:var(--fs-sm);color:var(--c-ink-3)">还没有练习记录。</div>') + '</div>' +

      '<div class="card"><div class="card-hd"><h3>其他</h3></div>' +
      '<div class="list-item" data-reset><span class="grow"><span class="t">清空本机学习数据</span><span class="s">不可恢复，请谨慎</span></span></div>' +
      '<div class="list-item" data-install><span class="grow"><span class="t">安装到桌面 / 主屏幕</span><span class="s">需 https 访问</span></span></div>' +
      '<div style="font-size:var(--fs-xs);color:var(--c-ink-3);margin-top:10px;line-height:1.85">内容依据：《诊断学》第10版 + 诊断学A大纲（2026版）；《药理学》第10版 + 药理学B大纲（2025版）及题库、讲义、笔记。诊断学题目由平台依据大纲考点生成。</div>' +
      '</div></div>';
  }

  function viewStats() {
    const subj = R.subject;
    const sub = IDX.bySubject[subj];
    let tr = 0, tw = 0;
    Object.keys(S.quiz.records).forEach((k) => {
      const q = IDX.questionsById[k];
      if (!q || q.sub !== subj) return;
      tr += S.quiz.records[k].right; tw += S.quiz.records[k].wrong;
    });
    const totalAcc = (tr + tw) ? Math.round((tr / (tr + tw)) * 100) : 0;
    const rows = sub.chapters.map((ch) => ({ ch: ch, acc: chapterAccuracy(ch.id), n: (IDX.qByChapter[ch.id] || []).length }));
    const done = rows.filter((r) => r.acc !== null).sort((a, b) => a.acc - b.acc);
    const days = Object.keys(S.quiz.days).sort().slice(-14);

    return '<div class="view"><div class="page-hd"><h1>统计 · ' + esc(SUBJECT_META[subj].name) + '</h1><div class="sub">正确率、打卡与薄弱排行</div></div>' +
      '<div class="grid grid-3" style="margin-bottom:12px">' +
      '<div class="stat-tile"><div class="k">总正确率</div><div class="v">' + totalAcc + '<small>%</small></div></div>' +
      '<div class="stat-tile"><div class="k">累计答题</div><div class="v">' + (tr + tw) + '<small>题</small></div></div>' +
      '<div class="stat-tile"><div class="k">连续打卡</div><div class="v">' + (S.quiz.streak.days || 0) + '<small>天</small></div></div>' +
      '</div>' +
      '<div class="card" style="margin-bottom:12px"><div class="card-hd"><h3>近 14 天练习</h3></div>' +
      (days.length ? '<div style="display:flex;align-items:flex-end;gap:5px;height:110px;padding-top:6px">' + days.map((d) => {
        const x = S.quiz.days[d] || { answered: 0, right: 0 };
        const h = clamp(x.answered * 3, 4, 96);
        const pc = x.answered ? Math.round((x.right / x.answered) * 100) : 0;
        return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0" title="' + d + '：' + x.answered + ' 题">' +
          '<div style="width:100%;height:' + h + 'px;border-radius:5px 5px 2px 2px;background:' + (pc >= 80 ? 'var(--c-primary)' : pc >= 60 ? 'var(--c-accent)' : 'var(--c-danger)') + ';opacity:.9"></div>' +
          '<span style="font-size:9.5px;color:var(--c-ink-3);white-space:nowrap">' + d.slice(5) + '</span></div>';
      }).join('') + '</div>' : '<div style="font-size:var(--fs-sm);color:var(--c-ink-3)">还没有答题记录。</div>') +
      '</div>' +
      '<div class="card"><div class="card-hd"><h3>各章正确率</h3><span class="chip st-weak">正确率 &lt; 70% 标红</span></div>' +
      '<div class="hbar">' + rows.map((r) => {
        const p = r.acc === null ? 0 : Math.round(r.acc * 100);
        return '<div class="row ' + (r.acc !== null && p < 70 ? 'low' : p < 85 ? 'mid' : '') + '"><span class="nm">' + esc(r.ch.name) + '</span>' +
          bar(p) + '<span class="pc">' + (r.acc === null ? '—' : p + '%') + '</span></div>';
      }).join('') + '</div></div></div>';
  }

  function viewSprint() {
    const subj = R.subject;
    const sub = IDX.bySubject[subj];
    const wc = weakChapters(subj).slice(0, 6);
    const hot = [];
    sub.chapters.forEach((ch) => ch.sections.forEach((sec) => {
      if (sec.level === '掌握') (sec.exam || []).forEach((e) => hot.push({ sec: sec, e: e }));
    }));
    const dd = S.examDate ? Math.ceil((new Date(S.examDate + 'T08:00:00') - new Date()) / 86400000) : null;

    return '<div class="view"><div class="page-hd"><h1>考前冲刺 · ' + esc(SUBJECT_META[subj].name) + '</h1></div>' +
      '<div class="hero" style="margin-bottom:12px"><h1>' + (dd === null ? '未设置考试日期' : (dd >= 0 ? '距离考试还有 ' + dd + ' 天' : '考试日期已过')) + '</h1>' +
      '<div class="sub">' + (S.examDate ? esc(S.examDate) : '在「我的」里设置期末考试日期') + '</div>' +
      '<div style="display:flex;gap:9px;margin-top:16px"><button class="btn btn-accent" data-mock="' + subj + '">生成模拟卷（30 题 / 35 分钟）</button></div></div>' +
      '<div class="card" style="margin-bottom:12px"><div class="card-hd"><h3>高频考点清单</h3><span class="chip st-unlearned">' + hot.length + ' 条</span></div>' +
      hot.slice(0, 40).map((h) => '<div style="padding:8px 0;border-bottom:1px dashed var(--c-line);font-size:var(--fs-sm)">' +
        '<b style="color:var(--c-primary)">' + esc(h.sec.name) + '</b>：' + inline(h.e) + '</div>').join('') + '</div>' +
      '<div class="card"><div class="card-hd"><h3>冲刺行动</h3></div>' +
      '<button class="list-item" data-goto="#/quiz/wrong"><span class="grow"><span class="t">错题重做</span><span class="s">考前最高性价比</span></span></button>' +
      '<button class="list-item" data-goto="#/cards"><span class="grow"><span class="t">卡片速刷</span><span class="s">三键评分，最后一轮</span></span></button>' +
      (wc.length ? '<div style="margin-top:10px;font-weight:700;font-size:var(--fs-sm)">优先补漏</div>' +
        wc.map((w) => '<div class="list-item" style="margin-top:6px"><span class="grow"><span class="t">' + esc(w.name) + '</span><span class="s">正确率 ' + Math.round(w.acc * 100) + '%</span></span></div>').join('') : '') +
      '</div></div>';
  }

  function startMock(subject) {
    const sub = IDX.bySubject[subject];
    if (!sub) { toast('没有该科目'); return; }
    const totalQ = 30;
    const chs = sub.chapters.map((ch) => ({ id: ch.id, hours: ch.hours || 2, ids: (IDX.qByChapter[ch.id] || []).slice() }));
    const sumH = chs.reduce((a, b) => a + b.hours, 0) || 1;
    let picked = [];
    chs.forEach((c) => {
      const want = Math.max(1, Math.round((c.hours / sumH) * totalQ));
      picked = picked.concat(shuffle(c.ids).slice(0, want));
    });
    picked = shuffle(picked).slice(0, totalQ);
    if (!picked.length) { toast('题库为空'); return; }
    qz.active = true; qz.kind = 'exam'; qz.ids = picked; qz.idx = 0;
    qz.picks = {}; qz.submitted = {}; qz.right = 0; qz.wrong = 0;
    qz.startedAt = Date.now(); qz.limitMin = 35;
    startQzTimer();
    go('#/quiz');
  }

  /* ================= 18. 搜索 ================= */
  const plainCache = {};
  function sectionPlain(sec) {
    if (plainCache[sec.id]) return plainCache[sec.id];
    const parts = [sec.name, sec.chapterName, sec.level];
    (sec.preview || []).forEach((x) => parts.push(x));
    (sec.body || []).forEach((b) => {
      if (typeof b.v === 'string') parts.push(b.v);
      else if (Array.isArray(b.v)) b.v.forEach((x) => parts.push(Array.isArray(x) ? x.join(' ') : x));
    });
    (sec.plain || []).forEach((x) => parts.push(x));
    (sec.exam || []).forEach((x) => parts.push(x));
    (sec.cards || []).forEach((c) => { parts.push(c.f); parts.push(c.b); });
    (sec.tables || []).forEach((tb) => tb.rows.forEach((r) => parts.push(r.join(' '))));
    const txt = parts.join(' \n ');
    plainCache[sec.id] = txt;
    return txt;
  }

  function doSearch(q) {
    q = (q || '').trim();
    if (!q) return [];
    const low = q.toLowerCase();
    const out = [];
    IDX.secOrder.forEach((id) => {
      const sec = IDX.sections[id];
      if (sec.subjectId !== R.subject) return;
      const txt = sectionPlain(sec);
      const i = txt.toLowerCase().indexOf(low);
      if (i >= 0) out.push({ type: 'sec', id: id, title: sec.name, sub: SUBJECT_META[sec.subjectId].name, snippet: txt.slice(Math.max(0, i - 22), i + 46) });
    });
    QUESTIONS.forEach((qq) => {
      if (qq.sub !== R.subject) return;
      if ((qq.q + qq.o.join('') + (qq.e || '')).toLowerCase().indexOf(low) >= 0) {
        out.push({ type: 'q', id: qq.id, title: qq.q.slice(0, 40) + (qq.q.length > 40 ? '…' : ''), sub: SUBJECT_META[qq.sub].name, snippet: (qq.e || '').slice(0, 60) });
      }
    });
    return out.slice(0, 30);
  }
  function highlight(text, q) {
    const s = esc(text);
    if (!q) return s;
    try { return s.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<span class="h">$1</span>'); }
    catch (e) { return s; }
  }
  function viewSearch(q) {
    const res = doSearch(q);
    return '<div class="view"><div class="page-hd"><h1>搜索 · ' + esc(SUBJECT_META[R.subject].name) + '</h1>' +
      '<div class="sub">“' + esc(q) + '” 共 ' + res.length + ' 条结果</div></div>' +
      (res.length ? res.map((r) =>
        '<button class="sr-item" data-goto="' + (r.type === 'sec' ? '#/sec/' + r.id + '?hl=' + encodeURIComponent(q) : '#/quiz') + '">' +
        '<div class="t">' + highlight(r.title, q) + '</div>' +
        '<div class="s">' + esc(r.sub) + ' · ' + highlight(r.snippet, q).replace(/\n/g, ' ') + '</div></button>').join('')
        : emptyState('没有找到相关内容', '换个关键词试试，例如"移动性浊音""β内酰胺类"')) +
      '</div>';
  }

  /* ================= 19. 弹层 ================= */
  function openSheet(title, html) {
    $('#sheetTitle').textContent = title || '详情';
    $('#sheetBody').innerHTML = html;
    $('#sheet').classList.add('on');
    $('#sheet').setAttribute('aria-hidden', 'false');
    $('#scrim').classList.add('on');
  }
  function closeSheet() {
    $('#sheet').classList.remove('on');
    $('#sheet').setAttribute('aria-hidden', 'true');
    if (!$('#drawer').classList.contains('on')) $('#scrim').classList.remove('on');
  }
  function openDrawer() {
    $('#drawer').classList.add('on');
    $('#scrim').classList.add('on');
    $('#drawer').setAttribute('aria-hidden', 'false');
  }
  function closeDrawer() {
    $('#drawer').classList.remove('on');
    $('#drawer').setAttribute('aria-hidden', 'true');
    if (!$('#sheet').classList.contains('on')) $('#scrim').classList.remove('on');
  }

  /* ================= 20. 渲染主循环 ================= */
  let lastKey = '';
  function render() {
    parseHash();
    const subj = R.subject;
    S.activeSubject = subj;
    applyTheme(subj);
    applyNight();

    // 状态一致性：复习/答题退出时重置
    if (R.route !== 'review') reviewState.active = false;
    if (R.route !== 'quiz' && qz.active && !qz.ids.length) qz.active = false;
    // 答题时隐藏底部 Tab，让提交栏真正贴底
    document.body.classList.toggle('quiz-mode', !!(qz.active && R.route === 'quiz'));

    const host = $('#view');
    let html = '';
    switch (R.route) {
      case 'home': html = viewHome(); break;
      case 'sec': html = viewSection(R.secId); break;
      case 'review': html = viewReview(); break;
      case 'quiz':
        if (R.quizMode === 'wrong') { startQuiz('wrong', {}); }
        html = viewQuiz();
        break;
      case 'cards': html = viewCards(R.cardFilter || ''); break;
      case 'me': html = viewMe(); break;
      case 'stats': html = viewStats(); break;
      case 'sprint': html = viewSprint(); break;
      case 'search': html = viewSearch(R.term || ''); break;
      default: html = viewHome();
    }
    host.innerHTML = html;

    refreshTrees();

    const tabMap = { home: 'learn', sec: 'learn', review: 'review', quiz: 'quiz', cards: 'review', me: 'me', stats: 'me', sprint: 'review', search: 'learn' };
    const on = tabMap[R.route] || 'learn';
    $$('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === on));
    S.activeTab = on;

    // 局部挂载
    if ($('#miniQuiz')) renderMiniQuiz($('#miniQuiz').dataset.sec);
    const mechHosts = $$('.mech-host');
    mechHosts.forEach((h) => mountMech(h));

    if (R.hl && R.route === 'sec') highlightInView(R.hl);

    if (R.route === 'sec' && R.secId) startSecTimer(R.secId); else stopSecTimer();

    const key = R.route + '|' + R.secId;
    if (lastKey !== key) window.scrollTo(0, 0);
    lastKey = key;

    closeDrawer();
    save();
  }

  function highlightInView(term) {
    const view = $('#view');
    if (!view || !term) return;
    const walker = document.createTreeWalker(view, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const low = term.toLowerCase();
    let first = null;
    nodes.forEach((n) => {
      if (!n.nodeValue || n.nodeValue.toLowerCase().indexOf(low) < 0) return;
      if (n.parentElement && n.parentElement.tagName === 'SCRIPT') return;
      const re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      const span = document.createElement('span');
      span.innerHTML = esc(n.nodeValue).replace(re, '<mark>$1</mark>');
      n.parentNode.replaceChild(span, n);
      if (!first) first = span.querySelector('mark');
    });
    if (first) setTimeout(() => first.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  }

  function startSecTimer(id) {
    if (secTimerId === id) return;
    stopSecTimer();
    secTimerId = id; secEnterAt = Date.now();
    secTimer = setInterval(() => {
      const st = secState(id);
      const now = Date.now();
      st.timeSec = (st.timeSec || 0) + Math.round((now - secEnterAt) / 1000);
      secEnterAt = now;
      st.lastAt = now;
      save();
    }, 20000);
  }
  function stopSecTimer() {
    if (secTimer) { clearInterval(secTimer); secTimer = null; }
    if (secTimerId && secEnterAt) {
      const st = secState(secTimerId);
      st.timeSec = (st.timeSec || 0) + Math.round((Date.now() - secEnterAt) / 1000);
      save();
    }
    secTimerId = ''; secEnterAt = 0;
  }

  /* ================= 21. 全局事件（委托） ================= */
  function switchSubject(subj) {
    if (!IDX.bySubject[subj]) return;
    R.subject = subj;
    S.activeSubject = subj;
    applyTheme(subj);
    applyNight();
    treeSig = '';
    cardUI.list = null;
    // 切换科目后退回该科目首页，由「继续学习」卡片承接断点
    if (location.hash === '#/' || location.hash === '') render();
    else go('#/');
  }

  function bindGlobal() {
    // 顶栏
    // PC 端：左上角按钮折叠侧栏；移动端：打开目录抽屉
    $('#btnDrawer').addEventListener('click', () => {
      if (!isMobile()) {
        const app = $('#app');
        app.classList.toggle('rail');
        try { localStorage.setItem(KEY + '_rail', app.classList.contains('rail') ? '1' : '0'); } catch (e) {}
        refreshTrees(true);
        toast(app.classList.contains('rail') ? '侧栏已收起' : '侧栏已展开');
      } else {
        openDrawer();
      }
    });
    $('#btnDrawerClose').addEventListener('click', closeDrawer);
    $('#scrim').addEventListener('click', () => { closeDrawer(); closeSheet(); });
    $('#btnSheetClose').addEventListener('click', closeSheet);

    // 科目切换
    $$('#subjSwitch button').forEach((b) => b.addEventListener('click', () => switchSubject(b.dataset.subj)));

    // 黑夜模式
    const bn = $('#btnNight');
    if (bn) bn.addEventListener('click', () => {
      S.night = !S.night;
      save(true);
      applyNight();
      toast(S.night ? '已切换到黑夜模式' : '已切换到白天模式');
    });

    // 搜索
    const input = $('#searchInput');
    let st2 = null;
    input.addEventListener('input', () => {
      $('#searchClear').hidden = !input.value;
      clearTimeout(st2);
      st2 = setTimeout(() => {
        if (!input.value.trim()) { if (R.route === 'search') go('#/'); return; }
        R.term = input.value.trim();
        go('#/search');
      }, 280);
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { R.term = input.value.trim(); go('#/search'); input.blur(); } });
    $('#searchClear').addEventListener('click', () => {
      input.value = ''; $('#searchClear').hidden = true; R.term = ''; go('#/');
    });
    $('#btnSearchToggle').addEventListener('click', () => {
      const box = $('#searchBox');
      if (!isMobile()) {
        // PC 端搜索框常显，点击直接聚焦
        input.focus();
        input.select();
        return;
      }
      // 移动端：展开搜索行
      box.classList.toggle('open');
      if (box.classList.contains('open')) setTimeout(() => input.focus(), 60);
      else if (R.route === 'search') go('#/');
    });

    // Tab
    $$('#tabbar button').forEach((b) => b.addEventListener('click', () => {
      const t = b.dataset.tab;
      if (t === 'learn') {
        const last = S.lastSubjectSection && S.lastSubjectSection[R.subject];
        if (last && IDX.sections[last]) go('#/sec/' + last);
        else go('#/');
      } else go('#/' + t);
    }));

    // 侧栏折叠
    $('#btnRail').addEventListener('click', () => {
      const app = $('#app');
      app.classList.toggle('rail');
      try { localStorage.setItem(KEY + '_rail', app.classList.contains('rail') ? '1' : '0'); } catch (e) {}
    });
    try { if (localStorage.getItem(KEY + '_rail') === '1') $('#app').classList.add('rail'); } catch (e) {}

    // 全局委托：data-goto / 目录 / 折叠
    document.addEventListener('click', (e) => {
      const t = e.target.closest ? e.target : e.target.parentElement;
      if (!t || !t.closest) return;

      const goto = t.closest('[data-goto]');
      if (goto) { e.preventDefault(); closeDrawer(); go(goto.dataset.goto); return; }

      const subjOpen = t.closest('[data-subj-open]');
      if (subjOpen) {
        const subj = subjOpen.dataset.subjOpen;
        R.subject = subj;
        S.activeSubject = subj;
        treeSig = '';
        closeDrawer();
        go('#/');
        setTimeout(() => { applyTheme(subj); render(); }, 0);
        return;
      }

      const toggleCh = t.closest('[data-toggle-ch]');
      if (toggleCh) {
        const id = toggleCh.dataset.toggleCh;
        collapsed.ch[id] = !collapsed.ch[id];
        refreshTrees(true);
        return;
      }

      const del = t.closest('.fold > .fh');
      if (del) { del.parentElement.classList.toggle('open'); return; }

      // 步骤条
      const stepBtn = t.closest('[data-step]');
      if (stepBtn && R.route === 'sec') {
        const i = +stepBtn.dataset.step;
        setStep(R.secId, i);
        renderSteps(i);
        return;
      }
      const stepNav = t.closest('[data-step-nav]');
      if (stepNav && R.route === 'sec') {
        const cur = stepIndex(R.secId);
        const nxt = clamp(cur + (+stepNav.dataset.stepNav), 0, 5);
        if (nxt !== cur) {
          // 离开某一步即视为该步已完成
          const st = secState(R.secId);
          if (!st.doneStep) st.doneStep = {};
          st.doneStep[cur] = 1;
          setStep(R.secId, nxt);
          renderSteps(nxt);
          if (nxt === 5 && !st.selfDone) {
            toast('已到最后一步：给本节一个掌握度自评吧');
            st.selfDone = 1;
          }
        }
        return;
      }

      // 通俗/教材版
      const plainBtn = t.closest('[data-plain]');
      if (plainBtn) {
        const box = plainBtn.closest('.card');
        box.querySelectorAll('[data-plain]').forEach((x) => x.classList.toggle('on', x === plainBtn));
        const a = box.querySelector('#plainPlain'), b = box.querySelector('#plainTextbook');
        if (a) a.hidden = plainBtn.dataset.plain === '1';
        if (b) b.hidden = plainBtn.dataset.plain === '0';
        return;
      }

      // 自评
      const selfBtn = t.closest('[data-self]');
      if (selfBtn && R.route === 'sec') {
        const st = secState(R.secId);
        st.self = selfBtn.dataset.self;
        st.status = selfBtn.dataset.self === 'mastered' ? 'mastered' : selfBtn.dataset.self === 'seen' ? 'learning' : 'unlearned';
        st.lastDay = today();
        if (!st.srs.due) { st.srs.iv = 0; st.srs.due = shiftDay(today(), 1); }
        if (selfBtn.dataset.self !== 'none') cardsOf(R.secId).forEach((c) => cardState(c.id));
        save(); treeSig = ''; render();
        toast(selfBtn.dataset.self === 'mastered' ? '已标记为掌握 · 明天第 1 次复习'
          : selfBtn.dataset.self === 'seen' ? '已记录：学过' : '已重置为未学');
        return;
      }

      // 小测
      const miniOpt = t.closest('[data-mini]');
      if (miniOpt) {
        const hostEl = $('#miniQuiz');
        const secId = hostEl.dataset.sec;
        const qids = (IDX.qBySection[secId] || []).slice(0, 5);
        const q = IDX.questionsById[qids[mini.idx]];
        if (mini.answers[q.id] !== undefined) return;
        const i = +miniOpt.dataset.mini;
        mini.answers[q.id] = i;
        recordAnswer(q.id, i === q.a);
        treeSig = '';
        renderMiniQuiz(secId);
        return;
      }
      const miniPrev = t.closest('[data-mini-prev]');
      if (miniPrev) { mini.idx = Math.max(0, mini.idx - 1); renderMiniQuiz(mini.secId); return; }
      const miniNext = t.closest('[data-mini-next]');
      if (miniNext) {
        const hostEl = $('#miniQuiz');
        const secId = hostEl.dataset.sec;
        const qids = (IDX.qBySection[secId] || []).slice(0, 5);
        const q = IDX.questionsById[qids[mini.idx]];
        if (mini.answers[q.id] === undefined) { toast('先选一个答案'); return; }
        if (mini.idx >= qids.length - 1) {
          const rightN = qids.filter((id) => { const qq = IDX.questionsById[id]; return mini.answers[id] === qq.a; }).length;
          toast('本组完成：' + rightN + ' / ' + qids.length);
          markStudied(secId);
          if (R.route === 'sec') { setStep(secId, 5); render(); }
          else render();
        } else { mini.idx++; renderMiniQuiz(secId); }
        return;
      }

      // 视频
      const vw = t.closest('[data-vwatch]');
      if (vw) {
        const vid = vw.dataset.vwatch;
        const stv = S.videos[vid] = S.videos[vid] || {};
        stv.watched = !stv.watched; stv.at = new Date().toISOString();
        save(); render(); toast(stv.watched ? '已标记看过' : '已取消');
        return;
      }

      // 复习
      const rmode = t.closest('[data-rmode]');
      if (rmode) { reviewState.mode = rmode.dataset.rmode; render(); return; }
      const rstart = t.closest('[data-rstart]');
      if (rstart) { startReview(); return; }
      const rstop = t.closest('[data-rstop]');
      if (rstop) { reviewState.active = false; render(); return; }
      const rrate = t.closest('[data-rrate]');
      if (rrate) {
        rateSection(reviewState.list[reviewState.idx], +rrate.dataset.rrate);
        if (reviewState.idx < reviewState.list.length - 1) { reviewState.idx++; mini.secId = ''; render(); }
        else { reviewState.active = false; treeSig = ''; render(); toast('本轮复习完成 🎉'); }
        return;
      }

      // 刷题
      const qzc = t.closest('[data-qzc]');
      if (qzc) { startQuiz('chapter', { chapter: qzc.dataset.qzc }); return; }
      const qzr = t.closest('[data-qzrandom]');
      if (qzr) { startQuiz('random', { n: 20 }); return; }
      const qzw = t.closest('[data-qzwrong]');
      if (qzw) { startQuiz('wrong', {}); return; }
      const opt = t.closest('[data-opt]');
      if (opt && qz.active) {
        const q = IDX.questionsById[qz.ids[qz.idx]];
        if (qz.submitted[q.id]) return;
        qz.picks[q.id] = +opt.dataset.opt;
        render();
        return;
      }
      const qzsub = t.closest('[data-qzsubmit]');
      if (qzsub && qz.active) {
        const q = IDX.questionsById[qz.ids[qz.idx]];
        if (qz.picks[q.id] === undefined) { toast('请先选择一个选项'); return; }
        qz.submitted[q.id] = true;
        if (qz.picks[q.id] === q.a) qz.right++; else qz.wrong++;
        recordAnswer(q.id, qz.picks[q.id] === q.a);
        treeSig = '';
        render();
        return;
      }
      const qznext = t.closest('[data-qznext]');
      if (qznext && qz.active) {
        if (qz.idx >= qz.ids.length - 1) { finishQuiz(false); return; }
        qz.idx++; render();
        return;
      }
      const qzprev = t.closest('[data-qzprev]');
      if (qzprev && qz.active) { qz.idx = Math.max(0, qz.idx - 1); render(); return; }
      const qzquit = t.closest('[data-qzquit]');
      if (qzquit) { qz.active = false; clearInterval(qz.timer); go('#/quiz'); return; }
      const qzretry = t.closest('[data-qzretry]');
      if (qzretry) {
        const ids = qzretry.dataset.qzretry.split(',').filter(Boolean);
        qz.active = true; qz.kind = 'wrong'; qz.ids = ids; qz.idx = 0;
        qz.picks = {}; qz.submitted = {}; qz.right = 0; qz.wrong = 0;
        qz.startedAt = Date.now(); qz.limitMin = 0; clearInterval(qz.timer);
        render();
        return;
      }

      // 卡片
      const flip = t.closest('#flipCard');
      if (flip) {
        cardUI.flipped = !cardUI.flipped;
        flip.classList.toggle('on', cardUI.flipped);
        return;
      }
      const crate = t.closest('[data-crate]');
      if (crate && cardUI.list) {
        const c = cardUI.list[clamp(cardUI.idx, 0, cardUI.list.length - 1)];
        rateCard(c.id, +crate.dataset.crate);
        if (cardUI.idx < cardUI.list.length - 1) { cardUI.idx++; cardUI.flipped = false; render(); }
        else { cardUI.idx = 0; render(); toast('本组卡片完成'); }
        return;
      }
      const cprev = t.closest('[data-cprev]');
      if (cprev && cardUI.list) { cardUI.idx = Math.max(0, cardUI.idx - 1); cardUI.flipped = false; render(); return; }
      const cnext = t.closest('[data-cnext]');
      if (cnext && cardUI.list) { cardUI.idx = Math.min(cardUI.list.length - 1, cardUI.idx + 1); cardUI.flipped = false; render(); return; }
      const cardgo = t.closest('[data-cardgo]');
      if (cardgo && cardUI.list) {
        const sid = cardgo.dataset.cardgo;
        const i = cardUI.list.findIndex((c) => c.sec === sid);
        cardUI.idx = Math.max(0, i); cardUI.flipped = false; render();
        // 自动上滑到卡片处
        setTimeout(() => {
          const fw = $('.flip-wrap');
          if (fw) fw.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
        return;
      }

      const mechPageBtn = t.closest('[data-mech-page]');
      if (mechPageBtn) {
        reviewState.mechPage += +mechPageBtn.dataset.mechPage;
        render();
        return;
      }
      // 机制图库
      const openM = t.closest('[data-open-mech]');
      if (openM) { openMechLibrary(openM.dataset.openMech); return; }

      // 我的 / 统计 / 冲刺
      const saveExam = t.closest('[data-saveexam]');
      if (saveExam) {
        S.examDates = {
          diag: ($('#examDiag') || {}).value || '',
          pharm: ($('#examPharm') || {}).value || ''
        };
        save(true);
        render();
        toast('考试日期已保存');
        return;
      }
      const exportBtn = t.closest('[data-export]');
      if (exportBtn) {
        const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '医学学习平台-数据-' + today() + '.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        return;
      }
      const resetBtn = t.closest('[data-reset]');
      if (resetBtn) {
        if (confirm('确定清空所有学习数据？此操作不可恢复。')) {
          localStorage.removeItem(KEY); S = load(); treeSig = ''; cardUI.list = null; allCardsCache = null; render(); toast('已清空');
        }
        return;
      }
      const installBtn = t.closest('[data-install]');
      if (installBtn) { showInstallGuide(); return; }
      const mockBtn = t.closest('[data-mock]');
      if (mockBtn) { startMock(mockBtn.dataset.mock); return; }
    });

    // 文本输入（笔记）
    document.addEventListener('input', (e) => {
      const el = e.target;
      if (!el || !el.id) return;
      if (el.id === 'secNote' || el.hasAttribute('data-side-note')) {
        const key = el.id === 'secNote' ? ('sec:' + R.secId) : ('sec:' + el.dataset.sideNote);
        S.notes[key] = { text: el.value, at: new Date().toISOString() };
        save();
        const other = el.id === 'secNote' ? $('[data-side-note]') : $('#secNote');
        if (other && other.value !== el.value) other.value = el.value;
        return;
      }
      if (el.id.indexOf('vnote-') === 0) {
        const vid = el.id.slice(6);
        S.notes['vid:' + vid] = { text: el.value, at: new Date().toISOString() };
        save();
      }
    });

    // 上一节 / 下一节（底部按钮）
    document.addEventListener('click', (e) => {
      const nx = e.target.closest && e.target.closest('#btnNextSec');
      const pv = e.target.closest && e.target.closest('#btnPrevSec');
      if (nx) {
        const i = IDX.secOrder.indexOf(R.secId);
        if (i >= 0 && i < IDX.secOrder.length - 1) go('#/sec/' + IDX.secOrder[i + 1]);
        else toast('已经是最后一节了');
      }
      if (pv) {
        const i = IDX.secOrder.indexOf(R.secId);
        if (i > 0) go('#/sec/' + IDX.secOrder[i - 1]);
        else toast('已经是第一节了');
      }
    });

    // 快捷键
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
      if (e.key === 'Escape') { closeSheet(); closeDrawer(); if (typing) e.target.blur(); return; }
      if (typing) return;

      if (R.route === 'quiz' && qz.active && qz.idx < qz.ids.length) {
        const q = IDX.questionsById[qz.ids[qz.idx]];
        if (/^[1-5]$/.test(e.key)) {
          const i = +e.key - 1;
          if (i < q.o.length && !qz.submitted[q.id]) { qz.picks[q.id] = i; render(); }
          e.preventDefault(); return;
        }
        if (e.key === 'Enter') {
          if (!qz.submitted[q.id]) {
            if (qz.picks[q.id] === undefined) { toast('请先选择一个选项'); return; }
            qz.submitted[q.id] = true;
            if (qz.picks[q.id] === q.a) qz.right++; else qz.wrong++;
            recordAnswer(q.id, qz.picks[q.id] === q.a);
          } else if (qz.idx >= qz.ids.length - 1) { finishQuiz(false); return; }
          else qz.idx++;
          render(); e.preventDefault(); return;
        }
        if (e.key === 'ArrowRight') { qz.idx = Math.min(qz.ids.length - 1, qz.idx + 1); render(); e.preventDefault(); return; }
        if (e.key === 'ArrowLeft') { qz.idx = Math.max(0, qz.idx - 1); render(); e.preventDefault(); return; }
      }

      if (R.route === 'sec') {
        if (e.key === 'ArrowRight') { const c = stepIndex(R.secId); if (c < 5) { setStep(R.secId, c + 1); renderSteps(c + 1); } return; }
        if (e.key === 'ArrowLeft') { const c = stepIndex(R.secId); if (c > 0) { setStep(R.secId, c - 1); renderSteps(c - 1); } return; }
      }

      if (R.route === 'cards' && cardUI.list) {
        const c = cardUI.list[clamp(cardUI.idx, 0, cardUI.list.length - 1)];
        if (e.key === ' ') {
          e.preventDefault();
          cardUI.flipped = !cardUI.flipped;
          const f = $('#flipCard');
          if (f) f.classList.toggle('on', cardUI.flipped);
          return;
        }
        if (/^[1-3]$/.test(e.key)) {
          if (c) { rateCard(c.id, +e.key - 1); cardUI.idx = Math.min(cardUI.list.length - 1, cardUI.idx + 1); cardUI.flipped = false; render(); }
          return;
        }
        if (e.key === 'ArrowLeft') { cardUI.idx = Math.max(0, cardUI.idx - 1); cardUI.flipped = false; render(); return; }
        if (e.key === 'ArrowRight') { cardUI.idx = Math.min(cardUI.list.length - 1, cardUI.idx + 1); cardUI.flipped = false; render(); return; }
      }
    });

    window.addEventListener('hashchange', render);
    window.addEventListener('beforeunload', () => { stopSecTimer(); save(true); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { stopSecTimer(); save(true); }
      else if (R.route === 'sec') startSecTimer(R.secId);
    });

    const mq = window.matchMedia('(max-width:767.98px)');
    const onMq = () => {
      treeSig = '';
      refreshTrees(true);
      if (R.route === 'sec') { render(); }
    };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else mq.addListener(onMq);

    // 移动端卡片滑动手势
    let sx = 0, sy = 0, tracking = false;
    document.addEventListener('touchstart', (e) => {
      if (R.route !== 'cards') return;
      const fw = e.target.closest && e.target.closest('.flip-wrap');
      if (!fw) return;
      tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) < 48 || Math.abs(dy) > Math.abs(dx)) return;
      if (!cardUI.list) return;
      const c = cardUI.list[clamp(cardUI.idx, 0, cardUI.list.length - 1)];
      if (!c) return;
      rateCard(c.id, dx < 0 ? 0 : 2);
      cardUI.idx = Math.min(cardUI.list.length - 1, cardUI.idx + 1);
      cardUI.flipped = false;
      render();
    }, { passive: true });
  }

  /** 切换步骤：只替换内容面板 + 步骤条状态，不整页重绘 */
  function renderSteps(i) {
    const sec = IDX.sections[R.secId];
    if (!sec) { render(); return; }
    const body = $('#stepBody');
    if (body) body.innerHTML = renderStepPanel(sec, i);
    const host = $('#miniQuiz');
    if (host) renderMiniQuiz(host.dataset.sec);
    const mechHost = $('.mech-host');
    if (mechHost) mountMech(mechHost);
    $$('#stepbar .sp').forEach((b, k) => {
      b.classList.toggle('on', k === i);
      b.classList.toggle('done', k < i);
      const n = b.querySelector('.n');
      if (n) n.textContent = k < i ? '✓' : String(k + 1);
    });
    const counter = $('#stepCounter');
    if (counter) counter.textContent = (i + 1) + ' / 6';
    const prev = $('[data-step-nav="-1"]'), next = $('[data-step-nav="1"]');
    if (prev) prev.disabled = i === 0;
    if (next) next.disabled = i === 5;
    const top = $('#stepbar');
    if (top) top.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* 视频全屏退出后恢复滚动（iOS/Android WebView 全屏会锁死 body 滚动） */
  function releaseFullscreenLock() {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
  }
  function initFullscreenFix() {
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach((evt) => {
      document.addEventListener(evt, () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          setTimeout(releaseFullscreenLock, 120);
        }
      });
    });
    window.addEventListener('pageshow', (e) => { if (e.persisted) releaseFullscreenLock(); });
    window.addEventListener('focus', releaseFullscreenLock);
  }

  /* ================= 22. PWA ================= */
  let deferredPrompt = null, waitingSW = null;
  function banner(html, id) {
    const host = $('#bannerHost');
    if (!host) return;
    if (host.querySelector('[data-bid="' + id + '"]')) return;
    const div = document.createElement('div');
    div.dataset.bid = id;
    div.innerHTML = html;
    host.appendChild(div);
  }
  function showInstallGuide() {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    openSheet('安装到桌面 / 主屏幕',
      '<div style="font-size:var(--fs-sm);line-height:1.9">' +
      (ios
        ? '<p><b>iPhone / iPad（Safari）</b></p><ol><li>点底部「分享」按钮 ⤴️</li><li>选择「添加到主屏幕」</li><li>确认后从主屏幕图标打开，即全屏无地址栏</li></ol>'
        : '<p><b>Android（Chrome / Edge）</b></p><ol><li>点右上角「⋮」菜单</li><li>选择「安装应用」或「添加到主屏幕」</li></ol>' +
          '<p><b>电脑（Chrome / Edge）</b></p><ol><li>地址栏右侧出现「安装」图标，或菜单 →「安装 医学学习平台」</li></ol>') +
      '<p style="color:var(--c-ink-3);font-size:var(--fs-xs)">PWA 安装需 https 访问（如 GitHub Pages）。离线时除 B 站视频外全部功能可用。</p></div>');
  }
  function initPWA() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        reg.onupdatefound = () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              waitingSW = nw;
              banner('<div class="banner accent"><span class="grow">有新版本，点击更新</span><button data-update>更新</button><button class="x" data-bx>×</button></div>', 'update');
            }
          });
        };
      }).catch(() => {});
    }
    // 安装提示仅在浏览器真正触发 beforeinstallprompt 时出现一次，且 7 天后才再次提示
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const lastTip = S.installTipAt || 0;
      const week = 7 * 86400000;
      if (S.installTipDismissed && (Date.now() - lastTip) < week) return;
      if (matchMedia('(display-mode: standalone)').matches) return;
      banner('<div class="banner"><span class="grow">添加到主屏幕，像 App 一样使用</span><button data-install-go>安装</button><button class="x" data-bx>×</button></div>', 'install');
      S.installTipAt = Date.now(); save();
    });
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-update]')) {
        if (waitingSW) waitingSW.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(() => location.reload(), 400);
      }
      if (e.target.closest('[data-install-go]')) {
        if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; } else showInstallGuide();
      }
      if (e.target.closest('[data-bx]')) {
        const b = e.target.closest('[data-bid]');
        if (b) b.remove();
        S.installTipDismissed = true;
        S.installTipAt = Date.now();
        save();
      }
    });
  }

  /* ================= 23. 启动 ================= */
  function boot() {
    bindGlobal();
    initFullscreenFix();
    if (!location.hash) location.hash = '#/';
    render();
    initPWA();
    save(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
