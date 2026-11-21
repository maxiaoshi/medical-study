/* =====================================================================
 * 药理网课视频清单（独立 JS 数组，便于批量替换）
 * 来源：B 站 UP 主「忠保研道」《药理学》全集，BV1bP4y1P76R，共 102 P
 * 字段：id / section（挂到哪个小节）/ title / bv / p（分P号）/ up / dur
 *      section 对应 data/pharm-outline.js 中的小节 id
 * 替换方式：保持字段名不变，改数组内容即可，界面会自动重新挂载。
 * 注意：视频需联网播放；离线时其余功能不受影响。
 * ===================================================================== */
window.DB_VIDEOS = [
  /* ---------- 第1章 总论 ---------- */
  { id: 'v101', section: 'pharm-c1-s1', title: '第一章 绪论（1）', bv: 'BV1bP4y1P76R', p: 1, up: '忠保研道', dur: '' },
  { id: 'v102', section: 'pharm-c1-s1', title: '第一章 绪论（2）', bv: 'BV1bP4y1P76R', p: 2, up: '忠保研道', dur: '' },
  { id: 'v103', section: 'pharm-c1-s2', title: '第二章 药物代谢动力学（1）', bv: 'BV1bP4y1P76R', p: 3, up: '忠保研道', dur: '' },
  { id: 'v104', section: 'pharm-c1-s2', title: '第二章 药物代谢动力学（2）', bv: 'BV1bP4y1P76R', p: 4, up: '忠保研道', dur: '' },
  { id: 'v105', section: 'pharm-c1-s3', title: '第二章 药物代谢动力学（3）', bv: 'BV1bP4y1P76R', p: 5, up: '忠保研道', dur: '' },
  { id: 'v106', section: 'pharm-c1-s3', title: '第二章 药物代谢动力学（4）', bv: 'BV1bP4y1P76R', p: 6, up: '忠保研道', dur: '' },
  { id: 'v107', section: 'pharm-c1-s4', title: '第三章 药物效应动力学（1）', bv: 'BV1bP4y1P76R', p: 7, up: '忠保研道', dur: '' },
  { id: 'v108', section: 'pharm-c1-s4', title: '第三章 药物效应动力学（2）', bv: 'BV1bP4y1P76R', p: 8, up: '忠保研道', dur: '' },
  { id: 'v109', section: 'pharm-c1-s5', title: '第三章 药物效应动力学（3）', bv: 'BV1bP4y1P76R', p: 9, up: '忠保研道', dur: '' },
  { id: 'v110', section: 'pharm-c1-s5', title: '第三章 药物效应动力学（4）', bv: 'BV1bP4y1P76R', p: 10, up: '忠保研道', dur: '' },
  { id: 'v111', section: 'pharm-c1-s5', title: '第三章 药物效应动力学（5）', bv: 'BV1bP4y1P76R', p: 11, up: '忠保研道', dur: '' },
  { id: 'v112', section: 'pharm-c1-s2', title: '第四章 影响药物效应的因素', bv: 'BV1bP4y1P76R', p: 12, up: '忠保研道', dur: '' },

  /* ---------- 第2章 传出神经系统药 ---------- */
  { id: 'v113', section: 'pharm-c2-s1', title: '第五章 传出神经系统药理学（1）', bv: 'BV1bP4y1P76R', p: 13, up: '忠保研道', dur: '' },
  { id: 'v114', section: 'pharm-c2-s1', title: '第五章 传出神经系统药理学（2）', bv: 'BV1bP4y1P76R', p: 14, up: '忠保研道', dur: '' },
  { id: 'v115', section: 'pharm-c2-s2', title: '第六章 胆碱受体激动药（1）', bv: 'BV1bP4y1P76R', p: 15, up: '忠保研道', dur: '' },
  { id: 'v116', section: 'pharm-c2-s2', title: '第六章 胆碱受体激动药（2）', bv: 'BV1bP4y1P76R', p: 16, up: '忠保研道', dur: '' },
  { id: 'v117', section: 'pharm-c2-s3', title: '第七章 抗胆碱酯酶药（1）', bv: 'BV1bP4y1P76R', p: 17, up: '忠保研道', dur: '' },
  { id: 'v118', section: 'pharm-c2-s3', title: '第七章 抗胆碱酯酶药（2）', bv: 'BV1bP4y1P76R', p: 18, up: '忠保研道', dur: '' },
  { id: 'v119', section: 'pharm-c2-s4', title: '第八九章 胆碱受体阻断药（1）', bv: 'BV1bP4y1P76R', p: 19, up: '忠保研道', dur: '' },
  { id: 'v120', section: 'pharm-c2-s4', title: '第八九章 胆碱受体阻断药（2）', bv: 'BV1bP4y1P76R', p: 20, up: '忠保研道', dur: '' },
  { id: 'v121', section: 'pharm-c2-s5', title: '第十章 肾上腺素受体激动药（1）', bv: 'BV1bP4y1P76R', p: 21, up: '忠保研道', dur: '' },
  { id: 'v122', section: 'pharm-c2-s5', title: '第十章 肾上腺素受体激动药（2）', bv: 'BV1bP4y1P76R', p: 22, up: '忠保研道', dur: '' },
  { id: 'v123', section: 'pharm-c2-s6', title: '第十一章 肾上腺素受体阻断药（1）', bv: 'BV1bP4y1P76R', p: 23, up: '忠保研道', dur: '' },
  { id: 'v124', section: 'pharm-c2-s6', title: '第十一章 肾上腺素受体阻断药（2）', bv: 'BV1bP4y1P76R', p: 24, up: '忠保研道', dur: '' },

  /* ---------- 第3章 中枢神经系统药 ---------- */
  { id: 'v125', section: 'pharm-c3-s1', title: '第十二章 中枢神经系统药理学总论', bv: 'BV1bP4y1P76R', p: 25, up: '忠保研道', dur: '' },
  { id: 'v126', section: 'pharm-c3-s1', title: '第十五章 镇静催眠药（1）', bv: 'BV1bP4y1P76R', p: 31, up: '忠保研道', dur: '' },
  { id: 'v127', section: 'pharm-c3-s1', title: '第十五章 镇静催眠药（2）', bv: 'BV1bP4y1P76R', p: 32, up: '忠保研道', dur: '' },
  { id: 'v128', section: 'pharm-c3-s2', title: '第十六章 抗癫痫药物及抗惊厥药', bv: 'BV1bP4y1P76R', p: 33, up: '忠保研道', dur: '' },
  { id: 'v129', section: 'pharm-c3-s3', title: '第十七章 治疗中枢神经系统退行性疾病药（1）', bv: 'BV1bP4y1P76R', p: 34, up: '忠保研道', dur: '' },
  { id: 'v130', section: 'pharm-c3-s3', title: '第十七章 治疗中枢神经系统退行性疾病药（2）', bv: 'BV1bP4y1P76R', p: 35, up: '忠保研道', dur: '' },
  { id: 'v131', section: 'pharm-c3-s4', title: '第十八章 抗精神失常药（1）', bv: 'BV1bP4y1P76R', p: 36, up: '忠保研道', dur: '' },
  { id: 'v132', section: 'pharm-c3-s4', title: '第十八章 抗精神失常药（2）', bv: 'BV1bP4y1P76R', p: 37, up: '忠保研道', dur: '' },

  /* ---------- 第4章 镇痛药与解热镇痛抗炎药 ---------- */
  { id: 'v133', section: 'pharm-c4-s1', title: '第十九章 镇痛药（1）', bv: 'BV1bP4y1P76R', p: 38, up: '忠保研道', dur: '' },
  { id: 'v134', section: 'pharm-c4-s1', title: '第十九章 镇痛药（2）', bv: 'BV1bP4y1P76R', p: 39, up: '忠保研道', dur: '' },
  { id: 'v135', section: 'pharm-c4-s2', title: '第二十章 解热镇痛抗炎药（1）', bv: 'BV1bP4y1P76R', p: 40, up: '忠保研道', dur: '' },
  { id: 'v136', section: 'pharm-c4-s2', title: '第二十章 解热镇痛抗炎药（2）', bv: 'BV1bP4y1P76R', p: 41, up: '忠保研道', dur: '' },

  /* ---------- 第5章 心血管系统药 ---------- */
  { id: 'v137', section: 'pharm-c5-s1', title: '第二十一章 钙通道阻滞药（1）', bv: 'BV1bP4y1P76R', p: 42, up: '忠保研道', dur: '' },
  { id: 'v138', section: 'pharm-c5-s1', title: '第二十一章 钙通道阻滞药（2）', bv: 'BV1bP4y1P76R', p: 43, up: '忠保研道', dur: '' },
  { id: 'v139', section: 'pharm-c5-s1', title: '第二十一章 钙通道阻滞药（3）', bv: 'BV1bP4y1P76R', p: 44, up: '忠保研道', dur: '' },
  { id: 'v140', section: 'pharm-c5-s1', title: '第二十一章 钙通道阻滞药（4）', bv: 'BV1bP4y1P76R', p: 45, up: '忠保研道', dur: '' },
  { id: 'v141', section: 'pharm-c5-s2', title: '第二十二章 抗心律失常药（1）', bv: 'BV1bP4y1P76R', p: 46, up: '忠保研道', dur: '' },
  { id: 'v142', section: 'pharm-c5-s2', title: '第二十二章 抗心律失常药（2）', bv: 'BV1bP4y1P76R', p: 47, up: '忠保研道', dur: '' },
  { id: 'v143', section: 'pharm-c5-s2', title: '第二十二章 抗心律失常药（3）', bv: 'BV1bP4y1P76R', p: 48, up: '忠保研道', dur: '' },
  { id: 'v144', section: 'pharm-c5-s2', title: '第二十二章 抗心律失常药（4）', bv: 'BV1bP4y1P76R', p: 49, up: '忠保研道', dur: '' },
  { id: 'v145', section: 'pharm-c5-s3', title: '第二十三章 作用于肾素血管紧张素系统药物（1）', bv: 'BV1bP4y1P76R', p: 50, up: '忠保研道', dur: '' },
  { id: 'v146', section: 'pharm-c5-s3', title: '第二十三章 作用于肾素血管紧张素系统药物（2）', bv: 'BV1bP4y1P76R', p: 51, up: '忠保研道', dur: '' },
  { id: 'v147', section: 'pharm-c5-s3', title: '第二十五章 抗高血压药（1）', bv: 'BV1bP4y1P76R', p: 54, up: '忠保研道', dur: '' },
  { id: 'v148', section: 'pharm-c5-s3', title: '第二十五章 抗高血压药（2）', bv: 'BV1bP4y1P76R', p: 55, up: '忠保研道', dur: '' },
  { id: 'v149', section: 'pharm-c5-s3', title: '第二十五章 抗高血压药（3）', bv: 'BV1bP4y1P76R', p: 56, up: '忠保研道', dur: '' },
  { id: 'v150', section: 'pharm-c5-s3', title: '第二十五章 抗高血压药（4）', bv: 'BV1bP4y1P76R', p: 57, up: '忠保研道', dur: '' },
  { id: 'v151', section: 'pharm-c5-s4', title: '第二十六章 治疗充血性心力衰竭的药物（1）', bv: 'BV1bP4y1P76R', p: 58, up: '忠保研道', dur: '' },
  { id: 'v152', section: 'pharm-c5-s4', title: '第二十六章 治疗充血性心力衰竭的药物（2）', bv: 'BV1bP4y1P76R', p: 59, up: '忠保研道', dur: '' },
  { id: 'v153', section: 'pharm-c5-s4', title: '第二十六章 治疗充血性心力衰竭的药物（3）', bv: 'BV1bP4y1P76R', p: 60, up: '忠保研道', dur: '' },
  { id: 'v154', section: 'pharm-c5-s4', title: '第二十六章 治疗充血性心力衰竭的药物（4）', bv: 'BV1bP4y1P76R', p: 61, up: '忠保研道', dur: '' },
  { id: 'v155', section: 'pharm-c5-s5', title: '第二十七章 调血脂药与抗动脉粥样硬化药', bv: 'BV1bP4y1P76R', p: 62, up: '忠保研道', dur: '' },
  { id: 'v156', section: 'pharm-c5-s5', title: '第二十八章 抗心绞痛药物（1）', bv: 'BV1bP4y1P76R', p: 63, up: '忠保研道', dur: '' },
  { id: 'v157', section: 'pharm-c5-s5', title: '第二十八章 抗心绞痛药物（2）', bv: 'BV1bP4y1P76R', p: 64, up: '忠保研道', dur: '' },
  { id: 'v158', section: 'pharm-c5-s6', title: '第二十九章 作用于血液及造血系统的药物（1）', bv: 'BV1bP4y1P76R', p: 65, up: '忠保研道', dur: '' },
  { id: 'v159', section: 'pharm-c5-s6', title: '第二十九章 作用于血液及造血系统的药物（2）', bv: 'BV1bP4y1P76R', p: 66, up: '忠保研道', dur: '' },
  { id: 'v160', section: 'pharm-c5-s6', title: '第二十九章 作用于血液及造血系统的药物（3）', bv: 'BV1bP4y1P76R', p: 67, up: '忠保研道', dur: '' },
  { id: 'v161', section: 'pharm-c5-s6', title: '第二十九章 作用于血液及造血系统的药物（4）', bv: 'BV1bP4y1P76R', p: 68, up: '忠保研道', dur: '' },

  /* ---------- 第6章 内脏系统药 ---------- */
  { id: 'v162', section: 'pharm-c6-s1', title: '第三十一章 作用于呼吸系统的药物（1）', bv: 'BV1bP4y1P76R', p: 70, up: '忠保研道', dur: '' },
  { id: 'v163', section: 'pharm-c6-s1', title: '第三十一章 作用于呼吸系统的药物（2）', bv: 'BV1bP4y1P76R', p: 71, up: '忠保研道', dur: '' },
  { id: 'v164', section: 'pharm-c6-s2', title: '第三十二章 作用于消化系统的药物（1）', bv: 'BV1bP4y1P76R', p: 72, up: '忠保研道', dur: '' },
  { id: 'v165', section: 'pharm-c6-s2', title: '第三十二章 作用于消化系统的药物（2）', bv: 'BV1bP4y1P76R', p: 73, up: '忠保研道', dur: '' },
  { id: 'v166', section: 'pharm-c6-s3', title: '第二十四章 利尿药（1）', bv: 'BV1bP4y1P76R', p: 52, up: '忠保研道', dur: '' },
  { id: 'v167', section: 'pharm-c6-s3', title: '第二十四章 利尿药（2）', bv: 'BV1bP4y1P76R', p: 53, up: '忠保研道', dur: '' },

  /* ---------- 第7章 内分泌系统药 ---------- */
  { id: 'v168', section: 'pharm-c7-s1', title: '第三十五章 肾上腺皮质激素类药物（1）', bv: 'BV1bP4y1P76R', p: 75, up: '忠保研道', dur: '' },
  { id: 'v169', section: 'pharm-c7-s1', title: '第三十五章 肾上腺皮质激素类药物（2）', bv: 'BV1bP4y1P76R', p: 76, up: '忠保研道', dur: '' },
  { id: 'v170', section: 'pharm-c7-s1', title: '第三十五章 肾上腺皮质激素类药物（3）', bv: 'BV1bP4y1P76R', p: 77, up: '忠保研道', dur: '' },
  { id: 'v171', section: 'pharm-c7-s1', title: '第三十五章 肾上腺皮质激素类药物（4）', bv: 'BV1bP4y1P76R', p: 78, up: '忠保研道', dur: '' },
  { id: 'v172', section: 'pharm-c7-s2', title: '第三十六章 甲状腺激素和抗甲状腺药（1）', bv: 'BV1bP4y1P76R', p: 79, up: '忠保研道', dur: '' },
  { id: 'v173', section: 'pharm-c7-s2', title: '第三十六章 甲状腺激素和抗甲状腺药（2）', bv: 'BV1bP4y1P76R', p: 80, up: '忠保研道', dur: '' },
  { id: 'v174', section: 'pharm-c7-s3', title: '第三十七章 胰岛素和口服降糖药（1）', bv: 'BV1bP4y1P76R', p: 81, up: '忠保研道', dur: '' },
  { id: 'v175', section: 'pharm-c7-s3', title: '第三十七章 胰岛素和口服降糖药（2）', bv: 'BV1bP4y1P76R', p: 82, up: '忠保研道', dur: '' },

  /* ---------- 第8章 化学治疗药物 ---------- */
  { id: 'v176', section: 'pharm-c8-s1', title: '第三十九章 抗菌药物概论（1）', bv: 'BV1bP4y1P76R', p: 83, up: '忠保研道', dur: '' },
  { id: 'v177', section: 'pharm-c8-s1', title: '第三十九章 抗菌药物概论（2）', bv: 'BV1bP4y1P76R', p: 84, up: '忠保研道', dur: '' },
  { id: 'v178', section: 'pharm-c8-s1', title: '第三十九章 抗菌药物概论（3）', bv: 'BV1bP4y1P76R', p: 85, up: '忠保研道', dur: '' },
  { id: 'v179', section: 'pharm-c8-s1', title: '第三十九章 抗菌药物概论（4）', bv: 'BV1bP4y1P76R', p: 86, up: '忠保研道', dur: '' },
  { id: 'v180', section: 'pharm-c8-s2', title: '第四十章 β-内酰胺类抗生素（1）', bv: 'BV1bP4y1P76R', p: 87, up: '忠保研道', dur: '' },
  { id: 'v181', section: 'pharm-c8-s2', title: '第四十章 β-内酰胺类抗生素（2）', bv: 'BV1bP4y1P76R', p: 88, up: '忠保研道', dur: '' },
  { id: 'v182', section: 'pharm-c8-s2', title: '第四十章 β-内酰胺类抗生素（3）', bv: 'BV1bP4y1P76R', p: 89, up: '忠保研道', dur: '' },
  { id: 'v183', section: 'pharm-c8-s3', title: '第四十一章 大环内酯类、林可霉素类及多肽类抗生素', bv: 'BV1bP4y1P76R', p: 90, up: '忠保研道', dur: '' },
  { id: 'v184', section: 'pharm-c8-s3', title: '第四十二章 氨基糖苷类抗生素（1）', bv: 'BV1bP4y1P76R', p: 91, up: '忠保研道', dur: '' },
  { id: 'v185', section: 'pharm-c8-s3', title: '第四十二章 氨基糖苷类抗生素（2）', bv: 'BV1bP4y1P76R', p: 92, up: '忠保研道', dur: '' },
  { id: 'v186', section: 'pharm-c8-s3', title: '第四十三章 四环素类及氯霉素类', bv: 'BV1bP4y1P76R', p: 93, up: '忠保研道', dur: '' },
  { id: 'v187', section: 'pharm-c8-s3', title: '第四十四章 人工合成抗菌药（1）', bv: 'BV1bP4y1P76R', p: 94, up: '忠保研道', dur: '' },
  { id: 'v188', section: 'pharm-c8-s3', title: '第四十四章 人工合成抗菌药（2）', bv: 'BV1bP4y1P76R', p: 95, up: '忠保研道', dur: '' },
  { id: 'v189', section: 'pharm-c8-s4', title: '第四十五章 抗真菌药和抗病毒药（1）', bv: 'BV1bP4y1P76R', p: 96, up: '忠保研道', dur: '' },
  { id: 'v190', section: 'pharm-c8-s4', title: '第四十五章 抗真菌药和抗病毒药（2）', bv: 'BV1bP4y1P76R', p: 97, up: '忠保研道', dur: '' },
  { id: 'v191', section: 'pharm-c8-s5', title: '第四十六章 抗结核病药及抗麻风病药（1）', bv: 'BV1bP4y1P76R', p: 98, up: '忠保研道', dur: '' },
  { id: 'v192', section: 'pharm-c8-s5', title: '第四十六章 抗结核病药及抗麻风病药（2）', bv: 'BV1bP4y1P76R', p: 99, up: '忠保研道', dur: '' },
  { id: 'v193', section: 'pharm-c8-s5', title: '第四十八章 抗恶性肿瘤药（1）', bv: 'BV1bP4y1P76R', p: 100, up: '忠保研道', dur: '' },
  { id: 'v194', section: 'pharm-c8-s5', title: '第四十八章 抗恶性肿瘤药（2）', bv: 'BV1bP4y1P76R', p: 101, up: '忠保研道', dur: '' },
  { id: 'v195', section: 'pharm-c8-s5', title: '第四十八章 抗恶性肿瘤药（3）', bv: 'BV1bP4y1P76R', p: 102, up: '忠保研道', dur: '' },

  /* ---------- 补充：麻醉药 / 子宫兴奋药 / 自体活性物质（大纲未强要求，供拓展） ---------- */
  { id: 'v196', section: 'pharm-c3-s1', title: '第十三章 全身麻醉药（1）', bv: 'BV1bP4y1P76R', p: 26, up: '忠保研道', dur: '' },
  { id: 'v197', section: 'pharm-c3-s1', title: '第十三章 全身麻醉药（2）', bv: 'BV1bP4y1P76R', p: 27, up: '忠保研道', dur: '' },
  { id: 'v198', section: 'pharm-c3-s1', title: '第十四章 局部麻醉药（1）', bv: 'BV1bP4y1P76R', p: 29, up: '忠保研道', dur: '' }
];
