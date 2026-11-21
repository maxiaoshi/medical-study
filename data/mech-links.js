/* =====================================================================
 * 机制图挂载层
 * 作用：把 data/mech.js 与 data/mech-2.js 中的机制图按主题挂到对应小节上。
 * 为什么单独一个文件：机制图 id 与小节 id 的对应关系属于"展示配置"，
 * 与教材正文分开维护，将来换图/加图只改这里，不动正文。
 * 加载顺序要求：必须在 content.js（负责把 CONTENT 合并进 DB）之后。
 * ===================================================================== */
(function () {
  var LINKS = {
    /* ---- 诊断学 ---- */
    'diag-c2-s7': 'mech-jaundice',                 // 黄疸分类鉴别
    'diag-c4-s3': 'mech-pleural-effusion',         // 肺脏听诊 → 胸腔积液
    'diag-c5-s2': 'mech-valve',                    // 心脏听诊区与血流
    'diag-c5-s3': 'mech-murmur-timing',            // 杂音时相判断
    'diag-c5-s4': 'mech-heart-failure-signs',      // 血管检查 → 心衰体征
    'diag-c6-s2': 'mech-ascites',                  // 腹部叩诊 → 腹水机制
    'diag-c6-s3': 'mech-liver-cirrhosis',          // 腹部听诊 → 门脉高压侧支
    /* ---- 药理学 ---- */
    'pharm-c2-s6': 'mech-betablock',               // β受体阻断药通路
    'pharm-c5-s3': 'mech-bp',                      // 降压药靶点
    'pharm-c5-s4': 'mech-heart-failure-signs',     // 抗心衰药 → 心衰体征
    'pharm-c6-s1': 'mech-asthma-drugs',            // 平喘药分层
    'pharm-c6-s3': 'mech-diuretic-sites',          // 利尿药作用部位
    'pharm-c7-s3': 'mech-diabetes-drugs',          // 降糖药靶点
    'pharm-c8-s1': 'mech-antibiotic-targets',      // 抗菌药作用靶点
    'pharm-c8-s2': 'mech-penicillin'               // 青霉素杀菌机制
  };

  /* 额外的"关联图"映射：某些小节除主图外，还应推荐 1 张相关图 */
  var EXTRA = {
    'diag-c2-s4': ['mech-shock-stages'],
    'diag-c6-s1': ['mech-liver-cirrhosis'],
    'pharm-c5-s6': ['mech-anticoagulant'],
    'pharm-c4-s2': ['mech-antibiotic-targets']
  };

  function apply() {
    if (!window.DB || !window.DB.subjects) return;
    var byId = {};
    (window.DB_MECH || []).concat(window.DB_MECH2 || []).forEach(function (m) { byId[m.id] = m; });
    window.DB.subjects.forEach(function (sub) {
      sub.chapters.forEach(function (ch) {
        ch.sections.forEach(function (sec) {
          if (LINKS[sec.id] && byId[LINKS[sec.id]]) {
            sec.mech = LINKS[sec.id];
          }
          if (EXTRA[sec.id]) {
            sec.mechMore = EXTRA[sec.id].filter(function (id) { return !!byId[id]; });
          }
        });
      });
    });
  }

  // 直接在脚本执行时挂载即可（此时 content.js 已完成合并）；
  // 若在非浏览器环境（如 Node 校验脚本）下运行，因为没有 document，同样能正常执行。
  apply();
})();