# AI Gym Voice Coach 🎙️💪
> **Hands-free, voice-only gym coach with ultra-low latency barge-in interruption powered by Rime.ai TTS**

Built for hackathons and mid-workout training where athletes' hands are busy and eyes cannot remain glued to a screen.

🔗 **GitHub Repository**: [https://github.com/Priyanshuf1/voice-gym-coach](https://github.com/Priyanshuf1/voice-gym-coach)

---

## ⚡ The Hard Voice Problem: Interruption & Recovery

Traditional voice assistants suffer from **speech queue bloat** and **stale background execution**. If a coach is 5 seconds into a 30-second rest announcement ("*Rest for 30 seconds... take deep breaths...*") and the user shouts *"Skip rest, next set!"*, standard assistants either:
1. Finish speaking the full 30-second sentence before responding.
2. Cut audio, but leave the countdown interval running in the background, blurting out *"Rest over!"* 25 seconds into Set 2.

### How We Solved It
Our pipeline cuts across **three separate layers simultaneously in <10ms**:
1. **Physical Audio Abort (0ms)**: Synchronously calls `audio.pause()`, resets `currentTime = 0`, and revokes active audio stream blobs.
2. **Network & In-Flight Abort (<5ms)**: Uses native JavaScript `AbortController.abort()` to terminate in-flight HTTP streams to Rime.ai, preventing orphaned speech from ever loading into memory.
3. **State Machine Destruction (Synchronous)**: Calls `clearInterval()` and `clearTimeout()` on the active rest countdown interval. The Workout Finite State Machine (FSM) transitions from `REST_TIMER` directly into `EXERCISE_REPS` (Set 2), resets rep counts, and triggers new speech with zero stale state leakage.

---

## 🏗️ Architecture & Audio Flow

```
[ User Speaks into Mic ]
       │
       ▼
[ Web Audio API / Browser Mic Stream ]
       │
       ├─── (A) ⚡ INSTANT BARGE-IN TRIGGER (onspeechstart / interim STT) ─────┐
       │                                                                       │
       ▼                                                                       ▼
[ Speech-to-Text (STT) ]                                           [ INTERRUPT BUS ]
  • Browser Web Speech API (0ms round-trip, continuous)                        │
       │                                                                       │
       ▼ (Final / Interim Transcript: "skip rest", "stop", "next set")         │
[ Intent Router / Command Parser ]                                             │
  • Fast Regex & Rule Engine                                                   │
       │                                                                       │
       ▼                                                                       │
[ Workout State Machine (FSM) ] <──────────────────────────────────────────────┤
  • States: IDLE, COUNTDOWN, EXERCISE_REPS, REST_TIMER, PAUSED, COMPLETED      │
  • Timers: Rest Countdown Tick (cleared synchronously on interrupt)           │
       │                                                                       │
       ▼ (Coach Text: "Skipping rest! Starting Set 2 now: 1...")               │
[ Coach Speech Dispatcher & Audio Controller ] <───────────────────────────────┘
       │                                                    * On Interrupt (0ms):
       │                                                      1. audio.pause() & reset
       │                                                      2. Abort in-flight Rime fetch
       │                                                      3. Destroy active intervals
       ▼
[ Backend Proxy (/api/tts) ] (Node/Express - secures API key)
       │ (Bearer Authorization)
       ▼
[ Rime.ai Cloud TTS API ]
  • Endpoint: `https://users.rime.ai/v1/rime-tts`
  • Model: `coda` (flagship low-latency model)
  • Speaker: `celeste`
       │
       ▼ (Audio Stream / WAV / MP3)
[ Speaker (Browser Web Audio Player) ]
```

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
Copy the template `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` and add your Rime API key (get free credits at [dashboard.rime.ai](https://dashboard.rime.ai/)):
```env
RIME_API_KEY=your_actual_rime_api_key
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

---

## ⚠️ Known Limitations
1. **Acoustic Echo Cancellation (Laptop Speakers vs Headphones)**: If testing at maximum speaker volume without headphones, loud coach speech can occasionally feed into the laptop's open microphone. For best experience, wear wireless earbuds/headphones (as someone working out in a gym would).
2. **Browser Engine**: Web Speech API is natively supported in Google Chrome, Microsoft Edge, and Safari. Firefox does not implement `webkitSpeechRecognition` by default.
