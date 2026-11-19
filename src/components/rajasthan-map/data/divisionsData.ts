import { DivisionId, DivisionInfo } from "../types";

export const RAJASTHAN_DIVISIONS: Record<DivisionId, DivisionInfo> = {
  jaipur: {
    id: "jaipur",
    nameHindi: "जयपुर संभाग",
    nameEnglish: "Jaipur Division",
    headquarter: "जयपुर",
    color: "#E11D48", // Rose Red
    textColor: "text-rose-700 dark:text-rose-300",
    borderColor: "border-rose-400 dark:border-rose-600",
    bgLight: "bg-rose-50 dark:bg-rose-950/30",
    districtIds: ["jaipur", "alwar", "dausa", "jhunjhunu", "sikar", "kotputli_behror", "khairthal_tijara"],
    description: "7 ज़िले: राजधानी क्षेत्र, शेखावाटी (सीकर-झुंझुनूं), बैराठ सभ्यता व आमेर विरासत",
    isNew: false,
  },
  jodhpur: {
    id: "jodhpur",
    nameHindi: "जोधपुर संभाग",
    nameEnglish: "Jodhpur Division",
    headquarter: "जोधपुर",
    color: "#D97706", // Amber Gold
    textColor: "text-amber-700 dark:text-amber-300",
    borderColor: "border-amber-400 dark:border-amber-600",
    bgLight: "bg-amber-50 dark:bg-amber-950/30",
    districtIds: ["jodhpur", "barmer", "jaisalmer", "jalore", "sirohi", "pali", "balotra", "phalodi"],
    description: "8 ज़िले: मरुस्थलीय संभाग, क्षेत्रफल में सबसे बड़ा, थार मरुस्थल, खनिज तेल, गोडवाड़ व आबू",
    isNew: false,
  },
  ajmer: {
    id: "ajmer",
    nameHindi: "अजमेर संभाग",
    nameEnglish: "Ajmer Division",
    headquarter: "अजमेर",
    color: "#800020", // Royal Maroon
    textColor: "text-red-800 dark:text-red-300",
    borderColor: "border-red-400 dark:border-red-700",
    bgLight: "bg-red-50 dark:bg-red-950/30",
    districtIds: ["ajmer", "bhilwara", "nagaur", "tonk", "beawar", "didwana_kuchaman"],
    description: "6 ज़िले: राजस्थान का हृदय स्थल, ख्वाजा दरगाह, पुष्कर तीर्थ, वस्त्र नगरी भीलवाड़ा व संगमरमर",
    isNew: false,
  },
  udaipur: {
    id: "udaipur",
    nameHindi: "उदयपुर संभाग",
    nameEnglish: "Udaipur Division",
    headquarter: "उदयपुर",
    color: "#059669", // Emerald Green
    textColor: "text-emerald-700 dark:text-emerald-300",
    borderColor: "border-emerald-400 dark:border-emerald-600",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/30",
    districtIds: ["udaipur", "chittorgarh", "rajsamand", "dungarpur", "banswara", "pratapgarh", "salumbar"],
    description: "7 ज़िले: मेवाड़ व वागड़ गौरव, झीलों की नगरी, बेणेश्वर धाम, अरावली वन संपदा व सीसा-जस्ता",
    isNew: false,
  },
  bikaner: {
    id: "bikaner",
    nameHindi: "बीकानेर संभाग",
    nameEnglish: "Bikaner Division",
    headquarter: "बीकानेर",
    color: "#CA8A04", // Sand Yellow
    textColor: "text-yellow-700 dark:text-yellow-300",
    borderColor: "border-yellow-400 dark:border-yellow-600",
    bgLight: "bg-yellow-50 dark:bg-yellow-950/30",
    districtIds: ["bikaner", "churu", "sri_ganganagar", "hanumangarh"],
    description: "4 ज़िले: उत्तरी नहरी सिंचित क्षेत्र, राजस्थान का अन्न का कटोरा, करणी माता व घग्घर नदी",
    isNew: false,
  },
  kota: {
    id: "kota",
    nameHindi: "कोटा संभाग",
    nameEnglish: "Kota Division",
    headquarter: "कोटा",
    color: "#2563EB", // Royal Blue
    textColor: "text-blue-700 dark:text-blue-300",
    borderColor: "border-blue-400 dark:border-blue-600",
    bgLight: "bg-blue-50 dark:bg-blue-950/30",
    districtIds: ["kota", "bundi", "baran", "jhalawar"],
    description: "4 ज़िले: हाड़ौती अंचल, सर्वाधिक वर्षा व नदियों वाला संभाग, चंबल नदी व मुकंदरा हिल्स",
    isNew: false,
  },
  bharatpur: {
    id: "bharatpur",
    nameHindi: "भरतपुर संभाग",
    nameEnglish: "Bharatpur Division",
    headquarter: "भरतपुर",
    color: "#7C3AED", // Royal Violet
    textColor: "text-violet-700 dark:text-violet-300",
    borderColor: "border-violet-400 dark:border-violet-600",
    bgLight: "bg-violet-50 dark:bg-violet-950/30",
    districtIds: ["bharatpur", "dholpur", "karauli", "sawai_madhopur", "deeg"],
    description: "5 ज़िले: ब्रज संस्कृति, रणथंभौर राष्ट्रीय उद्यान, केवलादेव घना पक्षी विहार व डीग के जलमहल",
    isNew: false,
  },
};

export const DIVISIONS_LIST = Object.values(RAJASTHAN_DIVISIONS);
export const RAJASTHAN_DIVISIONS_LIST = DIVISIONS_LIST;
