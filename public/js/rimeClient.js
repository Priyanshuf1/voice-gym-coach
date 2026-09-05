/**
 * rimeClient.js
 * Client wrapper for Rime.ai Text-to-Speech API
 * Communicates through local /api/tts proxy to keep API keys secure.
 */

export class RimeClient {
  constructor(options = {}) {
    this.speaker = options.speaker || 'celeste';
    this.modelId = options.modelId || 'coda';
    this.isRimeConfigured = false;
    this.cache = new Map();
  }

  async checkConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      this.isRimeConfigured = data.isRimeConfigured;
      return data;
    } catch (err) {
      console.warn('[RimeClient] Failed to check server config:', err);
      return { isRimeConfigured: false, voiceEngine: 'Offline' };
    }
  }

  /**
   * Pre-cache an array of common workout phrases in the background
   * Ensures near 0ms latency when these phrases are triggered mid-workout.
   */
  async precache(phrases = []) {
    for (const phrase of phrases) {
      const clean = (phrase || '').trim();
      if (!clean || this.cache.has(clean)) continue;
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: clean,
            speaker: this.speaker,
            modelId: this.modelId
          })
        });
        if (res.ok) {
          const blob = await res.blob();
          this.cache.set(clean, blob);
          console.log(`[RimeClient] Cached audio for: "${clean.substring(0, 30)}..." (${Math.round(blob.size/1024)} KB)`);
        }
      } catch (e) {
        // Silently continue precaching
      }
    }
  }

  /**
   * Request TTS audio from Rime via server proxy with instant cache lookup.
   * @param {string} text - Phrase to synthesize
   * @param {AbortSignal} [signal] - Optional signal to abort fetch immediately upon barge-in
   * @returns {Promise<Blob|null>} Audio blob
   */
  async synthesize(text, signal = null) {
    if (!text || !text.trim()) return null;
    const clean = text.trim();

    // 0ms Instant Cache Hit
    if (this.cache.has(clean)) {
      return { audioBlob: this.cache.get(clean), fallback: false, text: clean, fromCache: true };
    }

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: clean,
          speaker: this.speaker,
          modelId: this.modelId
        }),
        signal: signal
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.warn('[RimeClient] Server returned status:', res.status, errorData);
        return { fallback: true, text: clean };
      }

      const audioBlob = await res.blob();
      // Store in memory cache for instant future reuse
      this.cache.set(clean, audioBlob);
      return { audioBlob, fallback: false, text: clean, fromCache: false };
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[RimeClient] Synthesis request was aborted mid-flight by barge-in.');
        throw err;
      }
      console.error('[RimeClient] Synthesis failed:', err);
      return { fallback: true, text: clean };
    }
  }
}
