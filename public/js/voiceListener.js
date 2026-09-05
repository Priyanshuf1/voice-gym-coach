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
    const clean = (text || '').toLowerCase();
    // 0. Emergency Stop / Immediate Pause (<1ms cutoff)
    if (
      clean.includes('stop') ||
      clean.includes('pause') ||
      clean.includes('hold up') ||
      clean.includes('hold on') ||
      clean.includes('hol up') ||
      clean.includes('wait') ||
      clean.includes('chill') ||
      clean.includes('quiet') ||
      clean.includes('shut up') ||
      clean.includes('freeze')
    ) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('PAUSE', text);
      return true;
    }

    // 1. Recovery / Resume: "okay now", "ready to go", "resume", "continue", "start again"
    if (
      clean.includes('resume') ||
      clean.includes('continue') ||
      clean.includes('okay now') ||
      clean.includes('fine now') ||
      clean.includes('good now') ||
      clean.includes('recovered') ||
      clean.includes('ready to go') ||
      clean.includes('ready to roll') ||
      clean.includes('all good') ||
      clean.includes("i'm okay") ||
      clean.includes("i am okay") ||
      clean.includes('feeling better') ||
      clean.includes('start again') ||
      clean.includes('keep going')
    ) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('RESUME', text);
      return true;
    }

    // 2. Start Workout / Let's Go / Begin / Start the Gym / Start
    if (
      clean.includes('start') ||
      clean.includes('begin') ||
      clean.includes('lets go') ||
      clean.includes("let's go") ||
      clean.includes('get started') ||
      clean.includes('hit it') ||
      clean.includes('go for instant')
    ) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('START', text);
      return true;
    }

    // 3. Skip rest
    if (
      clean.includes('skip rest') ||
      clean.includes('skipt') ||
      clean.includes('skip it') ||
      clean.includes('skip') ||
      clean.includes('next set') ||
      clean.includes('next round') ||
      clean.includes('hit me') ||
      clean.includes('cut rest') ||
      clean.includes("i'm ready") ||
      clean.includes('im ready')
    ) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('SKIP_REST', text);
      return true;
    }

    // 4. Add rest
    if (clean.includes('add 10') || clean.includes('add ten') || clean.includes('more time') || clean.includes('more rest')) {
      this.lastProcessedText = clean;
      setTimeout(() => { this.lastProcessedText = ''; }, 1200);
      this.onCommand('ADD_REST', text);
      return true;
    }

    // 5. Next Exercise
    if (clean.includes('next exercise') || clean.includes('skip exercise') || clean.includes('different exercise')) {
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
