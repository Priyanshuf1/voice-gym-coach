const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
}));

const GEMINI_API_URL = process.env.GEMINI_WEB2API_URL || 'http://localhost:8081/v1';
const GEMINI_DIRECT_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_DIRECT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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
    if (GEMINI_DIRECT_API_KEY) {
      // Direct Gemini REST API (fastest path — no local proxy hop)
      const geminiRes = await fetch(`${GEMINI_DIRECT_URL}?key=${GEMINI_DIRECT_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemMessage}\n\nUser: ${prompt}` }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 80 }
        }),
        signal: AbortSignal.timeout(2000)
      });
      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (reply) {
          const cleanReply = reply.replace(/<[^>]*>/g, '').replace(/[*_#`]/g, '').replace(/\s+/g, ' ').trim();
          return res.json({ reply: cleanReply, source: 'gemini-direct' });
        }
      }
    } else {
      // Fallback: web2api proxy on port 8081
      const geminiRes = await fetch(`${GEMINI_API_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk-gemini' },
        body: JSON.stringify({
          model: 'gemini-3.6-flash',
          messages: [{ role: 'system', content: systemMessage }, { role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 80
        }),
        signal: AbortSignal.timeout(2500)
      });
      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const reply = data.choices?.[0]?.message?.content?.trim();
        if (reply) {
          const cleanReply = reply.replace(/<[^>]*>/g, '').replace(/[*_#`]/g, '').replace(/\s+/g, ' ').trim();
          return res.json({ reply: cleanReply, source: 'gemini-brain' });
        }
      }
    }
  } catch (err) {
    // Graceful fallback to expert athletic biomechanics if network delays
  }

  // Fast athletic coach biomechanics engine for instantaneous spoken feedback
  const lower = prompt.toLowerCase();
  const ex = currentExercise.toLowerCase();
  let fallbackReply = "Keep your core braced tight and maintain full control through every rep!";

  if (lower.includes('elbow') && (lower.includes('flare') || lower.includes('out') || lower.includes('wide'))) {
    fallbackReply = "Tuck your elbows to forty-five degrees and screw your palms into the floor. Never let them flare out to the sides.";
  } else if (lower.includes('elbow') || (lower.includes('arm') && lower.includes('hurt'))) {
    fallbackReply = "Tuck your elbows to forty-five degrees and engage your chest. Avoid flaring elbows out wide.";
  } else if (lower.includes('wrist') || lower.includes('wrists')) {
    fallbackReply = "Spread your fingers wide and press through all five knuckles to distribute wrist load. Keep wrists stacked under your shoulders.";
  } else if (lower.includes('shoulder') || lower.includes('shoulders')) {
    fallbackReply = "Pull your shoulder blades down and back before each rep. This protects the rotator cuff and adds power.";
  } else if (lower.includes('knee') || lower.includes('knees')) {
    fallbackReply = "Track your knees out over your pinky toes, load through your heels, and keep your shins as vertical as possible.";
  } else if (lower.includes('back') && (lower.includes('lower') || lower.includes('hurts') || lower.includes('pain'))) {
    fallbackReply = "Brace your core like you're about to take a punch and tuck your pelvis slightly. Never let your hips sag or pike.";
  } else if (lower.includes('form') || lower.includes('technique') || lower.includes('doing') || lower.includes('correct') || lower.includes('right')) {
    if (ex.includes('diamond')) {
      fallbackReply = "Diamond push-ups: join thumbs and index fingers under your chest. Elbows tight to your ribs, full chest-to-floor range.";
    } else if (ex.includes('push')) {
      fallbackReply = "Tuck elbows forty-five degrees, squeeze glutes, brace abs, and touch your chest to the floor every single rep.";
    } else if (ex.includes('squat')) {
      fallbackReply = "Chest high, knees out, break at hips first, drive through your heels to full lockout at the top.";
    } else if (ex.includes('plank')) {
      fallbackReply = "Brace abs like taking a punch. Squeeze glutes hard, neutral spine. Don't let your hips pike or sag.";
    } else if (ex.includes('dip')) {
      fallbackReply = "Grip the edge, back grazing the bench, lower to ninety degree elbow bend, press through triceps to full extension.";
    } else if (ex.includes('lunge')) {
      fallbackReply = "Step forward, lower your rear knee toward the floor, keep front shin vertical, and drive through your front heel to return.";
    } else if (ex.includes('pike')) {
      fallbackReply = "Hips high in a V, lower your crown between your hands, then press hard through your shoulders.";
    } else if (ex.includes('mountain') || ex.includes('climber')) {
      fallbackReply = "Stable plank position, drive each knee explosively to your chest alternately, keep your hips level throughout.";
    } else {
      fallbackReply = "Keep your chest tall, core engaged, and focus on clean control over speed. Quality beats quantity every time.";
    }
  } else if (lower.includes('intense') || lower.includes('harder') || lower.includes('more') || lower.includes('difficult')) {
    fallbackReply = "Add a two-second pause at the bottom of each rep. That eccentric load will torch your muscles twice as hard!";
  } else if (lower.includes('easy') || lower.includes('too easy') || lower.includes('not hard enough')) {
    fallbackReply = "Increase your tempo on the way up and slow down for three counts on the way down. Make every rep earn its place.";
  } else if (lower.includes('pain') || lower.includes('hurt') || lower.includes('dizzy') || lower.includes('bad') || lower.includes('sick') || lower.includes('nauseous')) {
    fallbackReply = "Safety first. Take a deep breath, shake it out, and rest until you feel completely ready. Never push through sharp pain.";
  } else if (lower.includes('breathe') || lower.includes('breath') || lower.includes('breathing')) {
    fallbackReply = "Inhale deep through your nose on the way down, and exhale powerfully through your mouth as you push up. Rhythm is everything.";
  } else if (lower.includes('motivat') || lower.includes('tired') || lower.includes('cant') || lower.includes("can't") || lower.includes('give up') || lower.includes('quit')) {
    fallbackReply = "This is exactly where champions are forged. Your body can handle more than your mind thinks. Last few reps, let's finish strong!";
  } else if (lower.includes('rep') || lower.includes('reps') || lower.includes('how many')) {
    fallbackReply = `You're on set ${currentSet}. Focus on one rep at a time. Full range, full control. You've got this!`;
  } else if (lower.includes('rest') || lower.includes('break') || lower.includes('recover')) {
    fallbackReply = "Use your rest to shake out your arms, control your breathing, and mentally prepare for the next set. Rest is part of training.";
  } else if (lower.includes('water') || lower.includes('drink') || lower.includes('thirsty')) {
    fallbackReply = "Hydration is critical for performance. Drink now, rehydrate well, and say start or resume when you're ready to crush it.";
  } else if (lower.includes('warm') || lower.includes('warmup') || lower.includes('warm up')) {
    fallbackReply = "Do ten arm circles each direction and five deep bodyweight squats to prime your joints before the working sets.";
  } else if (lower.includes('muscle') || lower.includes('working') || lower.includes('what muscle')) {
    if (ex.includes('push') || ex.includes('diamond')) {
      fallbackReply = "Push-ups work chest, triceps, and front deltoids as primary movers, with your core stabilizing throughout.";
    } else if (ex.includes('squat') || ex.includes('lunge')) {
      fallbackReply = "Squats target quads, glutes, and hamstrings as primary movers, plus your core and spinal erectors to stabilize.";
    } else if (ex.includes('plank') || ex.includes('climber')) {
      fallbackReply = "This exercise targets your entire core — abs, obliques, lower back, and glutes — all working simultaneously.";
    } else if (ex.includes('dip') || ex.includes('pike')) {
      fallbackReply = "This targets your triceps and anterior deltoids as primary movers, with chest as a secondary synergist.";
    } else {
      fallbackReply = "Stay focused on the primary muscles. Mind-muscle connection amplifies every single rep.";
    }
  } else if (lower.includes('good') || lower.includes('great') || lower.includes('feeling good') || lower.includes('amazing')) {
    fallbackReply = "Love that energy! Channel it into every rep. Let's make this set your best set of the day!";
  } else if (lower.includes('slow') || lower.includes('slower') || lower.includes('fast') || lower.includes('faster') || lower.includes('tempo')) {
    fallbackReply = "Control the tempo: three counts down, explosive push up. Slow negatives build more muscle than going fast.";
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

  // 1. Athlete Distress, Pain & Injury Detection (<1ms immediate safety pause)
  if (
    lower.includes('hurt myself') || lower.includes('injured') || lower.includes('pulled a muscle') ||
    lower.includes('sprained') || lower.includes('not feeling good') || lower.includes('feeling bad') ||
    lower.includes('feel bad') || lower.includes('feel sick') || lower.includes('elbow hurt') ||
    lower.includes('elbow is hurting') || lower.includes('shoulder hurt') || lower.includes('knee hurt') ||
    lower.includes('wrist hurt') || lower.includes('dizzy') || lower.includes('nauseous') ||
    lower.includes('lightheaded') || lower.includes('pain') || lower.includes('cramping') ||
    lower.includes('hurts') || lower.includes('clicking') || lower.includes('cracking')
  ) {
    let advice = "Workout paused immediately for safety. Step back, catch your breath, and do not push through sharp pain.";
    if (lower.includes('hurt myself') || lower.includes('injured')) {
      advice = "Workout paused immediately. Sit down, avoid bearing weight on the joint, and take slow, deep recovery breaths.";
    } else if (lower.includes('elbow')) {
      advice = "Workout paused. Sharp elbow pain usually comes from flaring elbows out. Tuck them forty-five degrees to your ribs.";
    } else if (lower.includes('shoulder')) {
      advice = "Workout paused. Keep your shoulder blades pulled down and back to avoid joint impingement.";
    } else if (lower.includes('knee')) {
      advice = "Workout paused. Keep your knees tracking out over your pinky toes and load through your heels.";
    } else if (lower.includes('dizzy') || lower.includes('lightheaded') || lower.includes('bad') || lower.includes('sick')) {
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
    lower.includes('feeling good') || lower.includes('feel good') || lower.includes('feeling great') ||
    lower.includes('feeling better') || lower.includes('back at it')
  ) {
    const nextAction = (workoutContext.state === 'REST_TIMER') ? 'SKIP_REST' : (workoutContext.state === 'PAUSED' ? 'RESUME' : 'START');
    return res.json({
      action: nextAction,
      spokenFeedback: "Awesome to hear! Let's get right back to work and finish strong.",
      source: 'recovery-engine'
    });
  }

  // 3. Dynamic Workout Routine Switching on the Fly ("I want to do triceps now", "switch to legs")
  const isSwitchRequest = lower.includes('switch') || lower.includes('want to do') || lower.includes('wanna do') ||
    lower.includes('do ') || lower.includes('change to') || lower.includes('focus on') || lower.includes('train');

  if (isSwitchRequest || lower.includes('tricep') || lower.includes('leg') || lower.includes('chest') || lower.includes('core') || lower.includes('shoulder')) {
    if (lower.includes('tricep') || lower.includes('arms')) {
      return res.json({
        action: 'SWITCH_ROUTINE',
        parameter: 'triceps',
        spokenFeedback: "Switching to Triceps focus! Dropping previous workout. First up: Diamond Push-ups. Keep hands close and elbows tucked. Starting set one now!",
        source: 'routine-dispatcher'
      });
    } else if (lower.includes('leg') || lower.includes('quad') || lower.includes('squat') || lower.includes('calve')) {
      return res.json({
        action: 'SWITCH_ROUTINE',
        parameter: 'legs',
        spokenFeedback: "Switching to Leg day! Dropping previous workout. First exercise: Bodyweight Squats. Keep your chest up, drive knees out. Starting set one now!",
        source: 'routine-dispatcher'
      });
    } else if (lower.includes('chest') || lower.includes('pec')) {
      return res.json({
        action: 'SWITCH_ROUTINE',
        parameter: 'chest',
        spokenFeedback: "Switching to Chest blast! Dropping previous workout. First up: Standard Push-ups. Squeeze your pecs at the top. Starting set one now!",
        source: 'routine-dispatcher'
      });
    } else if (lower.includes('core') || lower.includes('ab') || lower.includes('plank')) {
      return res.json({
        action: 'SWITCH_ROUTINE',
        parameter: 'core',
        spokenFeedback: "Switching to Core shield! Dropping previous workout. First up: Forearm Plank Hold. Brace like taking a punch. Starting set one now!",
        source: 'routine-dispatcher'
      });
    } else if (lower.includes('shoulder') || lower.includes('delt')) {
      return res.json({
        action: 'SWITCH_ROUTINE',
        parameter: 'shoulders',
        spokenFeedback: "Switching to Shoulders! Dropping previous workout. First up: Pike Push-ups. Drive through your delts with power. Starting set one now!",
        source: 'routine-dispatcher'
      });
    } else if (lower.includes('full body') || lower.includes('whole body')) {
      return res.json({
        action: 'SWITCH_ROUTINE',
        parameter: 'full_body',
        spokenFeedback: "Switching to Full Body burn! Dropping previous workout. First up: Push-ups. Let's do this, starting set one now!",
        source: 'routine-dispatcher'
      });
    }
  }

  // 4. Form Coaching & Masterclass ("Teach me what to do and how to do")
  if (
    lower.includes('teach me') || lower.includes('how to do') || lower.includes('how do i do') ||
    lower.includes('explain form') || lower.includes('break down') || lower.includes('form guide') ||
    lower.includes('what to do')
  ) {
    const currentEx = (workoutContext.exerciseName || 'Push-ups').toLowerCase();
    let coachingSpeech = "Set your foundation first: control the descent for two seconds, explode up with power, and breathe steadily.";

    if (currentEx.includes('diamond')) {
      coachingSpeech = "For diamond push-ups: join thumbs and index fingers under your chest. Tuck elbows tight to your ribcage to isolate triceps.";
    } else if (currentEx.includes('push')) {
      coachingSpeech = "For push-ups: place hands shoulder-width apart, screw palms into the floor, tuck elbows forty-five degrees, and touch chest down.";
    } else if (currentEx.includes('squat')) {
      coachingSpeech = "For squats: feet shoulder-width, break at hips and knees together, drive knees out over pinky toes, and press through your heels.";
    } else if (currentEx.includes('dip')) {
      coachingSpeech = "For dips: grip the edge, keep your back grazing the bench, lower to ninety degrees at elbows, and press straight through triceps.";
    } else if (currentEx.includes('plank')) {
      coachingSpeech = "For plank: elbows under shoulders, squeeze glutes hard, pull belly button to spine, and hold a straight line from neck to heels.";
    } else if (currentEx.includes('pike')) {
      coachingSpeech = "For pike push-ups: elevate hips high in an inverted V shape, lower crown of head between hands, and drive up through shoulders.";
    }

    return res.json({
      action: 'TEACH_EXERCISE',
      spokenFeedback: coachingSpeech,
      source: 'biomechanics-masterclass'
    });
  }

  // 5. START command (Immediate start / begin / start the gym / let's go)
  if (
    lower.includes('start the gym') || lower.includes('start workout') || lower.includes('starts now') || lower.includes('start now') ||
    lower.includes('lets start') || lower.includes("let's start") || lower.includes('lets go') ||
    lower.includes("let's go") || lower.includes('begin') || lower.includes('get started') ||
    lower.includes('hit it') || lower.includes('go for instant') || lower === 'start' || lower.startsWith('start ') || lower === 'starts'
  ) {
    return res.json({
      action: 'START',
      spokenFeedback: "Starting workout! Let's crush this session!",
      source: 'phonetic-engine'
    });
  }

  // 6. PAUSE / Water Break / Emergency Stop
  if (
    lower.includes('water') || lower.includes('drink') || lower.includes('sip') || lower.includes('thirsty')
  ) {
    return res.json({
      action: 'PAUSE',
      parameter: 'WATER',
      spokenFeedback: "Workout paused for water break. Rehydrate and catch your breath! Say start or resume when you're ready.",
      source: 'phonetic-engine'
    });
  }

  if (
    lower.includes('paws') || lower.includes('pos') || lower.includes('hault') ||
    lower.includes('hold up') || lower.includes('hold on') || lower.includes('hol up') ||
    lower.includes('hol on') || lower.includes('gimme a sec') || lower.includes('gimme a min') ||
    lower.includes('wait up') || lower.includes('chill') || lower.includes('time out') ||
    lower.includes('take a break') || lower.includes('let me breathe') ||
    lower.includes('dying') || lower.includes('stop') || lower.includes('pause') ||
    lower === 'top' || lower.startsWith('top ') || lower.endsWith(' top') ||
    lower.includes(' stock') || lower === 'stock' || lower.startsWith('stock ') ||
    lower.includes(' stalk') || lower === 'stalk' || lower === 'shop' ||
    lower.includes(' spot') || lower === 'spot' || lower.includes(' stuck') || lower === 'stuck' ||
    lower.includes('stopped') || lower.includes('stopping') || lower === 'drop' || lower.includes('break')
  ) {
    return res.json({
      action: 'PAUSE',
      spokenFeedback: 'Workout paused. Catch your breath.',
      source: 'phonetic-engine'
    });
  }

  // 7. SKIP REST
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

  // 8. RESUME
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

  // 9. Add time
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

  // 10. Next Exercise
  if (
    lower.includes('next exercise') || lower.includes('skip exercise') ||
    lower.includes('different exercise') || lower.includes('what is next') || lower.includes("what's next") ||
    lower.includes('move on') || lower.includes('swap exercise')
  ) {
    return res.json({
      action: 'NEXT_EXERCISE',
      spokenFeedback: 'Moving on to the next exercise!',
      source: 'phonetic-engine'
    });
  }

  // 11. Form check queries
  if (
    lower.includes('form') || lower.includes('technique') || lower.includes('doing') ||
    lower.includes('correct') || lower.includes('right')
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

  // 12. Gemini LLM Classification for open-ended questions (direct REST API — fastest path)
  try {
    const promptSystem = `You are Coach Celeste, the voice gym coach AI brain.
Current Exercise: ${workoutContext.exerciseName || 'Push-ups'}, Set ${workoutContext.set || 1}, State: ${workoutContext.state || 'ACTIVE'}.
User utterance: "${raw}".
Classify user's intent into ONE action:
- "START", "PAUSE", "RESUME", "SKIP_REST", "ADD_REST", "SWITCH_ROUTINE", "TEACH_EXERCISE", or "COACH_ADVICE".
If SWITCH_ROUTINE, include parameter: "triceps" | "legs" | "chest" | "core" | "shoulders" | "full_body".
Respond ONLY with valid JSON (no markdown, no explanation):
{"action": "...", "parameter": "optional_parameter", "spokenFeedback": "Direct, punchy spoken coach response under 20 words"}`;

    if (GEMINI_DIRECT_API_KEY) {
      // Direct Gemini REST API — fastest path
      const geminiRes = await fetch(`${GEMINI_DIRECT_URL}?key=${GEMINI_DIRECT_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptSystem }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 100 }
        }),
        signal: AbortSignal.timeout(3000)
      });
      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (content) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return res.json({
              action: parsed.action || 'COACH_ADVICE',
              parameter: parsed.parameter || null,
              spokenFeedback: parsed.spokenFeedback || 'Stay focused and keep pushing!',
              source: 'gemini-direct'
            });
          }
        }
      }
    } else {
      // Fallback: web2api proxy
      const geminiRes = await fetch(`${GEMINI_API_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk-gemini' },
        body: JSON.stringify({
          model: 'gemini-3.6-flash',
          messages: [{ role: 'system', content: promptSystem }],
          temperature: 0.2,
          max_tokens: 80
        }),
        signal: AbortSignal.timeout(1800)
      });
      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return res.json({
            action: parsed.action || 'COACH_ADVICE',
            parameter: parsed.parameter || null,
            spokenFeedback: parsed.spokenFeedback || 'Stay focused and keep pushing!',
            source: 'gemini-brain'
          });
        }
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
