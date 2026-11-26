import { Subject } from '../types';

/**
 * Keyword mapping for popular Rajasthan competitive examinations
 */
const EXAM_KEYWORD_RULES: Record<string, string[]> = {
  reet: [
    'शिक्षण विधियां',
    'बाल विकास',
    'शिक्षा शास्त्र',
    'pedagogy',
    'मनोविज्ञान',
    'पर्यावरण',
    'हिंदी व्याकरण',
    'संस्कृत',
    'गणित शिक्षण',
  ],
  ras: [
    'इतिहास',
    'कला एवं संस्कृति',
    'भूगोल',
    'अर्थव्यवस्था',
    'राजनीति विज्ञान',
    'प्रशासनिक',
    'समसामयिकी',
    'current affairs',
    'सामान्य विज्ञान',
  ],
  cet: [
    'कंप्यूटर',
    'तार्किक क्षमता',
    'रीजनिंग',
    'reasoning',
    'सामान्य विज्ञान',
    'गणित',
    'राजस्थान भूगोल',
    'हिंदी',
    'अंग्रेजी',
  ],
  police: [
    'महिला एवं बाल अपराध',
    'क्राइम',
    'कंप्यूटर',
    'राजस्थान पुलिस',
    'कानूनी अधिकार',
    'भूगोल',
    'रीजनिंग',
  ],
  patwar: [
    'पटवार',
    'भू-अभिलेख',
    'कंप्यूटर',
    'सामान्य विज्ञान',
    'राजस्व',
    'गणित',
    'राजस्थान इतिहास',
  ],
};

/**
 * Checks if a given subject is high-priority/recommended for the student's target exam
 */
export function isSubjectRecommendedForExam(subjectName: string, targetExam?: string): boolean {
  if (!targetExam || !subjectName) return false;

  const targetLower = targetExam.toLowerCase();
  const subLower = subjectName.toLowerCase();

  for (const [examKey, keywords] of Object.entries(EXAM_KEYWORD_RULES)) {
    if (targetLower.includes(examKey)) {
      const hasMatch = keywords.some((kw) => subLower.includes(kw.toLowerCase()));
      if (hasMatch) return true;
    }
  }

  // Broad state exam match for Rajasthan Core subjects (History, Geography, Economy, Polity)
  if (
    (targetLower.includes('rpsc') || targetLower.includes('rajasthan')) &&
    (subLower.includes('राजस्थान') || subLower.includes('इतिहास') || subLower.includes('भूगोल'))
  ) {
    return true;
  }

  return false;
}

/**
 * Sorts curriculum subjects placing target-exam recommended subjects first
 */
export function sortSubjectsByTargetExam(subjects: Subject[], targetExam?: string): Subject[] {
  if (!targetExam || !subjects || subjects.length === 0) return subjects;

  return [...subjects].sort((a, b) => {
    const aRec = isSubjectRecommendedForExam(a.name || a.title || '', targetExam) ? 1 : 0;
    const bRec = isSubjectRecommendedForExam(b.name || b.title || '', targetExam) ? 1 : 0;
    return bRec - aRec;
  });
}
