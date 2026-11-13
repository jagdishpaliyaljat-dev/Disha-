export interface Achievement {
  id: string;
  title: string;
  hindiTitle: string;
  description: string;
  icon: string;
  condition: (stats: { attempted: number; accuracy: number; streak: number }) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'starter',
    title: 'First Step',
    hindiTitle: 'पहला कदम',
    description: 'Solve your first 10 questions',
    icon: '🎯',
    condition: (s) => s.attempted >= 10
  },
  {
    id: 'centurion',
    title: 'Century Maker',
    hindiTitle: 'शतकवीर',
    description: 'Solve 100 questions',
    icon: '💯',
    condition: (s) => s.attempted >= 100
  },
  {
    id: 'streak_3',
    title: 'Consistency',
    hindiTitle: 'निरंतरता',
    description: 'Maintain a 3-day streak',
    icon: '🔥',
    condition: (s) => s.streak >= 3
  },
  {
    id: 'accuracy_pro',
    title: 'Precision Master',
    hindiTitle: 'सटीकता मास्टर',
    description: 'Achieve 80%+ accuracy (min 50 Qs)',
    icon: '⭐',
    condition: (s) => s.attempted >= 50 && s.accuracy >= 80
  }
];

export const MOTIVATIONAL_QUOTES = [
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "कठिन परिश्रम का कोई विकल्प नहीं है।", author: "Thomas Edison" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "लक्ष्य को पाने के लिए केवल कोशिश नहीं, ज़िद चाहिए।", author: "Unknown" },
  { text: "Don't stop when you're tired. Stop when you're done.", author: "David Goggins" },
  { text: "विजेता वे नहीं होते जो कभी असफल नहीं होते, बल्कि वे होते हैं जो कभी हार नहीं मानते।", author: "Unknown" }
];

/**
 * Gets a consistent "Question of the Day" based on the current date.
 */
export function getQuestionOfTheDayId(totalQuestions: number): number {
  if (totalQuestions === 0) return 0;
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  // Simple deterministic pseudo-random index
  return seed % totalQuestions;
}

export const DAILY_GOALS = [
  { id: 'practice_10', title: 'Solve 10 Questions', target: 10, type: 'count' },
  { id: 'accuracy_90', title: 'Get 90% Accuracy', target: 90, type: 'accuracy' },
  { id: 'streak_keep', title: 'Keep the Flame Alive', target: 1, type: 'streak' },
];

