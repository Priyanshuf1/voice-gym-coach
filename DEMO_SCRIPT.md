# Rime Hackathon Challenge — 4–5 Minute Recorded Demo Script 🎙️⏱️
**Project**: Virtual Gym Trainer  
**Hackathon**: DataForge x Pathway x Rime  
**Speech Engine**: Rime.ai Coda (`modelId: coda`, `speaker: celeste`, `language: en-US`)  
**Repository**: [https://github.com/Priyanshuf1/voice-gym-coach](https://github.com/Priyanshuf1/voice-gym-coach)

---

## 🎬 Video Recording Plan & Script (Total Time: ~4:30)

| Timestamp | Phase | What to Say (Spoken Script) | What to Show on Screen / Action |
| :--- | :--- | :--- | :--- |
| **0:00 - 0:45** | **The User & Problem Necessity (25% Criteria)** | *"Hi judges! When you're mid-workout doing diamond push-ups or holding a plank, your hands are sweat-soaked on the floor and your eyes are focused on spinal alignment. You cannot reach over to tap a screen, adjust a timer, or read small text without collapsing your posture and risking injury. This is a voice-native product: if you remove voice, the product is completely broken. Rime Coda's real-time speech is the essential interaction layer."* | Show the clean athletic HUD with the 3D interactive Spline robot coach. Point to the header badge displaying **"🎙️ RIME CODA TTS ACTIVE"**. |
| **0:45 - 1:45** | **Normal Flow: Voice-Guided Reps & Rest** | *"Let's start the workout hands-free. I simply say: 'Start now!'"*<br>Speak: *"Start now!"*<br>Coach Celeste responds: *"Starting workout! Let's crush this session!"*<br>The coach counts reps, and the 3D Spline robot and kinetic biomechanics stick figure animate in sync. Rep 8 completes, and the coach enters a 30s rest countdown. | Circular progress ring animates, Web Audio tick and rep ding sound effects fire, and 3D robot matches the push-up cadence. |
| **1:45 - 2:45** | **Hard Voice Problem: Full-Duplex Interruption (<10ms)** | *"Now for our primary hard voice challenge: Full-Duplex Interruption. During the 30-second rest countdown, the coach is explaining: 'Rest for thirty seconds. Breathe deep and shake out your arms.' Watch what happens when I barge in mid-sentence:"*<br>Speak loudly: *"Skip rest, next set!"*<br>Coach instantly cuts off in **0.2ms**, cancels the rest timer synchronously, advances to **SET 2 OF 3**, and says: *"Skipping rest! Next set starts now."* | Point out the timestamped log showing **0.2ms** hardware audio cutoff, `AbortController` stream abortion, and Set 2 rep counter reset with 0 stale audio leakage. |
| **2:45 - 3:45** | **Stress Tests: Speaker Echo Suppression & Complex Speech** | *"Now let's run our deliberate stress cases:*<br>1. **Acoustic Speaker Echo Test**: The coach speaks loudly through laptop speakers. Without echo suppression, the mic would hear 'triceps', re-triggering the command 3-4 times. Our echo cancellation cross-references outgoing speech, dropping feedback with **zero repetitions**.<br>2. **Sentence Accumulation**: Instead of prematurely cutting me off when I pause for breath, I can speak a full complex sentence: *'I want to do triceps now'*. The coach seamlessly switches routines to Diamond Push-ups without chopping.*" | Speak: *"I want to do triceps now"*. Show routine pill switch to Triceps, with speech bubble reading the full phrase without truncation. |
| **3:45 - 4:15** | **Pronunciation & Controlled Delivery Benchmarks** | *"For our secondary challenge, we benchmarked athletic pronunciation following Brooke Larson's 'Writing for the ear' principles. Raw numbers like '12 reps' or '0:30' introduce tokenizer glottal hesitations. Normalizing to spelled-out equivalents like 'twelve reps' and 'thirty seconds' gives Rime Coda smooth athletic cadence."* | Show the saved WAV audio files in `public/pronunciation_evidence/` and play the side-by-side comparison. |
| **4:15 - 4:30** | **Automated Reproducibility & Wrap-Up** | *"Every claim in this demo can be verified in one command with `node test_voice_benchmarks.js`. The codebase is open source on GitHub with strict secret isolation. Thank you!"* | Run `node test_voice_benchmarks.js` in terminal showing 4/4 tests passed. Show GitHub repository link. |

---

## 💡 Practical Recording Tips
1. **Microphone Setup**: Keep laptop microphone 1–2 feet away or wear wireless earbuds (AirPods).
2. **Fail-Safe**: If background noise is loud, the on-screen voice chips and action buttons trigger the exact same event bus and millisecond audit logs.
3. **Keep it under 4:30**: Judges value crisp, direct demonstrations that get right to the voice challenge and acceptance tests.
