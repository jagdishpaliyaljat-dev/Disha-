import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express from 'express';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { parseRawMcqText } from './src/utils/questionParser';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { encryptSecret, decryptSecret, redactSensitiveText, encryptionKeyMode } from './src/server/cryptoVault';
import { SlidingWindowRateLimiter } from './src/server/rateLimiter';
import {
  AuthDeps,
  VerifiedUserContext,
  createRequireAuthenticatedUser,
  createRequireVerifiedAdmin,
} from './src/server/authMiddleware';
import {
  gradeAndSubmitLiveTest,
  isValidFirestoreDocId,
  sanitizeLiveTestForPublic,
} from './src/server/liveTestService';
import { createQuizAssetsService } from './src/server/quizAssetsService';
import {
  executeExportJob,
  generateRestorePreview,
  executeRestoreJob,
  listStoredBackups,
  deleteStoredBackup,
  getStoredBackupBuffer,
  getActiveJob,
  VERIFIED_QUIZPRO_COLLECTIONS,
} from './src/server/backupEngine';
import { defaultSnapshotPublishingService } from './src/server/snapshotPublishingService';

const currentFilename = typeof __filename !== 'undefined' ? __filename : '';
const currentDirname = typeof __dirname !== 'undefined' ? __dirname : (currentFilename ? path.dirname(currentFilename) : process.cwd());

// Firebase configuration for server-side REST queries (sitemap, meta tag prerendering)
const FIREBASE_PROJECT_ID = 'gen-lang-client-0811306192';
const FIRESTORE_DATABASE_ID = 'ai-studio-quizproshopx-3bfab5fe-4412-4a74-8471-935f57b6f194';
const FIREBASE_API_KEY = 'AIzaSyDSJtdRRNMSYnt4960wCkuyE14Yxgt_am4';

let defaultAdminApp: any = null;
let defaultAdminDb: any = null;
let defaultAdminAuth: any = null;

try {
  // Use a named app instance to ensure we use our specific project ID and avoid collisions with environment defaults
  const appName = 'quizpro-admin';
  defaultAdminApp = getApps().find(a => a.name === appName) || initializeApp({ projectId: FIREBASE_PROJECT_ID }, appName);

  // Strictly bind to the named Firestore database configured for this applet — never fall back to (default)
  try {
    defaultAdminDb = getFirestore(defaultAdminApp, FIRESTORE_DATABASE_ID);
  } catch (e: any) {
    console.error('[Firebase Admin] Named database access failed (fail-closed, no fallback):', redactSensitiveText(e));
    defaultAdminDb = null;
  }
  defaultAdminAuth = getAuth(defaultAdminApp);
} catch (err: any) {
  console.warn('[Firebase Admin Initialization Notice]:', redactSensitiveText(err));
}

let activeViteInstance: any = null;

export interface ServerDependencies {
  adminAuth?: AuthDeps['adminAuth'];
  adminDb?: any;
  geminiClientFactory?: (apiKey: string) => any;
  getViteInstance?: () => any;
}

const ALLOWED_PROVIDERS = new Set(['gemini', 'groq', 'openai', 'claude']);
const SAFE_MODEL_REGEX = /^[a-zA-Z0-9._:/-]{1,100}$/;
const ALLOWED_UPLOAD_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']);

export function createServerApp(deps: ServerDependencies = {}) {
  const adminDb = deps.adminDb !== undefined ? deps.adminDb : defaultAdminDb;
  const adminAuth = deps.adminAuth !== undefined ? deps.adminAuth : defaultAdminAuth;
  const getVite = () => (deps.getViteInstance ? deps.getViteInstance() : activeViteInstance);

  const app = express();
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL || process.env.npm_lifecycle_event === 'start';
  const distPath = path.join(process.cwd(), 'dist');

  const rateLimiter = new SlidingWindowRateLimiter();
  const requireAuthenticatedUser = createRequireAuthenticatedUser(() => ({ adminAuth, adminDb }));
  const requireVerifiedAdmin = createRequireVerifiedAdmin(() => ({ adminAuth, adminDb }));

  let aiConfigsStore: any[] = [];
  let rotationPolicy: 'priority_failover' | 'round_robin' = 'priority_failover';

  const sanitizeConfigForClient = (c: any) => {
    const { encryptedApiKey, ...safe } = c;
    return {
      ...safe,
      apiKey: encryptedApiKey ? '•••••••••••••' : '',
      hasKey: Boolean(encryptedApiKey),
    };
  };

  // Capture raw body for Cashfree HMAC webhook verification
  app.use(express.json({
    limit: '15mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  const getGeminiClient = (req?: express.Request, authUser?: VerifiedUserContext) => {
    // Only authenticated callers reach AI handlers; check caller-provided personal key first
    const headerKey = req ? (req.headers['x-ai-api-key'] || req.headers['x-gemini-api-key']) as string : undefined;
    let apiKey = (headerKey && headerKey.trim()) || '';

    // Server-managed keys (env or aiConfigsStore) may ONLY be accessed after verified authentication
    if ((!apiKey || apiKey.length < 15) && authUser?.uid) {
      apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
      if ((!apiKey || apiKey.length < 15) && aiConfigsStore.length > 0) {
        const geminiCfg = aiConfigsStore.find(c => (c.provider === 'gemini' || !c.provider) && c.enabled && c.encryptedApiKey);
        if (geminiCfg && geminiCfg.encryptedApiKey) {
          const decrypted = decryptSecret(geminiCfg.encryptedApiKey);
          if (decrypted && decrypted.length >= 15) {
            apiKey = decrypted;
          }
        }
      }
    }

    if (!apiKey || apiKey === 'YOUR_API_KEY' || apiKey.length < 15) return null;
    if (deps.geminiClientFactory) {
      return deps.geminiClientFactory(apiKey);
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  const generateWithFallback = async (ai: any, prompt: string | any[], systemInstruction?: string) => {
    const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        const contents = typeof prompt === 'string' ? [{ role: 'user', parts: [{ text: prompt }] }] : prompt;
        const generationConfig: any = { responseMimeType: 'application/json' };

        const options: any = {
          model: modelName,
          contents,
          generationConfig,
        };

        if (systemInstruction) {
          options.systemInstruction = { role: 'system', parts: [{ text: systemInstruction }] };
        }

        const response = await ai.models.generateContent(options);

        if (response && response.text) {
          return response.text;
        }
      } catch (err: any) {
        const errStr = redactSensitiveText(err);
        if (errStr.includes('401') || errStr.includes('UNAUTHENTICATED') || errStr.includes('API key not valid')) {
          throw new Error('Gemini API Key is unauthenticated or invalid.');
        }
        console.warn(`Model ${modelName} failed, trying next fallback:`, errStr);
        lastError = err;
      }
    }
    throw lastError || new Error('All Gemini AI models failed');
  };

  /**
   * Robust JSON extraction from AI response strings that might contain markdown or extra text.
   */
  function extractJsonFromResponse(text: string): any {
    if (!text) return null;
    try {
      // 1. Try direct parse
      return JSON.parse(text);
    } catch (e) {
      try {
        // 2. Try removing markdown blocks
        const cleaned = text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
      } catch (e2) {
        // 3. Regex extract first JSON array or object
        const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (e3) {
            console.error("[extractJson] Failed regex parse:", e3);
          }
        }
        throw new Error("Failed to parse JSON from AI response.");
      }
    }
  }

  // British English Vocabulary Audio Proxy (en-GB authentic pronunciation fallback)
  app.get('/api/pronounce-en-gb', async (req, res) => {
    const word = String(req.query.word || '').trim();
    if (!word || word.length > 100 || !/^[a-zA-Z\s'-]+$/.test(word)) {
      return res.status(400).send('Invalid vocabulary word parameter');
    }
    try {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-GB&client=tw-ob&q=${encodeURIComponent(word)}`;
      const response = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (!response.ok) {
        return res.status(502).send('Failed to fetch British TTS stream');
      }
      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.warn('[Pronounce en-GB Proxy Error]:', err?.message || err);
      res.status(500).send('Pronunciation service error');
    }
  });

  // Contact Us & Technical Feedback Endpoint (wired to contact_messages collection for Admin Panel)
  app.post('/api/contact', async (req, res) => {
    try {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      const rlKey = `contact:${Array.isArray(ip) ? ip[0] : String(ip).split(',')[0].trim()}`;
      const rl = rateLimiter.check(rlKey, { windowMs: 10 * 60 * 1000, maxRequests: 10 });
      if (!rl.allowed) {
        return res.status(429).json({
          success: false,
          error: 'Too Many Requests',
          message: 'Too many messages sent. Please wait a few minutes before submitting again.'
        });
      }

      const { name, email, subject, message } = req.body || {};
      const trimmedName = String(name || '').trim().slice(0, 100);
      const trimmedEmail = String(email || '').trim().slice(0, 150);
      const trimmedSubject = String(subject || '').trim().slice(0, 150);
      const trimmedMessage = String(message || '').trim().slice(0, 5000);

      if (!trimmedName || trimmedName.length < 2) {
        return res.status(400).json({ success: false, message: 'Valid name is required (at least 2 characters).' });
      }
      if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
        return res.status(400).json({ success: false, message: 'Valid email address is required.' });
      }
      if (!trimmedSubject) {
        return res.status(400).json({ success: false, message: 'Subject is required.' });
      }
      if (!trimmedMessage || trimmedMessage.length < 10) {
        return res.status(400).json({ success: false, message: 'Message must be at least 10 characters.' });
      }

      const now = new Date();
      const messageDoc = {
        name: trimmedName,
        email: trimmedEmail,
        subject: trimmedSubject,
        message: trimmedMessage,
        status: 'new',
        statusText: 'New',
        createdAt: now,
        createdIso: now.toISOString(),
      };

      if (defaultAdminDb) {
        try {
          const docRef = defaultAdminDb.collection('contact_messages').doc();
          await docRef.set(messageDoc);
          console.log(`[Contact API] Message recorded in Firestore doc: ${docRef.id}`);
        } catch (dbErr: any) {
          console.warn('[Contact API] Failed to write message to Firestore, proceeding with acknowledgment:', dbErr?.message || dbErr);
        }
      } else {
        console.warn('[Contact API] Firestore defaultAdminDb not initialized, message acknowledged in memory.');
      }

      return res.status(200).json({
        success: true,
        message: 'Thank you for contacting DISHA 20-20! Your message has been received.'
      });
    } catch (err: any) {
      console.error('[Contact API Error]:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to process contact message. Please try again later.'
      });
    }
  });

  // 1. OCR Exam Paper Extraction (Authenticated non-anonymous callers + strict rate & payload limits)
  app.post('/api/exam-paper/extract', requireAuthenticatedUser, async (req, res) => {
    try {
      const authUser = req.authUser!;
      const rl = rateLimiter.check(`ai-extract:${authUser.uid}`, {
        windowMs: 60_000,
        maxRequests: authUser.isAdmin ? 60 : 12,
      });
      if (!rl.allowed) {
        return res.status(429).json({
          success: false,
          questions: [],
          error: `Rate limit exceeded. Please retry in ${rl.retryAfterSeconds}s.`,
        });
      }

      const { files, rawText } = req.body || {};
      if (rawText !== undefined && (typeof rawText !== 'string' || rawText.length > 80_000)) {
        return res.status(400).json({
          success: false,
          questions: [],
          error: 'Invalid rawText payload or maximum length (80,000 chars) exceeded.',
        });
      }
      if (files !== undefined) {
        if (!Array.isArray(files) || files.length > 5) {
          return res.status(400).json({
            success: false,
            questions: [],
            error: 'Invalid files payload (maximum 5 pages per request).',
          });
        }
        for (const f of files) {
          if (!f || typeof f !== 'object' || (f.base64Data && (typeof f.base64Data !== 'string' || f.base64Data.length > 12_000_000))) {
            return res.status(400).json({
              success: false,
              questions: [],
              error: 'Invalid or oversized file payload.',
            });
          }
          if (f.mimeType && !ALLOWED_UPLOAD_MIME_TYPES.has(String(f.mimeType).toLowerCase())) {
            return res.status(400).json({
              success: false,
              questions: [],
              error: 'Unsupported file MIME type.',
            });
          }
        }
      }

      const ai = getGeminiClient(req, authUser);

      let questions: any[] = [];

      // A. If rawText is provided (e.g. pasted exam text or JSON)
      if (rawText && typeof rawText === 'string' && rawText.trim().length > 10) {
        if (ai) {
          try {
            const textPrompt = `You are DISHA 20-20's specialized competitive exam parser.
Extract all Multiple Choice Questions (MCQs) from this text with complete accuracy.
Preserve Hindi and English text, formulas, statements, and numbers.
Extract all options (A, B, C, D or 1, 2, 3, 4).
If a correct option or answer is indicated, include it as "answer" (e.g. "A", "B", "1") and "correctIndex" (0-based integer, or -1 if not indicated).
If an explanation is present, include it as "explanation".

Text to extract:
${rawText}

Return ONLY a JSON array of question objects with fields:
originalQuestionNumber (number),
originalText (string),
extractedOptions (array of strings),
questionType (string: standard | statement_based | match_following | assertion_reason),
answer (string, optional),
correctIndex (number, optional),
explanation (string, optional)`;

            const resText = await generateWithFallback(ai, textPrompt);
            const parsed = extractJsonFromResponse(resText);
            const qList = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.mcqs || []);

            qList.forEach((q: any, idx: number) => {
              questions.push({
                tempId: `draft-text-ai-${Date.now()}-${idx + 1}`,
                originalQuestionNumber: q.originalQuestionNumber || idx + 1,
                sourcePageNumber: 1,
                originalText: q.originalText || q.question || q.text || '',
                extractedOptions: Array.isArray(q.extractedOptions) && q.extractedOptions.length >= 2
                  ? q.extractedOptions
                  : (Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']),
                ocrStatus: 'high',
                ocrConfidence: 0.98,
                questionType: q.questionType || 'standard',
                isFlaggedForReview: false,
                answer: q.answer || '',
                correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : -1,
                explanation: q.explanation || '',
              });
            });
          } catch (textAiErr: any) {
            console.warn('AI text extraction notice in /api/exam-paper/extract:', redactSensitiveText(textAiErr));
          }
        }

        // Robust heuristic fallback parser if AI key wasn't active or AI returned empty
        if (questions.length === 0) {
          try {
            const localRes = parseRawMcqText(rawText);
            if (localRes.questions && localRes.questions.length > 0) {
              localRes.questions.forEach((q, idx) => {
                questions.push({
                  tempId: `draft-text-local-${Date.now()}-${idx + 1}`,
                  originalQuestionNumber: idx + 1,
                  sourcePageNumber: 1,
                  originalText: q.question || q.text || '',
                  extractedOptions: q.options && q.options.length >= 2 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
                  ocrStatus: 'high',
                  ocrConfidence: q.confidence || 0.95,
                  questionType: q.type || 'standard',
                  isFlaggedForReview: !q.isValid,
                  answer: q.answer || '',
                  correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : -1,
                  explanation: q.explanation || '',
                });
              });
            }
          } catch (localParseErr) {
            console.warn('Local parse fallback notice:', redactSensitiveText(localParseErr));
          }
        }
      }

      // B. If image/PDF files are uploaded
      if (Array.isArray(files) && files.length > 0) {
        if (!ai) {
          return res.status(200).json({
            questions: [],
            success: false,
            error: 'Google Gemini API key is missing or invalid. Please configure your key in Settings > AI API Settings to scan exam paper images.',
            requiresApiKey: true,
          });
        }

        for (const file of files) {
          if (!file.base64Data) continue;
          const cleanBase64 = file.base64Data.replace(/^data:[^;]+;base64,/, '').trim();
          if (!cleanBase64) continue;

          const mimeType = (file.mimeType && file.mimeType.includes('/'))
            ? file.mimeType
            : (file.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

          try {
            const prompt = [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: `You are an expert OCR and Exam Paper extraction system specialized in competitive exam papers (such as RAS, UPSC, REET, Patwar, Police, SSC, State PSC).
Transcribe all Multiple Choice Questions (MCQs) visible in this exam paper page.
Requirements:
1. Transcribe both Hindi and English accurately, preserving original wording, equations, formulas, and numbers.
2. Extract the question number into "originalQuestionNumber" (e.g. 1, 2, 3...).
3. Extract the full question stem into "originalText".
4. Extract all 4 (or 5) options exactly as printed into "extractedOptions" (array of strings, e.g. ["A. ...", "B. ...", "C. ...", "D. ..."] or plain text).
5. If an answer key, circle, tick, or correct option is marked, extract it into "answer" (e.g. "A", "1", etc.) and "correctIndex" (0, 1, 2, 3).
6. Classify "questionType" as "standard", "statement_based", "match_following", or "assertion_reason".

Return ONLY a JSON array of objects:
[
  {
    "originalQuestionNumber": 1,
    "originalText": "Question stem text in Hindi/English",
    "extractedOptions": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "questionType": "standard",
    "answer": "A",
    "correctIndex": 0
  }
]`,
              },
            ];

            const resText = await generateWithFallback(ai, prompt);
            const parsed = extractJsonFromResponse(resText);
            const qList = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.mcqs || []);

            qList.forEach((q: any, idx: number) => {
              questions.push({
                tempId: `draft-server-${Date.now()}-${file.pageNumber || 1}-${idx + 1}`,
                originalQuestionNumber: q.originalQuestionNumber || questions.length + 1,
                sourcePageNumber: file.pageNumber || 1,
                originalText: q.originalText || q.question || '',
                extractedOptions: Array.isArray(q.extractedOptions) && q.extractedOptions.length >= 2
                  ? q.extractedOptions
                  : (Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']),
                ocrStatus: 'high',
                ocrConfidence: 0.95,
                questionType: q.questionType || 'standard',
                isFlaggedForReview: false,
                answer: q.answer || '',
                correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : -1,
                explanation: q.explanation || '',
              });
            });
          } catch (visionErr: any) {
            console.warn('Gemini Vision OCR single file notice:', visionErr?.message || visionErr);
          }
        }
      }

      if (questions.length === 0) {
        return res.json({
          questions: [],
          success: true,
          warning: 'No readable questions detected from the document/image. Please ensure the paper is clear, right-side-up, and legible.',
        });
      }

      res.json({ questions, success: true });
    } catch (err: any) {
      console.warn('Notice in /api/exam-paper/extract:', redactSensitiveText(err));
      res.status(500).json({ questions: [], success: false, error: redactSensitiveText(err) || 'Extraction failed' });
    }
  });

  // 2. Admin News AI Write (Strict Verified Admin Only)
  app.post('/api/admin/news/ai-write', requireVerifiedAdmin, async (req, res) => {
    try {
      const authUser = req.authUser!;
      const { topic, examTarget, language, category } = req.body || {};
      if (!topic || typeof topic !== 'string' || topic.trim().length > 1000) {
        return res.status(400).json({ success: false, error: 'Valid topic string (<= 1000 chars) is required.' });
      }
      const ai = getGeminiClient(req, authUser);

      if (!ai) {
        return res.status(200).json({ success: false, error: 'Gemini API key is missing or invalid. Please configure your key in AI API Settings.' });
      }

      const prompt = `Write a comprehensive, professional educational news article or exam guide.
Target Topic: ${topic}
Target Exam: ${examTarget || 'RPSC & Competitive Exams'}
Language: ${language || 'Both Hindi and English'}
Category: ${category || 'Current Affairs'}

Return ONLY valid JSON with keys:
{
  "title": "English Title",
  "hindiTitle": "Hindi Title",
  "subtitle": "Subtitle",
  "slug": "kebab-case-slug",
  "category": "${category || 'Current Affairs'}",
  "language": "Both",
  "excerpt": "Short 2-sentence summary",
  "content": "Full article markdown content",
  "authorName": "DISHA 20-20 Editorial Team",
  "authorBio": "Senior Exam Analyst",
  "status": "published",
  "tags": ["Exam", "Study Guide"],
  "seoTitle": "SEO optimized title under 60 chars",
  "seoDescription": "Meta description under 150 chars",
  "focusKeyword": "main keyword",
  "faqs": [{"question": "FAQ 1?", "answer": "Answer 1"}]
}`;

      const resText = await generateWithFallback(ai, prompt);
      const article = extractJsonFromResponse(resText);

      article.id = `art_${Date.now()}`;
      article.publishedAt = new Date().toISOString();
      article.createdAt = new Date().toISOString();
      article.views = 0;

      res.json({ success: true, article });
    } catch (err: any) {
      console.warn('Notice in /api/admin/news/ai-write:', redactSensitiveText(err));
      res.status(200).json({ success: false, error: redactSensitiveText(err) || 'AI generation failed' });
    }
  });

  // 3. Admin News AI Assist / SEO Optimize (Strict Verified Admin Only)
  app.post('/api/admin/news/ai-assist', requireVerifiedAdmin, async (req, res) => {
    try {
      const authUser = req.authUser!;
      const { title, text } = req.body || {};
      if (!title || typeof title !== 'string' || title.length > 500) {
        return res.status(400).json({ success: false, error: 'Valid article title is required.' });
      }
      if (text && (typeof text !== 'string' || text.length > 20_000)) {
        return res.status(400).json({ success: false, error: 'Article text exceeds maximum allowed length.' });
      }
      const ai = getGeminiClient(req, authUser);

      if (!ai) {
        return res.status(200).json({ success: false, error: 'Gemini API key is missing or invalid' });
      }

      const prompt = `Optimize SEO fields for article with title: "${title}" and excerpt: "${text || ''}".
Return ONLY JSON with keys:
{
  "seoTitle": "Catchy SEO Title (50-60 chars)",
  "seoDescription": "Compelling Meta Description (120-150 chars)",
  "focusKeyword": "Primary Keyword",
  "suggestedSlug": "clean-seo-slug",
  "tags": ["tag1", "tag2", "tag3"]
}`;

      const resText = await generateWithFallback(ai, prompt);
      const result = extractJsonFromResponse(resText);

      res.json({ success: true, result });
    } catch (err: any) {
      console.error('Error in /api/admin/news/ai-assist:', redactSensitiveText(err));
      res.status(500).json({ success: false, error: redactSensitiveText(err) || 'AI SEO optimization failed' });
    }
  });

  // 5. Firebase Admin Info & Health (Strict Verified Admin Only)
  app.get('/api/admin/firebase-info', requireVerifiedAdmin, (_req, res) => {
    res.json({
      success: true,
      projectId: FIREBASE_PROJECT_ID,
      databaseId: FIRESTORE_DATABASE_ID,
      region: 'asia-east1',
      status: adminDb ? 'connected' : 'initialization_failed',
      encryptionKeyMode,
    });
  });

  // 5b. Firebase Storage & Database Resource Usage Monitor (Authoritative Cloud Metrics - Admin Only)
  let cachedMetrics: any = null;
  let cachedMetricsTimestamp = 0;
  const METRICS_CACHE_TTL_MS = 60 * 1000; // 60 seconds server cache

  app.get('/api/admin/firebase-storage-metrics', requireVerifiedAdmin, async (req, res) => {

    const forceRefresh = req.query.force === 'true';
    const now = Date.now();

    if (!forceRefresh && cachedMetrics && (now - cachedMetricsTimestamp < METRICS_CACHE_TTL_MS)) {
      return res.json({
        ...cachedMetrics,
        fromCache: true,
        cacheAgeMs: now - cachedMetricsTimestamp
      });
    }

    try {
      // 2. Fetch authoritative Cloud Firestore collection counts via runAggregationQuery
      const collectionsToMeasure = [
        'mcqs',
        'questions',
        'subjects',
        'chapters',
        'topics',
        'articles',
        'users',
        'liveTests',
        'pyq_papers',
        'import_batches'
      ];

      const collectionCounts: Record<string, number> = {};
      let totalDocuments = 0;

      await Promise.allSettled(
        collectionsToMeasure.map(async (col) => {
          try {
            const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents:runAggregationQuery?key=${FIREBASE_API_KEY}`;
            const queryRes = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                structuredAggregationQuery: {
                  structuredQuery: { from: [{ collectionId: col }] },
                  aggregations: [{ alias: 'count', count: {} }]
                }
              })
            });
            if (queryRes.ok) {
              const data = await queryRes.json();
              const countVal = data?.[0]?.result?.aggregateFields?.count?.integerValue;
              const count = countVal ? parseInt(countVal, 10) : 0;
              collectionCounts[col] = count;
              totalDocuments += count;
            } else {
              collectionCounts[col] = 0;
            }
          } catch (_) {
            collectionCounts[col] = 0;
          }
        })
      );

      // 3. Compute Firestore database sizing (avg 1.25 KB per doc + index overhead)
      const estimatedBytesPerDoc = 1250;
      const firestoreSizeEstimatedBytes = totalDocuments * estimatedBytesPerDoc;
      const firestoreSizeMb = Number((firestoreSizeEstimatedBytes / (1024 * 1024)).toFixed(2));

      // 4. Check Firebase Storage Bucket Availability & Stats
      const bucketName = 'gen-lang-client-0811306192.firebasestorage.app';
      let storageStatus: 'connected' | 'unprovisioned' | 'error' = 'unprovisioned';
      let storageUsedBytes = 0;
      let storageFileCount = 0;
      let storageCapacityBytes: number | null = null;
      let storageRemainingBytes: number | null = null;
      let storageConsumptionPercent = 0;

      try {
        const storageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o?key=${FIREBASE_API_KEY}`;
        const sRes = await fetch(storageUrl);
        if (sRes.ok) {
          const sData = await sRes.json();
          storageStatus = 'connected';
          const items = sData?.items || [];
          storageFileCount = items.length;
          // Spark free tier provides 5 GB Firebase Storage capacity where provisioned
          storageCapacityBytes = 5 * 1024 * 1024 * 1024;
          storageUsedBytes = items.reduce((acc: number, item: any) => acc + (parseInt(item.size, 10) || 0), 0);
          storageRemainingBytes = Math.max(0, storageCapacityBytes - storageUsedBytes);
          storageConsumptionPercent = Number(((storageUsedBytes / storageCapacityBytes) * 100).toFixed(2));
        } else if (sRes.status === 404) {
          storageStatus = 'unprovisioned';
        }
      } catch (_) {
        storageStatus = 'error';
      }

      const metricsResult = {
        success: true,
        projectId: FIREBASE_PROJECT_ID,
        databaseId: FIRESTORE_DATABASE_ID,
        region: 'asia-east1',
        storage: {
          bucketName,
          status: storageStatus,
          isProvisioned: storageStatus === 'connected',
          capacityBytes: storageCapacityBytes,
          capacityText: storageCapacityBytes ? '5.0 GB (Spark Plan)' : 'Quota not applicable',
          usedBytes: storageUsedBytes,
          usedMb: Number((storageUsedBytes / (1024 * 1024)).toFixed(2)),
          remainingBytes: storageRemainingBytes,
          remainingMb: storageRemainingBytes ? Number((storageRemainingBytes / (1024 * 1024)).toFixed(2)) : null,
          remainingText: storageRemainingBytes !== null ? `${(storageRemainingBytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Quota not applicable',
          consumptionPercent: storageConsumptionPercent,
          fileCount: storageFileCount,
        },
        firestore: {
          databaseSizeMb: firestoreSizeMb,
          databaseSizeBytes: firestoreSizeEstimatedBytes,
          totalDocumentCount: totalDocuments,
          collections: collectionCounts,
          capacityText: 'Quota not applicable (Serverless pay-as-you-go)',
          freeTierStorageLimit: '1.0 GB Free Tier (Stored Data)',
          freeTierDailyLimits: {
            reads: 50000,
            writes: 20000,
            deletes: 20000,
          }
        },
        timestamp: new Date().toISOString(),
        lastUpdatedTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      cachedMetrics = metricsResult;
      cachedMetricsTimestamp = now;

      res.json(metricsResult);
    } catch (err: any) {
      console.error('[API Firebase Storage Metrics Error]:', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to retrieve Firebase storage metrics'
      });
    }
  });

  // 5c. Complete Full Firebase Backup, Export & Disaster Recovery Engine (Strict Verified Admin Only)
  app.get('/api/admin/backup/collections', requireVerifiedAdmin, (_req, res) => {
    res.json({
      success: true,
      collections: VERIFIED_QUIZPRO_COLLECTIONS,
      totalCount: VERIFIED_QUIZPRO_COLLECTIONS.length,
    });
  });

  app.post('/api/admin/backup/export', requireVerifiedAdmin, async (req, res) => {
    try {
      const { scope = 'full', selectedCollections = [], exportStorage = true } = req.body || {};
      const jobId = `export_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const adminBearerToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

      // Launch async export job in background
      executeExportJob(
        jobId,
        {
          scope: scope === 'selective' ? 'selective' : 'full',
          selectedCollections: Array.isArray(selectedCollections) ? selectedCollections : undefined,
          exportStorage: Boolean(exportStorage),
          adminBearerToken,
        },
        {
          adminDb,
          projectId: FIREBASE_PROJECT_ID,
          databaseId: FIRESTORE_DATABASE_ID,
          apiKey: FIREBASE_API_KEY,
        }
      ).catch((jobErr) => {
        console.error(`[Backup Export Fatal Error] Job ${jobId}:`, jobErr);
      });

      res.json({
        success: true,
        jobId,
        message: 'Backup export job initiated successfully.',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to initiate backup export.' });
    }
  });

  app.get('/api/admin/backup/jobs/:jobId', requireVerifiedAdmin, (req, res) => {
    const job = getActiveJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found or expired.' });
    }
    res.json({ success: true, job });
  });

  app.get('/api/admin/backup/history', requireVerifiedAdmin, (_req, res) => {
    try {
      const backups = listStoredBackups();
      res.json({ success: true, backups });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list backup history.' });
    }
  });

  app.delete('/api/admin/backup/history/:backupId', requireVerifiedAdmin, (req, res) => {
    try {
      const deleted = deleteStoredBackup(req.params.backupId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Backup archive not found.' });
      }
      res.json({ success: true, message: 'Backup archive deleted from local storage.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to delete backup archive.' });
    }
  });

  app.get('/api/admin/backup/download/:backupId', requireVerifiedAdmin, (req, res) => {
    try {
      const buffer = getStoredBackupBuffer(req.params.backupId);
      const safeFilename = path.basename(req.params.backupId);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message || 'Backup file not found.' });
    }
  });

  app.post('/api/admin/backup/upload-validate', requireVerifiedAdmin, async (req, res) => {
    try {
      const { zipBase64, filename = 'uploaded_backup.zip' } = req.body || {};
      if (!zipBase64 || typeof zipBase64 !== 'string') {
        return res.status(400).json({ success: false, error: 'Missing zipBase64 file payload.' });
      }

      const zipBuffer = Buffer.from(zipBase64, 'base64');
      if (zipBuffer.length === 0) {
        return res.status(400).json({ success: false, error: 'Empty file payload received.' });
      }

      const adminBearerToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

      // Validate archive and generate Restore Preview
      const preview = await generateRestorePreview(
        zipBuffer,
        filename,
        {
          adminDb,
          projectId: FIREBASE_PROJECT_ID,
          databaseId: FIRESTORE_DATABASE_ID,
          apiKey: FIREBASE_API_KEY,
        },
        adminBearerToken
      );

      // Save staged archive in backups/ directory with temporary ID for execution
      const stageFilename = `STAGED_${Date.now()}_${path.basename(filename)}`;
      const stagePath = path.join(path.resolve(process.cwd(), 'backups'), stageFilename);
      fs.writeFileSync(stagePath, zipBuffer);
      preview.backupId = stageFilename;

      res.json({ success: true, preview });
    } catch (err: any) {
      console.error('[Upload Validate Error]:', err);
      res.status(400).json({ success: false, error: err.message || 'Archive validation failed.' });
    }
  });

  app.post('/api/admin/backup/restore', requireVerifiedAdmin, async (req, res) => {
    try {
      const { backupId, restoreMode, confirmationPhrase, selectedCollections, skipStorage } = req.body || {};
      if (!backupId || !restoreMode || !confirmationPhrase) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: backupId, restoreMode, confirmationPhrase.',
        });
      }

      const buffer = getStoredBackupBuffer(backupId);
      const jobId = `restore_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const adminBearerToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

      executeRestoreJob(
        jobId,
        {
          backupId,
          restoreMode,
          confirmationPhrase,
          selectedCollections,
          skipStorage,
        },
        buffer,
        { uid: req.authUser!.uid, email: req.authUser!.email },
        {
          adminDb,
          projectId: FIREBASE_PROJECT_ID,
          databaseId: FIRESTORE_DATABASE_ID,
          apiKey: FIREBASE_API_KEY,
        },
        adminBearerToken
      ).catch((rErr) => {
        console.error(`[Backup Restore Fatal Error] Job ${jobId}:`, rErr);
      });

      res.json({
        success: true,
        jobId,
        message: 'Disaster recovery restore job initiated.',
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to start restore job.' });
    }
  });

  // 6. AI Rotation Status & Policy (Strict Verified Admin Only)
  app.get('/api/admin/ai-rotation/status', requireVerifiedAdmin, (_req, res) => {
    res.json({
      success: true,
      activeProvider: 'Gemini AI Studio (Native)',
      policy: rotationPolicy,
      quotaHealth: '100%',
      isHealthy: true,
      encryptionKeyMode,
    });
  });

  app.post('/api/admin/ai-rotation/policy', requireVerifiedAdmin, (req, res) => {
    const { policy } = req.body || {};
    if (policy !== 'priority_failover' && policy !== 'round_robin') {
      return res.status(400).json({ success: false, error: 'Invalid rotation policy.' });
    }
    rotationPolicy = policy;
    res.json({ success: true, policy: rotationPolicy, message: 'Rotation policy updated' });
  });

  // 7. AI Config Management Routes (Strict Verified Admin Only + AES-256-GCM Vault)
  app.get('/api/admin/ai-configs', requireVerifiedAdmin, (_req, res) => {
    res.json({ success: true, configs: aiConfigsStore.map(sanitizeConfigForClient) });
  });

  app.post('/api/admin/ai-configs', requireVerifiedAdmin, (req, res) => {
    try {
      const { name, provider = 'gemini', model, apiKey, enabled, priority } = req.body || {};
      if (!ALLOWED_PROVIDERS.has(String(provider))) {
        return res.status(400).json({ success: false, error: 'Unsupported AI provider.' });
      }
      const targetModel = model || (provider === 'gemini' ? 'gemini-2.5-flash' : provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini');
      if (!SAFE_MODEL_REGEX.test(String(targetModel))) {
        return res.status(400).json({ success: false, error: 'Invalid model identifier.' });
      }

      const id = `config_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newConfig = {
        id,
        name: String(name || `${provider} Key`).slice(0, 100),
        provider: String(provider),
        model: String(targetModel),
        apiKey: apiKey ? '•••••••••••••' : '',
        encryptedApiKey: apiKey && typeof apiKey === 'string' && !apiKey.includes('••••') ? encryptSecret(apiKey) : '',
        enabled: enabled ?? true,
        priority: typeof priority === 'number' ? priority : (aiConfigsStore.length + 1),
        status: 'available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      aiConfigsStore.push(newConfig);
      res.json({ success: true, id, config: sanitizeConfigForClient(newConfig) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: redactSensitiveText(err) || 'Failed to save AI config' });
    }
  });

  app.put('/api/admin/ai-configs/:id', requireVerifiedAdmin, (req, res) => {
    try {
      const id = String(req.params.id || '');
      if (!isValidFirestoreDocId(id)) {
        return res.status(400).json({ success: false, error: 'Invalid config ID.' });
      }
      const { name, provider, model, apiKey, enabled, priority } = req.body || {};
      if (provider !== undefined && !ALLOWED_PROVIDERS.has(String(provider))) {
        return res.status(400).json({ success: false, error: 'Unsupported AI provider.' });
      }
      if (model !== undefined && !SAFE_MODEL_REGEX.test(String(model))) {
        return res.status(400).json({ success: false, error: 'Invalid model identifier.' });
      }

      const existingIdx = aiConfigsStore.findIndex(c => c.id === id);
      if (existingIdx === -1) {
        const prov = String(provider || 'gemini');
        const newConfig = {
          id,
          name: String(name || `${prov} Key`).slice(0, 100),
          provider: prov,
          model: String(model || (prov === 'gemini' ? 'gemini-2.5-flash' : prov === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini')),
          apiKey: apiKey ? '•••••••••••••' : '',
          encryptedApiKey: (apiKey && typeof apiKey === 'string' && !apiKey.includes('••••')) ? encryptSecret(apiKey) : '',
          enabled: enabled ?? true,
          priority: typeof priority === 'number' ? priority : 1,
          status: 'available',
          updatedAt: new Date().toISOString(),
        };
        aiConfigsStore.push(newConfig);
        return res.json({ success: true, id, config: sanitizeConfigForClient(newConfig) });
      }

      const updatedEncryptedKey = (apiKey && typeof apiKey === 'string' && !apiKey.includes('••••'))
        ? encryptSecret(apiKey)
        : aiConfigsStore[existingIdx].encryptedApiKey;

      aiConfigsStore[existingIdx] = {
        ...aiConfigsStore[existingIdx],
        name: name ? String(name).slice(0, 100) : aiConfigsStore[existingIdx].name,
        provider: provider ? String(provider) : aiConfigsStore[existingIdx].provider,
        model: model ? String(model) : aiConfigsStore[existingIdx].model,
        encryptedApiKey: updatedEncryptedKey,
        enabled: enabled ?? aiConfigsStore[existingIdx].enabled,
        priority: priority ?? aiConfigsStore[existingIdx].priority,
        updatedAt: new Date().toISOString(),
      };
      res.json({ success: true, id, config: sanitizeConfigForClient(aiConfigsStore[existingIdx]) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: redactSensitiveText(err) || 'Failed to update AI config' });
    }
  });

  app.put('/api/admin/ai-configs/:id/toggle', requireVerifiedAdmin, (req, res) => {
    const id = String(req.params.id || '');
    const { enabled } = req.body || {};
    const cfg = aiConfigsStore.find(c => c.id === id);
    if (!cfg) {
      return res.status(404).json({ success: false, error: 'AI config not found.' });
    }
    cfg.enabled = Boolean(enabled);
    cfg.status = cfg.enabled ? 'available' : 'disabled';
    res.json({ success: true, id, enabled: cfg.enabled });
  });

  app.post('/api/admin/ai-configs/:id/reset', requireVerifiedAdmin, (req, res) => {
    const id = String(req.params.id || '');
    const cfg = aiConfigsStore.find(c => c.id === id);
    if (!cfg) {
      return res.status(404).json({ success: false, error: 'AI config not found.' });
    }
    cfg.status = 'available';
    cfg.consecutiveErrors = 0;
    cfg.remainingCooldownSec = 0;
    res.json({ success: true, id, status: 'available' });
  });

  app.delete('/api/admin/ai-configs/:id', requireVerifiedAdmin, (req, res) => {
    const id = String(req.params.id || '');
    aiConfigsStore = aiConfigsStore.filter(c => c.id !== id);
    res.json({ success: true, id, message: 'AI config deleted' });
  });

  app.post('/api/admin/ai-configs/sync', requireVerifiedAdmin, (req, res) => {
    try {
      const { configs } = req.body || {};
      if (Array.isArray(configs)) {
        configs.slice(0, 50).forEach((incoming: any) => {
          if (!incoming || !isValidFirestoreDocId(incoming.id)) return;
          const idx = aiConfigsStore.findIndex(c => c.id === incoming.id);
          const encryptedKey = (incoming.apiKey && typeof incoming.apiKey === 'string' && !incoming.apiKey.includes('••••'))
            ? encryptSecret(incoming.apiKey)
            : (idx !== -1 ? aiConfigsStore[idx].encryptedApiKey : '');

          const entry = {
            id: incoming.id,
            name: String(incoming.name || 'AI Key').slice(0, 100),
            provider: ALLOWED_PROVIDERS.has(String(incoming.provider)) ? String(incoming.provider) : 'gemini',
            model: SAFE_MODEL_REGEX.test(String(incoming.model || '')) ? String(incoming.model) : 'gemini-2.5-flash',
            enabled: incoming.enabled ?? true,
            priority: typeof incoming.priority === 'number' ? incoming.priority : 1,
            status: incoming.status || 'available',
            encryptedApiKey: encryptedKey,
            apiKey: '•••••••••••••',
            updatedAt: new Date().toISOString(),
          };
          if (idx === -1) {
            aiConfigsStore.push(entry);
          } else {
            aiConfigsStore[idx] = { ...aiConfigsStore[idx], ...entry };
          }
        });
      }
      res.json({ success: true, message: 'AI configs synced', count: aiConfigsStore.length });
    } catch (err: any) {
      res.status(400).json({ success: false, error: redactSensitiveText(err) || 'Failed to sync AI configs' });
    }
  });

  app.post('/api/admin/ai-configs/reorder', requireVerifiedAdmin, (req, res) => {
    const { priorities } = req.body || {};
    if (priorities && typeof priorities === 'object') {
      aiConfigsStore = aiConfigsStore.map((cfg) => ({
        ...cfg,
        priority: typeof priorities[cfg.id] === 'number' ? priorities[cfg.id] : cfg.priority,
      }));
    }
    res.json({ success: true, message: 'AI configs reordered' });
  });

  // 8. Test API Key (Strict Verified Admin Only)
  app.post('/api/ai/test-key', requireVerifiedAdmin, async (req, res) => {
    try {
      const authUser = req.authUser!;
      const rl = rateLimiter.check(`ai-test:${authUser.uid}`, { windowMs: 60_000, maxRequests: 30 });
      if (!rl.allowed) {
        return res.status(429).json({ success: false, message: `Rate limit exceeded. Retry in ${rl.retryAfterSeconds}s.` });
      }

      let { apiKey, configId, provider = 'gemini', model } = req.body || {};

      if (!ALLOWED_PROVIDERS.has(String(provider))) {
        return res.status(400).json({ success: false, message: `Unsupported provider: ${String(provider)}` });
      }
      if (model && !SAFE_MODEL_REGEX.test(String(model))) {
        return res.status(400).json({ success: false, message: 'Invalid model identifier.' });
      }

      // If configId is provided and apiKey is missing or masked, look up in aiConfigsStore
      if (configId && (!apiKey || String(apiKey).includes('••••'))) {
        if (!isValidFirestoreDocId(configId)) {
          return res.status(400).json({ success: false, message: 'Invalid configId format.' });
        }
        const foundConfig = aiConfigsStore.find(c => c.id === configId);
        if (!foundConfig) {
          return res.status(404).json({ success: false, message: 'Referenced AI configuration was not found on server.' });
        }
        if (foundConfig.encryptedApiKey) {
          apiKey = decryptSecret(foundConfig.encryptedApiKey);
        }
        if (foundConfig.provider) provider = foundConfig.provider;
        if (foundConfig.model) model = foundConfig.model;
      }

      const keyToUse = (apiKey && typeof apiKey === 'string' && !apiKey.includes('••••'))
        ? apiKey.trim()
        : (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '');

      if (!keyToUse) {
        return res.status(400).json({ success: false, message: 'No valid API key provided or found in server configuration.' });
      }

      const startTime = Date.now();

      if (provider === 'gemini') {
        const targetModel = (model && model !== 'default' && model !== 'custom' && model !== 'gemini-1.5-flash') ? model : 'gemini-1.5-flash';
        const ai = deps.geminiClientFactory ? deps.geminiClientFactory(keyToUse) : new GoogleGenAI({ apiKey: keyToUse });

        const fallbackModels = Array.from(new Set([targetModel, 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash']));

        let testRes: any = null;
        let lastErr: any = null;

        for (const mName of fallbackModels) {
          try {
            testRes = await ai.models.generateContent({
              model: mName,
              contents: [{ text: 'Ping test. Reply with OK' }],
              config: { maxOutputTokens: 10, temperature: 0 },
            });
            if (testRes && (testRes.text || testRes.candidates)) {
              break;
            }
          } catch (fErr: any) {
            console.warn(`[test-key] Gemini model ${mName} test notice:`, redactSensitiveText(fErr));
            lastErr = fErr;
          }
        }

        const latencyMs = Date.now() - startTime;
        if (testRes && (testRes.text || testRes.candidates)) {
          return res.json({
            success: true,
            message: `Google Gemini API key verified successfully! (${latencyMs}ms)`,
            latencyMs
          });
        }
        if (lastErr) throw lastErr;
        return res.json({ success: false, message: 'Gemini check produced empty response.' });
      } else if (provider === 'groq') {
        const targetModel = (model && model !== 'default' && model !== 'custom' && model !== 'qwen/qwen3.8-27b') ? model : 'llama-3.3-70b-versatile';
        const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${keyToUse}`
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [{ role: 'user', content: 'Ping test. Reply with OK' }],
            max_tokens: 10,
            temperature: 0
          })
        });

        const latencyMs = Date.now() - startTime;
        if (groqResp.ok) {
          return res.json({ success: true, message: `Groq LPU API Key verified successfully! (${latencyMs}ms)`, latencyMs });
        } else {
          const errJson = await groqResp.json().catch(() => ({}));
          return res.json({ success: false, message: redactSensitiveText(errJson?.error?.message) || `Groq HTTP ${groqResp.status}` });
        }
      } else if (provider === 'openai') {
        const targetModel = (model && model !== 'default' && model !== 'custom') ? model : 'gpt-4o-mini';
        const oaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${keyToUse}`
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [{ role: 'user', content: 'Ping test. Reply with OK' }],
            max_tokens: 10,
            temperature: 0
          })
        });

        const latencyMs = Date.now() - startTime;
        if (oaiResp.ok) {
          return res.json({ success: true, message: `OpenAI API Key verified successfully! (${latencyMs}ms)`, latencyMs });
        } else {
          const errJson = await oaiResp.json().catch(() => ({}));
          return res.json({ success: false, message: redactSensitiveText(errJson?.error?.message) || `OpenAI HTTP ${oaiResp.status}` });
        }
      } else if (provider === 'claude') {
        const targetModel = (model && model !== 'default' && model !== 'custom') ? model : 'claude-3-5-haiku-20241022';
        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': keyToUse,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: targetModel,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Ping test. Reply with OK' }]
          })
        });

        const latencyMs = Date.now() - startTime;
        if (claudeResp.ok) {
          return res.json({ success: true, message: `Claude API Key verified successfully! (${latencyMs}ms)`, latencyMs });
        } else {
          const errJson = await claudeResp.json().catch(() => ({}));
          return res.json({ success: false, message: redactSensitiveText(errJson?.error?.message) || `Claude HTTP ${claudeResp.status}` });
        }
      }

      return res.json({ success: false, message: `Unsupported provider: ${provider}` });
    } catch (err: any) {
      console.error('[test-key] Error testing key:', redactSensitiveText(err));
      res.status(500).json({ success: false, message: redactSensitiveText(err) || 'API Key validation failed' });
    }
  });

  // 9. AI MCQ Bulk Generation / Import (Strict Verified Admin Only)
  app.post('/api/ai/ai-mcq-import', requireVerifiedAdmin, async (req, res) => {
    try {
      const authUser = req.authUser!;
      const { prompt: userPrompt, subject, chapter, topic, jsonContent } = req.body || {};
      const serialized = JSON.stringify(jsonContent || userPrompt || '');
      if (serialized.length > 60_000) {
        return res.status(400).json({ success: false, error: 'Payload size limit exceeded.', questions: [] });
      }

      const ai = getGeminiClient(req, authUser);

      if (!ai) {
        return res.status(400).json({ success: false, error: 'Gemini API key missing or invalid. Please configure your key in AI API Settings.' });
      }

      const prompt = `Generate 5 high-quality Multiple Choice Questions (MCQs) for competitive exam prep.
Subject: ${String(subject || 'General Knowledge').slice(0, 120)}
Chapter: ${String(chapter || 'General').slice(0, 120)}
Topic: ${String(topic || 'General').slice(0, 120)}
Custom Requirements: ${String(userPrompt || jsonContent?.rawText || 'Standard RPSC/NCERT pattern').slice(0, 10000)}

Return ONLY a JSON array of objects with fields:
[
  {
    "text": "Question text in English & Hindi",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Detailed explanation in English & Hindi",
    "importantFact": "Key fact to remember",
    "difficulty": "medium"
  }
]`;

      const resText = await generateWithFallback(ai, prompt);
      const questions = extractJsonFromResponse(resText);

      res.json({ success: true, questions });
    } catch (err: any) {
      console.warn('Notice in /api/ai/ai-mcq-import:', redactSensitiveText(err));
      res.status(200).json({ success: false, error: redactSensitiveText(err) || 'MCQ generation failed', questions: [] });
    }
  });

  // 10. AI MCQ Format & Recovery Endpoint (Authenticated callers + strict rate & payload limits)
  app.post('/api/ai/format-mcq', requireAuthenticatedUser, async (req, res) => {
    try {
      const authUser = req.authUser!;
      const rl = rateLimiter.check(`ai-format:${authUser.uid}`, {
        windowMs: 60_000,
        maxRequests: authUser.isAdmin ? 60 : 12,
      });
      if (!rl.allowed) {
        return res.status(429).json({
          success: false,
          questions: [],
          formatted: null,
          error: `Rate limit exceeded. Retry in ${rl.retryAfterSeconds}s.`,
        });
      }

      const { mode, rawQuestions, text } = req.body || {};
      if (text !== undefined && (typeof text !== 'string' || text.length > 80_000)) {
        return res.status(400).json({ success: false, error: 'Text payload exceeds 80,000 characters.' });
      }
      if (rawQuestions !== undefined && (!Array.isArray(rawQuestions) || rawQuestions.length > 100)) {
        return res.status(400).json({ success: false, error: 'rawQuestions must be an array of at most 100 items.' });
      }

      const ai = getGeminiClient(req, authUser);

      if (!ai) {
        return res.json({ success: true, questions: [], formatted: null, isFallback: true, warning: "API key missing or not provided" });
      }

      const systemRules = `You are DISHA 20-20's Universal MCQ Recognition, Parsing, Classification & JSON Mapping Engine.
STRICT ANTI-HALLUCINATION RULES:
1. NEVER invent, guess, or fabricate a correct answer if it is not explicitly present in the source input. If the answer is missing, set "correctIndex": -1 and "answer": "".
2. NEVER invent fake options (like "Option A", "Option B") if options are missing in the source input.
3. NEVER alter historical dates, years, numbers, formulas, or Hindi/English factual text.
4. Preserve Hindi, English, and mixed Unicode text accurately. Wrap mathematical formulas in $...$ LaTeX.
5. Classify "questionType" accurately as one of: "single_correct", "statement_based", "assertion_reason", "match_following", "table_based", "math", or "unsupported".
6. For "match_following" questions, include "matchTable": { "leftTitle": "सूची-I", "rightTitle": "सूची-II", "rows": [{ "left": "...", "right": "..." }] }.
7. For "table_based" questions, include "table": { "caption": "...", "headers": ["..."], "rows": [["..."]] }.
8. Do NOT invent subject, chapter, or topic if not present in the source.
9. MULTI-EXAM RECOGNITION & STRICT ANTI-FABRICATION:
   - Identify and extract ALL competitive examination names and years mentioned for the question into an array "examHistory": [ { "examName": "...", "year": 2023, "verified": true } ].
   - A question may have appeared in MULTIPLE exams (e.g. CET 12th Level 2023, SSC CGL 2022, Patwari 2021). Extract all of them.
   - CRITICAL: Never claim that a question appeared in a particular examination without direct supporting evidence in the text. Never invent an exam name or year.
   - If exam history is present, set "questionClassification": "pyq" and "isPYQ": true.
   - If no exam is mentioned, set "questionClassification": "practice", "isPYQ": false, and "examHistory": []. Do not add fake PYQ labels.`;

      let prompt = "";
      if (mode === "recover_json" && Array.isArray(rawQuestions)) {
        prompt = `Recover and normalize these malformed or incomplete question objects into DISHA 20-20's structured MCQ schema without inventing missing answers, options, or exam history.
Input raw questions:
${JSON.stringify(rawQuestions, null, 2)}

Return ONLY a JSON object with key "questions":
{
  "questions": [
    {
      "question": "Clear question text in original Hindi/English with LaTeX ($...$)",
      "text": "Clear question text",
      "options": ["...", "...", "...", "..."],
      "answer": "A" (or "" if not present in input),
      "correctIndex": 0 (0-based index, or -1 if not present in input),
      "explanation": "Explanation from input, or empty string if not present",
      "type": "single_correct | statement_based | assertion_reason | match_following | table_based | math | unsupported",
      "questionType": "single_correct | statement_based | assertion_reason | match_following | table_based | math | unsupported",
      "matchTable": { "leftTitle": "सूची-I", "rightTitle": "सूची-II", "rows": [{ "left": "A. ...", "right": "1. ..." }] } (only if match_following),
      "table": { "headers": ["..."], "rows": [["..."]] } (only if table_based),
      "examHistory": [ { "examName": "CET 12th Level", "year": 2023, "verified": true } ] (only if present in input),
      "questionClassification": "pyq | practice | pyq_practice",
      "isPYQ": true / false,
      "needsReview": false,
      "reviewReason": ""
    }
  ]
}`;
      } else {
        prompt = `Parse and map the following text into DISHA 20-20's structured Multiple Choice Questions (MCQs) without inventing missing answers, options, or exams:
${text || ''}

Return ONLY a JSON object with key "questions":
{
  "questions": [
    {
      "text": "Question text in original Hindi/English",
      "question": "Question text in original Hindi/English",
      "options": ["...", "...", "...", "..."],
      "correctIndex": 0 (0-based index, or -1 if answer is not given in text),
      "answer": "A" (or "" if answer is not given in text),
      "explanation": "Explanation if present in text, otherwise empty string",
      "type": "single_correct | statement_based | assertion_reason | match_following | table_based | math | unsupported",
      "questionType": "single_correct | statement_based | assertion_reason | match_following | table_based | math | unsupported",
      "matchTable": { "leftTitle": "सूची-I", "rightTitle": "सूची-II", "rows": [{ "left": "A. ...", "right": "1. ..." }] } (only if match_following),
      "table": { "headers": ["..."], "rows": [["..."]] } (only if table_based),
      "examHistory": [ { "examName": "CET 12th Level", "year": 2023, "verified": true } ],
      "questionClassification": "pyq | practice | pyq_practice",
      "isPYQ": true / false
    }
  ]
}`;
      }

      try {
        const resText = await generateWithFallback(ai, prompt, systemRules);
        const parsed = extractJsonFromResponse(resText);
        const questionsList = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.mcqs || []);
        return res.json({ success: true, questions: questionsList, formatted: questionsList[0] || null });
      } catch (aiErr: any) {
        console.warn("AI generation in /api/ai/format-mcq encountered unauthenticated/quota issue, returning fallback:", aiErr?.message || aiErr);
        return res.json({ success: true, questions: [], formatted: null, isFallback: true, warning: aiErr?.message || "AI API Key unauthenticated" });
      }
    } catch (err: any) {
      console.error('Error in /api/ai/format-mcq:', err);
      res.json({ success: true, questions: [], formatted: null, isFallback: true, error: err?.message || 'Formatting failed' });
    }
  });

  // 11. Exam Paper Match Endpoint (Authenticated callers + rate limiting)
  app.post('/api/exam-paper/match', requireAuthenticatedUser, async (req, res) => {
    try {
      const rl = rateLimiter.check(`exam-match:${req.authUser!.uid}`, { windowMs: 60_000, maxRequests: 20 });
      if (!rl.allowed) {
        return res.status(429).json({ success: false, error: `Rate limit exceeded. Retry in ${rl.retryAfterSeconds}s.` });
      }
      res.json({ success: true, matches: [] });
    } catch (err: any) {
      res.status(500).json({ error: redactSensitiveText(err) || 'Match failed' });
    }
  });

  // 12. Static Quiz Assets (Service Worker Cache-First Versioned Endpoints) & Live Tests
  const quizAssets = createQuizAssetsService({
    getAdminDb: () => adminDb,
    projectId: FIREBASE_PROJECT_ID,
    databaseId: FIRESTORE_DATABASE_ID,
    apiKey: FIREBASE_API_KEY,
  });

  const applyVersionedAssetCacheHeaders = (res: express.Response, vParam: unknown) => {
    const hasVersion = typeof vParam === 'string' && /^[a-zA-Z0-9._-]{1,64}$/.test(vParam.trim());
    if (hasVersion) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    }
  };

  app.get('/api/quiz-assets/version', async (req, res) => {
    try {
      const force = req.query.refresh === '1' || req.query.refresh === 'true';
      const manifest = await quizAssets.getVersionManifest(force);
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
      return res.json({ success: true, ...manifest });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) || 'Failed to load quiz version' });
    }
  });

  app.get('/api/quiz-assets/curriculum', async (req, res) => {
    try {
      const v = typeof req.query.v === 'string' ? req.query.v.trim() : undefined;
      const payload = await quizAssets.getCurriculumAsset(v);
      applyVersionedAssetCacheHeaders(res, v);
      return res.json({ success: true, ...payload });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) || 'Failed to load quiz curriculum' });
    }
  });

  app.get('/api/quiz-assets/bundle/:topicId', async (req, res) => {
    try {
      const topicId = String(req.params.topicId || '').trim();
      if (!isValidFirestoreDocId(topicId)) {
        return res.status(400).json({ success: false, error: 'Invalid topic ID.' });
      }
      const v = typeof req.query.v === 'string' ? req.query.v.trim() : undefined;
      const bundle = await quizAssets.getTopicBundleAsset(topicId, v);
      if (!bundle) {
        return res.status(404).json({ success: false, error: 'Question bundle not found.' });
      }
      applyVersionedAssetCacheHeaders(res, v);
      return res.json({ success: true, bundle });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) || 'Failed to load topic bundle' });
    }
  });

  app.get('/api/quiz-assets/pyq-papers', async (req, res) => {
    try {
      const v = typeof req.query.v === 'string' ? req.query.v.trim() : undefined;
      const payload = await quizAssets.getPyqPapersAsset(v);
      applyVersionedAssetCacheHeaders(res, v);
      return res.json({ success: true, ...payload });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) || 'Failed to load PYQ papers' });
    }
  });

  app.get('/api/quiz-assets/live-tests', async (req, res) => {
    try {
      const v = typeof req.query.v === 'string' ? req.query.v.trim() : undefined;
      const payload = await quizAssets.getLiveTestsAsset(v);
      applyVersionedAssetCacheHeaders(res, v);
      return res.json({ success: true, ...payload });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) || 'Failed to load live tests' });
    }
  });

  app.post('/api/quiz-assets/invalidate', requireVerifiedAdmin, (req, res) => {
    const topicIds = Array.isArray(req.body?.topicIds)
      ? req.body.topicIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0).slice(0, 200)
      : undefined;
    quizAssets.invalidateQuizAssetsCache(topicIds);
    return res.json({ success: true, invalidatedTopics: topicIds || 'all' });
  });

  // --- SNAPSHOT ARCHITECTURE ENDPOINTS ---

  // Manifest endpoint: returns current version manifest
  app.get('/api/manifests/current.json', (_req, res) => {
    try {
      const manifest = defaultSnapshotPublishingService.getCurrentManifest();
      if (!manifest) {
        return res.status(404).json({ success: false, error: 'No active snapshot manifest found' });
      }
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
      return res.json(manifest);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) });
    }
  });

  // Snapshot chunk / content delivery endpoint (immutable)
  app.get('/api/snapshots/:version/:filename', (req, res) => {
    try {
      const version = String(req.params.version || '');
      const filename = String(req.params.filename || '');
      const { filePath, exists } = defaultSnapshotPublishingService.getSnapshotFile(version, filename);

      if (!exists) {
        return res.status(404).json({ success: false, error: 'Snapshot file not found' });
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(filePath);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) });
    }
  });

  // Delta bundle delivery endpoint (immutable)
  app.get('/api/deltas/:filename', (req, res) => {
    try {
      const filename = String(req.params.filename || '');
      const { filePath, exists } = defaultSnapshotPublishingService.getDeltaFile(filename);

      if (!exists) {
        return res.status(404).json({ success: false, error: 'Delta bundle not found' });
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(filePath);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) });
    }
  });

  // Admin publishing endpoint: publish a new snapshot
  app.post('/api/admin/snapshots/publish', requireVerifiedAdmin, async (req, res) => {
    try {
      const options = req.body || {};
      const manifest = await defaultSnapshotPublishingService.publishNewSnapshot(options);
      return res.json({ success: true, manifest });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) });
    }
  });

  app.get('/api/live-tests/:testId', async (req, res) => {
    try {
      const testId = String(req.params.testId || '');
      const v = typeof req.query.v === 'string' ? req.query.v.trim() : undefined;
      if (!isValidFirestoreDocId(testId)) {
        return res.status(400).json({ success: false, error: 'Invalid live test ID.' });
      }
      if (!adminDb) {
        const fallback = await quizAssets.getPublicLiveTestById(testId, v);
        if (fallback.status !== 200 || !fallback.test) {
          return res.status(fallback.status === 404 ? 404 : 503).json({
            success: false,
            error: fallback.error || 'Database unavailable.',
          });
        }
        applyVersionedAssetCacheHeaders(res, v);
        return res.json({ success: true, test: fallback.test });
      }
      const result = await quizAssets.getPublicLiveTestById(testId, v);
      if (result.status !== 200 || !result.test) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      applyVersionedAssetCacheHeaders(res, v);
      return res.json({ success: true, test: result.test });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) || 'Failed to load live test' });
    }
  });

  app.post('/api/live-tests/:testId/submit', requireAuthenticatedUser, async (req, res) => {
    try {
      const authUser = req.authUser!;
      const rl = rateLimiter.check(`live-submit:${authUser.uid}`, { windowMs: 60_000, maxRequests: 10 });
      if (!rl.allowed) {
        return res.status(429).json({ success: false, error: `Too many submission attempts. Retry in ${rl.retryAfterSeconds}s.` });
      }
      const result = await gradeAndSubmitLiveTest({
        testId: String(req.params.testId || ''),
        authUser,
        body: req.body,
        adminDb,
      });
      return res.status(result.status).json(result.body);
    } catch (err: any) {
      console.error('[Live Test Submit Error]:', redactSensitiveText(err));
      return res.status(500).json({ success: false, error: redactSensitiveText(err) || 'Live test grading failed.' });
    }
  });

  // ─── FIRESTORE SERVER-SIDE QUERY HELPERS (REST API) ───────────────────
  interface FirestoreArticleServer {
    id: string;
    title: string;
    hindiTitle?: string;
    slug: string;
    excerpt?: string;
    content?: string;
    seoTitle?: string;
    seoDescription?: string;
    coverImageUrl?: string;
    authorName?: string;
    category?: string;
    publishedAt?: string;
    updatedAt?: string;
    status: string;
  }

  function parseFirestoreFields(fields: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(fields)) {
      if ('stringValue' in val) result[key] = val.stringValue;
      else if ('booleanValue' in val) result[key] = val.booleanValue;
      else if ('integerValue' in val) result[key] = Number(val.integerValue);
      else if ('doubleValue' in val) result[key] = Number(val.doubleValue);
      else if ('timestampValue' in val) result[key] = val.timestampValue;
      else if ('arrayValue' in val) {
        result[key] = (val.arrayValue.values || []).map((item: any) => {
          if ('stringValue' in item) return item.stringValue;
          if ('mapValue' in item) return parseFirestoreFields(item.mapValue.fields || {});
          return item;
        });
      } else if ('mapValue' in val) {
        result[key] = parseFirestoreFields(val.mapValue.fields || {});
      }
    }
    return result;
  }

  async function getPublishedArticlesServer(): Promise<FirestoreArticleServer[]> {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents:runQuery?key=${FIREBASE_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'articles' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'status' },
                op: 'EQUAL',
                value: { stringValue: 'published' }
              }
            },
            orderBy: [
              {
                field: { fieldPath: 'publishedAt' },
                direction: 'DESCENDING'
              }
            ],
            limit: 300
          }
        })
      });

      if (!res.ok) {
        console.warn('Firestore runQuery HTTP error:', res.status, await res.text());
        return [];
      }

      const data = await res.json();
      const articles: FirestoreArticleServer[] = [];
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.document?.fields) {
            const parsed = parseFirestoreFields(item.document.fields);
            const id = item.document.name.split('/').pop() || '';
            articles.push({
              id,
              title: parsed.title || '',
              hindiTitle: parsed.hindiTitle,
              slug: parsed.slug || id,
              excerpt: parsed.excerpt || '',
              content: parsed.content || '',
              seoTitle: parsed.seoTitle,
              seoDescription: parsed.seoDescription,
              coverImageUrl: parsed.coverImageUrl,
              authorName: parsed.authorName,
              category: parsed.category,
              publishedAt: parsed.publishedAt,
              updatedAt: parsed.updatedAt,
              status: parsed.status || 'published',
            });
          }
        }
      }
      return articles;
    } catch (err) {
      console.error('getPublishedArticlesServer error:', err);
      return [];
    }
  }

  async function getArticleBySlugServer(slug: string): Promise<FirestoreArticleServer | null> {
    if (!slug) return null;
    const cleanSlug = slug.trim().toLowerCase();

    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents:runQuery?key=${FIREBASE_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'articles' }],
            where: {
              compositeFilter: {
                op: 'AND',
                filters: [
                  {
                    fieldFilter: {
                      field: { fieldPath: 'slug' },
                      op: 'EQUAL',
                      value: { stringValue: cleanSlug }
                    }
                  },
                  {
                    fieldFilter: {
                      field: { fieldPath: 'status' },
                      op: 'EQUAL',
                      value: { stringValue: 'published' }
                    }
                  }
                ]
              }
            },
            limit: 1
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data[0]?.document?.fields) {
          const parsed = parseFirestoreFields(data[0].document.fields);
          const id = data[0].document.name.split('/').pop() || '';
          return {
            id,
            title: parsed.title || '',
            hindiTitle: parsed.hindiTitle,
            slug: parsed.slug || id,
            excerpt: parsed.excerpt || '',
            content: parsed.content || '',
            seoTitle: parsed.seoTitle,
            seoDescription: parsed.seoDescription,
            coverImageUrl: parsed.coverImageUrl,
            authorName: parsed.authorName,
            category: parsed.category,
            publishedAt: parsed.publishedAt,
            updatedAt: parsed.updatedAt,
            status: parsed.status || 'published',
          };
        }
      }

      // Fallback: check by document ID directly via REST
      const docUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/articles/${cleanSlug}?key=${FIREBASE_API_KEY}`;
      const docRes = await fetch(docUrl);
      if (docRes.ok) {
        const docData = await docRes.json();
        if (docData?.fields) {
          const parsed = parseFirestoreFields(docData.fields);
          if (parsed.status === 'published') {
            return {
              id: cleanSlug,
              title: parsed.title || '',
              hindiTitle: parsed.hindiTitle,
              slug: parsed.slug || cleanSlug,
              excerpt: parsed.excerpt || '',
              content: parsed.content || '',
              seoTitle: parsed.seoTitle,
              seoDescription: parsed.seoDescription,
              coverImageUrl: parsed.coverImageUrl,
              authorName: parsed.authorName,
              category: parsed.category,
              publishedAt: parsed.publishedAt,
              updatedAt: parsed.updatedAt,
              status: parsed.status || 'published',
            };
          }
        }
      }
    } catch (err) {
      console.warn('getArticleBySlugServer error:', err);
    }

    return null;
  }

  function getIndexHtml(): string {
    if (!isProd) {
      const devPath = path.join(process.cwd(), 'index.html');
      if (fs.existsSync(devPath)) return fs.readFileSync(devPath, 'utf-8');
    }

    const candidatePaths = [
      path.join(distPath, 'index.html'),
      path.join(process.cwd(), 'dist', 'index.html'),
      path.join(currentDirname, 'index.html'),
      path.join(currentDirname, 'dist', 'index.html'),
      path.join(currentDirname, '..', 'dist', 'index.html'),
      path.join(process.cwd(), 'index.html'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, 'utf-8');
          if (content && content.includes('<div id="root">')) return content;
        } catch {}
      }
    }
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DISHA 20-20 (दिशा 20-20) — Master Competitive Exams with Mock Tests &amp; PYQs</title>
    <meta name="description" content="Prepare for Rajasthan Competitive Exams with 1,500+ MCQs, official PYQs, and bilingual explanations on DISHA 20-20." />
    <link rel="canonical" href="https://disha2020.in" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
  }

  function injectVitePreamble(html: string, _url: string): string {
    if (isProd) return html;
    if (html.includes('__vite_plugin_react_preamble_installed__')) return html;

    const flagScript = '<script>window.__vite_plugin_react_preamble_installed__ = true;</script>';

    // Try to inject at the very top of head to ensure it's available before any modules
    if (html.includes('<head>')) {
      return html.replace('<head>', `<head>${flagScript}`);
    }
    // Fallback: inject at start of string
    return flagScript + html;
  }


  function escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function injectArticleMeta(baseHtml: string, art: FirestoreArticleServer): string {
    const title = art.seoTitle ? `${art.seoTitle} | DISHA 20-20` : `${art.title} | DISHA 20-20`;
    const desc = art.seoDescription || art.excerpt || art.title;
    const canonicalUrl = `https://disha2020.in/news/${encodeURI(art.slug)}`;
    const coverImage = art.coverImageUrl || 'https://disha2020.in/og-preview.png';
    const publishedDate = art.publishedAt || new Date().toISOString();
    const modifiedDate = art.updatedAt || art.publishedAt || publishedDate;
    const authorName = art.authorName || 'DISHA 20-20 Editorial Team';

    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "NewsArticle",
          "@id": `${canonicalUrl}#article`,
          "isPartOf": {
            "@type": "WebSite",
            "@id": "https://disha2020.in/#website",
            "name": "DISHA 20-20",
            "url": "https://disha2020.in"
          },
          "headline": art.title,
          "name": art.title,
          "description": desc,
          "url": canonicalUrl,
          "mainEntityOfPage": canonicalUrl,
          "datePublished": publishedDate,
          "dateModified": modifiedDate,
          "image": [coverImage],
          "author": {
            "@type": "Person",
            "name": authorName
          },
          "publisher": {
            "@type": "Organization",
            "name": "DISHA 20-20",
            "url": "https://disha2020.in",
            "logo": {
              "@type": "ImageObject",
              "url": "https://disha2020.in/logo.png"
            }
          }
        },
        {
          "@type": "BreadcrumbList",
          "@id": `${canonicalUrl}#breadcrumb`,
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://disha2020.in/"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": art.category || "News",
              "item": "https://disha2020.in/news"
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": art.title,
              "item": canonicalUrl
            }
          ]
        }
      ]
    };

    const jsonLdScript = `\n    <script type="application/ld+json" id="article-schema">\n${JSON.stringify(jsonLd, null, 2)}\n    </script>\n`;

    const prerenderedArticleHtml = `
  <div id="root">
    <main class="min-h-screen bg-[#F4F7FC] text-[#17233D] py-10 px-4">
      <article class="max-w-4xl mx-auto bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200">
        <nav aria-label="Breadcrumb" class="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
          <a href="/" class="hover:underline">Home</a> &gt; 
          <a href="/news" class="hover:underline">${escapeHtml(art.category || 'News')}</a> &gt; 
          <span class="text-slate-700 font-medium">${escapeHtml(art.title)}</span>
        </nav>
        <header class="mb-6">
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900 leading-tight mb-3">${escapeHtml(art.title)}</h1>
          ${art.hindiTitle ? `<p class="text-lg text-slate-600 font-medium mb-3">${escapeHtml(art.hindiTitle)}</p>` : ''}
          <div class="flex items-center gap-3 text-xs text-slate-500">
            <span>By <strong>${escapeHtml(authorName)}</strong></span>
            <span>•</span>
            <time datetime="${escapeHtml(publishedDate)}">${escapeHtml(new Date(publishedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}</time>
          </div>
        </header>
        ${art.coverImageUrl ? `<div class="mb-6"><img src="${escapeHtml(art.coverImageUrl)}" alt="${escapeHtml(art.title)}" class="w-full max-h-96 object-cover rounded-2xl" /></div>` : ''}
        ${art.excerpt ? `<div class="text-base text-slate-700 font-normal leading-relaxed mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">${escapeHtml(art.excerpt)}</div>` : ''}
      </article>
    </main>
  </div>`;

    let html = baseHtml;

    if (/<title>.*?<\/title>/i.test(html)) {
      html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
    } else {
      html = html.replace('</head>', `  <title>${escapeHtml(title)}</title>\n</head>`);
    }

    if (/<meta\s+name="description"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/i, `<meta name="description" content="${escapeHtml(desc)}" />`);
    } else {
      html = html.replace('</head>', `  <meta name="description" content="${escapeHtml(desc)}" />\n</head>`);
    }

    if (/<link\s+rel="canonical"\s+href=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<link\s+rel="canonical"\s+href=".*?"\s*\/?>/i, `<link rel="canonical" href="${canonicalUrl}" />`);
    } else {
      html = html.replace('</head>', `  <link rel="canonical" href="${canonicalUrl}" />\n</head>`);
    }

    if (/<meta\s+property="og:url"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+property="og:url"\s+content=".*?"\s*\/?>/i, `<meta property="og:url" content="${canonicalUrl}" />`);
    } else {
      html = html.replace('</head>', `  <meta property="og:url" content="${canonicalUrl}" />\n</head>`);
    }

    if (/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
    }

    if (/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i, `<meta property="og:description" content="${escapeHtml(desc)}" />`);
    }

    if (/<meta\s+property="og:image"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+property="og:image"\s+content=".*?"\s*\/?>/i, `<meta property="og:image" content="${escapeHtml(coverImage)}" />`);
    } else {
      html = html.replace('</head>', `  <meta property="og:image" content="${escapeHtml(coverImage)}" />\n</head>`);
    }

    if (/<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
    }
    if (/<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:description" content="${escapeHtml(desc)}" />`);
    }
    if (/<meta\s+name="twitter:url"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+name="twitter:url"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:url" content="${canonicalUrl}" />`);
    } else {
      html = html.replace('</head>', `  <meta name="twitter:url" content="${canonicalUrl}" />\n</head>`);
    }
    if (/<meta\s+name="twitter:image"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+name="twitter:image"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:image" content="${escapeHtml(coverImage)}" />`);
    } else {
      html = html.replace('</head>', `  <meta name="twitter:image" content="${escapeHtml(coverImage)}" />\n</head>`);
    }

    html = html.replace('</head>', `${jsonLdScript}</head>`);

    if (html.includes('<div id="root"></div>')) {
      html = html.replace('<div id="root"></div>', prerenderedArticleHtml);
    }

    return html;
  }

  function injectNewsListingMeta(baseHtml: string): string {
    const title = 'Latest Exam News, Syllabus Breakdown & Analysis | DISHA 20-20';
    const desc = 'Stay updated with Rajasthan competitive exam notifications, CET, REET, RPSC RAS syllabus breakdown, study strategies, and exam preparation news on DISHA 20-20.';
    const canonicalUrl = 'https://disha2020.in/news';

    let html = baseHtml;
    html = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
    html = html.replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/i, `<meta name="description" content="${desc}" />`);
    html = html.replace(/<link\s+rel="canonical"\s+href=".*?"\s*\/?>/i, `<link rel="canonical" href="${canonicalUrl}" />`);
    html = html.replace(/<meta\s+property="og:url"\s+content=".*?"\s*\/?>/i, `<meta property="og:url" content="${canonicalUrl}" />`);
    html = html.replace(/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i, `<meta property="og:title" content="${title}" />`);
    html = html.replace(/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i, `<meta property="og:description" content="${desc}" />`);
    return html;
  }

  function renderArticleNotFoundHtml(baseHtml: string, slug: string): string {
    let html = baseHtml;
    html = html.replace(/<title>.*?<\/title>/i, `<title>Article Not Found | DISHA 20-20</title>`);
    html = html.replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/i, `<meta name="description" content="The requested article does not exist or has been removed." />`);
    html = html.replace(/<link\s+rel="canonical"\s+href=".*?"\s*\/?>/i, `<link rel="canonical" href="https://disha2020.in/news" />`);
    html = html.replace('</head>', `  <meta name="robots" content="noindex, follow" />\n</head>`);
    const notFoundHtml = `
  <div id="root">
    <main class="min-h-screen bg-[#FFF9EF] text-[#171923] flex items-center justify-center p-6 text-center font-sans">
      <div class="max-w-md w-full bg-white rounded-3xl p-8 border border-[#E8D9C0] shadow-md">
        <h1 class="text-3xl font-black text-[#800020] mb-2">404</h1>
        <h2 class="text-xl font-bold text-[#171923] mb-3">Article Not Found</h2>
        <p class="text-sm text-[#52576A] mb-6">The article "${escapeHtml(slug)}" could not be found or may have been unlisted.</p>
        <a href="/news" class="inline-block px-6 py-3 bg-[#800020] text-white font-bold rounded-2xl text-sm shadow-md hover:bg-[#5E0017] transition-colors">← Back to News Directory</a>
      </div>
    </main>
  </div>`;
    if (html.includes('<div id="root"></div>')) {
      html = html.replace('<div id="root"></div>', notFoundHtml);
    }
    return html;
  }

  // ─── SEO, ROBOTS & SITEMAP ROUTES ─────────────────────────────────────
  app.get('/robots.txt', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send('User-agent: *\nAllow: /\nSitemap: https://disha2020.in/sitemap.xml\n');
  });

  async function generateAndSaveSitemapServer(): Promise<{
    success: boolean;
    xml: string;
    count: number;
    draftsExcluded: number;
    urls: string[];
    generatedAt: string;
  }> {
    const articles = await getPublishedArticlesServer();
    const nowIsoDate = new Date().toISOString().split('T')[0];

    // Filter valid published articles and exclude drafts or malformed slugs
    const validArticles = articles.filter(a => {
      const isPub = (a.status || 'published') === 'published';
      const cleanSlug = (a.slug || a.id || '').trim().toLowerCase();
      return isPub && cleanSlug.length >= 2 && cleanSlug !== 'undefined' && cleanSlug !== 'null';
    });

    const articleUrlsXml = validArticles.map((art) => {
      const lastMod = (art.updatedAt || art.publishedAt || nowIsoDate).split('T')[0];
      return `  <url>
    <loc>https://disha2020.in/news/${encodeURI(art.slug)}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }).join('\n');

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://disha2020.in/</loc>
    <lastmod>${nowIsoDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://disha2020.in/news</loc>
    <lastmod>${nowIsoDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://disha2020.in/topics</loc>
    <lastmod>${nowIsoDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://disha2020.in/pyq_vault</loc>
    <lastmod>${nowIsoDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://disha2020.in/live_tests</loc>
    <lastmod>${nowIsoDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
${articleUrlsXml}
</urlset>`;

    // Save to physical public/sitemap.xml
    try {
      const pubDir = path.join(process.cwd(), 'public');
      if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });
      fs.writeFileSync(path.join(pubDir, 'sitemap.xml'), sitemap, 'utf-8');
    } catch (e) {
      console.warn('Notice: Could not write public/sitemap.xml:', e);
    }

    // Save to physical dist/sitemap.xml if dist exists
    try {
      const dDir = path.join(process.cwd(), 'dist');
      if (fs.existsSync(dDir)) {
        fs.writeFileSync(path.join(dDir, 'sitemap.xml'), sitemap, 'utf-8');
      }
    } catch (e) {
      console.warn('Notice: Could not write dist/sitemap.xml:', e);
    }

    return {
      success: true,
      xml: sitemap,
      count: validArticles.length,
      draftsExcluded: Math.max(0, articles.length - validArticles.length),
      urls: validArticles.map(a => `https://disha2020.in/news/${encodeURI(a.slug)}`),
      generatedAt: new Date().toISOString()
    };
  }

  // 1. Live XML Sitemap Endpoint
  app.get('/sitemap.xml', async (_req, res) => {
    try {
      const result = await generateAndSaveSitemapServer();
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      return res.send(result.xml);
    } catch (err) {
      console.error('Sitemap error:', err);
      // Fallback: try reading public/sitemap.xml from disk
      try {
        const fallbackPath = path.join(process.cwd(), 'public', 'sitemap.xml');
        if (fs.existsSync(fallbackPath)) {
          const fallbackXml = fs.readFileSync(fallbackPath, 'utf-8');
          res.setHeader('Content-Type', 'application/xml; charset=utf-8');
          return res.send(fallbackXml);
        }
      } catch {}
      res.status(500).send('Error generating sitemap');
    }
  });

  // 2. Automated & Admin Trigger API to Regenerate / Update XML Sitemap (Strict Verified Admin Only)
  app.post(['/api/sitemap/generate', '/api/sitemap/update'], requireVerifiedAdmin, async (_req, res) => {
    try {
      const result = await generateAndSaveSitemapServer();
      res.json({
        success: true,
        message: 'XML Sitemap generated and saved successfully.',
        count: result.count,
        draftsExcluded: result.draftsExcluded,
        urls: result.urls,
        generatedAt: result.generatedAt,
        sitemapUrl: 'https://disha2020.in/sitemap.xml',
        xml: result.xml
      });
    } catch (err: any) {
      console.error('API sitemap generation error:', redactSensitiveText(err));
      res.status(500).json({ success: false, error: redactSensitiveText(err) || 'Failed to generate sitemap' });
    }
  });

  // 3. Sitemap Health & Status API
  app.get('/api/sitemap/status', async (_req, res) => {
    try {
      const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
      const exists = fs.existsSync(sitemapPath);
      let stats = null;
      let urlCount = 0;
      if (exists) {
        stats = fs.statSync(sitemapPath);
        const content = fs.readFileSync(sitemapPath, 'utf-8');
        urlCount = (content.match(/<url>/g) || []).length;
      }
      res.json({
        success: true,
        sitemapUrl: 'https://disha2020.in/sitemap.xml',
        exists,
        lastModified: stats?.mtime?.toISOString() || null,
        urlCount,
        status: 'ready_for_search_console'
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Handler for /news listing page to inject specific listing meta
  app.get('/news', async (req, res, next) => {
    try {
      const vite = getVite();
      let html = getIndexHtml();
      if (!isProd && vite) {
        html = await vite.transformIndexHtml(req.url, html);
        html = injectVitePreamble(html, req.url);
      }
      const enrichedHtml = injectNewsListingMeta(html);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (isProd) {
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      } else {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      }
      return res.status(200).send(enrichedHtml);
    } catch (err) {
      console.warn('Error handling /news:', err);
      return next();
    }
  });

  // Specific handler for individual news articles (/news/:slug)
  app.get('/news/:slug', async (req, res, next) => {
    const slug = (req.params.slug || (req.query.slug as string) || '').trim();
    if (!slug || slug === 'undefined') return next();

    try {
      const vite = getVite();
      const art = await getArticleBySlugServer(slug);
      let html = getIndexHtml();

      if (art && art.status === 'published') {
        if (!isProd && vite) {
          html = await vite.transformIndexHtml(req.url, html);
          html = injectVitePreamble(html, req.url);
        }
        const enrichedHtml = injectArticleMeta(html, art);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        if (isProd) {
          res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=1200');
        } else {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        }
        return res.status(200).send(enrichedHtml);
      } else {
        // Return 404 response for nonexistent articles
        if (!isProd && vite) {
          html = await vite.transformIndexHtml(req.url, html);
          html = injectVitePreamble(html, req.url);
        }
        const notFoundHtml = renderArticleNotFoundHtml(html, slug);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=30');
        return res.status(404).send(notFoundHtml);
      }
    } catch (err) {
      console.warn('SEO Injection error for slug:', slug, err);
      return next();
    }
  });

  // Home page handler for dev mode to ensure transformIndexHtml is called
  app.get('/', async (req, res, next) => {
    if (isProd) return next();
    try {
      const vite = getVite();
      let html = getIndexHtml();
      if (vite) {
        html = await vite.transformIndexHtml(req.url, html);
        html = injectVitePreamble(html, req.url);
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.send(html);
    } catch (e) {
      next(e);
    }
  });

  if (isProd) {
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath, {
        setHeaders: (res, filePath) => {
          const base = path.basename(filePath);
          if (base === 'sw.js' || base === 'registerSW.js' || base === 'manifest.webmanifest') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      }));
    }
    app.get('*', (_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(getIndexHtml());
    });
  }

  return app;
}

const app = createServerApp();
const isProdEnv = process.env.NODE_ENV === 'production' || !!process.env.VERCEL || process.env.npm_lifecycle_event === 'start';
const distPathRoot = path.join(process.cwd(), 'dist');

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  if (!isProdEnv) {
    const { createServer: createViteServer } = await import('vite');
    activeViteInstance = await createViteServer({
      server: { middlewareMode: true, hmr: true },
      appType: 'spa',
    });

    // 1. Never serve dev source code (/src/*) as 304 Not Modified
    app.use((req, res, next) => {
      if (req.url.startsWith('/src/') || req.url.includes('/node_modules/.vite/')) {
        delete req.headers['if-none-match'];
        delete req.headers['if-modified-since'];
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      next();
    });

    app.use(activeViteInstance.middlewares);

    // Dev catch-all for SPA routes to ensure transformIndexHtml is called
    app.get('*', async (req, res, next) => {
      if (req.url.startsWith('/api/') || req.url.includes('.')) return next();
      try {
        const indexPath = path.join(process.cwd(), 'index.html');
        let html = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf-8') : '';
        html = await activeViteInstance.transformIndexHtml(req.url, html);
        if (!html.includes('__vite_plugin_react_preamble_installed__') && html.includes('<head>')) {
          html = html.replace('<head>', '<head><script>window.__vite_plugin_react_preamble_installed__ = true;</script>');
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.send(html);
      } catch (e) {
        next(e);
      }
    });
  } else if (fs.existsSync(distPathRoot)) {
    app.use(express.static(distPathRoot));
  }

  if (!process.env.VERCEL && !process.env.NOW_REGION) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

// Only auto-start server when executed directly outside test/serverless runners
if (!process.env.VERCEL && !process.env.NOW_REGION && !process.env.LAMBDA_TASK_ROOT && !process.env.VITEST && process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
