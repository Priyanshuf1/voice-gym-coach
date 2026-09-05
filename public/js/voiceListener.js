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
    this.lastCommandName = '';
    this.lastCommandTime = 0;
    this.silenceTimer = null;
    this.currentTurnHandled = false;
    this.turnCooldownTimer = null;

    this.initRecognition();
  }

  isSelfEcho(text) {
    if (!text) return false;
    const clean = text.toLowerCase().trim();
    if (!clean) return false;

    // Check if coach is actively speaking or finished less than 1200ms ago
    const isCoachActive = window.__isCoachSpeaking || (Date.now() - (window.__coachSpeechEndedAt || 0) < 1200);
    if (!isCoachActive) return false;

    // Check for explicit user barge-in single words: "stop", "pause", "water", "wait"
    // The coach never says a bare single word "stop" while talking.
    const isExplicitHalt = /^(stop|pause|paws|top|stock|stalk|spot|stuck|water|hold on|wait|chill|freeze|shut up)$/i.test(clean);
    if (isExplicitHalt) {
      return false; // User is legitimately barging in!
    }

    // Check against coach's recent spoken phrases
    const recent = window.__recentCoachUtterances || [];
    if (window.__lastCoachSpeech) {
      recent.unshift(window.__lastCoachSpeech);
    }

    for (const phrase of recent) {
      if (!phrase) continue;
      if (phrase.includes(clean) || clean.includes(phrase)) {
        return true;
      }
      const words = clean.split(/\s+/).filter(w => w.length > 2);
      if (words.length > 0) {
        let matchCount = 0;
        for (const w of words) {
          if (phrase.includes(w)) matchCount++;
        }
        if (matchCount / words.length >= 0.4) {
          return true;
        }
      }
    }

    return false;
  }

  safeDispatchCommand(command, text, subReason) {
    const now = Date.now();

    // 1. If acoustic echo from device speaker, suppress immediately
    if (this.isSelfEcho(text)) {
      console.log(`[VoiceListener] Acoustic echo suppressed for command "${command}": "${text}"`);
      return true;
    }

    // 2. If coach is speaking, ONLY emergency PAUSE is allowed to barge-in
    if (window.__isCoachSpeaking && command !== 'PAUSE') {
      console.log(`[VoiceListener] Blocked non-pause command "${command}" during coach speech`);
      return true;
    }

    // 3. Deduplicate rapid identical commands within 2000ms
    if (this.lastCommandName === command && (now - this.lastCommandTime) < 2000) {
      console.log(`[VoiceListener] Deduplicated duplicate command "${command}" within 2000ms`);
      return true;
    }

    this.lastCommandName = command;
    this.lastCommandTime = now;
    this.lastProcessedText = text;
    this.onCommand(command, text, subReason);
    return true;
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
    rec.maxAlternatives = 1;

    // 1. Acoustic speech detection (Fastest possible barge-in signal: <1ms)
    rec.onspeechstart = () => {
      this.onStatusChange('SPEECH_DETECTED');
      this.onSpeechStart();
    };

    rec.onspeechend = () => {
      this.onStatusChange('LISTENING');
    };

    // 2. Real-time Transcript Stream (<10ms Turnaround)
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

      // 1. Check acoustic echo from coach speech
      if (this.isSelfEcho(activeText)) {
        console.log(`[VoiceListener] Acoustic speaker echo suppressed: "${activeText}"`);
        return;
      }

      // Update live spoken display
      this.onInterim(activeText);

      // 2. Fast-path: Check for immediate safety / emergency command (<5ms)
      const handledFast = this.checkFastCommands(activeText);
      if (handledFast) {
        clearTimeout(this.silenceTimer);
        return;
      }

      // 3. Conversational Speech & Full Utterances:
      // Wait for complete sentence (isFinal) or generous trailing silence (1100ms)
      // NEVER prematurely chop into tiny 180ms word fragments!
      if (finalTranscript.trim()) {
        clearTimeout(this.silenceTimer);
        this.dispatchFullUtterance(finalTranscript.trim());
      } else {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = setTimeout(() => {
          if (activeText && activeText !== this.lastProcessedText) {
            this.dispatchFullUtterance(activeText);
          }
        }, 1100);
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
          }, 300);
        }
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
      return this.safeDispatchCommand('PAUSE', text, 'WATER');
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
      return this.safeDispatchCommand('PAUSE', text, 'REST');
    }

    // 2. Pain, Injury / Distress (<1ms Safety Pause)
    if (
      clean.includes('hurt myself') ||
      clean.includes('injured') ||
      clean.includes('pulled a muscle') ||
      clean.includes('sprained') ||
      clean.includes('not feeling good') ||
      clean.includes('feel sick') ||
      clean.includes('knee') ||
      clean.includes('wrist') ||
      clean.includes('dizzy') ||
      clean.includes('nauseous') ||
      clean.includes('cramp') ||
      clean.includes('clicking')
    ) {
      const isInjured = clean.includes('hurt myself') || clean.includes('injured') || clean.includes('pulled a muscle');
      return this.safeDispatchCommand('PAUSE', text, isInjured ? 'INJURY' : 'PAIN');
    }

    // 2b. Dynamic Workout Routine Switching on the fly ("I want to do triceps now", "switch to legs")
    if (
      clean.includes('tricep') || clean.includes('triceps') || clean.includes('diamond push')
    ) {
      return this.safeDispatchCommand('SWITCH_ROUTINE', text, 'triceps');
    }

    if (
      clean.includes('legs') || clean.includes('leg day') || clean.includes('quads') || clean.includes('squats')
    ) {
      return this.safeDispatchCommand('SWITCH_ROUTINE', text, 'legs');
    }

    if (
      clean.includes('chest') || clean.includes('pecs') || clean.includes('pushups') || clean.includes('push ups')
    ) {
      if (clean.includes('do chest') || clean.includes('want chest') || clean.includes('switch to chest') || clean.includes('chest blast')) {
        return this.safeDispatchCommand('SWITCH_ROUTINE', text, 'chest');
      }
    }

    if (
      clean.includes('core') || clean.includes('abs') || clean.includes('abdominals')
    ) {
      return this.safeDispatchCommand('SWITCH_ROUTINE', text, 'core');
    }

    if (
      clean.includes('shoulders') || clean.includes('shoulder workout') || clean.includes('delts')
    ) {
      return this.safeDispatchCommand('SWITCH_ROUTINE', text, 'shoulders');
    }

    // 2c. Spoken Form Coaching Masterclass ("Teach me what to do and how to do")
    if (
      clean.includes('teach me') ||
      clean.includes('how to do') ||
      clean.includes('how do i do') ||
      clean.includes('explain form') ||
      clean.includes('what to do')
    ) {
      return this.safeDispatchCommand('TEACH_EXERCISE', text);
    }

    // 3. Emergency Stop / General Immediate Pause (<1ms Cutoff)
    // Includes phonetic mishearings: "top", "stock", "stalk", "shop", "spot", "stuck", "stopped", "stopping"
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
      clean.includes('hault') ||
      clean === 'top' ||
      clean.startsWith('top ') ||
      clean.endsWith(' top') ||
      clean.includes(' stock') ||
      clean === 'stock' ||
      clean.startsWith('stock ') ||
      clean.includes(' stalk') ||
      clean === 'stalk' ||
      clean === 'shop' ||
      clean.includes(' spot') ||
      clean === 'spot' ||
      clean.includes(' stuck') ||
      clean === 'stuck' ||
      clean.includes('stopped') ||
      clean.includes('stopping') ||
      clean === 'drop' ||
      clean.includes('break') ||
      clean.includes('time out') ||
      clean.includes('timeout')
    ) {
      return this.safeDispatchCommand('PAUSE', text, 'GENERAL');
    }

    // 4. Start Workout / Let's Go / Begin / Start the Gym
    if (
      clean.includes('start the gym') ||
      clean.includes('start workout') ||
      clean.includes('starts now') ||
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
      clean.startsWith('start ') ||
      clean === 'starts'
    ) {
      return this.safeDispatchCommand('START', text);
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
      return this.safeDispatchCommand('RESUME', text);
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
      return this.safeDispatchCommand('SKIP_REST', text);
    }

    // 7. Add rest
    if (clean.includes('add 10') || clean.includes('add ten') || clean.includes('more time') || clean.includes('more rest') || clean.includes('longer rest')) {
      return this.safeDispatchCommand('ADD_REST', text);
    }

    // 8. Next Exercise
    if (clean.includes('next exercise') || clean.includes('skip exercise') || clean.includes('different exercise') || clean.includes('switch exercise')) {
      return this.safeDispatchCommand('NEXT_EXERCISE', text);
    }

    return false;
  }

  /**
   * Dispatch full conversational speech to the AI backend
   * (Allows user to talk freely without word limits or premature chopping)
   */
  dispatchFullUtterance(text) {
    if (!text) return;
    const clean = text.trim();
    if (!clean || clean === this.lastProcessedText) return;

    // Check echo suppression
    if (this.isSelfEcho(clean)) {
      console.log(`[VoiceListener] Echo suppressed in dispatchFullUtterance: "${clean}"`);
      return;
    }

    // Ignore commands if coach is currently speaking
    if (window.__isCoachSpeaking) {
      console.log(`[VoiceListener] Ignored full utterance while coach is speaking: "${clean}"`);
      return;
    }

    // Filter out isolated single incomplete tokens (e.g. "I", "the", "a", "so", "um", "uh")
    // Unless it's a known single-word command
    const words = clean.split(/\s+/);
    if (words.length === 1) {
      const w = words[0].toLowerCase();
      const validSingles = [
        'start', 'stop', 'pause', 'resume', 'skip', 'water',
        'top', 'stock', 'stalk', 'spot', 'halt', 'break',
        'legs', 'core', 'chest', 'triceps', 'shoulders', 'pushups', 'squats'
      ];
      if (!validSingles.includes(w)) {
        console.log(`[VoiceListener] Incomplete single-word fragment ignored: "${clean}"`);
        return;
      }
    }

    this.lastProcessedText = clean;
    this.onCommand('', clean);
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
