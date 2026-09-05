/**
 * app.js
 * Main Orchestrator for Virtual Gym Trainer
 * Coordinates Spline 3D Robot Mascot, Rime TTS, AudioController, StateMachine,
 * VoiceListener, SoundFX, and CollaborationBackground.
 */

import { RimeClient } from './rimeClient.js';
import { AudioController } from './audioController.js';
import { WorkoutStateMachine, STATES, WORKOUT_ROUTINES } from './stateMachine.js';
import { VoiceListener } from './voiceListener.js';
import { SoundFX } from './soundFx.js';
import { CollaborationBackground } from './collaborationBackground.js';

// 0. Architectural Background Initialization
const collabBg = new CollaborationBackground('collab-bg-canvas');

// DOM Elements: Audio & Header
const btnMute = document.getElementById('btn-mute');
const volSlider = document.getElementById('vol-slider');

// DOM Elements: HUD & Workout
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

// =========================================================
// Spline 3D Robot HUD & Mouth/Ear Vocalizer Synchronizers
// =========================================================
function updateSpeechHUD(text, isSpeaking) {
  const robotMouthStatus = document.getElementById('robot-mouth-status');
  const robotSpeakingLabel = document.getElementById('robot-speaking-label');
  const robotSpeechBubble = document.getElementById('robot-speech-bubble');
  const robotSpeechText = document.getElementById('robot-speech-text');

  if (robotSpeechText && text) {
    robotSpeechText.textContent = `"${text}"`;
  }

  if (robotMouthStatus) {
    if (isSpeaking) {
      robotMouthStatus.classList.add('is-talking');
      if (robotSpeakingLabel) robotSpeakingLabel.textContent = 'VOCALIZER: SPEAKING';
      if (robotSpeechBubble) robotSpeechBubble.classList.add('is-talking');
    } else {
      robotMouthStatus.classList.remove('is-talking');
      if (robotSpeakingLabel) robotSpeakingLabel.textContent = 'VOCALIZER: READY';
      if (robotSpeechBubble) robotSpeechBubble.classList.remove('is-talking');
    }
  }
}

function updateRobotAction(actionType, text, exerciseName = '') {
  const robotViewerWrapper = document.getElementById('robot-viewer-wrapper');
  const robotActionText = document.getElementById('robot-action-text');
  const robotCurrentExercise = document.getElementById('robot-current-exercise');

  if (robotCurrentExercise && exerciseName) {
    robotCurrentExercise.textContent = exerciseName.toUpperCase();
  }
  if (robotActionText && text) {
    robotActionText.textContent = text;
  }
  if (!robotViewerWrapper) return;

  robotViewerWrapper.classList.remove(
    'action-pushup-rep',
    'action-squat-rep',
    'action-jump-rep',
    'action-plank-hold',
    'action-rest-breathe',
    'action-interrupted',
    'action-victory',
    'action-countdown'
  );

  if (actionType) {
    void robotViewerWrapper.offsetWidth; // Force CSS reflow
    robotViewerWrapper.classList.add(actionType);
  }
}

function triggerRobotRepAction(exerciseName, repNumber) {
  const robotViewerWrapper = document.getElementById('robot-viewer-wrapper');
  if (!robotViewerWrapper) return;

  const exLower = (exerciseName || '').toLowerCase();
  const pacingSec = (stateMachine.repPacingMs / 1000).toFixed(2);
  robotViewerWrapper.style.setProperty('--pacing-duration', `${pacingSec}s`);

  if (exLower.includes('push') || exLower.includes('dip')) {
    updateRobotAction('action-pushup-rep', `Push-Up Rep ${repNumber}`, exerciseName);
  } else if (exLower.includes('squat') || exLower.includes('lunge')) {
    updateRobotAction('action-squat-rep', `Squat Rep ${repNumber}`, exerciseName);
  } else if (exLower.includes('climber') || exLower.includes('jack') || exLower.includes('jump')) {
    updateRobotAction('action-jump-rep', `Jump Rep ${repNumber}`, exerciseName);
  } else if (exLower.includes('plank') || exLower.includes('hold') || exLower.includes('crawl')) {
    updateRobotAction('action-plank-hold', `Plank Hold (${repNumber}s)`, exerciseName);
  } else {
    updateRobotAction('action-squat-rep', `Rep ${repNumber}`, exerciseName);
  }
}

function triggerRobotBargeIn() {
  const robotMouthStatus = document.getElementById('robot-mouth-status');
  const robotSpeakingLabel = document.getElementById('robot-speaking-label');
  const robotViewerWrapper = document.getElementById('robot-viewer-wrapper');
  const robotActionText = document.getElementById('robot-action-text');

  if (robotMouthStatus) {
    robotMouthStatus.classList.remove('is-talking');
    if (robotSpeakingLabel) robotSpeakingLabel.textContent = 'VOCALIZER: INTERRUPTED';
    setTimeout(() => {
      if (robotSpeakingLabel) robotSpeakingLabel.textContent = 'VOCALIZER: READY';
    }, 1200);
  }

  if (robotViewerWrapper) {
    robotViewerWrapper.classList.remove(
      'action-pushup-rep', 'action-squat-rep', 'action-jump-rep',
      'action-plank-hold', 'action-rest-breathe', 'action-victory', 'action-countdown'
    );
    void robotViewerWrapper.offsetWidth;
    robotViewerWrapper.classList.add('action-interrupted');
    if (robotActionText) robotActionText.textContent = '⚡ Barge-In Halt!';
    setTimeout(() => {
      robotViewerWrapper.classList.remove('action-interrupted');
    }, 450);
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
    if (newState === STATES.IDLE) {
      updateRobotAction('', 'Active Mascot Ready', context.exercise ? context.exercise.name : 'Push-Ups');
    } else if (newState === STATES.COUNTDOWN) {
      updateRobotAction('action-countdown', 'Get In Position!', context.exercise ? context.exercise.name : 'Ready');
    } else if (newState === STATES.EXERCISE_REPS) {
      updateRobotAction('', `Set ${context.set}: Ready for Rep 1`, context.exercise ? context.exercise.name : 'Exercise');
    } else if (newState === STATES.REST_TIMER) {
      updateRobotAction('action-rest-breathe', `Rest & Recovery (${context.restRemaining}s)`, 'Rest');
    } else if (newState === STATES.PAUSED) {
      updateRobotAction('', 'Workout Paused (Holding)', 'Paused');
    } else if (newState === STATES.COMPLETED) {
      updateRobotAction('action-victory', 'Workout Crushed! 🏆', 'Champion');
    }

    if (collabBg) {
      collabBg.triggerPulse(true);
    }
  },
  onTick: (context) => {
    updateHUD(context.state, context);
    if (context.state === STATES.REST_TIMER) {
      const robotActionText = document.getElementById('robot-action-text');
      if (robotActionText) robotActionText.textContent = `Rest & Recovery (${context.restRemaining}s)`;
    }
    if (collabBg) {
      collabBg.setRepIntensity(context.state === STATES.EXERCISE_REPS ? 1.2 : 0.4);
    }
  },
  onRep: (repNum, repTarget) => {
    soundFx.playRepDing();
    triggerRobotRepAction(stateMachine.currentExercise.name, repNum);
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
    const robotEarStatus = document.getElementById('robot-ear-status');
    const robotListeningLabel = document.getElementById('robot-listening-label');
    if (robotEarStatus) robotEarStatus.classList.add('is-hearing');
    if (robotListeningLabel) robotListeningLabel.textContent = 'EAR: HEARING SPEECH';

    // If coach is speaking, user has started interrupting!
    if (audioController.isPlaying) {
      triggerBargeIn('Acoustic voice start detected over mic');
    }
  },
  onStatusChange: (status) => {
    const btnMicToggle = document.getElementById('btn-mic-toggle');
    const btnMicText = document.getElementById('btn-mic-text');
    const robotEarStatus = document.getElementById('robot-ear-status');
    const robotListeningLabel = document.getElementById('robot-listening-label');

    if (status === 'LISTENING') {
      if (robotEarStatus) robotEarStatus.classList.remove('is-hearing');
      if (robotListeningLabel) robotListeningLabel.textContent = 'EAR SENSOR: LISTENING';
      if (btnMicToggle) btnMicToggle.classList.add('active');
      if (btnMicText) btnMicText.textContent = '🎙️ Mic Active (Listening)';
    } else if (status === 'SPEECH_DETECTED') {
      if (robotEarStatus) robotEarStatus.classList.add('is-hearing');
      if (robotListeningLabel) robotListeningLabel.textContent = 'EAR: HEARING YOU...';
      if (btnMicText) btnMicText.textContent = '🎙️ Hearing You...';
    } else if (status === 'OFF') {
      if (robotEarStatus) robotEarStatus.classList.remove('is-hearing');
      if (robotListeningLabel) robotListeningLabel.textContent = 'EAR SENSOR: STANDBY';
      if (btnMicToggle) btnMicToggle.classList.remove('active');
      if (btnMicText) btnMicText.textContent = '🎙️ Start Hands-Free Mic';
    } else if (status === 'MIC_BLOCKED') {
      if (robotEarStatus) robotEarStatus.classList.remove('is-hearing');
      if (robotListeningLabel) robotListeningLabel.textContent = 'MIC BLOCKED';
      if (btnMicToggle) btnMicToggle.classList.remove('active');
      if (btnMicText) btnMicText.textContent = '❌ Mic Blocked (Click)';
    }
  },
  onInterim: (text) => {
    const robotEarStatus = document.getElementById('robot-ear-status');
    if (robotEarStatus) robotEarStatus.classList.add('is-hearing');
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
  triggerRobotBargeIn();
}

// Spoken Command Router with Dynamic AI Semantic Brain
async function handleSpokenCommand(fallbackCommand, rawText, subReason) {
  logMessage(`🎙️ [HEARD] "${rawText}"`, 'user');

  // 1. Instant hardware audio cutoff (<1ms)
  triggerBargeIn(`Spoken input: "${rawText}"`);

  // Helper to sync routine pill active styling
  const syncRoutinePills = (routineKey) => {
    document.querySelectorAll('.routine-pill').forEach(pill => {
      pill.classList.toggle('active', pill.getAttribute('data-routine') === routineKey);
    });
  };

  // 2. Instant Zero-Latency Execution for Hard Fast Commands
  if (fallbackCommand === 'SWITCH_ROUTINE') {
    const target = subReason || 'triceps';
    const routine = stateMachine.switchWorkoutTo(target);
    syncRoutinePills(stateMachine.routineKey);
    stateMachine.startWorkout();
    const announcement = `Switching to ${routine.name}! Dropping previous workout. First exercise: ${routine.exercises[0].name}. Let's crush this set!`;
    logMessage(`💪 Routine Switched: ${routine.name}`, 'success');
    audioController.speak(announcement, true);
    return;
  }

  if (fallbackCommand === 'TEACH_EXERCISE') {
    stateMachine.pause();
    const currentEx = stateMachine.currentExercise.name;
    logMessage(`📚 Form Coaching requested for: ${currentEx}`, 'info');
    // Ask the masterclass engine
    askAiCoach(`Teach me what to do and how to do ${currentEx}`);
    return;
  }

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
    audioController.speak("Awesome to hear! Let's get right back to work.", true);
    return;
  }

  if (fallbackCommand === 'PAUSE') {
    stateMachine.pause();
    const clean = (rawText || '').toLowerCase();

    if (subReason === 'INJURY' || clean.includes('hurt myself') || clean.includes('injured') || clean.includes('pulled a muscle')) {
      logMessage(`🛡️ Instant Executing: PAUSE (Injury Triage)`, 'interrupt');
      audioController.speak("Workout paused immediately. Sit down, avoid bearing weight on the joint, and take slow, deep recovery breaths.", true);
    } else if (subReason === 'WATER' || clean.includes('water') || clean.includes('drink') || clean.includes('sip') || clean.includes('thirsty')) {
      logMessage(`💧 Instant Executing: PAUSE (Water Break)`, 'info');
      audioController.speak("Workout paused for water break. Rehydrate and catch your breath! Say start or resume when you're ready.", true);
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

  // 3. Conversational AI Brain Route (/api/intent-ai)
  try {
    const ctx = stateMachine.getContext();
    const res = await fetch('/api/intent-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        utterance: rawText,
        workoutContext: {
          exerciseName: ctx.exercise ? ctx.exercise.name : 'Push-ups',
          set: ctx.set,
          state: ctx.state
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      logMessage(`🧠 [AI DEDUCTION] Action: ${data.action} | "${data.spokenFeedback}"`, 'coach');

      if (data.action === 'SWITCH_ROUTINE') {
        const routine = stateMachine.switchWorkoutTo(data.parameter || 'triceps');
        syncRoutinePills(stateMachine.routineKey);
        stateMachine.startWorkout();
        audioController.speak(data.spokenFeedback, true);
        return;
      }

      if (data.action === 'START') {
        if (stateMachine.state === STATES.IDLE || stateMachine.state === STATES.COMPLETED) {
          stateMachine.startWorkout();
        } else if (stateMachine.state === STATES.PAUSED) {
          stateMachine.resume();
        }
        audioController.speak(data.spokenFeedback, true);
        return;
      }

      if (data.action === 'RESUME') {
        stateMachine.resume();
        audioController.speak(data.spokenFeedback, true);
        return;
      }

      if (data.action === 'PAUSE') {
        stateMachine.pause();
        audioController.speak(data.spokenFeedback, true);
        return;
      }

      if (data.action === 'SKIP_REST') {
        stateMachine.skipRest();
        audioController.speak(data.spokenFeedback, true);
        return;
      }

      if (data.action === 'ADD_REST') {
        if (stateMachine.state === STATES.REST_TIMER) {
          stateMachine.addRestSeconds(data.parameter || 10);
        }
        audioController.speak(data.spokenFeedback, true);
        return;
      }

      if (data.action === 'TEACH_EXERCISE') {
        stateMachine.pause();
        audioController.speak(data.spokenFeedback, true);
        return;
      }

      // Default: Spoken Coach Advice
      audioController.speak(data.spokenFeedback || "Stay focused and breathe through each rep!", true);
      return;
    }
  } catch (err) {
    console.error('Intent error:', err);
  }

  // Fallback to coach AI query
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
          exerciseName: ctx.exercise ? ctx.exercise.name : 'Push-ups',
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
  if (lower.includes('elbow')) advice = "Keep your elbows tucked at forty-five degrees, avoid flaring out.";
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
        handleSpokenCommand('', text);
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

  // Routine Selectors (All 6 Muscle Groups)
  routinePills.forEach(pill => {
    pill.addEventListener('click', () => {
      routinePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const key = pill.getAttribute('data-routine');
      const routine = stateMachine.switchWorkoutTo(key);
      logMessage(`📋 Switched routine to: ${(routine && routine.name) || key}`, 'info');
      audioController.speak(`Switching to ${(routine && routine.name) || key}. Ready for set one!`, true);
    });
  });

  // Pacing Selectors
  pacingBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      pacingBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const pacing = parseInt(btn.getAttribute('data-pacing'), 10);
      stateMachine.setPacing(pacing);
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
      soundFx.init();
      audioController.initAudioContext();
      voiceListener.toggle();
    });
  }

  // Ask AI text input
  if (btnAskAi && aiPromptInput) {
    btnAskAi.addEventListener('click', () => {
      const q = aiPromptInput.value.trim();
      if (q) {
        handleSpokenCommand('', q);
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

// Clean Spline Watermark / Logo Remover
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
setInterval(hideSplineLogo, 150);

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
    soundFx.init();
    audioController.initAudioContext();
    if (!voiceListener.isListening && voiceListener.hasSupport) {
      voiceListener.start();
    }
  }, { once: true });
}

window.addEventListener('DOMContentLoaded', initApp);
