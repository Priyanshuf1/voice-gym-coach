/**
 * app.js
 * Main Orchestrator for Voice Gym Coach
 * Coordinates Rime TTS, AudioController, StateMachine, VoiceListener, SoundFX,
 * ExerciseVisualizer (Biomechanics Demo & Mascot), and CollaborationBackground.
 */

import { RimeClient } from './rimeClient.js';
import { AudioController } from './audioController.js';
import { WorkoutStateMachine, STATES, WORKOUT_ROUTINES } from './stateMachine.js';
import { VoiceListener } from './voiceListener.js';
import { SoundFX } from './soundFx.js';
import { CollaborationBackground } from './collaborationBackground.js';
import { ExerciseVisualizer } from './exerciseVisualizer.js';

// 0. Background & Exercise Visualizer Initialization
const collabBg = new CollaborationBackground('collab-bg-canvas');
const exerciseVisualizer = new ExerciseVisualizer('exercise-visualizer-container');

// DOM Elements
const btnMute = document.getElementById('btn-mute');
const volSlider = document.getElementById('vol-slider');

const stateBadge = document.getElementById('state-badge');
const setBadge = document.getElementById('set-badge');
const exerciseNameEl = document.getElementById('exercise-name');
const workoutTargetEl = document.getElementById('workout-target');
const hudNumberEl = document.getElementById('hud-number');
const hudLabelEl = document.getElementById('hud-label');
const circleProgressEl = document.getElementById('circle-progress');

const btnToggleWorkout = document.getElementById('btn-toggle-workout');
const btnLabel = document.getElementById('btn-label');
const btnIcon = document.getElementById('btn-icon');
const btnSkipRest = document.getElementById('btn-skip-rest');

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
if (circleProgressEl) {
  circleProgressEl.style.strokeDasharray = `${CIRCLE_CIRCUMFERENCE}`;
  circleProgressEl.style.strokeDashoffset = '0';
}

// Initialize SoundFX
const soundFx = new SoundFX();

// Metrics & Log State
let interruptCount = 0;

function logMessage(text, type = 'info') {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `<span style="opacity:0.6;">[${time}]</span> ${text}`;
  if (logConsole) {
    logConsole.appendChild(entry);
    logConsole.scrollTop = logConsole.scrollHeight;
  }
}

// 1. Initialize Rime Client (Speaker: celeste, Model: coda)
const rimeClient = new RimeClient({
  speaker: 'celeste',
  modelId: 'coda'
});

// Helper to update Robot Mascot and Stage Subtitles
function updateSpeechHUD(text, isSpeaking) {
  const stageSpeechHud = document.getElementById('stage-robot-speech-hud');
  const stageSubtitle = document.getElementById('stage-coach-subtitle');
  const stageHudTitle = document.getElementById('stage-speech-hud-title');

  if (stageSubtitle && text) {
    stageSubtitle.textContent = `"${text}"`;
  }

  if (stageSpeechHud) {
    if (isSpeaking) {
      stageSpeechHud.classList.add('is-talking');
      if (stageHudTitle) stageHudTitle.textContent = 'COACH CELESTE • SPEAKING';
    } else {
      stageSpeechHud.classList.remove('is-talking');
      if (stageHudTitle) stageHudTitle.textContent = 'COACH CELESTE • READY';
    }
  }
}

// 2. Initialize Audio Controller with live Robot sync
const audioController = new AudioController(
  rimeClient,
  (subtitle) => {
    updateSpeechHUD(subtitle, true);
    logMessage(`🗣️ Coach: "${subtitle}"`, 'coach');
  },
  (logText, logType) => {
    logMessage(logText, logType);
  },
  (isPlaying, text) => {
    updateSpeechHUD(text, isPlaying);
  }
);

// 3. Initialize Finite State Machine (FSM)
const stateMachine = new WorkoutStateMachine({
  audioController,
  soundFx,
  onStateChange: (newState, context) => {
    updateHUD(newState, context);
    if (exerciseVisualizer) {
      exerciseVisualizer.setState(
        newState,
        context.rep,
        context.targetReps,
        context.restRemaining,
        context.totalRest
      );
      if (context.exercise) {
        exerciseVisualizer.setExercise(context.exercise.id);
      }
    }
    if (collabBg) {
      collabBg.triggerPulse(true);
    }
  },
  onTick: (context) => {
    updateHUD(context.state, context);
    if (exerciseVisualizer) {
      exerciseVisualizer.setState(
        context.state,
        context.rep,
        context.targetReps,
        context.restRemaining,
        context.totalRest
      );
    }
    if (collabBg) {
      collabBg.setRepIntensity(context.state === STATES.EXERCISE_REPS ? 1.2 : 0.4);
    }
  },
  onRep: (repNum, repTarget) => {
    soundFx.playRepDing();
    if (collabBg) {
      collabBg.triggerPulse(false);
    }
  },
  onLog: (msg, type) => {
    logMessage(msg, type);
  }
});

// Update UI on State Changes
function updateHUD(state, context) {
  const ex = context.exercise || {};
  const set = context.set || 1;
  const totalSets = context.totalSets || ex.sets || 3;
  const rep = context.rep || 0;
  const targetReps = context.targetReps || ex.reps || 8;
  const restRemaining = context.restRemaining || 0;
  const totalRest = context.totalRest || ex.restSeconds || 30;

  if (exerciseNameEl) exerciseNameEl.textContent = ex.name || 'Push-ups';
  if (workoutTargetEl) workoutTargetEl.textContent = `Target: ${targetReps} Reps • ${totalRest}s Rest`;
  if (setBadge) setBadge.textContent = `SET ${set} OF ${totalSets}`;

  // Reset tag classes
  if (stateBadge) {
    stateBadge.className = 'state-tag';

    switch (state) {
      case STATES.IDLE:
        stateBadge.textContent = 'READY';
        hudNumberEl.textContent = '0';
        hudLabelEl.textContent = 'REPS';
        btnLabel.textContent = 'START WORKOUT';
        btnIcon.textContent = '▶';
        btnToggleWorkout.className = 'btn-primary';
        btnSkipRest.style.display = 'none';
        setProgressOffset(0, 1);
        break;

      case STATES.COUNTDOWN:
        stateBadge.textContent = 'GET READY';
        stateBadge.classList.add('countdown');
        hudNumberEl.textContent = restRemaining;
        hudLabelEl.textContent = 'SECONDS';
        btnLabel.textContent = 'PAUSE';
        btnIcon.textContent = '⏸';
        btnToggleWorkout.className = 'btn-primary pause';
        btnSkipRest.style.display = 'none';
        setProgressOffset(restRemaining, 3);
        break;

      case STATES.EXERCISE_REPS:
        stateBadge.textContent = 'ACTIVE SET';
        stateBadge.classList.add('active-workout');
        hudNumberEl.textContent = rep;
        hudLabelEl.textContent = `OF ${targetReps} REPS`;
        btnLabel.textContent = 'PAUSE';
        btnIcon.textContent = '⏸';
        btnToggleWorkout.className = 'btn-primary pause';
        btnSkipRest.style.display = 'none';
        setProgressOffset(rep, targetReps);
        break;

      case STATES.REST_TIMER:
        stateBadge.textContent = 'RESTING';
        stateBadge.classList.add('resting');
        hudNumberEl.textContent = restRemaining;
        hudLabelEl.textContent = 'SEC REST';
        btnLabel.textContent = 'PAUSE';
        btnIcon.textContent = '⏸';
        btnToggleWorkout.className = 'btn-primary pause';
        btnSkipRest.style.display = 'inline-flex';
        setProgressOffset(restRemaining, totalRest);
        break;

      case STATES.PAUSED:
        stateBadge.textContent = 'PAUSED';
        stateBadge.classList.add('paused');
        btnLabel.textContent = 'RESUME';
        btnIcon.textContent = '▶';
        btnToggleWorkout.className = 'btn-primary';
        break;

      case STATES.COMPLETED:
        stateBadge.textContent = 'WORKOUT COMPLETED';
        stateBadge.classList.add('active-workout');
        hudNumberEl.textContent = '🏆';
        hudLabelEl.textContent = 'DONE';
        btnLabel.textContent = 'START AGAIN';
        btnIcon.textContent = '↺';
        btnToggleWorkout.className = 'btn-primary';
        btnSkipRest.style.display = 'none';
        setProgressOffset(1, 1);
        break;
    }
  }
}

function setProgressOffset(current, max) {
  if (!circleProgressEl) return;
  const progress = max > 0 ? Math.min(Math.max(current / max, 0), 1) : 0;
  const offset = CIRCLE_CIRCUMFERENCE * (1 - progress);
  circleProgressEl.style.strokeDashoffset = `${offset}`;
}

// 4. Initialize Voice Listener with Zero-Latency Barge-In
const voiceListener = new VoiceListener({
  onSpeechStart: () => {
    const stageEarHud = document.getElementById('stage-robot-ear-hud');
    const stageMicIndicator = document.getElementById('stage-mic-indicator');
    if (stageEarHud) stageEarHud.classList.add('is-hearing');
    if (stageMicIndicator) stageMicIndicator.textContent = 'EAR • HEARING SPEECH';

    // If coach is speaking, user has started interrupting!
    if (audioController.isPlaying) {
      triggerBargeIn('Acoustic voice start detected over mic');
    }
  },
  onStatusChange: (status) => {
    const btnMicToggle = document.getElementById('btn-mic-toggle');
    const btnMicText = document.getElementById('btn-mic-text');
    const stageEarHud = document.getElementById('stage-robot-ear-hud');
    const stageMicIndicator = document.getElementById('stage-mic-indicator');

    if (status === 'LISTENING') {
      if (stageEarHud) stageEarHud.classList.remove('is-hearing');
      if (stageMicIndicator) stageMicIndicator.textContent = 'EAR SENSOR • LISTENING';
      if (btnMicToggle) btnMicToggle.classList.add('active');
      if (btnMicText) btnMicText.textContent = '🎙️ Mic Active (Listening)';
    } else if (status === 'SPEECH_DETECTED') {
      if (stageEarHud) stageEarHud.classList.add('is-hearing');
      if (stageMicIndicator) stageMicIndicator.textContent = 'EAR • HEARING...';
      if (btnMicText) btnMicText.textContent = '🎙️ Hearing You...';
    } else if (status === 'OFF') {
      if (stageEarHud) stageEarHud.classList.remove('is-hearing');
      if (stageMicIndicator) stageMicIndicator.textContent = 'EAR • STANDBY';
      if (btnMicToggle) btnMicToggle.classList.remove('active');
      if (btnMicText) btnMicText.textContent = '🎙️ Start Hands-Free Mic';
    } else if (status === 'MIC_BLOCKED') {
      if (stageEarHud) stageEarHud.classList.remove('is-hearing');
      if (stageMicIndicator) stageMicIndicator.textContent = 'MIC BLOCKED';
      if (btnMicToggle) btnMicToggle.classList.remove('active');
      if (btnMicText) btnMicText.textContent = '❌ Mic Blocked (Click)';
    }
  },
  onInterim: (text) => {
    const stageTranscript = document.getElementById('stage-heard-transcript');
    if (stageTranscript) stageTranscript.textContent = `"${text}"`;
    const stageEarHud = document.getElementById('stage-robot-ear-hud');
    if (stageEarHud) stageEarHud.classList.add('is-hearing');
  },
  onCommand: (command, rawText, subReason) => {
    handleSpokenCommand(command, rawText, subReason);
  },
  onLog: (msg, type) => {
    logMessage(msg, type);
  }
});

// Common Barge-In Trigger (<1ms audio cutoff)
function triggerBargeIn(reason) {
  interruptCount++;
  if (interruptCountBadge) {
    interruptCountBadge.textContent = `${interruptCount} Interrupt${interruptCount > 1 ? 's' : ''}`;
  }
  
  if (stateBadge) {
    stateBadge.classList.add('interrupted');
    setTimeout(() => stateBadge.classList.remove('interrupted'), 400);
  }

  // Play glitch sound effect and cut audio
  soundFx.playBargeInGlitch();
  audioController.interrupt(reason);
}

// Spoken Command Router with Dynamic AI Semantic Brain
async function handleSpokenCommand(fallbackCommand, rawText, subReason) {
  logMessage(`🎙️ [HEARD] "${rawText}"`, 'user');
  const stageTranscript = document.getElementById('stage-heard-transcript');
  if (stageTranscript) stageTranscript.textContent = `"${rawText}"`;

  // 1. Instant hardware audio cutoff (<1ms)
  triggerBargeIn(`Spoken input: "${rawText}"`);

  // 2. Instant Zero-Latency Execution for Hard Commands
  if (fallbackCommand === 'START') {
    logMessage(`🎯 Instant Executing: START WORKOUT`, 'success');
    if (stateMachine.state === STATES.IDLE || stateMachine.state === STATES.COMPLETED) {
      stateMachine.startWorkout();
    } else if (stateMachine.state === STATES.PAUSED) {
      stateMachine.resume();
    } else if (stateMachine.state === STATES.REST_TIMER) {
      stateMachine.skipRest();
    }
    audioController.speak("Starting workout! Let's crush this session!", true);
    return;
  }

  if (fallbackCommand === 'RESUME') {
    logMessage(`🎯 Instant Executing: RESUME WORKOUT`, 'success');
    if (stateMachine.state === STATES.PAUSED) {
      stateMachine.resume();
    } else if (stateMachine.state === STATES.IDLE) {
      stateMachine.startWorkout();
    } else if (stateMachine.state === STATES.REST_TIMER) {
      stateMachine.skipRest();
    }
    audioController.speak("Awesome! Let's get right back to work.", true);
    return;
  }

  if (fallbackCommand === 'PAUSE') {
    stateMachine.pause();
    const clean = (rawText || '').toLowerCase();

    if (subReason === 'WATER' || clean.includes('water') || clean.includes('drink') || clean.includes('sip') || clean.includes('thirsty')) {
      logMessage(`💧 Instant Executing: PAUSE (Water Break)`, 'info');
      audioController.speak("Workout paused for water break. Stay hydrated, champ! Say start or resume when you're ready.", true);
    } else if (subReason === 'REST' || clean.includes('breathe') || clean.includes('breath') || clean.includes('tired') || clean.includes('exhausted')) {
      logMessage(`🫁 Instant Executing: PAUSE (Breather)`, 'info');
      audioController.speak("Workout paused. Catch your breath! Say start or resume whenever you're ready.", true);
    } else if (subReason === 'PAIN' || clean.includes('hurt') || clean.includes('pain') || clean.includes('elbow') || clean.includes('shoulder')) {
      logMessage(`🛡️ Instant Executing: PAUSE (Safety Check)`, 'info');
      if (clean.includes('elbow')) {
        audioController.speak("Workout paused. Tuck your elbows to forty-five degrees and avoid flaring out. Say start when ready.", true);
      } else {
        audioController.speak("Workout paused for safety. Check your form, take a breath, and don't push through joint pain. Say start when ready.", true);
      }
    } else {
      logMessage(`🎯 Instant Executing: PAUSE WORKOUT`, 'info');
      audioController.speak("Workout paused. Say start or resume when you're ready.", true);
    }
    return;
  }

  if (fallbackCommand === 'SKIP_REST') {
    logMessage(`🎯 Instant Executing: SKIP REST`, 'success');
    stateMachine.skipRest();
    audioController.speak("Skipping rest! Next set starts now.", true);
    return;
  }

  if (fallbackCommand === 'ADD_REST') {
    logMessage(`🎯 Instant Executing: ADD REST`, 'success');
    if (stateMachine.state === STATES.REST_TIMER) {
      stateMachine.addRestSeconds(10);
    }
    audioController.speak("Added ten more seconds to rest. Breathe deep!", true);
    return;
  }

  if (fallbackCommand === 'NEXT_EXERCISE') {
    logMessage(`🎯 Instant Executing: NEXT EXERCISE`, 'success');
    stateMachine.nextExercise();
    audioController.speak("Moving to next exercise!", true);
    return;
  }

  // 3. Conversational AI Brain (Powered by gemini-web2api)
  askAiCoach(rawText);
}
window.handleSpokenCommand = handleSpokenCommand;

// Conversational AI Coach Brain (Powered by gemini-web2api)
async function askAiCoach(question) {
  if (!question || !question.trim()) return;

  triggerBargeIn('User asked AI Coach question');
  logMessage(`🤖 [AI INQUIRY] "${question}"`, 'user');
  updateSpeechHUD('Analyzing question with AI...', false);

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

    if (res.ok) {
      const data = await res.json();
      const reply = data.reply || "Keep your form clean and your core braced tight!";
      logMessage(`💡 [AI COACH (${data.source})] "${reply}"`, 'coach');
      audioController.speak(reply, true);
    } else {
      fallbackCoachAdvice(question);
    }
  } catch (err) {
    console.error('AI error:', err);
    fallbackCoachAdvice(question);
  }
}

function fallbackCoachAdvice(question) {
  const lower = question.toLowerCase();
  let advice = "Keep your core braced and focus on clean movement!";
  if (lower.includes('elbow')) advice = "Keep your elbows tucked at 45 degrees, avoid flaring out.";
  else if (lower.includes('form') || lower.includes('push')) advice = "Chest to floor, glutes tight, neutral spine.";
  else if (lower.includes('squat')) advice = "Drive knees outward over toes, chest up, press through heels.";
  else if (lower.includes('water') || lower.includes('drink')) advice = "Workout paused for water break. Stay hydrated!";
  
  logMessage(`💡 [COACH ADVICE] "${advice}"`, 'coach');
  audioController.speak(advice, true);
}

// Visualizer Waveform Audio Monitor
function initWaveformVisualizer() {
  if (!visualizerCanvas) return;
  const canvas = visualizerCanvas;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = canvas.parentElement.clientWidth || 300;
    canvas.height = 42;
  }
  resize();
  window.addEventListener('resize', resize);

  let phase = 0;
  function draw() {
    requestAnimationFrame(draw);
    phase += 0.05;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isVoiceActive = audioController.isPlaying || voiceListener.isListening;
    const baseAmp = isVoiceActive ? (audioController.isPlaying ? 14 : 7) : 2;

    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);

    for (let x = 0; x < canvas.width; x += 4) {
      const freq = 0.04;
      const y = canvas.height / 2 + Math.sin(x * freq + phase) * baseAmp * Math.sin(x * 0.01);
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = audioController.isPlaying ? '#E07A5F' : (voiceListener.isListening ? '#2A9D8F' : 'rgba(212, 163, 115, 0.35)');
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  draw();
}

// Clickable Conversational Voice Chips
function initVoiceChips() {
  document.querySelectorAll('.voice-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const text = chip.getAttribute('data-speak');
      if (text) {
        logMessage(`👆 Simulating spoken phrase: "${text}"`, 'user');
        voiceListener.checkFastCommands(text);
      }
    });
  });
}

// Pronunciation Lab Compare Audio
function initPronunciationLab() {
  document.querySelectorAll('.btn-compare-audio').forEach(btn => {
    btn.addEventListener('click', async () => {
      const textA = btn.getAttribute('data-a');
      const textB = btn.getAttribute('data-b');
      btn.disabled = true;
      btn.textContent = 'Speaking...';

      logMessage(`🔬 Pronunciation Compare: "${textA}" vs "${textB}"`, 'info');
      await audioController.speak(textA);
      await new Promise(r => setTimeout(r, 600));
      await audioController.speak(textB);

      btn.disabled = false;
      btn.textContent = 'Compare';
    });
  });
}

// Event Bindings
function initEvents() {
  // Workout Toggle Button
  if (btnToggleWorkout) {
    btnToggleWorkout.addEventListener('click', () => {
      if (stateMachine.state === STATES.IDLE || stateMachine.state === STATES.COMPLETED) {
        stateMachine.startWorkout();
      } else if (stateMachine.state === STATES.PAUSED) {
        stateMachine.resume();
      } else {
        stateMachine.pause();
      }
    });
  }

  // Skip Rest Button
  if (btnSkipRest) {
    btnSkipRest.addEventListener('click', () => {
      stateMachine.skipRest();
    });
  }

  // Routine Selectors
  routinePills.forEach(pill => {
    pill.addEventListener('click', () => {
      routinePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const key = pill.getAttribute('data-routine');
      stateMachine.setRoutine(key);
      if (exerciseVisualizer) {
        const plan = WORKOUT_ROUTINES[key];
        if (plan && plan.exercises[0]) {
          exerciseVisualizer.setExercise(plan.exercises[0].id);
        }
      }
    });
  });

  // Pacing Selectors
  pacingBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      pacingBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const pacing = parseInt(btn.getAttribute('data-pacing'), 10);
      stateMachine.setRepPacing(pacing);
    });
  });

  // Master Volume Controls
  if (btnMute) {
    btnMute.addEventListener('click', () => {
      const isMuted = audioController.toggleMute();
      btnMute.textContent = isMuted ? '🔇' : '🔊';
    });
  }

  if (volSlider) {
    volSlider.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      audioController.setVolume(vol);
    });
  }

  // Live Hands-Free Mic Toggle Button
  const btnMicToggle = document.getElementById('btn-mic-toggle');
  if (btnMicToggle) {
    btnMicToggle.addEventListener('click', () => {
      voiceListener.toggle();
    });
  }

  // Ask AI text input
  if (btnAskAi && aiPromptInput) {
    btnAskAi.addEventListener('click', () => {
      const q = aiPromptInput.value.trim();
      if (q) {
        askAiCoach(q);
        aiPromptInput.value = '';
      }
    });
    aiPromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        btnAskAi.click();
      }
    });
  }

  // Test Buttons
  if (testVoiceSkip) {
    testVoiceSkip.addEventListener('click', () => {
      handleSpokenCommand('SKIP_REST', 'skip rest');
    });
  }

  if (testVoiceStop) {
    testVoiceStop.addEventListener('click', () => {
      handleSpokenCommand('PAUSE', 'I want to drink water', 'WATER');
    });
  }

  if (copyLogsBtn) {
    copyLogsBtn.addEventListener('click', () => {
      const logs = logConsole ? logConsole.innerText : '';
      navigator.clipboard.writeText(logs).then(() => {
        logMessage('📋 Audit logs copied to clipboard!', 'success');
      });
    });
  }

  if (clearLogsBtn && logConsole) {
    clearLogsBtn.addEventListener('click', () => {
      logConsole.innerHTML = '';
      logMessage('[System] Logs cleared.', 'info');
    });
  }
}

// App Startup & Server Config Check
async function initApp() {
  logMessage('[System] Checking Rime TTS & Gemini Web2API configuration...', 'info');
  const config = await rimeClient.checkConfig();

  if (config.isRimeConfigured) {
    logMessage(`✅ Connected to Rime.ai TTS Engine (Model: ${config.model}, Speaker: ${config.defaultSpeaker})`, 'success');
  } else {
    logMessage('ℹ️ Local TTS Active (RIME_API_KEY in .env will upgrade to live Coda)', 'info');
  }

  if (config.isGeminiWeb2ApiLive) {
    logMessage('✅ Connected to gemini-web2api on port 8081 for unlimited AI intelligence!', 'success');
  } else {
    logMessage('ℹ️ Built-in athletic coach AI active.', 'info');
  }

  initWaveformVisualizer();
  initVoiceChips();
  initPronunciationLab();
  initEvents();

  // Auto-start microphone on user interaction
  document.body.addEventListener('click', () => {
    if (!voiceListener.isListening && voiceListener.hasSupport) {
      voiceListener.start();
    }
  }, { once: true });
}

window.addEventListener('DOMContentLoaded', initApp);
