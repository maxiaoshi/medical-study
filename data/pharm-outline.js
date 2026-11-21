/* =====================================================================
 * 医学学习平台 · 数据层 A：课程骨架 / 大纲标记 / 网课
 * ---------------------------------------------------------------------
 * 章节划分依据：
 *   诊断学 —— 《诊断学》第10版 + 南京医科大学《诊断学（A）》学习大纲（2026版）
 *   药理学 —— 《药理学》第10版 + 南京医科大学《药理学（B）》学习大纲（2025版）
 *
 * 说明：
 *   1) 本文件只放“章节骨架 + 大纲掌握程度 + 学时”，正文在 content.js。
 *   2) 学时取自大纲“课程学时安排”，用于考前冲刺模拟卷按分值比例出题。
 *   3) 药理学章节树挂“网课视频”入口（见 videos.js）；诊断学没有网课，不设入口。
 * ===================================================================== */

/* ---- 大纲掌握程度说明 ----
   掌握：必考，能复述+应用   熟悉：常考，能解释   了解：识记
   hours：大纲课堂教学学时，用于按比例出卷
-------------------------------------------------------------- */

window.DB = {
  version: '1.0',
  updated: '2026-11-21',
  subjects: [
    /* ================= 诊断学 ================= */
    {
      id: 'diag',
      name: '诊断学',
      textbook: '《诊断学》第10版（万学红、卢雪峰主编，人卫社 2024）',
      outline: '南京医科大学《诊断学（A）》学习大纲 2026版',
      chapters: [
        {
          id: 'diag-c1', no: '第1章', name: '绪论·问诊·临床思维', hours: 2,
          sections: [
            { id: 'diag-c1-s1', name: '诊断学的内容与学习方法', level: '熟悉', minutes: 15 },
            { id: 'diag-c1-s2', name: '问诊的内容与技巧', level: '掌握', minutes: 25 },
            { id: 'diag-c1-s3', name: '临床思维与诊断推理', level: '掌握', minutes: 20 }
          ]
        },
        {
          id: 'diag-c2', no: '第2章', name: '症状学（常见症状）', hours: 12,
          sections: [
            { id: 'diag-c2-s1', name: '发热', level: '掌握', minutes: 25 },
            { id: 'diag-c2-s2', name: '胸痛、心悸', level: '熟悉', minutes: 20 },
            { id: 'diag-c2-s3', name: '咳嗽咳痰、咯血', level: '掌握', minutes: 22 },
            { id: 'diag-c2-s4', name: '呼吸困难、发绀', level: '掌握', minutes: 25 },
            { id: 'diag-c2-s5', name: '水肿', level: '熟悉', minutes: 18 },
            { id: 'diag-c2-s6', name: '呕血、便血', level: '掌握', minutes: 20 },
            { id: 'diag-c2-s7', name: '黄疸', level: '掌握', minutes: 25 },
            { id: 'diag-c2-s8', name: '腹痛、头痛、意识障碍', level: '熟悉', minutes: 22 }
          ]
        },
        {
          id: 'diag-c3', no: '第3章', name: '体格检查（基本检查法/一般/头颈）', hours: 2,
          sections: [
            { id: 'diag-c3-s1', name: '基本检查方法：视触叩听嗅', level: '掌握', minutes: 25 },
            { id: 'diag-c3-s2', name: '一般检查与生命体征', level: '掌握', minutes: 22 },
            { id: 'diag-c3-s3', name: '头颈部检查', level: '掌握', minutes: 25 }
          ]
        },
        {
          id: 'diag-c4', no: '第4章', name: '胸部与肺脏检查', hours: 3,
          sections: [
            { id: 'diag-c4-s1', name: '胸廓、胸壁与体表标志', level: '掌握', minutes: 22 },
            { id: 'diag-c4-s2', name: '肺脏视触叩诊', level: '掌握', minutes: 26 },
            { id: 'diag-c4-s3', name: '肺脏听诊与常见疾病体征', level: '掌握', minutes: 28 }
          ]
        },
        {
          id: 'diag-c5', no: '第5章', name: '心脏与血管检查', hours: 8,
          sections: [
            { id: 'diag-c5-s1', name: '心脏视诊、触诊、叩诊', level: '掌握', minutes: 25 },
            { id: 'diag-c5-s2', name: '心脏听诊：瓣膜听诊区、心音', level: '掌握', minutes: 30 },
            { id: 'diag-c5-s3', name: '额外心音与心脏杂音', level: '掌握', minutes: 32 },
            { id: 'diag-c5-s4', name: '血管检查与周围血管征', level: '熟悉', minutes: 20 }
          ]
        },
        {
          id: 'diag-c6', no: '第6章', name: '腹部检查', hours: 3,
          sections: [
            { id: 'diag-c6-s1', name: '腹部视诊与触诊', level: '掌握', minutes: 25 },
            { id: 'diag-c6-s2', name: '腹部叩诊与移动性浊音', level: '掌握', minutes: 26 },
            { id: 'diag-c6-s3', name: '腹部听诊与腹部常见疾病体征', level: '掌握', minutes: 24 }
          ]
        },
        {
          id: 'diag-c7', no: '第7章', name: '脊柱四肢、神经系统检查', hours: 2,
          sections: [
            { id: 'diag-c7-s1', name: '脊柱与四肢关节检查', level: '熟悉', minutes: 18 },
            { id: 'diag-c7-s2', name: '神经系统检查：生理反射与病理反射', level: '掌握', minutes: 26 },
            { id: 'diag-c7-s3', name: '脑膜刺激征与脑神经检查', level: '熟悉', minutes: 20 }
          ]
        },
        {
          id: 'diag-c8', no: '第8章', name: '实验诊断（血、尿、粪、生化）', hours: 5,
          sections: [
            { id: 'diag-c8-s1', name: '临床血液检测与骨髓细胞学', level: '掌握', minutes: 26 },
            { id: 'diag-c8-s2', name: '尿液与肾功能检测', level: '掌握', minutes: 24 },
            { id: 'diag-c8-s3', name: '肝功能与粪便检测', level: '掌握', minutes: 24 },
            { id: 'diag-c8-s4', name: '浆膜腔积液、脑脊液与血栓止血检测', level: '掌握', minutes: 28 },
            { id: 'diag-c8-s5', name: '糖脂代谢、电解质、血气分析与标志物', level: '熟悉', minutes: 24 }
          ]
        },
        {
          id: 'diag-c9', no: '第9章', name: '器械检查：心电图', hours: 7,
          sections: [
            { id: 'diag-c9-s1', name: '心电图基本知识：导联与正常波形', level: '掌握', minutes: 26 },
            { id: 'diag-c9-s2', name: '心房心室肥大与心律失常心电图', level: '掌握', minutes: 30 },
            { id: 'diag-c9-s3', name: '心肌梗死与电解质紊乱心电图', level: '掌握', minutes: 26 }
          ]
        },
        {
          id: 'diag-c10', no: '第10章', name: '病历书写与诊疗思维', hours: 3,
          sections: [
            { id: 'diag-c10-s1', name: '病历书写规范与内容', level: '掌握', minutes: 22 },
            { id: 'diag-c10-s2', name: '诊疗思维与病例分析', level: '熟悉', minutes: 20 }
          ]
        }
      ]
    },

    /* ================= 药理学 ================= */
    {
      id: 'pharm',
      name: '药理学',
      textbook: '《药理学》第10版（杨宝峰主编，人卫社 2024）',
      outline: '南京医科大学《药理学（B）》学习大纲 2025版',
      chapters: [
        {
          id: 'pharm-c1', no: '第1章', name: '总论：绪言·药动学·药效学', hours: 6,
          sections: [
            { id: 'pharm-c1-s1', name: '绪言与药理学基本概念', level: '熟悉', minutes: 14 },
            { id: 'pharm-c1-s2', name: '药物代谢动力学（一）：跨膜转运与体内过程', level: '掌握', minutes: 26 },
            { id: 'pharm-c1-s3', name: '药物代谢动力学（二）：动力学参数与给药方案', level: '掌握', minutes: 26 },
            { id: 'pharm-c1-s4', name: '药物效应动力学（一）：作用与不良反应', level: '掌握', minutes: 22 },
            { id: 'pharm-c1-s5', name: '药物效应动力学（二）：量效关系与受体理论', level: '掌握', minutes: 26 }
          ]
        },
        {
          id: 'pharm-c2', no: '第2章', name: '传出神经系统药', hours: 8,
          sections: [
            { id: 'pharm-c2-s1', name: '传出神经系统药理概论', level: '掌握', minutes: 22 },
            { id: 'pharm-c2-s2', name: '胆碱受体激动药：毛果芸香碱', level: '掌握', minutes: 20 },
            { id: 'pharm-c2-s3', name: '抗胆碱酯酶药与有机磷中毒解救', level: '掌握', minutes: 26 },
            { id: 'pharm-c2-s4', name: 'M胆碱受体阻断药：阿托品及同类药', level: '掌握', minutes: 26 },
            { id: 'pharm-c2-s5', name: '肾上腺素受体激动药', level: '掌握', minutes: 28 },
            { id: 'pharm-c2-s6', name: '肾上腺素受体阻断药', level: '掌握', minutes: 26 }
          ]
        },
        {
          id: 'pharm-c3', no: '第3章', name: '中枢神经系统药', hours: 8,
          sections: [
            { id: 'pharm-c3-s1', name: '镇静催眠药：苯二氮䓬类与巴比妥类', level: '掌握', minutes: 24 },
            { id: 'pharm-c3-s2', name: '抗癫痫药与抗惊厥药', level: '掌握', minutes: 26 },
            { id: 'pharm-c3-s3', name: '治疗中枢神经系统退行性疾病药', level: '掌握', minutes: 24 },
            { id: 'pharm-c3-s4', name: '抗精神失常药：氯丙嗪等', level: '掌握', minutes: 28 }
          ]
        },
        {
          id: 'pharm-c4', no: '第4章', name: '镇痛药与解热镇痛抗炎药', hours: 4,
          sections: [
            { id: 'pharm-c4-s1', name: '镇痛药：吗啡与人工合成品', level: '掌握', minutes: 26 },
            { id: 'pharm-c4-s2', name: '解热镇痛抗炎药：阿司匹林等', level: '掌握', minutes: 26 }
          ]
        },
        {
          id: 'pharm-c5', no: '第5章', name: '心血管系统药', hours: 12,
          sections: [
            { id: 'pharm-c5-s1', name: '离子通道与钙通道阻滞药', level: '掌握', minutes: 24 },
            { id: 'pharm-c5-s2', name: '抗心律失常药', level: '掌握', minutes: 28 },
            { id: 'pharm-c5-s3', name: '抗高血压药', level: '掌握', minutes: 28 },
            { id: 'pharm-c5-s4', name: '治疗心力衰竭的药物', level: '掌握', minutes: 28 },
            { id: 'pharm-c5-s5', name: '抗心绞痛药与调血脂药', level: '掌握', minutes: 26 },
            { id: 'pharm-c5-s6', name: '作用于血液及造血器官的药物', level: '掌握', minutes: 26 }
          ]
        },
        {
          id: 'pharm-c6', no: '第6章', name: '内脏系统药', hours: 6,
          sections: [
            { id: 'pharm-c6-s1', name: '平喘药与呼吸系统药', level: '掌握', minutes: 24 },
            { id: 'pharm-c6-s2', name: '消化系统药与抗消化性溃疡药', level: '熟悉', minutes: 20 },
            { id: 'pharm-c6-s3', name: '利尿药与脱水药', level: '掌握', minutes: 24 }
          ]
        },
        {
          id: 'pharm-c7', no: '第7章', name: '内分泌系统药', hours: 5,
          sections: [
            { id: 'pharm-c7-s1', name: '肾上腺皮质激素类药物', level: '掌握', minutes: 28 },
            { id: 'pharm-c7-s2', name: '甲状腺激素及抗甲状腺药', level: '掌握', minutes: 22 },
            { id: 'pharm-c7-s3', name: '治疗糖尿病的药物', level: '掌握', minutes: 28 }
          ]
        },
        {
          id: 'pharm-c8', no: '第8章', name: '化学治疗药物', hours: 7,
          sections: [
            { id: 'pharm-c8-s1', name: '抗菌药物概论与耐药机制', level: '掌握', minutes: 24 },
            { id: 'pharm-c8-s2', name: 'β-内酰胺类抗生素与各代头孢', level: '掌握', minutes: 30 },
            { id: 'pharm-c8-s3', name: '大环内酯、氨基糖苷、四环素与喹诺酮', level: '掌握', minutes: 28 },
            { id: 'pharm-c8-s4', name: '抗真菌药与抗病毒药', level: '掌握', minutes: 24 },
            { id: 'pharm-c8-s5', name: '抗恶性肿瘤药与抗结核药', level: '掌握', minutes: 26 }
          ]
        }
      ]
    }
  ]
};
