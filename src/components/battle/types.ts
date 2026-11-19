export type BattleCategory = 
  | "all"
  | "history"
  | "geography"
  | "culture"
  | "polity"
  | "economy";

export interface BattleQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  category?: string;
  difficulty?: "easy" | "medium" | "hard";
}

export interface BattlePlayer {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  isBot?: boolean;
  score: number;
  streak: number;
  correctCount: number;
  wrongCount: number;
  avgResponseTimeMs: number;
  lastAnswer?: {
    questionIndex: number;
    selectedOption: number;
    timeTakenMs: number;
    isCorrect: boolean;
    pointsEarned: number;
  } | null;
}

export type QuestionSourceType = 
  | "curated"      // Rajasthan GK Bank (Pre-built)
  | "subject"      // Specific subject questions
  | "chapter"      // Specific chapter questions
  | "topic"        // Specific topic questions
  | "custom_bank"  // User's custom added questions
  | "manual_pick"; // Hand-picked questions by host

export interface BattleRoomConfig {
  roomCode: string;
  hostId: string;
  questionCount: number; // 30, 50, 60, or custom
  timePerQuestionSec: number; // 5s, 10s, 15s
  category: BattleCategory;
  questionSource: QuestionSourceType;
  selectedSubjectId?: string;
  selectedSubjectTitle?: string;
  selectedChapterId?: string;
  selectedChapterTitle?: string;
  selectedTopicId?: string;
  selectedTopicTitle?: string;
  selectedQuestionIds?: string[];
  allowUnlimitedUsers?: boolean;
  createdAt: number;
}

export type BattlePhase = 
  | "initial"
  | "lobby"
  | "countdown"
  | "question_active"
  | "round_reveal"
  | "podium";

export interface FloatingEmoji {
  id: string;
  emoji: string;
  fromPlayerName: string;
  timestamp: number;
  xPercent?: number;
}

export interface BattleState {
  phase: BattlePhase;
  roomConfig: BattleRoomConfig;
  myPlayerId: string;
  players: BattlePlayer[];
  questions: BattleQuestion[];
  currentQuestionIndex: number;
  roundStartTime: number;
  roundEndsAt: number;
  selectedOption: number | null;
  hasLockedAnswer: boolean;
  floatingEmojis: FloatingEmoji[];
  winnerPlayerId?: string;
}

export type BattleEventType =
  | "JOIN"
  | "READY_TOGGLE"
  | "START_GAME"
  | "ANSWER_SUBMIT"
  | "NEXT_QUESTION"
  | "REACTION"
  | "REMATCH"
  | "ROOM_STATE_SYNC"
  | "PLAYER_LEAVE";

export interface BattleEventMessage {
  type: BattleEventType;
  senderId: string;
  senderName: string;
  timestamp: number;
  payload: any;
}
