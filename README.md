# Virtual Gym Trainer 🎙️⚡
> **Hands-Free, Real-Time Autonomous Sports Science Voice Coach powered by Rime.ai Coda TTS, Full-Duplex Acoustic Barge-In, and Interactive 3D Biomechanics.**

[![Rime Hackathon Submission](https://img.shields.io/badge/Rime%20Hackathon-Submission%202026-blueviolet)](https://users.rime.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/Repository-voice--gym--coach-orange)](https://github.com/Priyanshuf1/voice-gym-coach)

---

## 🏆 Rime Hackathon Challenge Overview

### 1. Problem & Necessity of Voice (25% Weight)
- **Target User**: Athletes, strength trainees, and solo home exercisers performing intense bodyweight and free-weight routines (Push-ups, Planks, Squats, Dips).
- **Physical Situation**: Both hands are planted on the gym floor or gripping a barbell. Eyes are focused down or ahead to maintain cervical spine neutrality. Forearms and palms are sweat-soaked.
- **Why Voice is Essential**: 
  - **Screen-only interfaces completely fail**: A trainee in the middle of an 8-rep diamond push-up set cannot reach over to tap a screen, adjust a timer, or read small text without breaking form, collapsing shoulder stability, or risking spinal injury.
  - **Removing speech destroys the product**: Real-time auditory pacing, countdown cues, rest countdowns, and acoustic barge-in halts are the *only* viable interaction modality when hands and eyes are fully occupied by physical load.

### 2. The Hard Voice Problem: Full-Duplex Interruption & Acoustic Speaker Echo Suppression (25% Weight)
Unlike simple conversational chatbots with play buttons, a sports coach operates under realistic, adverse acoustic conditions:
1. **Zero-Latency Barge-In Cutoff (<10ms)**: When a gasping user shouts *"Stop!"* or *"I need water!"*, the coach's audio must stop *immediately*, aborting in-flight network synthesis and purging queued speech.
2. **Acoustic Speaker Echo Cancellation**: Device speakers play loud audio into the room. Without intelligent echo filtering, the microphone transcribes the coach's own voice (e.g. *"Switching to Triceps..."*), matching its own words and causing an infinite 3–4x repetition echo loop. We solved this at the software layer by correlating recent coach speech with microphone tokens, dropping speaker feedback while keeping user barge-ins active.
3. **Sentence Accumulation without Fragmentation**: Normal human speech pauses between words (250–350ms). We eliminated premature interim timeouts, allowing users to speak natural complex thoughts (*"I want to do triceps now"*) without being chopped into isolated fragments.

---

## 🎙️ Rime.ai Integration Specifications (20% Weight)

| Parameter | Shipped Production Value | Technical Rationale |
| :--- | :--- | :--- |
| **Model ID** | `coda` | Rime's ultra-low latency, conversational model engineered for real-time responsiveness and realistic athletic prosody. |
| **Speaker** | `celeste` | Confident, clear, authoritative athletic trainer voice with high intelligibility over ambient noise. |
| **Language** | English (`en-US` / `en`) | Standard athletic command vocabulary and anatomical sports science terms. |
| **Endpoint** | `https://users.rime.ai/v1/rime-tts` | Official Rime production REST endpoint, proxied securely via backend `/api/tts`. |
| **Audio Format** | `audio/wav` (PCM Stream) | Uncompressed high-fidelity audio stream for immediate browser decoding with 0ms transcoding lag. |
| **Transport** | Streaming HTTP POST with `AbortController` | Enables instantaneous sub-10ms request termination when user interrupts mid-sentence. |
| **Active Indicator** | Live HUD Vocalizer Badge | UI displays **"VOCALIZER: RIME CODA TTS"** when active, or fallback badge if offline. |

---

## 🏗️ Architecture & Component Topology

```
+-------------------------------------------------------------------------+
|                              CLIENT (Browser)                           |
|                                                                         |
|  +---------------------+      +------------------+      +-------------+ |
|  | Web Speech API STT  | ---> |  VoiceListener   | ---> | StateMachine| |
|  | (Continuous Stream) |      | (Echo Filter +   |      | (Set & Rep  | |
|  +---------------------+      |  Accumulation)   |      |  Choreog.)  | |
|                               +------------------+      +------+------+ |
|                                                                |        |
|  +---------------------+      +------------------+             |        |
|  | HTML5 Audio Element | <--- | AudioController  | <-----------+        |
|  | (0ms Instant Abort) |      | (Barge-In Hub)   |                      |
|  +---------------------+      +--------+---------+                      |
|                                        |                                |
|  +---------------------+               |                                |
|  | Spline 3D Mascot    | <-------------+                                |
|  | (Biomechanics HUD)  |                                                |
|  +---------------------+                                                |
+----------------------------------------|--------------------------------+
                                         | HTTP /api/tts
                                         v
+-------------------------------------------------------------------------+
|                           SERVER (Node.js / Express)                    |
|                                                                         |
|  +----------------------+                     +----------------------+  |
|  |  POST /api/tts       | ------------------> | Rime.ai Cloud API    |  |
|  |  (Secret Bearer Auth)|                     | (coda / celeste)     |  |
|  +----------------------+                     +----------------------+  |
|                                                                         |
|  +----------------------+                     +----------------------+  |
|  |  POST /api/intent-ai | ------------------> | Gemini AI / Local    |  |
|  |  (Sports Science)    |                     | Sports Biomechanics  |  |
|  +----------------------+                     +----------------------+  |
+-------------------------------------------------------------------------+
```

---

## 🚀 Setup & Quickstart

### Prerequisites
- Node.js (v18 or higher recommended)
- Google Chrome or Microsoft Edge (for Web Speech API support)
- Free Rime API Key from [dashboard.rime.ai](https://dashboard.rime.ai/)

### 1. Clone the Repository
```bash
git clone https://github.com/Priyanshuf1/voice-gym-coach.git
cd voice-gym-coach
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and insert your Rime API key:
```env
RIME_API_KEY=your_actual_rime_api_key
PORT=3000
GEMINI_WEB2API_URL=http://localhost:8081/v1
```
*(Note: `.env` is gitignored to guarantee zero credentials ever reach GitHub).*

### 4. Start the Application
```bash
npm start
```
Visit **`http://localhost:3000`** in Chrome or Edge.

---

## 🧪 Automated Reproducible Verification

Judges can verify all claims with a single repeatable command:
```bash
node test_voice_benchmarks.js
```

This runs the automated test suite verifying:
1. **Configuration Preflight**: Secret isolation and live Rime credentials.
2. **Latency Benchmark**: Uncached network latency vs warm socket vs <15ms precached playback.
3. **Pronunciation & Delivery**: Normalized spelled-out variants (`"twelve reps"`) vs raw digits (`"12 reps"`).
4. **Colloquial Intent AI**: Full sentence routine switching and sports medicine recovery deduction.

---

## 🗣️ Voice Command Reference

| Spoken Utterance | Category | Action Taken |
| :--- | :--- | :--- |
| *"Stop"* / *"Pause"* / *"Top"* / *"Stock"* | Emergency Halt | Cuts audio in <10ms and freezes workout timer immediately. |
| *"I need water"* / *"Drink water"* | Hydration Pause | Halts set, offers hydration sports advice, and holds state. |
| *"My elbow is hurting"* / *"I hurt myself"* | Injury Triage | Stops set instantly, advises 45° elbow tuck and joint safety. |
| *"I want to do triceps now"* | Dynamic Routine Switch | Drops current routine, selects Triceps, announces first exercise. |
| *"Switch to legs"* / *"Leg day"* | Dynamic Routine Switch | Loads Bodyweight Squats & Lunges with custom cadence. |
| *"Skip rest"* / *"Next set"* / *"I'm ready"* | Rest Control | Cancels rest countdown and starts Set 2 rep counter instantly. |
| *"Add 10 seconds"* | Rest Extension | Extends rest timer by +10s without restarting audio. |
| *"Teach me what to do"* | Form Masterclass | Delivers a 2-sentence biomechanics coaching guide via Rime TTS. |

---

## ⚠️ Known Limitations & Failure Behavior

1. **Browser Speech Recognition**: Web Speech API is natively supported in Chromium browsers (Chrome, Edge, Brave, Opera) and Safari. If accessed on Firefox, manual voice chips and text inputs remain 100% operational.
2. **Acoustic Headphone Recommendation**: In gym environments with loud ambient music, Bluetooth sports earbuds (AirPods, etc.) provide optimal voice isolation. On laptop speakers, our built-in software echo suppressor filters out coach playback to prevent self-looping.
3. **Offline Fallback**: If the Rime API key is missing or network connectivity drops, the application automatically falls back to browser speech synthesis without throwing unhandled exceptions.
