export interface HindiQuestionSpeechPayload {
  questionText: string;
  options?: string[];
  explanation?: string;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export function isHindiSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function stopHindiSpeech(): void {
  if (isHindiSpeechSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

/**
 * Strips markdown symbols (bold, italic, links) for clean text-to-speech pronunciation
 */
function cleanSpeechText(input: string): string {
  return input
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

/**
 * Reads aloud a question and its options using the browser's native SpeechSynthesis in Hindi (hi-IN)
 */
export function speakHindiQuestion({
  questionText,
  options = [],
  explanation,
  onEnd,
  onError,
}: HindiQuestionSpeechPayload): SpeechSynthesisUtterance | null {
  if (!isHindiSpeechSupported()) return null;

  stopHindiSpeech();

  const cleanQuestion = cleanSpeechText(questionText);
  let script = cleanQuestion;

  if (options && options.length > 0) {
    const optionsText = options
      .map((opt, idx) => `विकल्प ${idx + 1}: ${cleanSpeechText(opt)}`)
      .join('. ');
    script += `. ${optionsText}`;
  }

  if (explanation) {
    script += `. व्याख्या: ${cleanSpeechText(explanation)}`;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.lang = 'hi-IN';
    utterance.rate = 0.95; // Slightly slower pacing for study clarity
    utterance.pitch = 1.0;

    // Attempt to pick a Hindi voice if available
    const voices = window.speechSynthesis.getVoices?.() || [];
    const hindiVoice = voices.find(v => v.lang.startsWith('hi') || v.lang.includes('Hindi'));
    if (hindiVoice) {
      utterance.voice = hindiVoice;
    }

    if (onEnd) utterance.onend = () => onEnd();
    if (onError) utterance.onerror = (e) => onError(e);

    window.speechSynthesis.speak(utterance);
    return utterance;
  } catch (err) {
    console.warn('Hindi Speech Synthesis error:', err);
    if (onError) onError(err);
    return null;
  }
}
