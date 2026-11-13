/**
 * British English Vocabulary Pronunciation Service for QuizPro.
 * 
 * Strict Requirements:
 * - Locale: 'en-GB' (British English only, strictly NO American 'en-US' fallback).
 * - High-quality, natural voice targeting.
 * - Non-overlapping playback (cancels previous audio on new tap).
 * - In-memory and browser HTTP caching for fast response.
 * - Zero Firebase reads/writes; no storage in Firestore.
 * - Graceful error handling with zero intrusive UI alerts.
 */

type PlayingListener = (word: string | null) => void;

let currentPlayingWord: string | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentAudioElement: HTMLAudioElement | null = null;
const listeners = new Set<PlayingListener>();

// In-memory cache for audio URLs or validated speech keys
const audioUrlCache = new Map<string, string>();

function notifyPlaying(word: string | null) {
  currentPlayingWord = word;
  listeners.forEach((listener) => {
    try {
      listener(word);
    } catch (_) {}
  });
}

export function subscribePronunciation(listener: PlayingListener): () => void {
  listeners.add(listener);
  listener(currentPlayingWord);
  return () => {
    listeners.delete(listener);
  };
}

export function getCurrentlyPlayingWord(): string | null {
  return currentPlayingWord;
}

/**
 * Stops any ongoing pronunciation playback immediately.
 * Ensures no overlapping audio when a new word is tapped.
 */
export function stopPronunciation(): void {
  if (typeof window !== 'undefined') {
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    if (currentAudioElement) {
      try {
        currentAudioElement.pause();
        currentAudioElement.currentTime = 0;
      } catch (_) {}
      currentAudioElement = null;
    }
  }
  currentUtterance = null;
  notifyPlaying(null);
}

/**
 * Identifies the best available authentic British English ('en-GB') voice
 * from the browser's speech synthesis engine.
 */
function findBritishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. High-priority named natural UK voices
  const preferredUkNames = [
    'google uk english female',
    'google uk english male',
    'microsoft libby online (natural) - english (united kingdom)',
    'microsoft oliver online (natural) - english (united kingdom)',
    'microsoft ryan online (natural) - english (united kingdom)',
    'microsoft sonia online (natural) - english (united kingdom)',
    'microsoft george',
    'microsoft hazel',
    'microsoft susan',
    'serena',
    'daniel',
    'oliver',
    'kate',
    'arthur',
    'martha',
    'fiona',
    'moira'
  ];

  for (const preferred of preferredUkNames) {
    const match = voices.find((v) => v.name.toLowerCase().includes(preferred));
    if (match) return match;
  }

  // 2. Strict exact locale match for 'en-GB' or 'en_GB'
  const langMatch = voices.find((v) => {
    const l = (v.lang || '').toLowerCase().replace('_', '-');
    return l === 'en-gb';
  });
  if (langMatch) return langMatch;

  // 3. Name indicator for UK / British / United Kingdom
  const nameMatch = voices.find((v) => {
    const n = (v.name || '').toLowerCase();
    const l = (v.lang || '').toLowerCase();
    // Must be English and UK
    return (
      l.startsWith('en') &&
      (n.includes('united kingdom') || n.includes('uk english') || n.includes('british'))
    );
  });
  if (nameMatch) return nameMatch;

  return null;
}

/**
 * Clean and normalize a word for pronunciation.
 */
export function cleanWordForPronunciation(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '')
    .trim();
}

const ROMAN_NUMERALS = new Set([
  'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'
]);

/**
 * Checks if a token is an eligible English vocabulary word for tap-to-listen.
 * Excludes single letters, numbers, roman numerals, and non-English scripts.
 */
export function isEligibleEnglishWord(token: string): boolean {
  if (!token) return false;
  // If token contains digits or math/code symbols, reject immediately
  if (/[\d+=<>\\/_{}]/.test(token)) return false;
  const clean = cleanWordForPronunciation(token);
  // Word must have at least 2 letters
  if (clean.length < 2) return false;
  // Must consist only of Latin alphabetic letters (with optional internal hyphen)
  if (!/^[a-zA-Z]+(?:-[a-zA-Z]+)*$/.test(clean)) return false;
  // Must not be a roman numeral
  if (ROMAN_NUMERALS.has(clean.toLowerCase())) return false;
  return true;
}

/**
 * Fallback audio playback using server-side British TTS proxy or direct authentic en-GB stream.
 * Strictly guarantees British English accent even when device lacks an en-GB voice.
 */
function playBritishAudioFallback(cleanWord: string): void {
  const cacheKey = cleanWord.toLowerCase();
  const cachedUrl = audioUrlCache.get(cacheKey);

  const primaryUrl = cachedUrl || `/api/pronounce-en-gb?word=${encodeURIComponent(cleanWord)}`;
  const directTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-GB&client=tw-ob&q=${encodeURIComponent(cleanWord)}`;

  try {
    const audio = new Audio(primaryUrl);
    currentAudioElement = audio;

    audio.onplay = () => {
      notifyPlaying(cleanWord);
      audioUrlCache.set(cacheKey, primaryUrl);
    };

    audio.onended = () => {
      if (currentPlayingWord === cleanWord) {
        notifyPlaying(null);
      }
      currentAudioElement = null;
    };

    audio.onerror = () => {
      // Secondary fallback directly to en-GB stream
      try {
        const directAudio = new Audio(directTtsUrl);
        currentAudioElement = directAudio;
        directAudio.onplay = () => {
          notifyPlaying(cleanWord);
          audioUrlCache.set(cacheKey, directTtsUrl);
        };
        directAudio.onended = () => {
          if (currentPlayingWord === cleanWord) {
            notifyPlaying(null);
          }
          currentAudioElement = null;
        };
        directAudio.onerror = () => {
          if (currentPlayingWord === cleanWord) {
            notifyPlaying(null);
          }
          currentAudioElement = null;
        };
        directAudio.play().catch(() => {
          notifyPlaying(null);
        });
      } catch (_) {
        notifyPlaying(null);
      }
    };

    audio.play().catch(() => {
      // Autoplay or network restriction
      notifyPlaying(null);
    });
  } catch (_) {
    notifyPlaying(null);
  }
}

/**
 * Plays British English ('en-GB') pronunciation for an English vocabulary word.
 */
export function playBritishPronunciation(rawWord: string): void {
  const cleanWord = cleanWordForPronunciation(rawWord);
  if (!cleanWord || !isEligibleEnglishWord(cleanWord)) return;

  // Always cancel any existing playback first to prevent overlapping audio
  stopPronunciation();

  // 1. Attempt Native Web Speech Synthesis with an authentic en-GB voice
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const britishVoice = findBritishVoice();

    if (britishVoice) {
      try {
        const utterance = new SpeechSynthesisUtterance(cleanWord);
        utterance.voice = britishVoice;
        utterance.lang = 'en-GB';
        utterance.rate = 0.92; // Clear, deliberate speed optimal for vocabulary study
        utterance.pitch = 1.0;

        currentUtterance = utterance;

        utterance.onstart = () => {
          notifyPlaying(cleanWord);
        };

        utterance.onend = () => {
          if (currentPlayingWord === cleanWord) {
            notifyPlaying(null);
          }
          currentUtterance = null;
        };

        utterance.onerror = (e) => {
          // If speech synthesis encountered an error, fallback to audio stream
          if (e.error !== 'canceled' && e.error !== 'interrupted') {
            playBritishAudioFallback(cleanWord);
          } else {
            notifyPlaying(null);
          }
        };

        window.speechSynthesis.speak(utterance);
        return;
      } catch (_) {
        // Fall through to fallback audio
      }
    }
  }

  // 2. Fallback: If device has NO British voice or SpeechSynthesis is unavailable/failed,
  // use authentic en-GB audio stream. (Strictly prevents American accent fallback).
  playBritishAudioFallback(cleanWord);
}
