/**
 * voiceListener.js
 * Browser-native Speech-To-Text and Instant Barge-In detection.
 * Uses Web Speech API (webkitSpeechRecognition) with continuous listening
 * and interimResults = true for zero-latency speech interception.
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

    // 1. Acoustic speech detection (Fastest possible barge-in signal)
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
        const text = item[0].transcript.trim().toLowerCase();

        if (item.isFinal) {
          finalTranscript += text + ' ';
        } else {
          interimTranscript += text + ' ';
        }
      }

      const activeText = (finalTranscript || interimTranscript).trim();
      if (activeText) {
        this.onInterim(activeText);
        this.parseCommand(activeText);
      }
    };

    rec.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.warn('[VoiceListener] Recognition error:', event.error);
        if (event.error === 'not-allowed') {
          this.shouldRestart = false;
          this.onStatusChange('MIC_BLOCKED');
          this.onLog('❌ Microphone access blocked. Please allow mic permission.', 'interrupt');
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
            if (this.shouldRestart) {
              try { rec.start(); this.isListening = true; } catch (err) {}
            }
          }, 400);
        }
      } else {
        this.onStatusChange('OFF');
      }
    };

    this.recognition = rec;
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
      // Already running or starting
    }
  }

  stop() {
    this.shouldRestart = false;
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.isListening = false;
    this.onStatusChange('OFF');
  }

  /**
   * Fast rule-based spoken intent parsing
   */
  parseCommand(text) {
    const clean = text.toLowerCase();

    // 1. Skip rest / Next set intent
    if (
      clean.includes('skip rest') ||
      clean.includes('skip it') ||
      clean.includes('skip') ||
      clean.includes('next set') ||
      clean.includes('start set')
    ) {
      this.onCommand('SKIP_REST', text);
      return;
    }

    // 2. Pause / Stop workout
    if (
      clean.includes('stop') ||
      clean.includes('pause') ||
      clean.includes('hold on') ||
      clean.includes('wait')
    ) {
      this.onCommand('PAUSE', text);
      return;
    }

    // 3. Resume workout
    if (
      clean.includes('resume') ||
      clean.includes('continue') ||
      clean.includes('start') ||
      clean.includes("i'm ready") ||
      clean.includes('im ready')
    ) {
      this.onCommand('RESUME', text);
      return;
    }

    // 4. Add more rest time
    if (
      clean.includes('add 10') ||
      clean.includes('add ten') ||
      clean.includes('more time') ||
      clean.includes('give me more') ||
      clean.includes('more rest')
    ) {
      this.onCommand('ADD_REST', text);
      return;
    }

    // 5. Next Exercise
    if (
      clean.includes('next exercise') ||
      clean.includes('skip exercise') ||
      clean.includes('different workout')
    ) {
      this.onCommand('NEXT_EXERCISE', text);
      return;
    }
  }
}
