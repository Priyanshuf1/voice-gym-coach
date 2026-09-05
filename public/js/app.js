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
import { ExerciseVisualizer } from './exerciseVisualizer.js';

// 0. Architectural Background Initialization
const collabBg = new CollaborationBackground('collab-bg-canvas');

// 0b. Virtual Workout Form Demonstration & Video Player
const exerciseVisualizer = new ExerciseVisualizer('exercise-demo-container');
window.__triggerSpokenMasterclass = (exId) => {
  stateMachine.pause();
  handleSpokenCommand('TEACH_EXERCISE', `Teach me how to do ${stateMachine.currentExercise.name}`);
};

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

// Pre-cache high-frequency coach responses into memory for instant (<15ms) playback
rimeClient.precache([
  "Workout paused for water break. Rehydrate and catch your breath! Say start or resume when you're ready.",
  "Workout paused. Catch your breath! Say start or resume whenever you're ready.",
  "Workout paused. Say start or resume when you're ready.",
  "Starting workout! Let's crush this session!",
  "Awesome to hear! Let's get right back to work.",
  "Skipping rest! Starting the next set now.",
  "Added ten more seconds to rest. Breathe deep!",
  "Switching to Triceps focus! Dropping previous workout. First up: Diamond Push-ups. Keep hands close and elbows tucked. Starting set one now!",
  "Switching to Leg day! Dropping previous workout. First exercise: Bodyweight Squats. Keep your chest up, drive knees out. Starting set one now!",
  "Switching to Chest blast! Dropping previous workout. First up: Standard Push-ups. Squeeze your pecs at the top. Starting set one now!",
  "Switching to Core shield! Dropping previous workout. First up: Forearm Plank Hold. Brace like taking a punch. Starting set one now!",
  "Switching to Shoulders! Dropping previous workout. First up: Pike Push-ups. Drive through your delts with power. Starting set one now!"
]);

// =========================================================
// Spline 3D Robot HUD & Mouth/Ear Vocalizer Synchronizers
// =========================================================
function updateSpeechHUD(text, isSpeaking) {
  const robotMouthStatus = document.getElementById('robot-mouth-status');
  const robotSpeakingLabel = document.getElementById('robot-speaking-label');
  const robotSpeechBubble = document.getElementById('robot-speech-bubble');
  const robotSpeechText = document.getElementById('robot-speech-text');
  const robotViewerWrapper = document.getElementById('robot-viewer-wrapper');
  const cyberMascot = document.getElementById('cyber-coach-mascot');

  if (robotSpeechText && text) {
    robotSpeechText.textContent = `"${text}"`;
  }

  if (robotViewerWrapper) {
    if (isSpeaking) robotViewerWrapper.classList.add('is-talking');
    else robotViewerWrapper.classList.remove('is-talking');
  }

  if (robotMouthStatus) {
    if (isSpeaking) {
      robotMouthStatus.classList.add('is-talking');
      if (cyberMascot) cyberMascot.classList.add('is-talking');
      if (robotSpeakingLabel) robotSpeakingLabel.textContent = 'VOCALIZER: SPEAKING';
      if (robotSpeechBubble) robotSpeechBubble.classList.add('is-talking');
    } else {
      robotMouthStatus.classList.remove('is-talking');
      if (cyberMascot) cyberMascot.classList.remove('is-talking');
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
    if (exerciseVisualizer) {
      exerciseVisualizer.setState(newState, context.rep, context.targetReps, context.restRemaining, context.totalRest);
      if (context.exercise) {
        exerciseVisualizer.setExercise(context.exercise.id, context.exercise.name);
      }
    }
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
    if (exerciseVisualizer) {
      exerciseVisualizer.setState(context.state, context.rep, context.targetReps, context.restRemaining, context.totalRest);
    }
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
window.stateMachine = stateMachine;
window.handleSpokenCommand = handleSpokenCommand;

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

    // If coach is actively speaking audio, user has started interrupting
    if (audioController.isActivelyEmittingSound) {
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
    const spokenEl = document.getElementById('live-spoken-transcript');
    if (spokenEl && text) {
      spokenEl.textContent = `"${text}" (listening…)`;
      spokenEl.style.color = 'var(--accent-emerald)';
    }
  },
  onCommand: (command, rawText, subReason) => {
    const spokenEl = document.getElementById('live-spoken-transcript');
    if (spokenEl && rawText) {
      spokenEl.textContent = `"${rawText}"`;
      spokenEl.style.color = 'var(--text-headline)';
    }
    window.__lastSpokenTranscript = rawText;
    handleSpokenCommand(command, rawText, subReason);
  },
  onLog: (msg, type) => {
    logMessage(msg, type);
  }
});

// Setup "What I Spoke" Replay Button
const btnVoiceReplay = document.getElementById('btn-voice-replay');
if (btnVoiceReplay) {
  btnVoiceReplay.addEventListener('click', () => {
    const text = window.__lastSpokenTranscript || 'Waiting for your command';
    audioController.speak(`You spoke: ${text}`, true);
  });
}

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
  const clean = (rawText || '').toLowerCase().trim();
  if (!clean) return;

  // Acoustic Echo Suppression: Ignore mic pickup of coach's own voice
  const isCoachActive = window.__isCoachSpeaking || (Date.now() - (window.__coachSpeechEndedAt || 0) < 1200);
  const isEmergencyHalt = /^(stop|pause|paws|top|stock|stalk|spot|stuck|water|hold on|wait|chill|freeze|shut up)$/i.test(clean);

  if (isCoachActive && !isEmergencyHalt) {
    const recent = window.__recentCoachUtterances || [];
    if (window.__lastCoachSpeech) recent.unshift(window.__lastCoachSpeech);
    for (const phrase of recent) {
      if (!phrase) continue;
      if (phrase.includes(clean) || clean.includes(phrase)) {
        console.log(`[handleSpokenCommand] Discarded speaker echo: "${clean}"`);
        return;
      }
      const words = clean.split(/\s+/).filter(w => w.length > 2);
      if (words.length > 0) {
        let matchCount = 0;
        for (const w of words) {
          if (phrase.includes(w)) matchCount++;
        }
        if (matchCount / words.length >= 0.4) {
          console.log(`[handleSpokenCommand] Discarded token-overlap echo: "${clean}"`);
          return;
        }
      }
    }
  }

  logMessage(`🎙️ [HEARD] "${rawText}"`, 'user');

  const spokenEl = document.getElementById('live-spoken-transcript');
  if (spokenEl && rawText) {
    spokenEl.textContent = `"${rawText}"`;
    spokenEl.style.color = 'var(--text-headline)';
  }
  window.__lastSpokenTranscript = rawText;

  // If coach was actively speaking, cut audio; otherwise play subtle earcon
  if (audioController.isActivelyEmittingSound) {
    triggerBargeIn(`Spoken input: "${rawText}"`);
  } else {
    soundFx.playRepDing();
  }

  // Helper to sync routine pill active styling
  const syncRoutinePills = (routineKey) => {
    document.querySelectorAll('.routine-pill').forEach(pill => {
      pill.classList.toggle('active', pill.getAttribute('data-routine') === routineKey);
    });
  };

  // 2. Local Phonetic Fast-Path (resolves empty fallbackCommand from voice chips / full utterance dispatch)
  // This mirrors voiceListener.checkFastCommands so voice-chip clicks are INSTANT with zero network latency.
  if (!fallbackCommand) {
    const lo = (rawText || '').toLowerCase().trim();

    // Water / hydration → PAUSE
    if (lo.includes('water') || lo.includes('drink') || lo.includes('thirsty') || lo.includes('sip') || lo.includes('hydrat') || lo.includes('bottle')) {
      fallbackCommand = 'PAUSE'; subReason = 'WATER';
    }
    // Rest / breathe → PAUSE
    else if (lo.includes('breath') || lo.includes('breather') || lo.includes('tired') || lo.includes('exhausted') || lo.includes('gimme a sec') || lo.includes('hold on') || lo.includes('take a break') || lo.includes('wait up') || lo.includes('winded')) {
      fallbackCommand = 'PAUSE'; subReason = 'REST';
    }
    // Injury / pain → PAUSE
    else if (lo.includes('hurt myself') || lo.includes('injured') || lo.includes('pulled a muscle') || lo.includes('sprained')) {
      fallbackCommand = 'PAUSE'; subReason = 'INJURY';
    }
    else if (lo.includes('elbow') || lo.includes('shoulder') || lo.includes('knee') || lo.includes('wrist') || lo.includes('dizzy') || lo.includes('nauseous') || lo.includes('pain') || lo.includes('hurts') || lo.includes('hurting') || lo.includes('cramp') || lo.includes('clicking')) {
      fallbackCommand = 'PAUSE'; subReason = 'PAIN';
    }
    // Stop / pause → PAUSE (including Web Speech phonetic mishearings: "top", "stock", "stalk", "shop", "spot", "stuck", etc.)
    else if (
      lo.includes('stop') || lo.includes('pause') || lo.includes('paws') ||
      lo.includes('hold up') || lo.includes('hol up') || lo.includes('chill') ||
      lo.includes('freeze') || lo.includes('halt') || lo.includes('hault') ||
      lo.includes('shut up') || lo.includes('quiet') ||
      lo === 'top' || lo.startsWith('top ') || lo.endsWith(' top') ||
      lo.includes(' stock') || lo === 'stock' || lo.startsWith('stock ') ||
      lo.includes(' stalk') || lo === 'stalk' ||
      lo === 'shop' || lo.includes(' spot') || lo === 'spot' ||
      lo.includes(' stuck') || lo === 'stuck' ||
      lo.includes('stopped') || lo.includes('stopping') ||
      lo === 'drop' || lo.includes('break') ||
      lo.includes('time out') || lo.includes('timeout')
    ) {
      fallbackCommand = 'PAUSE'; subReason = 'GENERAL';
    }
    // Teach / form coaching
    else if (lo.includes('teach me') || lo.includes('how to do') || lo.includes('how do i do') || lo.includes('explain form') || lo.includes('what to do')) {
      fallbackCommand = 'TEACH_EXERCISE';
    }
    // Routine switching
    else if (lo.includes('tricep') || lo.includes('diamond push')) {
      fallbackCommand = 'SWITCH_ROUTINE'; subReason = 'triceps';
    }
    else if (lo.includes('legs') || lo.includes('leg day') || lo.includes('quads')) {
      fallbackCommand = 'SWITCH_ROUTINE'; subReason = 'legs';
    }
    else if ((lo.includes('chest') || lo.includes('pec')) && (lo.includes('do chest') || lo.includes('switch') || lo.includes('want') || lo.includes('train'))) {
      fallbackCommand = 'SWITCH_ROUTINE'; subReason = 'chest';
    }
    else if (lo.includes('core') || lo.includes('abs') || lo.includes('abdominal')) {
      fallbackCommand = 'SWITCH_ROUTINE'; subReason = 'core';
    }
    else if (lo.includes('shoulders') || lo.includes('shoulder workout') || lo.includes('delts')) {
      fallbackCommand = 'SWITCH_ROUTINE'; subReason = 'shoulders';
    }
    // START — bare "start", "starts now", or common start phrases
    else if (
      lo === 'start' || lo.startsWith('start ') || lo === 'starts' || lo === 'go' || lo === 'begin' ||
      lo.includes('starts now') || lo.includes('start now') ||
      lo.includes('start the gym') || lo.includes('start workout') ||
      lo.includes('lets start') || lo.includes("let's start") ||
      lo.includes('lets go') || lo.includes("let's go") ||
      lo.includes('begin') || lo.includes('get started') ||
      lo.includes('hit it') || lo.includes('go for instant')
    ) {
      fallbackCommand = 'START';
    }
    // RESUME / Recovery
    else if (
      lo.includes('resume') || lo.includes('continue') || lo.includes('okay now') ||
      lo.includes('fine now') || lo.includes('good now') || lo.includes('feeling good') ||
      lo.includes('feel good') || lo.includes('feeling great') || lo.includes('recovered') ||
      lo.includes('ready to go') || lo.includes('ready to roll') || lo.includes('ready now') ||
      lo.includes('all good') || lo.includes("i'm okay") || lo.includes("i am okay") ||
      lo.includes('im okay') || lo.includes('feeling better') || lo.includes('start again') ||
      lo.includes('keep going') || lo.includes('back at it')
    ) {
      fallbackCommand = 'RESUME';
    }
    // Skip rest
    else if (
      lo.includes('skip rest') || lo.includes('skip it') || lo.includes('skip') ||
      lo.includes('next set') || lo.includes('next round') || lo.includes('hit me') ||
      lo.includes('cut rest') || lo.includes("i'm ready") || lo.includes('im ready') ||
      lo.includes('bring it on') || lo.includes('start set')
    ) {
      fallbackCommand = 'SKIP_REST';
    }
    // Add rest
    else if (lo.includes('add 10') || lo.includes('add ten') || lo.includes('more time') || lo.includes('more rest') || lo.includes('longer rest')) {
      fallbackCommand = 'ADD_REST';
    }
    // Next exercise
    else if (lo.includes('next exercise') || lo.includes('skip exercise') || lo.includes('different exercise') || lo.includes('switch exercise')) {
      fallbackCommand = 'NEXT_EXERCISE';
    }
  }

  // Block non-emergency commands while coach is speaking
  if (window.__isCoachSpeaking && fallbackCommand !== 'PAUSE') {
    console.log(`[app.js] Blocked command "${fallbackCommand}" because coach is speaking.`);
    return;
  }

  // Deduplicate rapid repeat triggers of the same action within 2200ms
  const now = Date.now();
  if (fallbackCommand && fallbackCommand === window.__lastDispatchedCmd && (now - (window.__lastDispatchedTime || 0)) < 2200) {
    console.log(`[app.js] Deduplicated duplicate command "${fallbackCommand}" within 2200ms`);
    return;
  }
  if (fallbackCommand) {
    window.__lastDispatchedCmd = fallbackCommand;
    window.__lastDispatchedTime = now;
  }

  // 3. Instant Zero-Latency Execution for Hard Fast Commands
  if (fallbackCommand === 'SWITCH_ROUTINE') {
    const target = subReason || 'triceps';
    const routine = stateMachine.switchWorkoutTo(target);
    syncRoutinePills(stateMachine.routineKey);
    stateMachine.startWorkout();
    const announcement = `Switching to ${routine.name}! Dropping previous workout. First exercise: ${routine.exercises[0].name}. Let's crush this set!`;
    logMessage(`💪 Routine Switched: ${routine.name}`, 'success');
    updateSpeechHUD(announcement, false);
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
    updateSpeechHUD("Starting workout! Let's crush this session!", false);
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
    updateSpeechHUD("Awesome to hear! Let's get right back to work.", false);
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
      updateSpeechHUD("Workout paused for water break. Rehydrate and catch your breath! Say start or resume when you're ready.", false);
      audioController.speak("Workout paused for water break. Rehydrate and catch your breath! Say start or resume when you're ready.", true);
    } else if (subReason === 'REST' || clean.includes('breathe') || clean.includes('breath') || clean.includes('tired') || clean.includes('exhausted')) {
      logMessage(`🫁 Instant Executing: PAUSE (Breather)`, 'info');
      updateSpeechHUD("Workout paused. Catch your breath! Say start or resume whenever you're ready.", false);
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
      updateSpeechHUD("Workout paused. Say start or resume when you're ready.", false);
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

  // 3D Spline Custom Scene URL Drawer Toggle & Loader
  const btnToggleCustomSpline = document.getElementById('btn-toggle-custom-spline');
  const customSplineDrawer = document.getElementById('custom-spline-drawer');
  const customSplineInput = document.getElementById('custom-spline-input');
  const btnLoadSpline = document.getElementById('btn-load-spline');
  const splineRobot = document.getElementById('spline-robot');

  if (btnToggleCustomSpline && customSplineDrawer) {
    btnToggleCustomSpline.addEventListener('click', () => {
      const isVisible = customSplineDrawer.style.display !== 'none';
      customSplineDrawer.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible && customSplineInput) customSplineInput.focus();
    });
  }

  let isWebGLAvailable = false;
  try {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    isWebGLAvailable = !!gl;
  } catch (e) {
    isWebGLAvailable = false;
  }

  if (btnLoadSpline && customSplineInput) {
    btnLoadSpline.addEventListener('click', () => {
      const url = customSplineInput.value.trim();
      if (!url) return;
      if (!isWebGLAvailable) {
        logMessage('⚠️ WebGL 2 is disabled in your browser. Enable Hardware Acceleration in chrome://settings/system to render Spline 3D.', 'interrupt');
        return;
      }
      try {
        const splineStage = document.getElementById('spline-3d-stage');
        let splineRobot = document.getElementById('spline-robot');
        if (!splineRobot && splineStage) {
          splineRobot = document.createElement('spline-viewer');
          splineRobot.id = 'spline-robot';
          splineRobot.setAttribute('loading-anim-type', 'spinner-small-dark');
          splineStage.appendChild(splineRobot);
        }
        if (splineRobot) {
          splineRobot.setAttribute('url', url);
          logMessage(`✨ Loaded 3D Spline scene: ${url}`, 'success');
        }
        if (customSplineDrawer) customSplineDrawer.style.display = 'none';
      } catch (err) {
        logMessage(`⚠️ Error loading 3D scene: ${err.message}`, 'interrupt');
      }
    });
    customSplineInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnLoadSpline.click();
    });
  }

  // WebGL 2 Detection & Automatic Cyber Mascot Fallback Hub
  function initRobotStage() {
    const splineStage = document.getElementById('spline-3d-stage');
    const cyberMascot = document.getElementById('cyber-mascot-stage');
    const webglBanner = document.getElementById('webgl-alert-banner');
    const robotActionText = document.getElementById('robot-action-text');
    const btnDismissBanner = document.getElementById('btn-dismiss-webgl-alert');

    if (btnDismissBanner && webglBanner) {
      btnDismissBanner.addEventListener('click', () => {
        webglBanner.style.display = 'none';
      });
    }

    if (!isWebGLAvailable) {
      console.warn('[RobotStage] WebGL context is disabled in this browser. Gracefully activating 3D Cyber Mascot.');
      if (splineStage) splineStage.style.display = 'none';
      if (cyberMascot) cyberMascot.style.display = 'flex';
      if (webglBanner) webglBanner.style.display = 'flex';
      if (robotActionText) robotActionText.textContent = '3D CYBER MASCOT (ACTIVE)';
    } else {
      if (splineStage) {
        splineStage.style.display = 'flex';
        // Mount Spline viewer only when WebGL is verified active
        let splineRobot = document.getElementById('spline-robot');
        if (!splineRobot) {
          splineRobot = document.createElement('spline-viewer');
          splineRobot.id = 'spline-robot';
          splineRobot.setAttribute('loading-anim-type', 'spinner-small-dark');
          splineRobot.setAttribute('url', 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode');
          splineStage.appendChild(splineRobot);
        }
      }
      if (cyberMascot) cyberMascot.style.display = 'none';
      if (webglBanner) webglBanner.style.display = 'none';
      if (robotActionText) robotActionText.textContent = '3D ROBOT COACH (SPLINE)';
    }

    // Interactive 3D Mouse Parallax Tilt for Cyber Mascot
    const canvasWrapper = document.getElementById('robot-canvas-wrapper');
    const mascotCard = document.getElementById('mascot-3d-card');
    if (canvasWrapper && mascotCard) {
      canvasWrapper.addEventListener('mousemove', (e) => {
        const rect = canvasWrapper.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        const rotY = (x * 24).toFixed(1);
        const rotX = (-y * 18).toFixed(1);
        mascotCard.style.transform = `perspective(800px) rotateY(${rotY}deg) rotateX(${rotX}deg) translateZ(10px)`;
      });
      canvasWrapper.addEventListener('mouseleave', () => {
        mascotCard.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) translateZ(0px)';
      });
    }
  }

  initRobotStage();

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

  // Conversational Voice Chips Quick Click
  document.querySelectorAll('.voice-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const text = chip.getAttribute('data-speak') || chip.textContent;
      handleSpokenCommand('', text);
    });
  });

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
