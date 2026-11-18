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

export interface BattleRoomConfig {
  roomCode: string;
  hostId: string;
  questionCount: number;
  timePerQuestionSec: number;
  category: BattleCategory;
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
  | "PLAYER_LEAVE";

export interface BattleEventMessage {
  type: BattleEventType;
  senderId: string;
  senderName: string;
  timestamp: number;
  payload: any;
}
