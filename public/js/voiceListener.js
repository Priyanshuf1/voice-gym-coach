/**
 * voiceListener.js
 * Browser-native Speech-To-Text and Instant Barge-In detection.
 * Uses Web Speech API (webkitSpeechRecognition) with continuous listening
 * and interimResults = true for zero-latency speech interception.
 * 
 * Supports:
 * - Instant acoustic speech detection (<1ms audio cutoff)
 * - Instant stop/skip/pause trigger on fast keywords
 * - Unlimited conversational speech input (user can talk freely to AI)
 * - Auto-restart resilience and user gesture permission handling
 */

export class VoiceListener {
  constructor({ onSpeechStart, onCommand, onInterim, onStatusChange, onLog }) {
    this.onSpeechStart = onSpeechStart || (() => {});
    this.onCommand = onCommand || (() => {});
    this.onInterim = onInterim || (() => {});
    this.onStatusChange = onStatusChange || (() => {});
    this.onLog = onLog || (() => {});

    this.recognition = null;
    this.isListening = false;
    this.shouldRestart = true;
    this.hasSupport = false;
    this.lastProcessedText = '';
    this.silenceTimer = null;

    this.initRecognition();
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[VoiceListener] Web Speech API not supported in this browser.');
      this.hasSupport = false;
      this.onStatusChange('UNSUPPORTED');
      this.onLog('⚠️ Web Speech API not supported in this browser. Use Chrome or Edge.', 'interrupt');
      return;
    }

    this.hasSupport = true;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    // 1. Acoustic speech detection (Fastest possible barge-in signal: <1ms)
    rec.onspeechstart = () => {
      this.onStatusChange('SPEECH_DETECTED');
      this.onSpeechStart();
    };

    rec.onspeechend = () => {
      this.onStatusChange('LISTENING');
    };

    // 2. Real-time Transcript Stream
    rec.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        const text = item[0].transcript.trim();

        if (item.isFinal) {
          finalTranscript += text + ' ';
        } else {
          interimTranscript += text + ' ';
        }
      }

      const activeText = (finalTranscript || interimTranscript).trim();
      if (!activeText) return;

      this.onInterim(activeText);

      // Fast-path: Check for immediate command trigger (stop, skip, pause)
      const handledFast = this.checkFastCommands(activeText);
      if (handledFast) {
        this.lastProcessedText = activeText;
        return;
      }

      // If user spoke a complete thought (isFinal) or pauses for 700ms, forward to conversational AI
      if (finalTranscript) {
        this.dispatchFullUtterance(finalTranscript.trim());
      } else {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = setTimeout(() => {
          if (activeText && activeText !== this.lastProcessedText) {
            this.dispatchFullUtterance(activeText);
          }
        }, 750);
      }
    };

    rec.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.warn('[VoiceListener] Recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.shouldRestart = false;
          this.isListening = false;
          this.onStatusChange('MIC_BLOCKED');
          this.onLog('❌ Microphone access denied. Click the Mic button to grant permission.', 'interrupt');
        }
      }
    };

    rec.onend = () => {
      this.isListening = false;
      if (this.shouldRestart) {
        // Auto restart for continuous hands-free workout session
        try {
          rec.start();
          this.isListening = true;
          this.onStatusChange('LISTENING');
        } catch (e) {
          setTimeout(() => {
            if (this.shouldRestart && !this.isListening) {
              try {
                rec.start();
                this.isListening = true;
                this.onStatusChange('LISTENING');
              } catch (err) {}
            }
          }, 350);
        }
      } else {
        this.onStatusChange('OFF');
      }
    };

    this.recognition = rec;
  }

  /**
   * Fast emergency / immediate command check (Runs on every interim token)
   */
  checkFastCommands(text) {
    const clean = (text || '').toLowerCase().trim();
    if (!clean) return false;

    // 0. Water Break & Hydration (<1ms Instant Execution)
    if (
      clean.includes('water') ||
      clean.includes('drink') ||
      clean.includes('drinking') ||
      clean.includes('thirsty') ||
      clean.includes('sip') ||
      clean.includes('hydrate') ||
      clean.includes('hydration') ||
      clean.includes('bottle')
    ) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('PAUSE', text, 'WATER');
      return true;
    }

    // 1. Rest / Catch Breath / Exhaustion (<1ms Instant Execution)
    if (
      clean.includes('breathe') ||
      clean.includes('breath') ||
      clean.includes('breather') ||
      clean.includes('out of breath') ||
      clean.includes('winded') ||
      clean.includes('tired') ||
      clean.includes('exhausted') ||
      clean.includes('cant breathe') ||
      clean.includes("can't breathe") ||
      clean.includes('let me breathe') ||
      clean.includes('gimme a sec') ||
      clean.includes('gimme a min') ||
      clean.includes('give me a second') ||
      clean.includes('take a break') ||
      clean.includes('hold on') ||
      clean.includes('wait a sec') ||
      clean.includes('wait up')
    ) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('PAUSE', text, 'REST');
      return true;
    }

    // 2. Pain, Injury / Distress (<1ms Safety Pause)
    if (
      clean.includes('hurt myself') ||
      clean.includes('injured') ||
      clean.includes('pulled a muscle') ||
      clean.includes('sprained') ||
      clean.includes('not feeling good') ||
      clean.includes('feel sick') ||
      clean.includes('hurt') ||
      clean.includes('hurts') ||
      clean.includes('hurting') ||
      clean.includes('pain') ||
      clean.includes('elbow') ||
      clean.includes('shoulder') ||
      clean.includes('knee') ||
      clean.includes('wrist') ||
      clean.includes('dizzy') ||
      clean.includes('nauseous') ||
      clean.includes('cramp') ||
      clean.includes('clicking')
    ) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      const isInjured = clean.includes('hurt myself') || clean.includes('injured') || clean.includes('pulled a muscle');
      this.onCommand('PAUSE', text, isInjured ? 'INJURY' : 'PAIN');
      return true;
    }

    // 2b. Dynamic Workout Routine Switching on the fly ("I want to do triceps now", "switch to legs")
    if (
      clean.includes('tricep') || clean.includes('triceps') || clean.includes('diamond push')
    ) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('SWITCH_ROUTINE', text, 'triceps');
      return true;
    }

    if (
      clean.includes('legs') || clean.includes('leg day') || clean.includes('quads') || clean.includes('squats')
    ) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('SWITCH_ROUTINE', text, 'legs');
      return true;
    }

    if (
      clean.includes('chest') || clean.includes('pecs') || clean.includes('pushups') || clean.includes('push ups')
    ) {
      if (clean.includes('do chest') || clean.includes('want chest') || clean.includes('switch to chest') || clean.includes('chest blast')) {
        this.lastProcessedText = clean;
        setTimeout(() => { this.lastProcessedText = ''; }, 1200);
        this.onCommand('SWITCH_ROUTINE', text, 'chest');
        return true;
      }
    }

    if (
      clean.includes('core') || clean.includes('abs') || clean.includes('abdominals')
    ) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('SWITCH_ROUTINE', text, 'core');
      return true;
    }

    if (
      clean.includes('shoulders') || clean.includes('shoulder workout') || clean.includes('delts')
    ) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('SWITCH_ROUTINE', text, 'shoulders');
      return true;
    }

    // 2c. Spoken Form Coaching Masterclass ("Teach me what to do and how to do")
    if (
      clean.includes('teach me') ||
      clean.includes('how to do') ||
      clean.includes('how do i do') ||
      clean.includes('explain form') ||
      clean.includes('what to do')
    ) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('TEACH_EXERCISE', text);
      return true;
    }

    // 3. Emergency Stop / General Immediate Pause (<1ms Cutoff)
    if (
      clean.includes('stop') ||
      clean.includes('pause') ||
      clean.includes('paws') ||
      clean.includes('hold up') ||
      clean.includes('hol up') ||
      clean.includes('wait') ||
      clean.includes('chill') ||
      clean.includes('quiet') ||
      clean.includes('shut up') ||
      clean.includes('freeze') ||
      clean.includes('halt') ||
      clean.includes('hault')
    ) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('PAUSE', text, 'GENERAL');
      return true;
    }

    // 4. Start Workout / Let's Go / Begin / Start the Gym
    if (
      clean.includes('start the gym') ||
      clean.includes('start workout') ||
      clean.includes('start now') ||
      clean.includes('lets start') ||
      clean.includes("let's start") ||
      clean.includes('lets go') ||
      clean.includes("let's go") ||
      clean.includes('begin') ||
      clean.includes('get started') ||
      clean.includes('hit it') ||
      clean.includes('go for instant') ||
      clean === 'start' ||
      clean.startsWith('start ')
    ) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('START', text);
      return true;
    }

    // 5. Recovery / Resume: "okay now", "ready to go", "resume", "continue", "start again", "all good", "feeling good"
    if (
      clean.includes('resume') ||
      clean.includes('continue') ||
      clean.includes('okay now') ||
      clean.includes('fine now') ||
      clean.includes('good now') ||
      clean.includes('feeling good') ||
      clean.includes('feel good') ||
      clean.includes('feeling great') ||
      clean.includes('recovered') ||
      clean.includes('ready to go') ||
      clean.includes('ready to roll') ||
      clean.includes('ready now') ||
      clean.includes('all good') ||
      clean.includes("i'm okay") ||
      clean.includes("i am okay") ||
      clean.includes('im okay') ||
      clean.includes('feeling better') ||
      clean.includes('start again') ||
      clean.includes('keep going') ||
      clean.includes('back at it')
    ) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('RESUME', text);
      return true;
    }

    // 6. Skip rest
    if (
      clean.includes('skip rest') ||
      clean.includes('skipt') ||
      clean.includes('skip it') ||
      clean.includes('skip') ||
      clean.includes('next set') ||
      clean.includes('next round') ||
      clean.includes('hit me') ||
      clean.includes('cut rest') ||
      clean.includes('cut the rest') ||
      clean.includes("i'm ready") ||
      clean.includes('im ready') ||
      clean.includes('bring it on')
    ) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('SKIP_REST', text);
      return true;
    }

    // 7. Add rest
    if (clean.includes('add 10') || clean.includes('add ten') || clean.includes('more time') || clean.includes('more rest') || clean.includes('longer rest')) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('ADD_REST', text);
      return true;
    }

    // 8. Next Exercise
    if (clean.includes('next exercise') || clean.includes('skip exercise') || clean.includes('different exercise') || clean.includes('switch exercise')) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('NEXT_EXERCISE', text);
      return true;
    }

    return false;
  }

  /**
   * Dispatch full conversational speech to the AI backend
   * (Allows user to talk freely without word limits)
   */
  dispatchFullUtterance(text) {
    if (!text || text === this.lastProcessedText) return;
    this.lastProcessedText = text;
    this.onCommand('', text);
  }

  start() {
    if (!this.hasSupport || !this.recognition) return;
    this.shouldRestart = true;
    try {
      this.recognition.start();
      this.isListening = true;
      this.onStatusChange('LISTENING');
      this.onLog('🎙️ Hands-free microphone listening started.', 'info');
    } catch (e) {
      // Already active
      this.isListening = true;
      this.onStatusChange('LISTENING');
    }
  }

  stop() {
    this.shouldRestart = false;
    clearTimeout(this.silenceTimer);
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.isListening = false;
    this.onStatusChange('OFF');
    this.onLog('🎙️ Microphone paused.', 'info');
  }

  toggle() {
    if (this.isListening) {
      this.stop();
    } else {
      this.start();
    }
  }
}
