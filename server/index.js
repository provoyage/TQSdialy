import express from 'express';
import admin from 'firebase-admin';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const ANALYSIS_VERSION = 'soos-v1';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
const ANALYSIS_TIMEOUT_MS = Number(process.env.ANALYSIS_TIMEOUT_MS || 6000);
const EMBEDDING_TIMEOUT_MS = Number(process.env.EMBEDDING_TIMEOUT_MS || 5000);
const FIRESTORE_WRITE_TIMEOUT_MS = Number(process.env.FIRESTORE_WRITE_TIMEOUT_MS || 1500);
const SIMILAR_QUERY_TIMEOUT_MS = Number(process.env.SIMILAR_QUERY_TIMEOUT_MS || 1500);

function initAdmin() {
  if (admin.apps.length) return;
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    return;
  }
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

initAdmin();
const db = admin.firestore();

function cosineSimilarity(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function hashEmbedding(text, size = 64) {
  const vec = new Array(size).fill(0);
  const normalized = String(text || '').toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    vec[i % size] += (code % 31) / 31;
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + (v * v), 0)) || 1;
  return vec.map((v) => v / norm);
}

function withTimeout(promise, ms, label) {
  if (!ms || ms <= 0) return promise;
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(label || 'timeout')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function computeEmbedding(text) {
  if (!GEMINI_API_KEY) return hashEmbedding(text);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] }
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      throw new Error(`Embedding API Error: ${res.status}`);
    }
    const data = await res.json();
    return data.embedding?.values || hashEmbedding(text);
  } catch (err) {
    return hashEmbedding(text);
  } finally {
    clearTimeout(timer);
  }
}

function basicAnalysis(text) {
  const raw = String(text || '').trim();
  const sentences = raw.split(/\n|。|\.|!/).filter(Boolean);
  const facts = sentences.slice(0, 2).map((s) => s.trim()).filter(Boolean);
  const story = sentences.slice(2, 5).map((s) => s.trim()).filter(Boolean);
  const triggers = raw.replace(/[^\w\u3040-\u30ff\u4e00-\u9faf\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1).slice(0, 5);

  return {
    facts,
    story,
    emotions: [{
      label: 'joy',
      intensity_0_100: 45,
      certainty_0_1: 0.3,
      valence: 'positive',
      arousal: 'medium'
    }],
    patterns: [{
      pattern_id: 'inference_jump',
      label: '結論飛躍',
      confidence_0_1: 0.25,
      evidence_quotes: sentences.slice(0, 1)
    }],
    triggers,
    observation_comment: '観察: いくつかの出来事が一つの結論にまとめられている可能性があります。'
  };
}

async function analyzeWithGemini(text) {
  if (!GEMINI_API_KEY) return basicAnalysis(text);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const prompt = `
You are a professional counselor. Extract structured observations only. No diagnosis or definitive labels. Use observational language.
Return JSON only with this schema:
{
  "facts": ["..."],
  "story": ["..."],
  "emotions": [{"label":"joy","intensity_0_100":0,"certainty_0_1":0,"valence":"positive|negative|mixed","arousal":"low|medium|high"}],
  "patterns": [{"pattern_id":"label","label":"label","confidence_0_1":0,"evidence_quotes":["..."]}],
  "triggers": ["..."],
  "observation_comment": "..."
}
Constraints:
- No medical diagnosis.
- Avoid definitive language (use "可能性"-style).
- Always include certainty/confidence fields.

Diary:
"""
${text}
"""
  `;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`Analysis API Error: ${res.status}`);
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
      story: Array.isArray(parsed.story) ? parsed.story : [],
      emotions: Array.isArray(parsed.emotions) ? parsed.emotions : [],
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
      triggers: Array.isArray(parsed.triggers) ? parsed.triggers : [],
      observation_comment: parsed.observation_comment || ''
    };
  } catch (err) {
    return basicAnalysis(text);
  } finally {
    clearTimeout(timer);
  }
}

async function findSimilarEntries(userId, entryId, embedding, limit = 3) {
  const snapshot = await withTimeout(
    db.collection('diary_embeddings').where('user_id', '==', userId).get(),
    SIMILAR_QUERY_TIMEOUT_MS,
    'similar_query_timeout'
  );
  const scored = [];
  snapshot.forEach((doc) => {
    if (doc.id === entryId) return;
    const data = doc.data();
    if (!Array.isArray(data.embedding)) return;
    const score = cosineSimilarity(embedding, data.embedding);
    scored.push({ entry_id: doc.id, score });
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

app.get('/api/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { entry_id, user_id, text, created_at } = req.body || {};
    if (!entry_id || !user_id || !text) {
      return res.status(400).json({ error: 'missing required fields' });
    }

    const [analysis, embedding] = await Promise.all([
      withTimeout(analyzeWithGemini(text), ANALYSIS_TIMEOUT_MS, 'analysis_timeout')
        .catch(() => basicAnalysis(text)),
      withTimeout(computeEmbedding(text), EMBEDDING_TIMEOUT_MS, 'embedding_timeout')
        .catch(() => hashEmbedding(text))
    ]);

    const analysisDoc = {
      entry_id,
      user_id,
      analysis_version: ANALYSIS_VERSION,
      facts: analysis.facts || [],
      story: analysis.story || [],
      emotions: analysis.emotions || [],
      patterns: analysis.patterns || [],
      triggers: analysis.triggers || [],
      observation_comment: analysis.observation_comment || '',
      created_at: created_at || new Date().toISOString()
    };

    let analysisSaved = false;
    let embeddingSaved = false;
    let analysisError = null;
    let embeddingError = null;

    const [analysisWrite, embeddingWrite] = await Promise.allSettled([
      withTimeout(
        db.collection('diary_analysis').doc(entry_id).set(analysisDoc, { merge: true }),
        FIRESTORE_WRITE_TIMEOUT_MS,
        'analysis_write_timeout'
      ),
      withTimeout(
        db.collection('diary_embeddings').doc(entry_id).set({
          entry_id,
          user_id,
          embedding,
          created_at: new Date().toISOString()
        }, { merge: true }),
        FIRESTORE_WRITE_TIMEOUT_MS,
        'embedding_write_timeout'
      )
    ]);

    analysisSaved = analysisWrite.status === 'fulfilled';
    embeddingSaved = embeddingWrite.status === 'fulfilled';
    if (!analysisSaved) analysisError = analysisWrite.reason?.message || 'analysis_save_failed';
    if (!embeddingSaved) embeddingError = embeddingWrite.reason?.message || 'embedding_save_failed';

    try {
      await withTimeout(
        db.collection('diary_entries').doc(entry_id).set({
          meta: {
            analysis_status: 'complete',
            analysis_version: ANALYSIS_VERSION
          }
        }, { merge: true }),
        1000,
        'meta_write_timeout'
      );
    } catch (err) {
      // Non-fatal metadata update
    }

    let similar = [];
    try {
      similar = await findSimilarEntries(user_id, entry_id, embedding, 3);
    } catch (err) {
      similar = [];
    }

    res.json({
      analysis: analysisDoc,
      embedding,
      similar,
      analysis_saved: analysisSaved,
      embedding_saved: embeddingSaved,
      analysis_error: analysisError,
      embedding_error: embeddingError
    });
  } catch (err) {
    res.status(500).json({ error: 'analysis_failed' });
  }
});

app.post('/api/analyze-lite', (req, res) => {
  try {
    const { entry_id, user_id, text, created_at } = req.body || {};
    if (!entry_id || !user_id || !text) {
      return res.status(400).json({ error: 'missing required fields' });
    }

    const analysis = basicAnalysis(text);
    const embedding = hashEmbedding(text);
    const analysisDoc = {
      entry_id,
      user_id,
      analysis_version: ANALYSIS_VERSION,
      facts: analysis.facts || [],
      story: analysis.story || [],
      emotions: analysis.emotions || [],
      patterns: analysis.patterns || [],
      triggers: analysis.triggers || [],
      observation_comment: analysis.observation_comment || '',
      created_at: created_at || new Date().toISOString()
    };

    res.json({ analysis: analysisDoc, embedding, similar: [], analysis_saved: false, embedding_saved: false });
  } catch (err) {
    res.status(500).json({ error: 'analysis_failed' });
  }
});

app.post('/api/similar', async (req, res) => {
  try {
    const { entry_id, user_id, limit } = req.body || {};
    if (!entry_id || !user_id) {
      return res.status(400).json({ error: 'missing required fields' });
    }
    const embedDoc = await db.collection('diary_embeddings').doc(entry_id).get();
    if (!embedDoc.exists) {
      return res.json({ similar: [] });
    }
    const data = embedDoc.data();
    const embedding = data.embedding || [];
    const similar = await findSimilarEntries(user_id, entry_id, embedding, limit || 3);
    res.json({ similar });
  } catch (err) {
    res.status(500).json({ error: 'similar_failed' });
  }
});

app.post('/api/summary', async (req, res) => {
  const { period_label, top_emotion, top_pattern, emotion_top5, pattern_top5 } = req.body || {};
  if (GEMINI_API_KEY) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      const prompt = `
Generate a short summary (1-2 lines) and 3 short themes from the aggregated counts.
Avoid definitive language. Use observational language.
Return JSON only:
{
  "summary": "...",
  "themes": ["...", "...", "..."]
}

Period: ${period_label}
Top emotion: ${top_emotion}
Top pattern: ${top_pattern}
Top emotions: ${JSON.stringify(emotion_top5 || [])}
Top patterns: ${JSON.stringify(pattern_top5 || [])}
      `;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (!resp.ok) throw new Error('summary_failed');
      const data = await resp.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      return res.json({
        summary: parsed.summary || '',
        themes: Array.isArray(parsed.themes) ? parsed.themes : []
      });
    } catch (err) {
      return res.status(500).json({ error: 'summary_failed' });
    }
  }

  const summary = `直近${period_label}では、感情は${top_emotion || '未集計'}、パターンは${top_pattern || '未集計'}が目立つ傾向です。`;
  const themes = [
    top_emotion ? `${top_emotion}の揺れ` : '感情の揺れ',
    top_pattern ? `${top_pattern}への注意` : '思考のパターン',
    '反応のトリガー'
  ];
  res.json({ summary, themes });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`Self-Observation OS API running on :${port}`);
});
