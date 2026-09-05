/**
 * stateMachine.js
 * Robust Workout Finite State Machine (FSM)
 * Ensures zero stale timer leaks, clean state transitions, and immediate recovery from interrupts.
 */

export const WORKOUT_ROUTINES = {
  full_body: {
    name: 'Full Body Burn',
    exercises: [
      { id: 'pushups', name: 'Push-Ups', sets: 3, reps: 8, restSeconds: 30 },
      { id: 'squats', name: 'Bodyweight Squats', sets: 3, reps: 10, restSeconds: 30 },
      { id: 'climbers', name: 'Mountain Climbers', sets: 3, reps: 12, restSeconds: 25 }
    ]
  },
  upper_body: {
    name: 'Upper Body Power',
    exercises: [
      { id: 'diamond_pushups', name: 'Diamond Push-ups', sets: 3, reps: 8, restSeconds: 30 },
      { id: 'pike_pushups', name: 'Pike Push-ups', sets: 3, reps: 8, restSeconds: 35 },
      { id: 'dips', name: 'Bench Dips', sets: 3, reps: 10, restSeconds: 30 }
    ]
  },
  core_mobility: {
    name: 'Core & Mobility',
    exercises: [
      { id: 'plank', name: 'Plank Hold', sets: 3, reps: 20, restSeconds: 25 },
      { id: 'birddog', name: 'Bird-Dog Extensions', sets: 3, reps: 10, restSeconds: 20 },
      { id: 'crunches', name: 'Bicycle Crunches', sets: 3, reps: 12, restSeconds: 25 }
    ]
  }
};

export const WORKOUT_PLAN = WORKOUT_ROUTINES.full_body.exercises;

export const STATES = {
  IDLE: 'IDLE',
  COUNTDOWN: 'COUNTDOWN',
  EXERCISE_REPS: 'EXERCISE_REPS',
  REST_TIMER: 'REST_TIMER',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED'
};

export class WorkoutStateMachine {
  constructor({ audioController, soundFx, onStateChange, onTick, onRep, onLog }) {
    this.audio = audioController;
    this.soundFx = soundFx;
    this.onStateChange = onStateChange || (() => {});
    this.onTick = onTick || (() => {});
    this.onRep = onRep || (() => {});
    this.onLog = onLog || (() => {});

    // Routine & Settings
    this.routineKey = 'full_body';
    this.currentPlan = WORKOUT_ROUTINES.full_body.exercises;
    this.repPacingMs = 2200; // Default pacing

    // State Variables
    this.state = STATES.IDLE;
    this.exerciseIndex = 0;
    this.currentSet = 1;
    this.currentRep = 0;
    this.restTimeRemaining = 0;
    this.totalRestTime = 30;

    // Timers & Loops
    this.restInterval = null;
    this.repTimeout = null;
    this.isRepLoopActive = false;
  }

  setRoutine(routineKey) {
    if (WORKOUT_ROUTINES[routineKey]) {
      this.clearAllTimers();
      this.routineKey = routineKey;
      this.currentPlan = WORKOUT_ROUTINES[routineKey].exercises;
      this.exerciseIndex = 0;
      this.currentSet = 1;
      this.currentRep = 0;
      this.state = STATES.IDLE;
      this.notifyState();
      this.onLog(`📋 Switched routine to: ${WORKOUT_ROUTINES[routineKey].name}`, 'info');
    }
  }

  setPacing(pacingMs) {
    this.repPacingMs = Math.max(1200, Math.min(4000, pacingMs));
    this.onLog(`⚡ Rep pacing set to ${(this.repPacingMs / 1000).toFixed(1)}s per rep`, 'info');
  }

  get currentExercise() {
    return this.currentPlan[this.exerciseIndex] || this.currentPlan[0];
  }

  getContext() {
    const ex = this.currentExercise || {};
    return {
      state: this.state,
      exercise: ex,
      set: this.currentSet,
      totalSets: ex.sets || 3,
      rep: this.currentRep,
      targetReps: ex.reps || 8,
      restRemaining: this.restTimeRemaining,
      totalRest: this.totalRestTime || ex.restSeconds || 30
    };
  }

  notifyState() {
    this.onStateChange(this.state, this.getContext());
  }

  /**
   * Completely clear any running intervals or pending timeouts.
   * This guarantees no lingering timers count down in the background.
   */
  clearAllTimers() {
    if (this.restInterval) {
      clearInterval(this.restInterval);
      this.restInterval = null;
    }
    if (this.repTimeout) {
      clearTimeout(this.repTimeout);
      this.repTimeout = null;
    }
    this.isRepLoopActive = false;
  }

  /**
   * Start or restart the workout
   */
  async startWorkout() {
    this.clearAllTimers();
    this.exerciseIndex = 0;
    this.currentSet = 1;
    this.currentRep = 0;
    this.state = STATES.COUNTDOWN;
    this.notifyState();

    this.onLog(`🚀 Workout started: ${this.currentExercise.name}, Set 1 of ${this.currentExercise.sets}`, 'info');
    await this.audio.speak(`Get ready for ${this.currentExercise.name}. Set 1 starting in 3, 2, 1, go!`, true);

    if (this.state === STATES.COUNTDOWN) {
      this.startRepCycle();
    }
  }

  /**
   * Run the rep pacing loop
   */
  async startRepCycle() {
    this.clearAllTimers();
    this.state = STATES.EXERCISE_REPS;
    this.currentRep = 0;
    this.isRepLoopActive = true;
    this.notifyState();

    this.runNextRep();
  }

  async runNextRep() {
    if (!this.isRepLoopActive || this.state !== STATES.EXERCISE_REPS) return;

    this.currentRep++;
    this.onRep(this.currentRep, this.currentExercise.reps);

    // Dynamic encouraging cues
    let cue = `${this.currentRep}`;
    if (this.currentRep === 1) cue = "1, good form!";
    else if (this.currentRep === Math.floor(this.currentExercise.reps / 2)) cue = `${this.currentRep}, halfway there!`;
    else if (this.currentRep === this.currentExercise.reps - 1) cue = `${this.currentRep}, one more!`;
    else if (this.currentRep === this.currentExercise.reps) cue = `${this.currentRep}, and down! Set finished.`;

    // Play crisp rep chime
    if (this.soundFx) this.soundFx.playRepDing();

    await this.audio.speak(cue);

    if (!this.isRepLoopActive || this.state !== STATES.EXERCISE_REPS) return;

    if (this.currentRep >= this.currentExercise.reps) {
      this.finishCurrentSet();
    } else {
      // Rep pacing delay
      this.repTimeout = setTimeout(() => {
        this.runNextRep();
      }, this.repPacingMs);
    }
  }

  /**
   * Transition from rep completion to rest timer
   */
  async finishCurrentSet() {
    this.clearAllTimers();

    if (this.currentSet < this.currentExercise.sets) {
      // Start rest period before next set
      this.startRestTimer(this.currentExercise.restSeconds);
    } else {
      // Exercise finished, check if there's a next exercise
      if (this.exerciseIndex < this.currentPlan.length - 1) {
        this.exerciseIndex++;
        this.currentSet = 1;
        this.onLog(`✅ Completed all sets of previous exercise. Moving to ${this.currentExercise.name}`, 'success');
        this.startRestTimer(40, `Great work! Exercise finished. Next up is ${this.currentExercise.name}. Rest for 40 seconds.`);
      } else {
        this.state = STATES.COMPLETED;
        this.notifyState();
        this.onLog(`🏆 WORKOUT COMPLETED! Outstanding effort!`, 'success');
        await this.audio.speak("Workout complete! Outstanding effort today! You crushed it.", true);
      }
    }
  }

  /**
   * Start a countdown rest period
   */
  async startRestTimer(seconds = 30, customAnnouncement = null) {
    this.clearAllTimers();
    this.state = STATES.REST_TIMER;
    this.totalRestTime = seconds;
    this.restTimeRemaining = seconds;
    this.notifyState();

    if (this.soundFx) this.soundFx.playRestGong();

    const speechText = customAnnouncement || `Rest for ${seconds} seconds. Take deep breaths.`;
    this.onLog(`⏱️ Rest period started (${seconds}s)`, 'info');

    // Announce rest out loud
    await this.audio.speak(speechText);

    // If still in rest mode (not interrupted while coach was announcing)
    if (this.state === STATES.REST_TIMER) {
      this.restInterval = setInterval(() => {
        if (this.state !== STATES.REST_TIMER) {
          clearInterval(this.restInterval);
          return;
        }

        this.restTimeRemaining--;
        this.onTick(this.restTimeRemaining, this.totalRestTime);

        // Sound tick in last 5 seconds
        if (this.restTimeRemaining <= 5 && this.restTimeRemaining > 0 && this.soundFx) {
          this.soundFx.playTick();
        }

        // Announce remaining time cues
        if (this.restTimeRemaining === 10) {
          this.audio.speak("10 seconds left, get ready.");
        } else if (this.restTimeRemaining <= 0) {
          this.clearAllTimers();
          this.currentSet++;
          this.onLog(`🔔 Rest timer completed naturally. Starting Set ${this.currentSet}.`, 'info');
          this.audio.speak(`Time's up! Set ${this.currentSet}, 3, 2, 1, go!`, true).then(() => {
            if (this.state === STATES.REST_TIMER || this.state === STATES.EXERCISE_REPS) {
              this.startRepCycle();
            }
          });
        }
      }, 1000);
    }
  }

  /**
   * ⚡ SKIP REST (THE CORE BARGE-IN ACCEPTANCE TEST REQUIREMENT)
   * Must:
   * 1. Clear active rest interval immediately
   * 2. Advance set counter correctly
   * 3. Switch state directly to EXERCISE_REPS
   * 4. Announce and begin next set without old countdown in background
   */
  skipRest() {
    this.onLog(`⚡ [STATE-MACHINE] skipRest() called. Destroying background rest interval.`, 'interrupt');

    if (this.soundFx) this.soundFx.playBargeInGlitch();

    // 1. Instantly destroy background timer
    this.clearAllTimers();

    // 2. Advance to next set
    this.currentSet++;
    this.state = STATES.EXERCISE_REPS;
    this.currentRep = 0;
    this.notifyState();

    this.onLog(`🔄 State updated: REST_TIMER -> EXERCISE_REPS. Set is now ${this.currentSet} of ${this.currentExercise.sets}.`, 'success');

    // 3. Announce new set immediately
    this.audio.speak(`Skipping rest! Starting Set ${this.currentSet} now: 1...`, true).then(() => {
      this.isRepLoopActive = true;
      this.currentRep = 1;
      this.onRep(this.currentRep, this.currentExercise.reps);
      this.repTimeout = setTimeout(() => {
        this.runNextRep();
      }, 2200);
    });
  }

  /**
   * Add seconds to the rest timer
   */
  addRestSeconds(seconds = 10) {
    if (this.state === STATES.REST_TIMER) {
      this.restTimeRemaining += seconds;
      this.totalRestTime += seconds;
      this.onTick(this.restTimeRemaining, this.totalRestTime);
      this.onLog(`⏱️ Added ${seconds}s to rest timer. New remaining: ${this.restTimeRemaining}s`, 'info');
      this.audio.speak(`Added ${seconds} seconds. Rest up.`, true);
    }
  }

  /**
   * Move to next exercise
   */
  nextExercise() {
    this.clearAllTimers();
    if (this.exerciseIndex < WORKOUT_PLAN.length - 1) {
      this.exerciseIndex++;
      this.currentSet = 1;
      this.currentRep = 0;
      this.onLog(`⏭️ Skipping to next exercise: ${this.currentExercise.name}`, 'info');
      this.audio.speak(`Switching to ${this.currentExercise.name}. Set 1 starting now!`, true).then(() => {
        this.startRepCycle();
      });
    } else {
      this.audio.speak(`This is already the last exercise. Let's finish strong!`, true);
    }
  }

  /**
   * Pause workout
   */
  pause() {
    this.clearAllTimers();
    this.state = STATES.PAUSED;
    this.notifyState();
    this.onLog(`⏸️ Workout paused.`, 'info');
    this.audio.speak("Workout paused. Say 'resume' whenever you are ready.", true);
  }

  /**
   * Resume workout
   */
  resume() {
    if (this.state === STATES.PAUSED) {
      this.onLog(`▶️ Workout resumed.`, 'info');
      this.audio.speak("Resuming workout!", true).then(() => {
        this.startRepCycle();
      });
    }
  }
}
