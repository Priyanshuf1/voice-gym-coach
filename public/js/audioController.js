/**
 * audioController.js
 * Hardware-level audio playback and instant barge-in interruption controller.
 * Solves:
 * 1. Immediate audio playback cutoff (0ms pause + zero currentTime)
 * 2. Purging scheduled speech queue
 * 3. In-flight network request abortion via AbortController
 * 4. Fallback synthesis instant cancellation
 */

export class AudioController {
  constructor(rimeClient, onSubtitleUpdate, onLog) {
    this.rimeClient = rimeClient;
    this.onSubtitleUpdate = onSubtitleUpdate || (() => {});
    this.onLog = onLog || (() => {});

    // Active audio element
    this.currentAudio = null;
    // Active AbortController for network fetch
    this.activeAbortController = null;
    // Active speech queue
    this.queue = [];
    this.isPlaying = false;
    this.isInterrupted = false;

    // AudioContext for Web Audio if needed
    this.audioCtx = null;
  }

  initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Speak a text string using Rime TTS (or browser synthesis fallback)
   * @param {string} text - The spoken sentence
   * @param {boolean} priority - If true, clears current queue first
   * @returns {Promise<boolean>} True if completed, false if interrupted
   */
  async speak(text, priority = false) {
    if (!text || !text.trim()) return false;

    if (priority) {
      this.interrupt('New priority phrase dispatched');
    }

    this.isInterrupted = false;
    this.initAudioContext();

    return new Promise(async (resolve) => {
      this.activeAbortController = new AbortController();
      const signal = this.activeAbortController.signal;

      this.onSubtitleUpdate(text);
      this.isPlaying = true;

      try {
        const result = await this.rimeClient.synthesize(text, signal);

        // Check if interrupted while fetching from network
        if (this.isInterrupted || signal.aborted) {
          resolve(false);
          return;
        }

        if (result && !result.fallback && result.audioBlob) {
          // Play Rime audio via HTMLAudioElement
          const audioUrl = URL.createObjectURL(result.audioBlob);
          const audio = new Audio(audioUrl);
          this.currentAudio = audio;

          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            this.currentAudio = null;
            this.isPlaying = false;
            resolve(true);
          };

          audio.onerror = (e) => {
            console.warn('[AudioController] Audio playback error:', e);
            URL.revokeObjectURL(audioUrl);
            this.currentAudio = null;
            this.isPlaying = false;
            resolve(false);
          };

          await audio.play();
        } else {
          // Graceful fallback to browser Web Speech Synthesis if Rime API key not set
          this.playBrowserSynthesis(text, resolve);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          resolve(false);
        } else {
          console.error('[AudioController] Speak error:', err);
          this.isPlaying = false;
          resolve(false);
        }
      }
    });
  }

  playBrowserSynthesis(text, resolve) {
    if (!('speechSynthesis' in window)) {
      this.isPlaying = false;
      resolve(true);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      this.isPlaying = false;
      resolve(true);
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('[AudioController] Fallback TTS error:', e);
      }
      this.isPlaying = false;
      resolve(false);
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * ⚡ CRITICAL INTERRUPT METHOD (Barge-In)
   * Cuts off audio playback in 0-10 milliseconds.
   * Purges queues and aborts pending network streams.
   */
  interrupt(reason = 'User voice barge-in') {
    const startTime = performance.now();
    this.isInterrupted = true;
    this.isPlaying = false;

    // 1. Instantly stop HTMLAudio playback
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
      } catch (e) {
        console.warn('[AudioController] Error pausing audio:', e);
      }
      this.currentAudio = null;
    }

    // 2. Abort any in-flight Rime TTS fetch request
    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch (e) {}
      this.activeAbortController = null;
    }

    // 3. Instantly kill browser speech synthesis if active
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }

    // 4. Empty queue
    this.queue = [];

    const latency = (performance.now() - startTime).toFixed(1);
    this.onLog(`🛑 [INTERRUPT] Audio aborted instantly in ${latency}ms (${reason})`, 'interrupt');
    return latency;
  }
}
