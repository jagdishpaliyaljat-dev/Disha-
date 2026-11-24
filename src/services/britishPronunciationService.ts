/**
 * British English Vocabulary Pronunciation Service for DISHA 20-20.
 * 
 * Capabilities:
 * - High-fidelity British English ('en-GB') prioritization with multi-tier English fallback.
 * - Robust mobile Android WebView & Capacitor support (handles async voice loading, paused state, GC prevention).
 * - Non-overlapping playback (cancels previous audio immediately when a new word is tapped).
 * - Free Dictionary API high-quality native audio fallback with in-memory caching.
 * - Single-word vocabulary pronunciation and full-phrase / question speech synthesis.
 * - Zero intrusive UI alerts or runtime errors on unsupported platforms.
 */

type PlayingListener = (word: string | null) => void;

let currentPlayingWord: string | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentAudioElement: HTMLAudioElement | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];
const listeners = new Set<PlayingListener>();

// In-memory cache for audio URLs
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
 * Ensures no overlapping audio when a new word or question is tapped.
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
    try {
      (window as any).__dishaSpeechUtterance = null;
    } catch (_) {}
  }
  currentUtterance = null;
  notifyPlaying(null);
}

/**
 * Retrieves the available speech synthesis voices, caching them for fast subsequent access.
 */
export function clearVoiceCacheForTesting(): void {
  cachedVoices = [];
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  try {
    const list = window.speechSynthesis.getVoices();
    if (list && list.length > 0) {
      cachedVoices = list;
      return cachedVoices;
    }
  } catch (_) {}
  return cachedVoices;
}

// Preload voices and listen for dynamic voice initialization in Chromium / Android WebView
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    getAvailableVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      try {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) {
          cachedVoices = v;
        }
      } catch (_) {}
    };
  } catch (_) {}
}

export interface VoiceMatchResult {
  voice: SpeechSynthesisVoice | null;
  lang: string;
  isBritish: boolean;
}

/**
 * Identifies the best available voice from the browser / device speech engine.
 * Priority:
 * 1. High-fidelity British English ('en-GB') voice.
 * 2. Natural Indian / Commonwealth English voice ('en-IN', 'en-AU', 'en-CA', 'en-IE').
 * 3. Any standard English voice ('en-US' or any 'en-*').
 * 4. System default voice.
 */
export function resolveBestVoice(): VoiceMatchResult {
  const voices = getAvailableVoices();

  if (voices.length > 0) {
    // 1. High-priority named natural UK / British voices
    const preferredUkKeywords = [
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

    for (const kw of preferredUkKeywords) {
      const match = voices.find((v) => (v.name || '').toLowerCase().includes(kw));
      if (match) return { voice: match, lang: 'en-GB', isBritish: true };
    }

    // Exact locale match for 'en-GB' or 'en_GB'
    const langMatch = voices.find((v) => {
      const l = (v.lang || '').toLowerCase().replace('_', '-');
      return l === 'en-gb';
    });
    if (langMatch) return { voice: langMatch, lang: 'en-GB', isBritish: true };

    // Name indicator for UK / British / United Kingdom
    const nameMatch = voices.find((v) => {
      const n = (v.name || '').toLowerCase();
      const l = (v.lang || '').toLowerCase();
      return (
        l.startsWith('en') &&
        (n.includes('united kingdom') || n.includes('uk english') || n.includes('british'))
      );
    });
    if (nameMatch) return { voice: nameMatch, lang: 'en-GB', isBritish: true };

    // 2. High-priority Indian English ('en-IN') or Commonwealth English
    const commonwealthKeywords = ['en-in', 'en_in', 'india', 'en-au', 'en-ca', 'en-ie', 'en-nz'];
    for (const kw of commonwealthKeywords) {
      const match = voices.find((v) => {
        const l = (v.lang || '').toLowerCase().replace('_', '-');
        const n = (v.name || '').toLowerCase();
        return l === kw || n.includes(kw);
      });
      if (match) return { voice: match, lang: match.lang || 'en-GB', isBritish: false };
    }

    // 3. Any available English voice (e.g. en-US)
    const anyEnglish = voices.find((v) => {
      const l = (v.lang || '').toLowerCase().replace('_', '-');
      const n = (v.name || '').toLowerCase();
      return l.startsWith('en') || n.includes('english');
    });
    if (anyEnglish) return { voice: anyEnglish, lang: anyEnglish.lang || 'en-GB', isBritish: false };

    // 4. Fallback to default voice
    const defaultVoice = voices.find((v) => v.default);
    if (defaultVoice) return { voice: defaultVoice, lang: 'en-GB', isBritish: false };
  }

  // 5. Fallback: No voice object in list yet (voices may not have populated),
  // but utterance.lang = 'en-GB' lets the Android OS TTS engine handle synthesis.
  return { voice: null, lang: 'en-GB', isBritish: true };
}

/**
 * Backward compatibility alias for findBritishVoice.
 */
export function findBritishVoice(): SpeechSynthesisVoice | null {
  return resolveBestVoice().voice;
}

/**
 * Clean and normalize a word or short phrase for pronunciation.
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
 * Excludes single letters, numbers, roman numerals, math symbols, and non-English scripts.
 * Supports hyphens and apostrophes (e.g., "well-known", "don't").
 */
export function isEligibleEnglishWord(token: string): boolean {
  if (!token) return false;
  // If token contains digits or math/code symbols, reject immediately
  if (/[\d+=<>\\/_{}]/.test(token)) return false;
  const clean = cleanWordForPronunciation(token);
  // Word must have at least 2 letters
  if (clean.length < 2) return false;
  // Must consist only of Latin alphabetic letters (with optional internal hyphen or apostrophe)
  if (!/^[a-zA-Z]+(?:['’-][a-zA-Z]+)*$/.test(clean)) return false;
  // Must not be a roman numeral
  if (ROMAN_NUMERALS.has(clean.toLowerCase())) return false;
  return true;
}

/**
 * Fetches an authentic pronunciation audio recording (.mp3) from the public Dictionary API.
 */
async function fetchDictionaryAudioUrl(word: string): Promise<string | null> {
  const cacheKey = word.toLowerCase();
  const cached = audioUrlCache.get(cacheKey);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!resp.ok) return null;
    const data = await resp.json();
    if (!Array.isArray(data)) return null;

    const audioUrls: string[] = [];
    for (const entry of data) {
      if (entry && Array.isArray(entry.phonetics)) {
        for (const p of entry.phonetics) {
          if (p && typeof p.audio === 'string' && p.audio.trim().length > 0) {
            audioUrls.push(p.audio.trim());
          }
        }
      }
    }

    if (audioUrls.length === 0) return null;

    // Prioritize UK pronunciation if available
    const ukAudio = audioUrls.find((u) => u.includes('-uk') || u.includes('/uk/'));
    const chosen = ukAudio || audioUrls[0];
    const finalUrl = chosen.startsWith('//') ? `https:${chosen}` : chosen;

    audioUrlCache.set(cacheKey, finalUrl);
    return finalUrl;
  } catch (_) {
    return null;
  }
}

/**
 * Fallback audio playback using Free Dictionary API native MP3 streams.
 */
function playBritishAudioFallback(cleanWord: string): void {
  fetchDictionaryAudioUrl(cleanWord).then((audioUrl) => {
    if (!audioUrl) {
      notifyPlaying(null);
      return;
    }

    try {
      const audio = new Audio(audioUrl);
      currentAudioElement = audio;

      audio.onplay = () => {
        notifyPlaying(cleanWord);
      };

      audio.onended = () => {
        if (currentPlayingWord === cleanWord) {
          notifyPlaying(null);
        }
        currentAudioElement = null;
      };

      audio.onerror = () => {
        if (currentPlayingWord === cleanWord) {
          notifyPlaying(null);
        }
        currentAudioElement = null;
      };

      audio.play().catch(() => {
        notifyPlaying(null);
      });
    } catch (_) {
      notifyPlaying(null);
    }
  }).catch(() => {
    notifyPlaying(null);
  });
}

/**
 * Plays English pronunciation for a single vocabulary word.
 * Prioritizes British English ('en-GB') with comprehensive mobile Android safeguards.
 */
export function playBritishPronunciation(rawWord: string): void {
  const cleanWord = cleanWordForPronunciation(rawWord);
  if (!cleanWord || !isEligibleEnglishWord(cleanWord)) return;

  // Always cancel any existing playback first to prevent overlapping audio
  stopPronunciation();

  // 1. Attempt Native Web Speech Synthesis with Android WebView fixes
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      // Android WebView resume safeguard: unstick any paused synthesizer queue
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const { voice, lang } = resolveBestVoice();
      const utterance = new SpeechSynthesisUtterance(cleanWord);

      if (voice) {
        utterance.voice = voice;
      }
      utterance.lang = lang || 'en-GB';
      // 0.90 speed: Deliberate, clear cadence ideal for competitive exam vocabulary study
      utterance.rate = 0.90;
      utterance.pitch = 1.0;

      // Retain utterance reference globally to prevent Android V8 GC mid-speech
      currentUtterance = utterance;
      (window as any).__dishaSpeechUtterance = utterance;

      utterance.onstart = () => {
        notifyPlaying(cleanWord);
      };

      utterance.onend = () => {
        if (currentPlayingWord === cleanWord) {
          notifyPlaying(null);
        }
        currentUtterance = null;
        try {
          (window as any).__dishaSpeechUtterance = null;
        } catch (_) {}
      };

      utterance.onerror = (e) => {
        currentUtterance = null;
        try {
          (window as any).__dishaSpeechUtterance = null;
        } catch (_) {}
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          // If native speech fails with a real error, try dictionary audio fallback
          playBritishAudioFallback(cleanWord);
        } else {
          notifyPlaying(null);
        }
      };

      window.speechSynthesis.speak(utterance);

      // Force resume on Android WebView if speak() entered paused state
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      return;
    } catch (_) {
      // Fall through to audio fallback
    }
  }

  // 2. Fallback: If device lacks SpeechSynthesis or throws, use dictionary MP3 stream
  playBritishAudioFallback(cleanWord);
}

/**
 * Speaks an entire sentence, question, or explanation in clear English.
 */
export function speakEnglishText(rawText: string): void {
  if (!rawText) return;

  // Clean markdown, KaTeX math symbols, and diagram placeholders
  const clean = rawText
    .replace(/\$\$[\s\S]+?\$\$/g, ' ')
    .replace(/\\\[[\s\S]+?\\\]/g, ' ')
    .replace(/\$[^$\n]+?\$/g, ' ')
    .replace(/\\\([\s\S]+?\\\)/g, ' ')
    .replace(/\[(?:image|diagram|चित्र)[^\]]*\]/gi, ' ')
    .replace(/[*_#`~]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;!?])/g, '$1')
    .trim()
    .slice(0, 1000);

  if (!clean) return;

  stopPronunciation();

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const { voice, lang } = resolveBestVoice();
      const utterance = new SpeechSynthesisUtterance(clean);

      if (voice) {
        utterance.voice = voice;
      }
      utterance.lang = lang || 'en-GB';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      const stateKey = '__full_question_speech__';
      currentUtterance = utterance;
      (window as any).__dishaSpeechUtterance = utterance;

      utterance.onstart = () => {
        notifyPlaying(stateKey);
      };

      utterance.onend = () => {
        if (currentPlayingWord === stateKey) {
          notifyPlaying(null);
        }
        currentUtterance = null;
        try {
          (window as any).__dishaSpeechUtterance = null;
        } catch (_) {}
      };

      utterance.onerror = () => {
        if (currentPlayingWord === stateKey) {
          notifyPlaying(null);
        }
        currentUtterance = null;
        try {
          (window as any).__dishaSpeechUtterance = null;
        } catch (_) {}
      };

      window.speechSynthesis.speak(utterance);
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (_) {
      notifyPlaying(null);
    }
  }
}
