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
  },
  onRep: (currentRep, targetReps) => {
    hudNumberEl.textContent = `${currentRep}`;
    hudLabelEl.textContent = `OF ${targetReps} REPS`;
    const fraction = currentRep / targetReps;
    circleProgressEl.style.strokeDashoffset = `${CIRCLE_CIRCUMFERENCE * (1 - fraction)}`;
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
  } else if (state === STATES.COUNTDOWN) {
    stateBadge.textContent = 'COUNTDOWN';
    stateBadge.classList.add('active-workout');
    btnLabel.textContent = 'PAUSE WORKOUT';
    btnIcon.textContent = '⏸';
    btnToggleWorkout.classList.add('btn-pause');
    btnSkipRest.style.display = 'none';
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
  } else if (state === STATES.REST_TIMER) {
    stateBadge.textContent = 'REST PERIOD';
    stateBadge.classList.add('active-rest');
    circleProgressEl.classList.add('rest-mode');
    btnSkipRest.style.display = 'inline-block';
    hudNumberEl.textContent = `${ctx.restRemaining}`;
    hudLabelEl.textContent = 'SEC REST';
  } else if (state === STATES.PAUSED) {
    stateBadge.textContent = 'PAUSED';
    btnLabel.textContent = 'RESUME WORKOUT';
    btnIcon.textContent = '▶';
    btnToggleWorkout.classList.remove('btn-pause');
  } else if (state === STATES.COMPLETED) {
    stateBadge.textContent = 'COMPLETED';
    stateBadge.classList.add('active-workout');
    btnLabel.textContent = 'RESTART WORKOUT';
    btnIcon.textContent = '🔄';
    btnToggleWorkout.classList.remove('btn-pause');
    btnSkipRest.style.display = 'none';
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
    if (status === 'LISTENING') {
      micVisualizer.classList.remove('speaking');
      micVisualizer.classList.add('listening');
      micIndicator.textContent = 'LISTENING';
      micIndicator.className = 'state-tag active-workout';
    } else if (status === 'OFF') {
      micVisualizer.className = 'mic-visualizer';
      micIndicator.textContent = 'STANDBY';
      micIndicator.className = 'state-tag';
    } else if (status === 'MIC_BLOCKED') {
      micIndicator.textContent = 'BLOCKED';
      micIndicator.className = 'state-tag interrupted';
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

  // Play glitch sound effect and cut audio
  soundFx.playBargeInGlitch();
  audioController.interrupt(reason);
}

// Spoken Command Router
function handleSpokenCommand(command, rawText) {
  logMessage(`🎙️ [COMMAND HEARD] "${rawText}" -> ${command}`, 'user');

  // Any command cuts audio first
  triggerBargeIn(`Command parsed: ${command}`);

  switch (command) {
    case 'SKIP_REST':
      if (stateMachine.state === STATES.REST_TIMER) {
        logMessage(`🎯 Executing: SKIP REST`, 'success');
        stateMachine.skipRest();
      } else {
        stateMachine.skipRest();
      }
      break;

    case 'PAUSE':
      stateMachine.pause();
      break;

    case 'RESUME':
      stateMachine.resume();
      break;

    case 'ADD_REST':
      if (stateMachine.state === STATES.REST_TIMER) {
        stateMachine.addRestSeconds(10);
      } else {
        audioController.speak("You can only add rest time during a rest period.");
      }
      break;

    case 'NEXT_EXERCISE':
      stateMachine.nextExercise();
      break;

    default:
      console.log('Unrecognized command:', command);
  }
}

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
}

initApp();
