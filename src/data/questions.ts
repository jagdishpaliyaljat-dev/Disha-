import { Chapter, Question, Topic } from "../types";

// The seed data has been removed to provide a clean slate for your custom content.
// You can add new chapters, topics, and questions using the management tools in the app.

export const CHAPTERS_DATA: Chapter[] = [];

// Derived helper collections for easy lookup throughout the app
export const ALL_QUESTIONS: Question[] = [];
export const CHAPTERS_MAP: Record<string, Chapter> = {};
export const TOPICS_MAP: Record<string, Topic> = {};
export const QUESTIONS_MAP: Record<string, Question> = {};
