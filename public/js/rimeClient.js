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
   * Request TTS audio from Rime via server proxy.
   * @param {string} text - Phrase to synthesize
   * @param {AbortSignal} [signal] - Optional signal to abort fetch immediately upon barge-in
   * @returns {Promise<Blob|null>} Audio blob
   */
  async synthesize(text, signal = null) {
    if (!text || !text.trim()) return null;

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          speaker: this.speaker,
          modelId: this.modelId
        }),
        signal: signal
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.warn('[RimeClient] Server returned status:', res.status, errorData);
        return { fallback: true, text };
      }

      const audioBlob = await res.blob();
      return { audioBlob, fallback: false, text };
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[RimeClient] Synthesis request was aborted mid-flight by barge-in.');
        throw err;
      }
      console.error('[RimeClient] Synthesis failed:', err);
      return { fallback: true, text };
    }
  }
}
