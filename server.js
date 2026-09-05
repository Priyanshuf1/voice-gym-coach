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
    const check = await fetch(`${GEMINI_API_URL}/models`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer sk-gemini' },
      signal: AbortSignal.timeout(1500)
    });
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

// AI Coach Conversational Intelligence (Powered by gemini-web2api & athletic biomechanics)
app.post('/api/coach-ai', async (req, res) => {
  const { prompt, workoutContext = {} } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const currentExercise = workoutContext.exerciseName || 'Push-ups';
  const currentSet = workoutContext.set || 1;
  const currentState = workoutContext.state || 'ACTIVE';

  const systemMessage = `You are Coach Celeste, an elite Olympic voice gym coach. The user is currently mid-workout (hands busy, listening via headphones).
Current Exercise: ${currentExercise}, Set: ${currentSet}, State: ${currentState}.
RULES:
1. Answer in 1 to 2 punchy, spoken sentences (MAX 25 words).
2. If the user asks about form (e.g. "is my form correct?", "check my form", "how do I do this?"):
   - For Push-ups: Advise keeping elbows at 45 degrees, glutes squeezed tight, and chest touching the deck.
   - For Squats: Advise driving knees out over toes, chest tall, and pressing through heels.
   - For Jumping Jacks: Advise landing softly on balls of feet with light knees.
   - For Planks: Advise bracing abs like taking a punch, straight line from neck to heels.
3. NEVER use markdown, bullet points, asterisks, or emojis—this text will be spoken out loud by TTS.
4. Be inspiring, direct, and authoritative.`;

  try {
    // Attempt call to gemini-web2api (OpenAI-compatible format on port 8081)
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
        temperature: 0.6,
        max_tokens: 80
      }),
      signal: AbortSignal.timeout(4500)
    });

    if (geminiRes.ok) {
      const data = await geminiRes.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (reply) {
        // Clean out any accidental markdown or quotes
        const cleanReply = reply.replace(/[*_#`]/g, '').trim();
        return res.json({ reply: cleanReply, source: 'gemini-web2api' });
      }
    }
  } catch (err) {
    // Graceful fallback to expert athletic biomechanics if network delays
  }

  // Fast athletic coach biomechanics engine for instantaneous spoken feedback
  const lower = prompt.toLowerCase();
  let fallbackReply = "Keep your core braced tight and maintain full control through every rep!";

  if (lower.includes('form') || lower.includes('technique') || lower.includes('doing') || lower.includes('correct') || lower.includes('right')) {
    if (currentExercise.toLowerCase().includes('push')) {
      fallbackReply = "Tuck your elbows to forty-five degrees, squeeze your glutes, and lower until your chest taps the floor. Drive hard!";
    } else if (currentExercise.toLowerCase().includes('squat')) {
      fallbackReply = "Keep your chest high, drive your knees outward, and press through your heels to lockout at the top!";
    } else if (currentExercise.toLowerCase().includes('plank')) {
      fallbackReply = "Brace your abs like taking a punch. Don't let your lower back sag, keep a straight line neck to heel!";
    } else if (currentExercise.toLowerCase().includes('jump') || currentExercise.toLowerCase().includes('burpee')) {
      fallbackReply = "Stay springy and land soft on the balls of your feet. Keep a rhythm and breathe smoothly!";
    } else {
      fallbackReply = "Keep your chest tall, core engaged, and focus on clean control over speed. Perfect form builds real power!";
    }
  } else if (lower.includes('pain') || lower.includes('hurt') || lower.includes('shoulder') || lower.includes('knee') || lower.includes('wrist')) {
    fallbackReply = "If you feel sharp joint pain, pause right now and shake it out. Safety comes first, athlete.";
  } else if (lower.includes('breathe') || lower.includes('breath') || lower.includes('air') || lower.includes('out of breath')) {
    fallbackReply = "Inhale deep through your nose on the way down, and exhale with power as you push through the rep!";
  } else if (lower.includes('motivat') || lower.includes('tired') || lower.includes('cant') || lower.includes("can't") || lower.includes('heavy') || lower.includes('hard')) {
    fallbackReply = "This is where champions are built. You've got more in the tank than you think, let's finish this set!";
  } else if (lower.includes('water') || lower.includes('drink') || lower.includes('thirsty')) {
    fallbackReply = "Take a quick sip, keep your rest brief, and let's jump right back into the action.";
  }

  return res.json({ reply: fallbackReply, source: 'athletic-biomechanics' });
});

// Full Semantic & Slang Intent Engine (Beyond 4 Hardcoded Commands)
app.post('/api/intent-ai', async (req, res) => {
  const { utterance = '', workoutContext = {} } = req.body;
  const raw = utterance.trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return res.status(400).json({ error: 'Utterance is required' });
  }

  // 1. Phonetic & Colloquial Slang Normalization Rules (<1ms)
  // Catch mispronunciations (paws, skipt), regional slang (hold up, chill, hit me), and conversational intent
  if (
    lower.includes('paws') || lower.includes('pos') || lower.includes('hault') ||
    lower.includes('hold up') || lower.includes('hold on') || lower.includes('hol up') ||
    lower.includes('hol on') || lower.includes('gimme a sec') || lower.includes('gimme a min') ||
    lower.includes('wait up') || lower.includes('chill') || lower.includes('time out') ||
    lower.includes('take a break') || lower.includes('need water') || lower.includes('let me breathe') ||
    lower.includes('dying') || lower.includes('stop') || lower.includes('pause')
  ) {
    return res.json({
      action: 'PAUSE',
      spokenFeedback: 'Workout paused. Take your time and breathe.',
      source: 'phonetic-engine'
    });
  }

  if (
    lower.includes('skipt') || lower.includes('skip') || lower.includes('next set') ||
    lower.includes('next sit') || lower.includes('next round') || lower.includes('hit me') ||
    lower.includes('bring it on') || lower.includes('ready to roll') || lower.includes('im good') ||
    lower.includes("i'm good") || lower.includes('lets go') || lower.includes("let's go") ||
    lower.includes('cut the rest') || lower.includes('cut rest') || lower.includes('im ready') ||
    lower.includes("i'm ready") || lower.includes('start set')
  ) {
    return res.json({
      action: 'SKIP_REST',
      spokenFeedback: 'Skipping rest! Starting the next set now.',
      source: 'phonetic-engine'
    });
  }

  // Add time (regex check for numbers like 10, 15, 20, 30 seconds or 'minute')
  const addMatch = lower.match(/(?:add|need|gimme|give me|more)\s*(\d+|ten|fifteen|twenty|thirty|minute)?\s*(?:sec|second|more|time|rest)/);
  if (addMatch || lower.includes('more time') || lower.includes('more rest') || lower.includes('longer rest')) {
    let secs = 10;
    if (lower.includes('15') || lower.includes('fifteen')) secs = 15;
    else if (lower.includes('20') || lower.includes('twenty')) secs = 20;
    else if (lower.includes('30') || lower.includes('thirty')) secs = 30;
    else if (lower.includes('minute') || lower.includes('60')) secs = 60;

    return res.json({
      action: 'ADD_REST',
      parameter: secs,
      spokenFeedback: `Added ${secs} more seconds to rest. Catch your breath!`,
      source: 'phonetic-engine'
    });
  }

  if (
    lower.includes('switch') || lower.includes('next exercise') || lower.includes('skip exercise') ||
    lower.includes('different exercise') || lower.includes('what is next') || lower.includes("what's next") ||
    lower.includes('move on') || lower.includes('change workout') || lower.includes('swap')
  ) {
    return res.json({
      action: 'NEXT_EXERCISE',
      spokenFeedback: 'Moving on to the next exercise!',
      source: 'phonetic-engine'
    });
  }

  // START command (Immediate start / begin / start the gym)
  if (
    lower.includes('start') || lower.includes('begin') || lower.includes('lets go') ||
    lower.includes("let's go") || lower.includes('start the gym') || lower.includes('start workout') ||
    lower.includes('get started') || lower.includes('hit it') || lower.includes('go for instant')
  ) {
    return res.json({
      action: 'START',
      spokenFeedback: 'Starting workout! Let\'s crush this session!',
      source: 'phonetic-engine'
    });
  }

  if (
    lower.includes('resume') || lower.includes('continue') || lower.includes('back at it') ||
    lower.includes('start again') || lower.includes('keep going')
  ) {
    return res.json({
      action: 'RESUME',
      spokenFeedback: 'Resuming workout! Let\'s finish strong.',
      source: 'phonetic-engine'
    });
  }

  // 2. High-Level AI LLM Classification (Gemini-Web2API)
  // For freeform conversational requests, complaints, queries, or coaching questions
  try {
    const promptSystem = `You are the AI brain of a hands-free gym coach. Current exercise: ${workoutContext.exerciseName || 'Push-ups'}, Set ${workoutContext.set || 1}, State: ${workoutContext.state || 'ACTIVE'}.
The user said: "${raw}".
Classify into ONE action:
- "START" (wants to start workout, begin, start the gym, or get going)
- "PAUSE" (wants to stop, rest, freeze, catch breath, get water)
- "SKIP_REST" (wants to start next set, skip rest, says ready)
- "ADD_REST" (wants more rest time)
- "NEXT_EXERCISE" (wants to skip or change exercise)
- "RESUME" (wants to continue from paused)
- "COACH_ADVICE" (asking fitness question, form tip, pain, technique, or motivation)

Respond strictly with a JSON object:
{"action": "...", "parameter": 10, "spokenFeedback": "1-2 brief spoken sentences under 20 words for the coach to say out loud"}`;

    const geminiRes = await fetch(`${GEMINI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-gemini'
      },
      body: JSON.stringify({
        model: 'gemini-3.6-flash',
        messages: [{ role: 'system', content: promptSystem }],
        temperature: 0.2,
        max_tokens: 80
      }),
      signal: AbortSignal.timeout(4000)
    });

    if (geminiRes.ok) {
      const data = await geminiRes.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.json({
          action: parsed.action || 'COACH_ADVICE',
          parameter: parsed.parameter || 10,
          spokenFeedback: parsed.spokenFeedback || 'Stay focused and keep pushing!',
          source: 'gemini-brain'
        });
      }
    }
  } catch (err) {
    // Fallback if LLM unavailable
  }

  // 3. Fallback to rich conversational coach advice based on context
  const currentEx = workoutContext.exerciseName || 'Push-ups';
  let smartAdvice = "Keep your breathing steady and your form tight. You've got this!";

  if (lower.includes('form') || lower.includes('technique') || lower.includes('doing') || lower.includes('correct') || lower.includes('right')) {
    if (currentEx.toLowerCase().includes('push')) {
      smartAdvice = "Tuck your elbows to forty-five degrees, keep a tight plank, and touch your chest down. Perfect form!";
    } else if (currentEx.toLowerCase().includes('squat')) {
      smartAdvice = "Chest up, drive your knees outward, and press through your heels to stand tall!";
    } else {
      smartAdvice = "Lock in your core, maintain controlled tempo, and own every inch of the repetition!";
    }
  }

  return res.json({
    action: 'COACH_ADVICE',
    spokenFeedback: smartAdvice,
    source: 'athletic-biomechanics'
  });
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
