export type DivisionId =
  | "jaipur"
  | "jodhpur"
  | "ajmer"
  | "udaipur"
  | "bikaner"
  | "kota"
  | "bharatpur"
  | "sikar"
  | "pali"
  | "banswara";

export interface DivisionInfo {
  id: DivisionId;
  nameHindi: string;
  nameEnglish: string;
  headquarter: string;
  color: string;
  textColor: string;
  borderColor: string;
  bgLight: string;
  districtIds: string[];
  description: string;
  isNew?: boolean;
}

export interface DistrictGeography {
  terrain: string;
  rivers: string[];
  lakes: string[];
  minerals: string[];
  soil?: string;
  wildlifeOrForest?: string;
}

export interface DistrictCulture {
  forts?: string[];
  temples?: string[];
  fairs?: string[];
  folkGodsAndGoddesses?: string[];
  artAndCraft?: string[];
  personalities?: string[];
  wildlifeOrForest?: string;
}

export interface DistrictPYQ {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  examTag: string; // e.g. "REET 2023", "RAS Pre 2021"
}

export interface DistrictInfo {
  id: string;
  nameHindi: string;
  nameEnglish: string;
  divisionId: DivisionId;
  headquarter: string;
  formationInfo: string; // e.g. "7 अगस्त 2023 (जोधपुर से पुनर्गठित)"
  parentDistricts: string[];
  tagline: string;
  isNewDistrict: boolean;
  newChangesIn2023: string[]; // नए ज़िले में क्या-क्या आया (परीक्षा उपयोगी)
  geography: DistrictGeography;
  culture: DistrictCulture;
  examHighYieldFacts: string[];
  pyqQuestions: DistrictPYQ[];
  svgCoordinates: {
    cx: number;
    cy: number;
    labelX?: number;
    labelY?: number;
    pathD?: string;
  };
}

export type QuizCategory =
  | "district_locate"     // ज़िला नक्शे पर ढूँढें
  | "monument_fort"       // दुर्ग व स्मारक
  | "geography_nature"    // नदियाँ, झीलें व खनिज
  | "new_formation"       // 2023 पुनर्गठन व नए बदलाव
  | "art_culture";        // कला, संस्कृति व मेले

export interface MapQuizQuestion {
  id: string;
  prompt: string;
  targetDistrictId: string;
  targetDistrictName: string;
  category: QuizCategory;
  hint: string;
  difficulty: "easy" | "medium" | "hard";
  explanation: string;
}

export interface MapQuizSessionResult {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  score: number;
  timeSpentSeconds: number;
  accuracyPercentage: number;
  weakDistricts: string[];
  strongDistricts: string[];
}
