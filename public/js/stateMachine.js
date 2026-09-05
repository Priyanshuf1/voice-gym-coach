/**
 * stateMachine.js
 * Robust Workout Finite State Machine (FSM)
 * Ensures zero stale timer leaks, clean state transitions, and immediate recovery from interrupts.
 */

export const WORKOUT_PLAN = [
  { id: 'pushups', name: 'Push-Ups', sets: 3, reps: 8, restSeconds: 30 },
  { id: 'squats', name: 'Bodyweight Squats', sets: 3, reps: 10, restSeconds: 30 },
  { id: 'lunges', name: 'Walking Lunges', sets: 3, reps: 10, restSeconds: 25 }
];

export const STATES = {
  IDLE: 'IDLE',
  COUNTDOWN: 'COUNTDOWN',
  EXERCISE_REPS: 'EXERCISE_REPS',
  REST_TIMER: 'REST_TIMER',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED'
};

export class WorkoutStateMachine {
  constructor({ audioController, onStateChange, onTick, onRep, onLog }) {
    this.audio = audioController;
    this.onStateChange = onStateChange || (() => {});
    this.onTick = onTick || (() => {});
    this.onRep = onRep || (() => {});
    this.onLog = onLog || (() => {});

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

  get currentExercise() {
    return WORKOUT_PLAN[this.exerciseIndex] || WORKOUT_PLAN[0];
  }

  getContext() {
    return {
      state: this.state,
      exercise: this.currentExercise,
      set: this.currentSet,
      rep: this.currentRep,
      restRemaining: this.restTimeRemaining,
      totalRest: this.totalRestTime
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

    await this.audio.speak(cue);

    if (!this.isRepLoopActive || this.state !== STATES.EXERCISE_REPS) return;

    if (this.currentRep >= this.currentExercise.reps) {
      this.finishCurrentSet();
    } else {
      // Rep pacing delay (e.g. 2.2 seconds per rep)
      this.repTimeout = setTimeout(() => {
        this.runNextRep();
      }, 2200);
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
      if (this.exerciseIndex < WORKOUT_PLAN.length - 1) {
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
