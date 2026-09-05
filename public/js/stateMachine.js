/**
 * stateMachine.js
 * Robust Workout Finite State Machine (FSM)
 * Supports dynamic on-the-fly workout switching for any muscle group:
 * Triceps, Legs, Chest, Core, Shoulders, Full Body.
 */

export const WORKOUT_ROUTINES = {
  full_body: {
    name: 'Full Body Burn',
    muscle: 'Full Body',
    exercises: [
      { id: 'pushups', name: 'Push-Ups', sets: 3, reps: 8, restSeconds: 30 },
      { id: 'squats', name: 'Bodyweight Squats', sets: 3, reps: 10, restSeconds: 30 },
      { id: 'climbers', name: 'Mountain Climbers', sets: 3, reps: 12, restSeconds: 25 }
    ]
  },
  triceps: {
    name: 'Triceps Power Blast',
    muscle: 'Triceps',
    exercises: [
      { id: 'diamond_pushups', name: 'Diamond Push-ups', sets: 3, reps: 8, restSeconds: 30 },
      { id: 'dips', name: 'Bench Dips', sets: 3, reps: 10, restSeconds: 30 },
      { id: 'tricep_extensions', name: 'Plank Tricep Extensions', sets: 3, reps: 8, restSeconds: 25 }
    ]
  },
  legs: {
    name: 'Legs & Quads Power',
    muscle: 'Legs',
    exercises: [
      { id: 'squats', name: 'Bodyweight Squats', sets: 3, reps: 12, restSeconds: 30 },
      { id: 'lunges', name: 'Reverse Lunges', sets: 3, reps: 10, restSeconds: 30 },
      { id: 'jump_squats', name: 'Explosive Jump Squats', sets: 3, reps: 8, restSeconds: 35 }
    ]
  },
  chest: {
    name: 'Chest & Pecs Hypertrophy',
    muscle: 'Chest',
    exercises: [
      { id: 'pushups', name: 'Standard Push-ups', sets: 3, reps: 10, restSeconds: 30 },
      { id: 'wide_pushups', name: 'Wide-Grip Push-ups', sets: 3, reps: 8, restSeconds: 30 },
      { id: 'incline_pushups', name: 'Tempo Push-ups', sets: 3, reps: 8, restSeconds: 30 }
    ]
  },
  core: {
    name: 'Core & Abs Shield',
    muscle: 'Core',
    exercises: [
      { id: 'plank', name: 'Plank Hold', sets: 3, reps: 20, restSeconds: 25 },
      { id: 'climbers', name: 'Mountain Climbers', sets: 3, reps: 16, restSeconds: 25 },
      { id: 'crunches', name: 'Bicycle Crunches', sets: 3, reps: 14, restSeconds: 25 }
    ]
  },
  shoulders: {
    name: 'Shoulders & Delts',
    muscle: 'Shoulders',
    exercises: [
      { id: 'pike_pushups', name: 'Pike Push-ups', sets: 3, reps: 8, restSeconds: 35 },
      { id: 'plank_taps', name: 'Plank Shoulder Taps', sets: 3, reps: 12, restSeconds: 25 },
      { id: 'bear_crawl', name: 'Bear Crawl Hold', sets: 3, reps: 10, restSeconds: 30 }
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

  switchWorkoutTo(muscleKey) {
    const clean = (muscleKey || '').toLowerCase();
    let target = 'full_body';
    if (clean.includes('tricep') || clean.includes('arm')) target = 'triceps';
    else if (clean.includes('leg') || clean.includes('quad') || clean.includes('squat')) target = 'legs';
    else if (clean.includes('chest') || clean.includes('pec')) target = 'chest';
    else if (clean.includes('core') || clean.includes('ab') || clean.includes('plank')) target = 'core';
    else if (clean.includes('shoulder') || clean.includes('delt')) target = 'shoulders';
    else if (WORKOUT_ROUTINES[clean]) target = clean;

    this.setRoutine(target);
    return WORKOUT_ROUTINES[target];
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
      routineKey: this.routineKey,
      routineName: (WORKOUT_ROUTINES[this.routineKey] && WORKOUT_ROUTINES[this.routineKey].name) || 'Workout',
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

  async startWorkout() {
    this.clearAllTimers();
    this.exerciseIndex = 0;
    this.currentSet = 1;
    this.currentRep = 0;
    this.state = STATES.COUNTDOWN;
    this.notifyState();

    this.onLog(`🚀 Workout started: ${this.currentExercise.name}, Set 1 of ${this.currentExercise.sets}`, 'info');
    await this.audio.speak(`Get ready for ${this.currentExercise.name}. Set 1 starting in 3, 2, 1, go!`, true);

    this.startRepCycle();
  }

  startRepCycle() {
    this.clearAllTimers();
    this.state = STATES.EXERCISE_REPS;
    this.currentRep = 0; // Explicitly reset to 0
    this.isRepLoopActive = true;
    this.notifyState(); // Updates HUD to display: SET X OF Y, 0 OF 8 REPS

    // Verbal cue for set start, then count rep 1 after short pause
    if (this.currentSet > 1) {
      this.audio.speak(`Set ${this.currentSet}! Starting in three, two, one, go!`, true);
      this.repTimeout = setTimeout(() => {
        this.loopNextRep();
      }, 1600);
    } else {
      this.repTimeout = setTimeout(() => {
        this.loopNextRep();
      }, 1000);
    }
  }

  async loopNextRep() {
    if (!this.isRepLoopActive || this.state !== STATES.EXERCISE_REPS) return;

    this.currentRep++;
    this.onRep(this.currentRep, this.currentExercise.reps);
    this.notifyState();

    let spokenText = `${this.currentRep}`;
    if (this.currentRep === Math.floor(this.currentExercise.reps / 2)) {
      spokenText = `${this.currentRep}, halfway there!`;
    } else if (this.currentRep === this.currentExercise.reps) {
      spokenText = `${this.currentRep}, that's the set! Excellent work.`;
    }

    await this.audio.speak(spokenText);

    // Double-check if state was paused or changed while coach was speaking
    if (!this.isRepLoopActive || this.state !== STATES.EXERCISE_REPS) return;

    if (this.currentRep >= this.currentExercise.reps) {
      this.completeSet();
    } else {
      this.repTimeout = setTimeout(() => {
        this.loopNextRep();
      }, this.repPacingMs);
    }
  }

  completeSet() {
    this.clearAllTimers();
    this.soundFx.playSetComplete();

    const currentEx = this.currentExercise;
    const isLastSet = this.currentSet >= (currentEx.sets || 3);

    // Immediately reset currentRep to 0 so HUD shows 0 reps for the upcoming set
    this.currentRep = 0;

    if (!isLastSet) {
      // Resting between sets of current exercise
      const nextSetNum = this.currentSet + 1;
      const restSec = 15; // Crisp 15s rest between sets
      this.onLog(`✅ Set ${this.currentSet} of ${currentEx.sets || 3} complete! Rest for ${restSec}s before Set ${nextSetNum}.`, 'success');
      this.audio.speak(`Set ${this.currentSet} complete! Take a fifteen second breather. Set ${nextSetNum} starts automatically.`, true);
      this.startRestTimer(restSec, false);
    } else {
      // All sets complete for this exercise! Move to next exercise or finish workout
      if (this.exerciseIndex < this.currentPlan.length - 1) {
        this.exerciseIndex++;
        this.currentSet = 1;
        this.currentRep = 0;
        const nextEx = this.currentExercise;
        const restSec = 20; // 20s transition rest between different exercises
        this.onLog(`🎉 ${currentEx.name} finished! Up next: ${nextEx.name}.`, 'success');
        this.audio.speak(`${currentEx.name} crushed! Next up is ${nextEx.name}. Rest for twenty seconds.`, true);
        this.startRestTimer(restSec, true);
      } else {
        // Complete routine!
        this.state = STATES.COMPLETED;
        this.notifyState();
        this.soundFx.playWorkoutVictory();
        this.onLog('🏆 Full Workout Complete! You crushed every set and rep!', 'success');
        this.audio.speak("Workout complete! Outstanding performance today, athlete. Rehydrate and recover!", true);
      }
    }
  }

  startRestTimer(seconds, isNewExercise = false) {
    this.clearAllTimers();
    this.state = STATES.REST_TIMER;
    this.totalRestTime = seconds;
    this.restTimeRemaining = seconds;
    this.isNextExerciseTransition = isNewExercise;
    this.notifyState();

    this.restInterval = setInterval(() => {
      this.restTimeRemaining--;
      this.onTick(this.getContext());

      if (this.restTimeRemaining === 8) {
        if (this.isNextExerciseTransition) {
          this.audio.speak(`Get ready for ${this.currentExercise.name}. Set one starting shortly.`);
        } else {
          this.audio.speak(`Get ready for set ${this.currentSet + 1}.`);
        }
      } else if (this.restTimeRemaining === 3) {
        this.audio.speak("Three");
      } else if (this.restTimeRemaining === 2) {
        this.audio.speak("Two");
      } else if (this.restTimeRemaining === 1) {
        this.audio.speak("One, let's go!");
      } else if (this.restTimeRemaining <= 0) {
        this.clearAllTimers();
        if (!this.isNextExerciseTransition) {
          this.currentSet++;
        }
        this.startRepCycle();
      }
    }, 1000);
  }

  skipRest() {
    if (this.state !== STATES.REST_TIMER) return;
    this.clearAllTimers();
    this.onLog('⏭️ Rest timer skipped via voice command.', 'info');
    if (!this.isNextExerciseTransition) {
      this.currentSet++;
    }
    this.audio.speak(`Skipping rest! Set ${this.currentSet} starts now.`, true);
    this.startRepCycle();
  }

  addRestSeconds(seconds = 10) {
    if (this.state !== STATES.REST_TIMER) return;
    this.restTimeRemaining += seconds;
    this.totalRestTime += seconds;
    this.onLog(`⏱️ Added ${seconds}s to rest timer (${this.restTimeRemaining}s left)`, 'info');
    this.audio.speak(`Added ${seconds} seconds to rest.`);
    this.notifyState();
  }

  pause() {
    if (this.state === STATES.PAUSED || this.state === STATES.IDLE || this.state === STATES.COMPLETED) return;
    this.clearAllTimers();
    this.state = STATES.PAUSED;
    this.notifyState();
    this.onLog('⏸️ Workout paused. Holding current progress.', 'info');
  }

  resume() {
    if (this.state !== STATES.PAUSED) return;
    this.onLog('▶️ Resuming workout from where you left off.', 'info');

    if (this.restTimeRemaining > 0) {
      this.startRestTimer(this.restTimeRemaining);
    } else {
      this.state = STATES.EXERCISE_REPS;
      this.isRepLoopActive = true;
      this.notifyState();
      this.audio.speak("Resuming set! Let's get right back into it.");
      this.repTimeout = setTimeout(() => {
        this.loopNextRep();
      }, 1000);
    }
  }

  nextExercise() {
    this.clearAllTimers();
    if (this.exerciseIndex < this.currentPlan.length - 1) {
      this.exerciseIndex++;
      this.currentSet = 1;
      this.currentRep = 0;
      this.onLog(`⏭️ Skipped to next exercise: ${this.currentExercise.name}`, 'info');
      this.audio.speak(`Moving to ${this.currentExercise.name}! Get ready.`, true);
      this.startRepCycle();
    } else {
      this.completeSet();
    }
  }
}
