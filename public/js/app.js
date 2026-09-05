/**
 * app.js
 * Main entry point for Voice Gym Coach
 * Orchestrates Rime TTS, AudioController, StateMachine, VoiceListener, SoundFX, and Rabto UI.
 */

import { RimeClient } from './rimeClient.js';
import { AudioController } from './audioController.js';
import { WorkoutStateMachine, STATES, WORKOUT_ROUTINES } from './stateMachine.js';
import { VoiceListener } from './voiceListener.js';
import { SoundFX } from './soundFx.js';

// DOM Elements
const engineStatusBadge = document.getElementById('engine-status');
const engineText = document.getElementById('engine-text');
const geminiStatusBadge = document.getElementById('gemini-status');
const geminiText = document.getElementById('gemini-text');

const btnMute = document.getElementById('btn-mute');
const volSlider = document.getElementById('vol-slider');

const stateBadge = document.getElementById('state-badge');
const setBadge = document.getElementById('set-badge');
const exerciseNameEl = document.getElementById('exercise-name');
const workoutTargetEl = document.getElementById('workout-target');
const hudNumberEl = document.getElementById('hud-number');
const hudLabelEl = document.getElementById('hud-label');
const circleProgressEl = document.getElementById('circle-progress');
const coachSubtitleEl = document.getElementById('coach-subtitle');

const btnToggleWorkout = document.getElementById('btn-toggle-workout');
const btnLabel = document.getElementById('btn-label');
const btnIcon = document.getElementById('btn-icon');
const btnSkipRest = document.getElementById('btn-skip-rest');

const micIndicator = document.getElementById('mic-indicator');
const micVisualizer = document.getElementById('mic-visualizer');
const heardTranscriptEl = document.getElementById('heard-transcript');
const interruptCountBadge = document.getElementById('interrupt-count');
const logConsole = document.getElementById('log-console');

const testVoiceSkip = document.getElementById('test-voice-skip');
const testVoiceStop = document.getElementById('test-voice-stop');
const copyLogsBtn = document.getElementById('copy-logs');
const clearLogsBtn = document.getElementById('clear-logs');

const aiPromptInput = document.getElementById('ai-prompt-input');
const btnAskAi = document.getElementById('btn-ask-ai');

const routinePills = document.querySelectorAll('.routine-pill');
const pacingBtns = document.querySelectorAll('.pacing-btn');
const visualizerCanvas = document.getElementById('visualizer-canvas');

// Circle Circumference for r=90
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 90; // ~565.48
circleProgressEl.style.strokeDasharray = `${CIRCLE_CIRCUMFERENCE}`;
circleProgressEl.style.strokeDashoffset = '0';

// Initialize SoundFX
const soundFx = new SoundFX();

// Metrics & Log State
let interruptCount = 0;

function logMessage(text, type = 'info') {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `<span style="opacity:0.6;">[${time}]</span> ${text}`;
  logConsole.appendChild(entry);
  logConsole.scrollTop = logConsole.scrollHeight;
}

// 1. Initialize Rime Client
const rimeClient = new RimeClient({
  speaker: 'celeste',
  modelId: 'coda'
});

// 2. Initialize Audio Controller
const audioController = new AudioController(
  rimeClient,
  (subtitle) => {
    coachSubtitleEl.textContent = `"${subtitle}"`;
    logMessage(`🗣️ Coach: "${subtitle}"`, 'coach');
  },
  (logText, logType) => {
    logMessage(logText, logType);
  }
);

// Robot Action Controller Elements
const robotContainer = document.getElementById('robot-container');
const robotWrapper = document.getElementById('robot-wrapper');
const robotAura = document.getElementById('robot-aura');
const robotActionText = document.getElementById('robot-action-text');
const robotExerciseIndicator = document.getElementById('robot-exercise-indicator');

function resetRobotAnimations() {
  if (!robotWrapper) return;
  robotWrapper.classList.remove(
    'action-pushup-rep',
    'action-squat-rep',
    'action-jump-rep',
    'action-plank-hold',
    'action-rest-breathe',
    'action-interrupted',
    'action-victory',
    'action-countdown'
  );
}

function updateRobotAction(actionType, text, exerciseName = '') {
  if (!robotWrapper) return;

  if (robotExerciseIndicator && exerciseName) {
    robotExerciseIndicator.textContent = exerciseName;
  }

  if (robotActionText && text) {
    robotActionText.textContent = text;
  }

  if (robotAura) {
    robotAura.className = 'robot-aura';
    if (actionType && actionType.includes('pushup')) robotAura.classList.add('aura-pushup');
    else if (actionType && actionType.includes('squat')) robotAura.classList.add('aura-squat');
    else if (actionType && actionType.includes('rest')) robotAura.classList.add('aura-rest');
    else if (actionType && actionType.includes('victory')) robotAura.classList.add('aura-victory');
  }

  resetRobotAnimations();
  void robotWrapper.offsetWidth; // Trigger reflow

  if (actionType) {
    robotWrapper.classList.add(actionType);
  }
}

function triggerRobotRepAction(exerciseName, repNumber) {
  if (!robotWrapper) return;
  const ex = (exerciseName || '').toLowerCase();
  const pacingSec = (stateMachine.repPacingMs / 1000).toFixed(2);
  robotWrapper.style.setProperty('--pacing-duration', `${pacingSec}s`);

  if (ex.includes('push') || ex.includes('chest') || ex.includes('press')) {
    updateRobotAction('action-pushup-rep', `Push-Up Rep ${repNumber}`, exerciseName);
  } else if (ex.includes('squat') || ex.includes('lunge') || ex.includes('leg')) {
    updateRobotAction('action-squat-rep', `Squat Rep ${repNumber}`, exerciseName);
  } else if (ex.includes('jump') || ex.includes('jack') || ex.includes('burpee')) {
    updateRobotAction('action-jump-rep', `Jump Rep ${repNumber}`, exerciseName);
  } else if (ex.includes('plank') || ex.includes('hold')) {
    updateRobotAction('action-plank-hold', `Plank Hold (Rep ${repNumber})`, exerciseName);
  } else {
    updateRobotAction('action-squat-rep', `Rep ${repNumber}`, exerciseName);
  }
}

function triggerRobotBargeIn() {
  if (!robotWrapper) return;
  resetRobotAnimations();
  void robotWrapper.offsetWidth;
  robotWrapper.classList.add('action-interrupted');
  if (robotActionText) robotActionText.textContent = '⚡ Barge-In Halt!';
  setTimeout(() => {
    if (robotWrapper && robotWrapper.classList.contains('action-interrupted')) {
      robotWrapper.classList.remove('action-interrupted');
    }
  }, 380);
}

// 3. Initialize State Machine
const stateMachine = new WorkoutStateMachine({
  audioController,
  soundFx,
  onStateChange: (state, ctx) => {
    updateHUDState(state, ctx);
  },
  onTick: (remaining, total) => {
    hudNumberEl.textContent = `${remaining}`;
    hudLabelEl.textContent = 'SEC REST';
    const fraction = remaining / total;
    circleProgressEl.style.strokeDashoffset = `${CIRCLE_CIRCUMFERENCE * (1 - fraction)}`;
    if (robotActionText) robotActionText.textContent = `Rest & Breathe (${remaining}s)`;
  },
  onRep: (currentRep, targetReps) => {
    hudNumberEl.textContent = `${currentRep}`;
    hudLabelEl.textContent = `OF ${targetReps} REPS`;
    const fraction = currentRep / targetReps;
    circleProgressEl.style.strokeDashoffset = `${CIRCLE_CIRCUMFERENCE * (1 - fraction)}`;
    
    // Animate Robot to match the exercise rep motion
    const exName = stateMachine.currentExercise ? stateMachine.currentExercise.name : 'Rep';
    triggerRobotRepAction(exName, currentRep);
  },
  onLog: (msg, type) => {
    logMessage(msg, type);
  }
});

// Update HUD when state changes
function updateHUDState(state, ctx) {
  stateBadge.className = 'state-tag';
  circleProgressEl.classList.remove('rest-mode');

  if (state === STATES.IDLE) {
    stateBadge.textContent = 'READY';
    btnLabel.textContent = 'START WORKOUT';
    btnIcon.textContent = '▶';
    btnToggleWorkout.classList.remove('btn-pause');
    btnSkipRest.style.display = 'none';
    hudNumberEl.textContent = '0';
    hudLabelEl.textContent = 'REPS';
    circleProgressEl.style.strokeDashoffset = '0';
    exerciseNameEl.textContent = ctx.exercise.name;
    workoutTargetEl.textContent = `Target: ${ctx.exercise.reps} Reps • ${ctx.exercise.restSeconds}s Rest`;
    updateRobotAction('', 'Coach Standing By', 'Ready');
  } else if (state === STATES.COUNTDOWN) {
    stateBadge.textContent = 'COUNTDOWN';
    stateBadge.classList.add('active-workout');
    btnLabel.textContent = 'PAUSE WORKOUT';
    btnIcon.textContent = '⏸';
    btnToggleWorkout.classList.add('btn-pause');
    btnSkipRest.style.display = 'none';
    updateRobotAction('action-countdown', 'Get In Position!', ctx.exercise.name);
  } else if (state === STATES.EXERCISE_REPS) {
    stateBadge.textContent = 'SET IN PROGRESS';
    stateBadge.classList.add('active-workout');
    exerciseNameEl.textContent = ctx.exercise.name;
    setBadge.textContent = `SET ${ctx.set} OF ${ctx.exercise.sets}`;
    workoutTargetEl.textContent = `Target: ${ctx.exercise.reps} Reps • ${ctx.exercise.restSeconds}s Rest`;
    btnLabel.textContent = 'PAUSE WORKOUT';
    btnIcon.textContent = '⏸';
    btnToggleWorkout.classList.add('btn-pause');
    btnSkipRest.style.display = 'none';
    updateRobotAction('', `Set ${ctx.set}: Ready for Rep 1`, ctx.exercise.name);
  } else if (state === STATES.REST_TIMER) {
    stateBadge.textContent = 'REST PERIOD';
    stateBadge.classList.add('active-rest');
    circleProgressEl.classList.add('rest-mode');
    btnSkipRest.style.display = 'inline-block';
    hudNumberEl.textContent = `${ctx.restRemaining}`;
    hudLabelEl.textContent = 'SEC REST';
    updateRobotAction('action-rest-breathe', `Rest & Recovery (${ctx.restRemaining}s)`, 'Rest');
  } else if (state === STATES.PAUSED) {
    stateBadge.textContent = 'PAUSED';
    btnLabel.textContent = 'RESUME WORKOUT';
    btnIcon.textContent = '▶';
    btnToggleWorkout.classList.remove('btn-pause');
    updateRobotAction('', 'Workout Paused (Holding)', 'Paused');
  } else if (state === STATES.COMPLETED) {
    stateBadge.textContent = 'COMPLETED';
    stateBadge.classList.add('active-workout');
    btnLabel.textContent = 'RESTART WORKOUT';
    btnIcon.textContent = '🔄';
    btnToggleWorkout.classList.remove('btn-pause');
    btnSkipRest.style.display = 'none';
    updateRobotAction('action-victory', 'Workout Crushed! 🏆', 'Champion');
  }
}

// 4. Initialize Voice Listener with Barge-In Logic
const voiceListener = new VoiceListener({
  onSpeechStart: () => {
    micVisualizer.classList.add('speaking');
    micIndicator.textContent = 'HEARING SPEECH';
    micIndicator.className = 'state-tag active-workout';

    // If coach is speaking, user has started interrupting!
    if (audioController.isPlaying) {
      triggerBargeIn('Acoustic voice start detected over mic');
    }
  },
  onStatusChange: (status) => {
    const btnMicToggle = document.getElementById('btn-mic-toggle');
    const btnMicText = document.getElementById('btn-mic-text');

    if (status === 'LISTENING') {
      micVisualizer.classList.remove('speaking');
      micVisualizer.classList.add('listening');
      micIndicator.textContent = 'LISTENING';
      micIndicator.className = 'state-tag active-workout';
      if (btnMicToggle) btnMicToggle.classList.add('active');
      if (btnMicText) btnMicText.textContent = '🎙️ Mic Active (Listening)';
    } else if (status === 'SPEECH_DETECTED') {
      if (btnMicText) btnMicText.textContent = '🎙️ Hearing You...';
    } else if (status === 'OFF') {
      micVisualizer.className = 'mic-visualizer';
      micIndicator.textContent = 'STANDBY';
      micIndicator.className = 'state-tag';
      if (btnMicToggle) btnMicToggle.classList.remove('active');
      if (btnMicText) btnMicText.textContent = '🎙️ Start Hands-Free Mic';
    } else if (status === 'MIC_BLOCKED') {
      micIndicator.textContent = 'BLOCKED';
      micIndicator.className = 'state-tag interrupted';
      if (btnMicToggle) btnMicToggle.classList.remove('active');
      if (btnMicText) btnMicText.textContent = '❌ Mic Blocked (Click)';
    }
  },
  onInterim: (text) => {
    heardTranscriptEl.textContent = `"${text}"`;
  },
  onCommand: (command, rawText) => {
    handleSpokenCommand(command, rawText);
  },
  onLog: (msg, type) => {
    logMessage(msg, type);
  }
});

// Common Barge-In Trigger
function triggerBargeIn(reason) {
  interruptCount++;
  interruptCountBadge.textContent = `${interruptCount} Interrupt${interruptCount > 1 ? 's' : ''}`;
  
  // Flash state tag on screen
  stateBadge.classList.add('interrupted');
  setTimeout(() => stateBadge.classList.remove('interrupted'), 400);

  // Trigger 3D robot reaction
  triggerRobotBargeIn();

  // Play glitch sound effect and cut audio
  soundFx.playBargeInGlitch();
  audioController.interrupt(reason);
}

// Spoken Command Router with Dynamic AI Semantic Brain
async function handleSpokenCommand(fallbackCommand, rawText) {
  logMessage(`🎙️ [HEARD] "${rawText}"`, 'user');

  // 1. Instant hardware audio cutoff (<1ms)
  triggerBargeIn(`Spoken input: "${rawText}"`);

  // 2. Query AI Semantic Intent Engine (Handles slang, mispronunciations, and custom fitness questions)
  const ctx = stateMachine.getContext();
  try {
    const res = await fetch('/api/intent-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        utterance: rawText,
        workoutContext: {
          exerciseName: ctx.exercise.name,
          set: ctx.set,
          state: ctx.state
        }
      })
    });

    const data = await res.json();
    const action = data.action || fallbackCommand;
    logMessage(`🧠 [AI INTENT (${data.source})] "${rawText}" ➔ ${action}`, 'success');

    switch (action) {
      case 'SKIP_REST':
        logMessage(`🎯 Executing: SKIP REST`, 'success');
        stateMachine.skipRest();
        break;

      case 'PAUSE':
        logMessage(`🎯 Executing: PAUSE WORKOUT`, 'info');
        stateMachine.pause();
        if (data.spokenFeedback) audioController.speak(data.spokenFeedback, true);
        break;

      case 'RESUME':
        logMessage(`🎯 Executing: RESUME WORKOUT`, 'success');
        stateMachine.resume();
        break;

      case 'ADD_REST':
        const secs = data.parameter || 10;
        logMessage(`🎯 Executing: ADD ${secs}s REST`, 'success');
        if (stateMachine.state === STATES.REST_TIMER) {
          stateMachine.addRestSeconds(secs);
        } else {
          audioController.speak(data.spokenFeedback || `Added ${secs} seconds.`);
        }
        break;

      case 'NEXT_EXERCISE':
        logMessage(`🎯 Executing: NEXT EXERCISE`, 'success');
        stateMachine.nextExercise();
        break;

      case 'COACH_ADVICE':
      default:
        if (data.spokenFeedback) {
          logMessage(`✨ [COACH ADVICE] "${data.spokenFeedback}"`, 'coach');
          audioController.speak(data.spokenFeedback, true);
        }
        break;
    }
  } catch (err) {
    console.error('Intent parsing error:', err);
    // Graceful fallback to basic command if network fails
    if (fallbackCommand === 'SKIP_REST') stateMachine.skipRest();
    else if (fallbackCommand === 'PAUSE') stateMachine.pause();
  }
}
window.handleSpokenCommand = handleSpokenCommand;

// Conversational AI Coach Brain (Powered by gemini-web2api)
async function askAiCoach(question) {
  if (!question || !question.trim()) return;

  triggerBargeIn('User asked AI Coach question');
  logMessage(`🤖 [AI INQUIRY] "${question}"`, 'user');

  const ctx = stateMachine.getContext();
  try {
    const res = await fetch('/api/coach-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: question,
        workoutContext: {
          exerciseName: ctx.exercise.name,
          set: ctx.set,
          state: ctx.state
        }
      })
    });

    const data = await res.json();
    if (data.reply) {
      logMessage(`✨ [AI COACH (${data.source})] "${data.reply}"`, 'success');
      audioController.speak(data.reply, true);
    }
  } catch (err) {
    console.error('Error contacting AI coach:', err);
    audioController.speak("Keep your head in the game! Stay focused on your breathing.", true);
  }
}

// Equalizer Waveform Animation
function initWaveformVisualizer() {
  if (!visualizerCanvas) return;
  const ctx = visualizerCanvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = visualizerCanvas.clientWidth || 300;
  const h = 26;
  visualizerCanvas.width = w * dpr;
  visualizerCanvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  let phase = 0;
  function draw() {
    requestAnimationFrame(draw);
    ctx.clearRect(0, 0, w, h);

    const isLive = audioController.isPlaying || voiceListener.isListening;
    const barCount = 36;
    const barWidth = (w / barCount) - 3;

    for (let i = 0; i < barCount; i++) {
      let amp = 3;
      if (audioController.isPlaying) {
        amp = Math.sin(phase + i * 0.4) * 8 + 11;
      } else if (voiceListener.isListening) {
        amp = Math.sin(phase * 0.5 + i * 0.25) * 4 + 6;
      }

      ctx.fillStyle = audioController.isPlaying ? '#06b6d4' : (voiceListener.isListening ? '#10b981' : '#334155');
      const x = i * (barWidth + 3);
      const y = (h - amp) / 2;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, amp, 3);
      ctx.fill();
    }
    phase += 0.15;
  }
  draw();
}

// Button Events
btnToggleWorkout.addEventListener('click', () => {
  soundFx.init();
  audioController.initAudioContext();
  voiceListener.start();

  if (stateMachine.state === STATES.IDLE || stateMachine.state === STATES.COMPLETED) {
    stateMachine.startWorkout();
  } else if (stateMachine.state === STATES.PAUSED) {
    stateMachine.resume();
  } else {
    stateMachine.pause();
  }
});

btnSkipRest.addEventListener('click', () => {
  triggerBargeIn('Manual UI Button Click');
  stateMachine.skipRest();
});

// Routine Switcher Events
routinePills.forEach(pill => {
  pill.addEventListener('click', () => {
    routinePills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    const routineKey = pill.getAttribute('data-routine');
    stateMachine.setRoutine(routineKey);
  });
});

// Rep Pacing Selector Events
pacingBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    pacingBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const pacingMs = parseInt(btn.getAttribute('data-pacing'), 10);
    stateMachine.setPacing(pacingMs);
  });
});

// Audio Volume & Mute Controls
btnMute.addEventListener('click', () => {
  soundFx.setMuted(!soundFx.isMuted);
  btnMute.textContent = soundFx.isMuted ? '🔇' : '🔊';
});

volSlider.addEventListener('input', (e) => {
  const vol = parseFloat(e.target.value);
  soundFx.setVolume(vol);
});

// AI Coach Question Form
btnAskAi.addEventListener('click', () => {
  const q = aiPromptInput.value.trim();
  if (q) {
    askAiCoach(q);
    aiPromptInput.value = '';
  }
});

aiPromptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const q = aiPromptInput.value.trim();
    if (q) {
      askAiCoach(q);
      aiPromptInput.value = '';
    }
  }
});

// Simulated Voice Commands
testVoiceSkip.addEventListener('click', () => {
  handleSpokenCommand('SKIP_REST', 'skip it, next set (simulated)');
});

testVoiceStop.addEventListener('click', () => {
  handleSpokenCommand('PAUSE', 'stop (simulated)');
});

// Problem 2: Pronunciation & Delivery Lab Event Listener
const compareBtns = document.querySelectorAll('.btn-compare-audio');
compareBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    soundFx.init();
    audioController.initAudioContext();
    const testId = btn.getAttribute('data-test');
    const varA = btn.getAttribute('data-a');
    const varB = btn.getAttribute('data-b');

    logMessage(`🔬 [PRONUNCIATION LAB] Testing Variant A ("${varA}") vs Variant B ("${varB}")`, 'info');
    
    // Announce Variant A
    logMessage(`🔊 Playing Variant A: "${varA}"`, 'coach');
    await audioController.speak(`Variant A: ${varA}`, true);

    await new Promise(r => setTimeout(r, 800));

    // Announce Variant B
    logMessage(`🔊 Playing Variant B: "${varB}"`, 'coach');
    await audioController.speak(`Variant B: ${varB}`, true);

    // Call server to save WAV evidence
    try {
      const res = await fetch('/api/pronunciation-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, variantA: varA, variantB: varB })
      });
      const data = await res.json();
      logMessage(`📊 [EVIDENCE] ${data.recommendation || 'WAV files recorded to /pronunciation_evidence'}`, 'success');
    } catch (e) {
      console.warn('Pronunciation test endpoint note:', e);
    }
  });
});

// Copy Evidence Log Button
copyLogsBtn.addEventListener('click', () => {
  const entries = Array.from(document.querySelectorAll('.log-entry')).map(e => e.textContent).join('\n');
  navigator.clipboard.writeText(entries).then(() => {
    logMessage('📋 Evidence log copied to clipboard for presentation!', 'success');
  }).catch(() => {
    logMessage('📋 Log ready for copying.', 'info');
  });
});

clearLogsBtn.addEventListener('click', () => {
  logConsole.innerHTML = '<div class="log-entry info">[System] Log cleared.</div>';
});

// App Startup & Server Config Check
async function initApp() {
  logMessage('[System] Checking Rime TTS & Gemini Web2API configuration...', 'info');
  const config = await rimeClient.checkConfig();

  if (config.isRimeConfigured) {
    engineStatusBadge.className = 'engine-status-badge';
    engineText.textContent = `Rime.ai Connected (Coda - ${config.defaultSpeaker})`;
    logMessage(`✅ Connected to Rime.ai TTS Engine (Model: ${config.model}, Speaker: ${config.defaultSpeaker})`, 'success');
  } else {
    engineStatusBadge.className = 'engine-status-badge warning';
    engineText.textContent = `Local TTS Active (Add RIME_API_KEY for Rime)`;
    logMessage('ℹ️ RIME_API_KEY is not yet added in .env. Falling back to high-speed local speech synthesis so you can test interruption immediately!', 'info');
  }

  if (config.isGeminiWeb2ApiLive) {
    geminiStatusBadge.className = 'engine-status-badge purple';
    geminiText.textContent = 'Gemini Web2API Connected (:8081)';
    logMessage('✅ Connected to gemini-web2api on port 8081 for unlimited AI intelligence!', 'success');
  } else {
    geminiStatusBadge.className = 'engine-status-badge purple';
    geminiText.textContent = 'AI Coach Brain Active';
    logMessage('ℹ️ Local gemini-web2api server not detected on :8081. Using built-in athletic coach AI intelligence. (Run python gemini_web2api.py to activate full web2api).', 'info');
  }

  initWaveformVisualizer();
  initCyberRoninAnimations();
  initMicInteractions();
}

// =========================================================
// 1. Cyber Ronin Cursor & Touch Spotlight Reveal
// =========================================================
const revealImg = document.getElementById('reveal-img');
function updateSpotlight(clientX, clientY) {
  if (!revealImg) return;
  const rect = revealImg.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const width = window.innerWidth;
  const r = width < 480 ? 120 : (width < 720 ? 160 : 260);
  const gradient = `radial-gradient(circle ${r}px at ${x}px ${y}px, #fff 0%, #fff 40%, rgba(255,255,255,0.75) 60%, rgba(255,255,255,0.4) 75%, rgba(255,255,255,0.12) 88%, transparent 100%)`;
  revealImg.style.webkitMaskImage = gradient;
  revealImg.style.maskImage = gradient;
}
window.addEventListener('mousemove', (e) => updateSpotlight(e.clientX, e.clientY));
window.addEventListener('touchmove', (e) => {
  if (e.touches && e.touches[0]) updateSpotlight(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

// =========================================================
// 2. Cyber Ronin Words Pull-Up & IntersectionObserver
// =========================================================
function initCyberRoninAnimations() {
  const wordsPullUpEls = document.querySelectorAll('.words-pull-up');
  wordsPullUpEls.forEach((el) => {
    if (el.dataset.split) return;
    el.dataset.split = 'true';
    const isH1 = el.tagName.toLowerCase() === 'h1';
    const directSpans = el.querySelectorAll(':scope > span');
    if (isH1 && directSpans.length > 0) {
      let continuousIndex = 0;
      directSpans.forEach((span) => {
        span.classList.add('pull-line');
        const rawText = span.textContent.trim();
        span.innerHTML = '';
        const words = rawText.split(/\s+/);
        words.forEach((word) => {
          if (!word) return;
          const wordSpan = document.createElement('span');
          wordSpan.className = 'pull-word';
          wordSpan.textContent = word;
          wordSpan.style.animationDelay = `${continuousIndex * 0.1}s`;
          span.appendChild(wordSpan);
          continuousIndex++;
        });
      });
    } else {
      const rawTextSimple = el.textContent.trim();
      el.innerHTML = '';
      const wordsSimple = rawTextSimple.split(/\s+/);
      wordsSimple.forEach((word, idx) => {
        if (!word) return;
        const wordSpan = document.createElement('span');
        wordSpan.className = 'pull-word';
        wordSpan.textContent = word;
        wordSpan.style.animationDelay = `${idx * 0.1}s`;
        el.appendChild(wordSpan);
      });
    }
  });

  if ('IntersectionObserver' in window) {
    const wordsObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('words-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    wordsPullUpEls.forEach((el) => wordsObserver.observe(el));

    const fadeEls = document.querySelectorAll('.fade-up-reveal');
    const fadeObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const delay = entry.target.getAttribute('data-delay') || '0';
          entry.target.style.animationDelay = `${delay}s`;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    fadeEls.forEach((el) => fadeObserver.observe(el));
  } else {
    wordsPullUpEls.forEach((el) => el.classList.add('words-visible'));
    document.querySelectorAll('.fade-up-reveal').forEach((el) => {
      const delay = el.getAttribute('data-delay') || '0';
      el.style.animationDelay = `${delay}s`;
      el.classList.add('is-visible');
    });
  }
}

// =========================================================
// 3. Hands-Free Mic Controls & Auto-Gesture Activation
// =========================================================
function initMicInteractions() {
  const btnMicToggle = document.getElementById('btn-mic-toggle');
  if (btnMicToggle) {
    btnMicToggle.addEventListener('click', () => {
      soundFx.init();
      audioController.initAudioContext();
      voiceListener.toggle();
    });
  }

  // Auto-start microphone on first user gesture anywhere
  function autoStartMic() {
    soundFx.init();
    audioController.initAudioContext();
    if (!voiceListener.isListening) {
      voiceListener.start();
    }
  }
  window.addEventListener('click', autoStartMic, { once: true });
  window.addEventListener('touchstart', autoStartMic, { once: true });
}

// =========================================================
// 4. Clean Spline Watermark / Logo Remover
// =========================================================
function hideSplineLogo() {
  const viewer = document.getElementById('spline-robot');
  if (viewer && viewer.shadowRoot) {
    const logo = viewer.shadowRoot.querySelector('#logo') || 
                 viewer.shadowRoot.querySelector('a[href*="spline.design"]') ||
                 viewer.shadowRoot.querySelector('.spline-watermark');
    if (logo) {
      logo.style.display = 'none';
      logo.style.opacity = '0';
      logo.style.visibility = 'hidden';
      logo.style.pointerEvents = 'none';
      try { logo.remove(); } catch(e) {}
    }
  }
}
setInterval(hideSplineLogo, 120);

initApp();
