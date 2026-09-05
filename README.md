# AI Gym Voice Coach 🎙️💪
> **Hands-free, voice-only gym coach with instant barge-in interruption powered by Rime.ai TTS, Rabto Awwwards-tier Design System, and Free Unlimited AI via Gemini-Web2API.**

Built for hackathons and athletic training where hands are busy, eyes cannot remain glued to a screen, and athletes need instant vocal responsiveness.

🔗 **GitHub Repository**: [https://github.com/Priyanshuf1/voice-gym-coach](https://github.com/Priyanshuf1/voice-gym-coach)

---

## 💎 Rabto Design System & Aesthetic Polish

Built following the **[Rabto Skill Standards](https://github.com/Priyanshuf1/rabto)**:
1. **Liquid Glass & Bento-Grid Layout (`modern-startup-design`, `ui-ux-pro-max`)**:
   - Frosted acrylic panels (`backdrop-filter: blur(20px)`) with subtle 1px border lighting.
   - Grounded colored left stripes (`stripe-cyan`, `stripe-purple`, `stripe-rose`) to anchor content areas.
   - Dual glowing background radial orbs (cyan & electric purple) layered on a technical dot-matrix background.
2. **Interactive Audio Direction (`interactive-audio-direction`)**:
   - Zero-latency Web Audio API synthesizer SFX engine:
     - 880Hz crisp woodblock countdown ticks (`playTick()`)
     - Resonant bell chime on rep completion (`playRepDing()`)
     - Deep harmonic rest period gong (`playRestGong()`)
     - Instant audio cutoff glitch sweep on barge-in (`playBargeInGlitch()`)
   - Master volume slider and global instant-mute toggle.
   - Real-time 60fps Web Audio frequency equalizer waveform pulsing to the coach's voice.
3. **Cinematic Web Typography (`cinematic-web-typography`)**:
   - Modern geometric pairing: **Space Grotesk** for athletic headers and counters + **Inter** for clean UI readability.
   - Tabular numerals for zero-jitter countdown displays.
4. **Workout Routine Switcher (Bento Pills)**:
   - 🔥 **Full Body Burn**: Push-ups, Bodyweight Squats, Mountain Climbers.
   - 💪 **Upper Body Power**: Diamond Push-ups, Pike Push-ups, Bench Dips.
   - 🧘 **Core & Mobility**: Plank Hold, Bird-Dog, Bicycle Crunches.
   - **Rep Pacing Selector**: Fast (1.6s), Standard (2.2s), Slow Power (3.0s).

---

## 🤖 Free Unlimited AI via Gemini-Web2API Integration

Integrated directly with **[Sophomoresty/gemini-web2api](https://github.com/Sophomoresty/gemini-web2api)** to provide unlimited, zero-cost conversational AI intelligence!

### How It Works:
- Athletes can ask the coach anything mid-workout using the **✨ AI Coach Brain** (spoken or typed):
  - *"My triceps are burning, give me motivation!"*
  - *"I feel sharp lower back pain, what should I do?"*
  - *"What is the breathing pattern for diamond push-ups?"*
- The backend proxy (`server.js`) routes requests to `http://localhost:8081/v1/chat/completions` using the high-speed `gemini-3.6-flash` model.
- The AI formulates punchy, athletic advice (under 25 words) that is immediately synthesized and spoken out loud via **Rime.ai TTS** (`coda` / `celeste`)!
- If the local Python Web2API daemon is offline, the coach automatically uses its built-in athletic intelligence rules without ever dropping a connection.

### To Run Gemini-Web2API Locally:
```bash
cd C:\Users\apriy\.gemini\antigravity\scratch\gemini-web2api
pip install -r requirements.txt
python gemini_web2api.py
```
*(Runs at `http://localhost:8081/v1`. The gym coach auto-detects it!)*

---

## ⚡ The Hard Voice Problem: Interruption & Recovery

When a user interrupts mid-sentence (e.g. saying *"skip it, next set"* during a rest announcement):
1. **Physical Audio Abort (0ms)**: Synchronously calls `audio.pause()`, resets `currentTime = 0`, and revokes active audio stream blobs.
2. **Network & In-Flight Abort (<5ms)**: Uses native JavaScript `AbortController.abort()` to terminate in-flight HTTP streams to Rime.ai.
3. **State Machine Destruction (Synchronous)**: Calls `clearInterval()` and `clearTimeout()` on active countdown timers. The Finite State Machine transitions to `EXERCISE_REPS` (Set 2), resets rep counts, and triggers new speech with zero stale state leakage.

---

## 🎙️ Rime.ai Engine Specifications

- **Endpoint**: `https://users.rime.ai/v1/rime-tts`
- **Model ID**: `coda` (optimized for conversational voice agents & real-time responsiveness)
- **Speaker**: `celeste` (natural, authoritative athletic coach voice)
- **Language**: English (`en-US`)
- **Payload Format**:
  ```json
  {
    "text": "Skipping rest! Starting Set 2 now: 1...",
    "speaker": "celeste",
    "modelId": "coda"
  }
  ```
- **Fallback Capability**: If running without an internet connection or before configuring an API key, the app gracefully falls back to high-speed local speech synthesis so you can test interruption instantly.

---

## 🚀 Setup & Running Instructions

### 1. Clone & Install
```bash
git clone https://github.com/Priyanshuf1/voice-gym-coach.git
cd voice-gym-coach
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```
Edit `.env` and add your Rime API key (get free credits at [dashboard.rime.ai](https://dashboard.rime.ai/)):
```env
RIME_API_KEY=your_actual_rime_api_key
GEMINI_WEB2API_URL=http://localhost:8081/v1
PORT=3000
```

### 3. Start the Application
```bash
npm start
```
Open **Chrome** or **Edge** at:
```
http://localhost:3000
```

---

## 🗣️ Supported Spoken Commands

| Command | Triggers / Synonyms | Action |
| :--- | :--- | :--- |
| **Skip Rest** | "skip rest", "skip it", "next set", "start set" | Instantly stops rest timer and begins the next exercise set. |
| **Pause** | "stop", "pause", "hold on", "wait" | Freezes rep cycle and active timers. |
| **Resume** | "resume", "continue", "start", "I'm ready" | Resumes active workout from paused state. |
| **Add Rest** | "add 10 seconds", "more time", "give me more" | Extends current rest countdown by +10 seconds. |
| **Next Exercise** | "next exercise", "skip exercise", "different workout" | Jumps straight to the next workout routine. |
| **Ask AI Coach** | Ask any fitness, form, or motivation question | AI Coach answers in 1-2 spoken sentences via Rime TTS. |
