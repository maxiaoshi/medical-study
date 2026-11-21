/* =====================================================================
 * 数据合并层
 * 把 content-diag.js / content-pharm.js 中的 CONTENT 按 sectionId
 * 合并进 window.DB 的对应小节；未提供内容的小节自动获得占位提示，
 * 保证界面在任何小节下都不会出现空白。
 * 字段说明（与 assets/app.js 的 blockHTML 对应）：
 *   preview : []                 预习提纲（3~5 条）
 *   body    : [{t,v}]            课本精读，t = h | p | ul | kv | tip
 *   plain   : []                 通俗讲解段落
 *   analogy : ''                 白话类比
 *   tables  : [{title,head,rows}] 易混概念对比表
 *   cards   : [{f,b}]            记忆卡片（建议 3~5 张）
 *   exam    : []                 考点提示（结合大纲掌握程度）
 *   mech    : 'mech-id'          关联机制图
 *   outlineRef / pages           大纲条目 / 教材页码
 * ===================================================================== */
(function () {
  var C = window.CONTENT || {};
  (window.DB.subjects || []).forEach(function (sub) {
    sub.chapters.forEach(function (ch) {
      ch.sections.forEach(function (sec) {
        var c = C[sec.id];
        if (c) { for (var k in c) if (Object.prototype.hasOwnProperty.call(c, k)) sec[k] = c[k]; }
        if (!sec.preview) sec.preview = ['本节内容整理中，可先按大纲条目预习：' + (sec.outlineRef || sec.name)];
        if (!sec.body) sec.body = [{ t: 'p', v: '本节正文正在按教材与笔记整理，先看「考点提示」与「即时小测」。' }];
        if (!sec.plain) sec.plain = ['本节通俗讲解整理中。'];
        if (!sec.exam) sec.exam = [];
        if (!sec.cards) sec.cards = [];
      });
    });
  });
})();
