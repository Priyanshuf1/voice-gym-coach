/**
 * app.js
 * Main entry point for Voice Gym Coach
 * Orchestrates Rime TTS, AudioController, StateMachine, VoiceListener, and HUD.
 */

import { RimeClient } from './rimeClient.js';
import { AudioController } from './audioController.js';
import { WorkoutStateMachine, STATES } from './stateMachine.js';
import { VoiceListener } from './voiceListener.js';

// DOM Elements
const engineStatusBadge = document.getElementById('engine-status');
const engineText = document.getElementById('engine-text');
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
const clearLogsBtn = document.getElementById('clear-logs');

// Metrics & Log State
let interruptCount = 0;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 100; // ~628.3
circleProgressEl.style.strokeDasharray = `${CIRCLE_CIRCUMFERENCE}`;
circleProgressEl.style.strokeDashoffset = '0';

// Helper to append logs
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
  // Acoustic detection: speech starting
  onSpeechStart: () => {
    micVisualizer.classList.add('speaking');
    micIndicator.textContent = 'HEARING SPEECH';
    micIndicator.className = 'state-tag active-workout';

    // If coach is speaking right now, user has started interrupting!
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
  setTimeout(() => stateBadge.classList.remove('interrupted'), 500);

  // Instantly cut audio playback and abort requests
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
        logMessage(`ℹ️ User requested skip rest, but state is ${stateMachine.state}. Transitioning to next set.`, 'info');
        stateMachine.skipRest();
      }
      break;

    case 'PAUSE':
      logMessage(`🎯 Executing: PAUSE WORKOUT`, 'info');
      stateMachine.pause();
      break;

    case 'RESUME':
      logMessage(`🎯 Executing: RESUME WORKOUT`, 'success');
      stateMachine.resume();
      break;

    case 'ADD_REST':
      if (stateMachine.state === STATES.REST_TIMER) {
        logMessage(`🎯 Executing: ADD 10s REST`, 'success');
        stateMachine.addRestSeconds(10);
      } else {
        audioController.speak("You can only add rest time during a rest period.");
      }
      break;

    case 'NEXT_EXERCISE':
      logMessage(`🎯 Executing: NEXT EXERCISE`, 'success');
      stateMachine.nextExercise();
      break;

    default:
      console.log('Unrecognized command:', command);
  }
}

// Button Events
btnToggleWorkout.addEventListener('click', () => {
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

// Simulated Voice Commands for debugging & quiet environments
testVoiceSkip.addEventListener('click', () => {
  handleSpokenCommand('SKIP_REST', 'skip it, next set (simulated)');
});

testVoiceStop.addEventListener('click', () => {
  handleSpokenCommand('PAUSE', 'stop (simulated)');
});

clearLogsBtn.addEventListener('click', () => {
  logConsole.innerHTML = '<div class="log-entry info">[System] Log cleared.</div>';
});

// App Startup & Server Config Check
async function initApp() {
  logMessage('[System] Checking Rime TTS configuration with server...', 'info');
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
}

initApp();
