export interface DistrictSvgNode {
  id: string;
  nameHindi: string;
  divisionId: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  shape?: "ellipse" | "polygon" | "round_rect";
  labelOffsetX?: number;
  labelOffsetY?: number;
}

export const DISTRICT_SVG_NODES: Record<string, DistrictSvgNode> = {
  // Northern Region
  sri_ganganagar: { id: "sri_ganganagar", nameHindi: "श्रीगंगानगर", divisionId: "bikaner", cx: 335, cy: 95, rx: 42, ry: 32 },
  hanumangarh: { id: "hanumangarh", nameHindi: "हनुमानगढ़", divisionId: "bikaner", cx: 420, cy: 110, rx: 44, ry: 36 },
  anupgarh: { id: "anupgarh", nameHindi: "अनूपगढ़", divisionId: "bikaner", cx: 270, cy: 175, rx: 38, ry: 32 },
  bikaner: { id: "bikaner", nameHindi: "बीकानेर", divisionId: "bikaner", cx: 335, cy: 250, rx: 55, ry: 45 },

  // Shekhawati & North East
  churu: { id: "churu", nameHindi: "चूरू", divisionId: "sikar", cx: 450, cy: 210, rx: 45, ry: 38 },
  jhunjhunu: { id: "jhunjhunu", nameHindi: "झुंझुनूं", divisionId: "sikar", cx: 520, cy: 220, rx: 34, ry: 30 },
  neem_ka_thana: { id: "neem_ka_thana", nameHindi: "नीम का थाना", divisionId: "sikar", cx: 560, cy: 255, rx: 35, ry: 26 },
  sikar: { id: "sikar", nameHindi: "सीकर", divisionId: "sikar", cx: 495, cy: 295, rx: 38, ry: 32 },

  // Matsya & Capital Region
  khairthal_tijara: { id: "khairthal_tijara", nameHindi: "खैरथल-तिजारा", divisionId: "jaipur", cx: 655, cy: 245, rx: 34, ry: 25 },
  kotputli_behror: { id: "kotputli_behror", nameHindi: "कोटपूतली-बहरोड़", divisionId: "jaipur", cx: 605, cy: 275, rx: 36, ry: 26 },
  alwar: { id: "alwar", nameHindi: "अलवर", divisionId: "jaipur", cx: 660, cy: 305, rx: 36, ry: 32 },
  deeg: { id: "deeg", nameHindi: "डीग", divisionId: "bharatpur", cx: 705, cy: 285, rx: 32, ry: 26 },
  bharatpur: { id: "bharatpur", nameHindi: "भरतपुर", divisionId: "bharatpur", cx: 725, cy: 340, rx: 35, ry: 28 },
  dholpur: { id: "dholpur", nameHindi: "धौलपुर", divisionId: "bharatpur", cx: 765, cy: 375, rx: 34, ry: 28 },
  dausa: { id: "dausa", nameHindi: "दौसा", divisionId: "jaipur", cx: 635, cy: 365, rx: 35, ry: 28 },
  jaipur_rural: { id: "jaipur_rural", nameHindi: "जयपुर ग्रामीण", divisionId: "jaipur", cx: 570, cy: 335, rx: 42, ry: 32 },
  jaipur: { id: "jaipur", nameHindi: "जयपुर", divisionId: "jaipur", cx: 575, cy: 375, rx: 28, ry: 24 },
  dudu: { id: "dudu", nameHindi: "दूदू", divisionId: "jaipur", cx: 525, cy: 395, rx: 26, ry: 22 },

  // Western Thar Desert
  jaisalmer: { id: "jaisalmer", nameHindi: "जैसलमेर", divisionId: "jodhpur", cx: 115, cy: 395, rx: 75, ry: 65 },
  phalodi: { id: "phalodi", nameHindi: "फलौदी", divisionId: "jodhpur", cx: 265, cy: 335, rx: 46, ry: 36 },
  jodhpur_rural: { id: "jodhpur_rural", nameHindi: "जोधपुर ग्रामीण", divisionId: "jodhpur", cx: 310, cy: 405, rx: 46, ry: 36 },
  jodhpur: { id: "jodhpur", nameHindi: "जोधपुर", divisionId: "jodhpur", cx: 335, cy: 440, rx: 28, ry: 24 },
  balotra: { id: "balotra", nameHindi: "बालोतरा", divisionId: "jodhpur", cx: 235, cy: 490, rx: 40, ry: 32 },
  barmer: { id: "barmer", nameHindi: "बाड़मेर", divisionId: "jodhpur", cx: 175, cy: 525, rx: 55, ry: 48 },

  // Central Region
  nagaur: { id: "nagaur", nameHindi: "नागौर", divisionId: "ajmer", cx: 400, cy: 365, rx: 46, ry: 38 },
  didwana_kuchaman: { id: "didwana_kuchaman", nameHindi: "डीडवाना-कुचामन", divisionId: "ajmer", cx: 460, cy: 350, rx: 40, ry: 30 },
  ajmer: { id: "ajmer", nameHindi: "अजमेर", divisionId: "ajmer", cx: 475, cy: 435, rx: 36, ry: 30 },
  beawar: { id: "beawar", nameHindi: "ब्यावर", divisionId: "ajmer", cx: 430, cy: 485, rx: 34, ry: 28 },
  kekri: { id: "kekri", nameHindi: "केकड़ी", divisionId: "ajmer", cx: 515, cy: 480, rx: 32, ry: 26 },
  tonk: { id: "tonk", nameHindi: "टोंक", divisionId: "ajmer", cx: 565, cy: 450, rx: 38, ry: 30 },
  shahpura: { id: "shahpura", nameHindi: "शाहपुरा", divisionId: "ajmer", cx: 490, cy: 525, rx: 32, ry: 26 },

  // South-West & Godwar
  pali: { id: "pali", nameHindi: "पाली", divisionId: "pali", cx: 370, cy: 500, rx: 40, ry: 34 },
  jalore: { id: "jalore", nameHindi: "जालौर", divisionId: "pali", cx: 285, cy: 555, rx: 38, ry: 32 },
  sanchor: { id: "sanchor", nameHindi: "सांचौर", divisionId: "pali", cx: 245, cy: 615, rx: 36, ry: 30 },
  sirohi: { id: "sirohi", nameHindi: "सिरोही", divisionId: "pali", cx: 315, cy: 635, rx: 34, ry: 28 },

  // Mewar & Vagad (Southern)
  rajsamand: { id: "rajsamand", nameHindi: "राजसमंद", divisionId: "udaipur", cx: 410, cy: 540, rx: 34, ry: 28 },
  bhilwara: { id: "bhilwara", nameHindi: "भीलवाड़ा", divisionId: "udaipur", cx: 465, cy: 555, rx: 38, ry: 30 },
  chittorgarh: { id: "chittorgarh", nameHindi: "चित्तौड़गढ़", divisionId: "udaipur", cx: 485, cy: 615, rx: 40, ry: 32 },
  udaipur: { id: "udaipur", nameHindi: "उदयपुर", divisionId: "udaipur", cx: 390, cy: 620, rx: 42, ry: 34 },
  salumbar: { id: "salumbar", nameHindi: "सलूंबर", divisionId: "udaipur", cx: 420, cy: 675, rx: 32, ry: 26 },
  dungarpur: { id: "dungarpur", nameHindi: "डूंगरपुर", divisionId: "banswara", cx: 370, cy: 740, rx: 35, ry: 28 },
  pratapgarh: { id: "pratapgarh", nameHindi: "प्रतापगढ़", divisionId: "banswara", cx: 460, cy: 720, rx: 36, ry: 30 },
  banswara: { id: "banswara", nameHindi: "बांसवाड़ा", divisionId: "banswara", cx: 415, cy: 785, rx: 40, ry: 32 },

  // South-East (Dang & Hadoti)
  gangapur_city: { id: "gangapur_city", nameHindi: "गंगापुर सिटी", divisionId: "bharatpur", cx: 655, cy: 405, rx: 32, ry: 26 },
  karauli: { id: "karauli", nameHindi: "करौली", divisionId: "bharatpur", cx: 695, cy: 425, rx: 36, ry: 28 },
  sawai_madhopur: { id: "sawai_madhopur", nameHindi: "सवाई माधोपुर", divisionId: "bharatpur", cx: 645, cy: 455, rx: 38, ry: 30 },
  bundi: { id: "bundi", nameHindi: "बूंदी", divisionId: "kota", cx: 535, cy: 555, rx: 36, ry: 28 },
  kota: { id: "kota", nameHindi: "कोटा", divisionId: "kota", cx: 575, cy: 605, rx: 36, ry: 30 },
  baran: { id: "baran", nameHindi: "बारां", divisionId: "kota", cx: 635, cy: 585, rx: 40, ry: 32 },
  jhalawar: { id: "jhalawar", nameHindi: "झालावाड़", divisionId: "kota", cx: 605, cy: 680, rx: 40, ry: 34 },
};
