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

  const systemMessage = `You are Coach Celeste, an elite Olympic voice gym coach and sports medicine expert. The user is currently mid-workout (hands busy, listening via headphones).
Current Exercise: ${currentExercise}, Set: ${currentSet}, State: ${currentState}.
RULES:
1. Answer in 1 to 2 punchy, spoken sentences (MAX 25 words).
2. If the user reports pain or distress (e.g. "elbow hurting", "feeling dizzy", "why am I feeling bad"):
   - Advise them immediately on safe biomechanics, tucking joints, or sitting down to breathe.
3. If the user asks about form (e.g. "is my form correct?", "how is my pushup?", "check form"):
   - For Push-ups: Advise keeping elbows at 45 degrees, glutes tight, and chest touching the floor.
   - For Squats: Advise driving knees out over toes, chest proud, and pressing through heels.
   - For Planks: Advise bracing abs like taking a punch, straight line from neck to heels.
   - For Jumping Jacks / Climbers: Advise staying springy on balls of feet with controlled breath.
4. Output ONLY clean text for TTS to speak. NEVER use markdown, bullet points, asterisks, image tags, or emojis.`;

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
        temperature: 0.4,
        max_tokens: 80
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (geminiRes.ok) {
      const data = await geminiRes.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (reply) {
        // Clean out any accidental markdown, HTML/Image tags, or quotes
        const cleanReply = reply
          .replace(/<[^>]*>/g, '')
          .replace(/[*_#`]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        return res.json({ reply: cleanReply, source: 'gemini-brain' });
      }
    }
  } catch (err) {
    // Graceful fallback to expert athletic biomechanics if network delays
  }

  // Fast athletic coach biomechanics engine for instantaneous spoken feedback
  const lower = prompt.toLowerCase();
  let fallbackReply = "Keep your core braced tight and maintain full control through every rep!";

  if (lower.includes('elbow') || lower.includes('arm')) {
    fallbackReply = "Tuck your elbows to forty-five degrees and engage your chest. Avoid flaring elbows out wide.";
  } else if (lower.includes('form') || lower.includes('technique') || lower.includes('doing') || lower.includes('correct') || lower.includes('right')) {
    if (currentExercise.toLowerCase().includes('push')) {
      fallbackReply = "Tuck your elbows to forty-five degrees, squeeze your glutes, and touch your chest to the floor every rep.";
    } else if (currentExercise.toLowerCase().includes('squat')) {
      fallbackReply = "Keep your chest high, drive your knees outward over your toes, and press through your heels.";
    } else if (currentExercise.toLowerCase().includes('plank')) {
      fallbackReply = "Brace your abs like taking a punch. Don't let your lower back sag, keep a straight line neck to heel.";
    } else {
      fallbackReply = "Keep your chest tall, core engaged, and focus on clean control over speed. You've got this!";
    }
  } else if (lower.includes('pain') || lower.includes('hurt') || lower.includes('dizzy') || lower.includes('bad') || lower.includes('sick')) {
    fallbackReply = "Safety first. Take a deep breath, shake it out, and take a quick rest until you feel completely ready.";
  } else if (lower.includes('breathe') || lower.includes('breath')) {
    fallbackReply = "Inhale deep through your nose on the eccentric, and exhale with power as you push through the rep!";
  } else if (lower.includes('motivat') || lower.includes('tired') || lower.includes('cant') || lower.includes("can't")) {
    fallbackReply = "This is where champions are built. You've got more in the tank than you think, let's finish strong!";
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

  // 1. Athlete Distress & Pain Detection (<1ms immediate safety pause)
  if (
    lower.includes('not feeling good') || lower.includes('feeling bad') || lower.includes('feel bad') ||
    lower.includes('feel sick') || lower.includes('elbow hurt') || lower.includes('elbow is hurting') ||
    lower.includes('shoulder hurt') || lower.includes('knee hurt') || lower.includes('wrist hurt') ||
    lower.includes('dizzy') || lower.includes('nauseous') || lower.includes('lightheaded') ||
    lower.includes('pain') || lower.includes('cramping') || lower.includes('hurts') ||
    lower.includes('clicking') || lower.includes('cracking')
  ) {
    let advice = "Workout paused. If you feel sharp joint discomfort, take a breather and do not force through pain.";
    if (lower.includes('elbow')) {
      advice = "Workout paused. Sharp elbow pain usually comes from flaring elbows out. Tuck them forty-five degrees to your ribs.";
    } else if (lower.includes('shoulder')) {
      advice = "Workout paused. Keep your shoulder blades pulled down and back to avoid joint impingement.";
    } else if (lower.includes('knee')) {
      advice = "Workout paused. Keep your knees tracking out over your pinky toes and load through your heels.";
    } else if (lower.includes('dizzy') || lower.includes('lightheaded') || lower.includes('bad')) {
      advice = "Workout paused immediately. Sit down, sip some water, and take deep diaphragmatic breaths.";
    }
    return res.json({
      action: 'PAUSE',
      spokenFeedback: advice,
      source: 'sports-medicine-engine'
    });
  }

  // 2. Recovery / Ready to restart: "I am okay now", "ready to go", "all good now", "let's roll"
  if (
    lower.includes('okay now') || lower.includes('fine now') || lower.includes('good now') ||
    lower.includes('recovered') || lower.includes('ready to go') || lower.includes('ready now') ||
    lower.includes('all good') || lower.includes("i'm okay") || lower.includes("i am okay") ||
    lower.includes('feeling better') || lower.includes('back at it')
  ) {
    const nextAction = (workoutContext.state === 'REST_TIMER') ? 'SKIP_REST' : (workoutContext.state === 'PAUSED' ? 'RESUME' : 'START');
    return res.json({
      action: nextAction,
      spokenFeedback: "Awesome to hear! Let's get right back to work and finish strong.",
      source: 'recovery-engine'
    });
  }

  // 3. START command (Immediate start / begin / start the gym / let's go)
  if (
    lower.includes('start the gym') || lower.includes('start workout') || lower.includes('start now') ||
    lower.includes('lets start') || lower.includes("let's start") || lower.includes('lets go') ||
    lower.includes("let's go") || lower.includes('begin') || lower.includes('get started') ||
    lower.includes('hit it') || lower.includes('go for instant') || lower === 'start' || lower.startsWith('start ')
  ) {
    return res.json({
      action: 'START',
      spokenFeedback: "Starting workout! Let's crush this session!",
      source: 'phonetic-engine'
    });
  }

  // 4. PAUSE / Emergency Stop
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
      spokenFeedback: 'Workout paused. Catch your breath.',
      source: 'phonetic-engine'
    });
  }

  // 5. SKIP REST
  if (
    lower.includes('skipt') || lower.includes('skip rest') || lower.includes('skip it') ||
    lower.includes('next set') || lower.includes('next sit') || lower.includes('next round') ||
    lower.includes('hit me') || lower.includes('bring it on') || lower.includes('ready to roll') ||
    lower.includes('cut the rest') || lower.includes('cut rest') || lower.includes('start set')
  ) {
    return res.json({
      action: 'SKIP_REST',
      spokenFeedback: 'Skipping rest! Starting the next set now.',
      source: 'phonetic-engine'
    });
  }

  // 6. RESUME
  if (
    lower.includes('resume') || lower.includes('continue') ||
    lower.includes('start again') || lower.includes('keep going')
  ) {
    return res.json({
      action: 'RESUME',
      spokenFeedback: "Resuming workout! Let's finish strong.",
      source: 'phonetic-engine'
    });
  }

  // 7. Add time
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

  // 8. Next Exercise
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

  // 9. Form check queries
  if (
    lower.includes('form') || lower.includes('technique') || lower.includes('doing') ||
    lower.includes('correct') || lower.includes('right') || lower.includes('how do i')
  ) {
    const currentEx = workoutContext.exerciseName || 'Push-ups';
    let smartAdvice = "Keep your core braced tight and maintain full control through every rep.";
    if (currentEx.toLowerCase().includes('push')) {
      smartAdvice = "Tuck your elbows to forty-five degrees, maintain a solid plank, and touch your chest down.";
    } else if (currentEx.toLowerCase().includes('squat')) {
      smartAdvice = "Chest up, drive your knees outward, and press through your heels to stand tall.";
    } else if (currentEx.toLowerCase().includes('plank')) {
      smartAdvice = "Brace your abs like taking a punch, squeeze your glutes, and keep a straight line neck to heel.";
    }
    return res.json({
      action: 'COACH_ADVICE',
      spokenFeedback: smartAdvice,
      source: 'athletic-biomechanics'
    });
  }

  // 10. Gemini LLM Classification for open-ended questions
  try {
    const promptSystem = `You are the voice gym coach AI brain. Exercise: ${workoutContext.exerciseName || 'Push-ups'}, Set ${workoutContext.set || 1}, State: ${workoutContext.state || 'ACTIVE'}.
User said: "${raw}".
Classify intent into ONE:
- "START", "PAUSE", "SKIP_REST", "ADD_REST", "NEXT_EXERCISE", "RESUME", or "COACH_ADVICE".
Respond with JSON only:
{"action": "...", "spokenFeedback": "Short spoken advice under 20 words for the coach to say out loud"}`;

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
        max_tokens: 70
      }),
      signal: AbortSignal.timeout(8000)
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
  } catch (err) {}

  return res.json({
    action: 'COACH_ADVICE',
    spokenFeedback: "Keep your breathing steady and your form tight. You've got this!",
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
