const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const GEMINI_API_URL = process.env.GEMINI_WEB2API_URL || 'http://localhost:8081/v1';

// Config check endpoint
app.get('/api/config', async (req, res) => {
  const apiKey = process.env.RIME_API_KEY;
  const isConfigured = !!apiKey && apiKey !== 'your_rime_api_key_here' && apiKey.trim().length > 10;
  
  // Check if gemini-web2api is running on port 8081
  let isGeminiWeb2ApiLive = false;
  try {
    const check = await fetch(`${GEMINI_API_URL}/models`, { method: 'GET', signal: AbortSignal.timeout(1000) });
    isGeminiWeb2ApiLive = check.ok;
  } catch (e) {
    isGeminiWeb2ApiLive = false;
  }

  res.json({
    isRimeConfigured: isConfigured,
    model: 'coda',
    defaultSpeaker: 'celeste',
    isGeminiWeb2ApiLive,
    geminiUrl: GEMINI_API_URL,
    voiceEngine: isConfigured ? 'Rime.ai TTS' : 'Fallback Local Speech (Add RIME_API_KEY to .env for Rime)'
  });
});

// AI Coach Conversational Intelligence (Powered by gemini-web2api)
app.post('/api/coach-ai', async (req, res) => {
  const { prompt, workoutContext = {} } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const systemMessage = `You are Coach Celeste, an elite athletic voice gym coach. The user is mid-workout (hands busy, listening via audio).
Current Exercise: ${workoutContext.exerciseName || 'Push-ups'}, Set ${workoutContext.set || 1}, State: ${workoutContext.state || 'Active'}.
RULES:
1. Answer in 1 to 2 punchy, spoken sentences (MAX 25 words).
2. NEVER use markdown, bullet points, asterisks, or emojis—this text will be spoken out loud by TTS.
3. Be inspiring, direct, and authoritative like an Olympic trainer.`;

  try {
    // Attempt call to gemini-web2api (OpenAI-compatible format)
    const geminiRes = await fetch(`${GEMINI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-gemini'
      },
      body: JSON.stringify({
        model: 'gemini-3.6-flash',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 80
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (geminiRes.ok) {
      const data = await geminiRes.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (reply) {
        return res.json({ reply, source: 'gemini-web2api' });
      }
    }
  } catch (err) {
    // Fallback to intelligent local coach heuristic if gemini-web2api server isn't running yet
  }

  // Fast offline heuristic coach replies for common workout inquiries
  const lower = prompt.toLowerCase();
  let fallbackReply = "Stay locked in! Breathe steady and push through this set.";

  if (lower.includes('pain') || lower.includes('hurt') || lower.includes('shoulder') || lower.includes('knee')) {
    fallbackReply = "If you feel sharp joint pain, pause immediately and shake it out. Safety comes first.";
  } else if (lower.includes('motivat') || lower.includes('tired') || lower.includes('can\'t') || lower.includes('hard')) {
    fallbackReply = "Every rep you do right now is where the real growth happens. Dig deep, you've got this!";
  } else if (lower.includes('breathe') || lower.includes('breath')) {
    fallbackReply = "Inhale deep on the way down, and exhale with power as you push up!";
  } else if (lower.includes('form') || lower.includes('technique')) {
    fallbackReply = "Keep your core braced tight and maintain full control through the entire range of motion.";
  }

  return res.json({ reply: fallbackReply, source: 'coach-heuristic' });
});

// Proxy endpoint for Rime.ai Text-To-Speech
app.post('/api/tts', async (req, res) => {
  const { text, speaker = 'celeste', modelId = 'coda' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required for TTS synthesis.' });
  }

  const apiKey = process.env.RIME_API_KEY;
  const isConfigured = !!apiKey && apiKey !== 'your_rime_api_key_here' && apiKey.trim().length > 10;

  if (!isConfigured) {
    return res.status(401).json({
      error: 'RIME_API_KEY not configured or using placeholder',
      fallback: true,
      text: text
    });
  }

  try {
    const rimeResponse = await fetch('https://users.rime.ai/v1/rime-tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'Accept': 'audio/wav'
      },
      body: JSON.stringify({
        text,
        speaker,
        modelId
      })
    });

    if (!rimeResponse.ok) {
      const errText = await rimeResponse.text();
      console.error(`[Rime API Error] Status: ${rimeResponse.status}, Details:`, errText);
      return res.status(rimeResponse.status).json({
        error: `Rime API Error (${rimeResponse.status})`,
        details: errText,
        fallback: true
      });
    }

    const audioBuffer = await rimeResponse.arrayBuffer();
    const contentType = rimeResponse.headers.get('content-type') || 'audio/wav';

    res.set({
      'Content-Type': contentType,
      'Content-Length': audioBuffer.byteLength,
      'Cache-Control': 'no-cache'
    });

    return res.send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error('[Server TTS Exception]', err);
    return res.status(500).json({
      error: 'Internal server error while contacting Rime TTS',
      details: err.message,
      fallback: true
    });
  }
});

// Acceptance Test 2: Pronunciation & Controlled Delivery Test Endpoint
app.post('/api/pronunciation-test', async (req, res) => {
  const { testId = 'test', variantA, variantB, speaker = 'celeste', modelId = 'coda' } = req.body;

  if (!variantA || !variantB) {
    return res.status(400).json({ error: 'Both variantA and variantB are required.' });
  }

  const apiKey = process.env.RIME_API_KEY;
  const isConfigured = !!apiKey && apiKey !== 'your_rime_api_key_here' && apiKey.trim().length > 10;

  const fs = require('fs');
  const evidenceDir = path.join(__dirname, 'public', 'pronunciation_evidence');
  if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

  const fileAPath = path.join(evidenceDir, `${testId}_variantA.wav`);
  const fileBPath = path.join(evidenceDir, `${testId}_variantB.wav`);

  if (!isConfigured) {
    return res.json({
      testId,
      variantA: { text: variantA, file: null, status: 'API key needed for live WAV file export' },
      variantB: { text: variantB, file: null, status: 'API key needed for live WAV file export' },
      recommendation: `Comparing "${variantA}" vs "${variantB}": Spelled-out variants and punctuation pauses provide superior cadence and prevent digit-by-digit TTS artifacts.`
    });
  }

  try {
    // 1. Fetch Variant A
    const resA = await fetch('https://users.rime.ai/v1/rime-tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'Accept': 'audio/wav'
      },
      body: JSON.stringify({ text: variantA, speaker, modelId })
    });
    const bufA = await resA.arrayBuffer();
    fs.writeFileSync(fileAPath, Buffer.from(bufA));

    // 2. Fetch Variant B
    const resB = await fetch('https://users.rime.ai/v1/rime-tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'Accept': 'audio/wav'
      },
      body: JSON.stringify({ text: variantB, speaker, modelId })
    });
    const bufB = await resB.arrayBuffer();
    fs.writeFileSync(fileBPath, Buffer.from(bufB));

    return res.json({
      testId,
      variantA: {
        text: variantA,
        url: `/pronunciation_evidence/${testId}_variantA.wav`,
        bytes: bufA.byteLength
      },
      variantB: {
        text: variantB,
        url: `/pronunciation_evidence/${testId}_variantB.wav`,
        bytes: bufB.byteLength
      },
      success: true
    });
  } catch (err) {
    console.error('[Pronunciation Test Error]', err);
    return res.status(500).json({ error: err.message });
  }
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🎙️ Voice Gym Coach server running at http://localhost:${PORT}`);
  console.log(`🔑 Rime API Key configured: ${process.env.RIME_API_KEY && process.env.RIME_API_KEY !== 'your_rime_api_key_here' ? 'YES' : 'NO (Add to .env)'}`);
});
