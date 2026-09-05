# Rime Hackathon Challenge — 4-5 Minute Live Demo Script 🎙️⏱️
**Project**: AI Gym Voice Coach  
**Team / Submitter**: Priyanshu (2nd-Year Engineering Student)  
**Hackathon**: DataForge x Pathway x Rime  
**Speech Engine**: Rime.ai (`coda` model, `celeste` speaker, English `en-US`)

---

## 🎬 Demo Breakdown & Timeline (Total: 4:30)

| Timestamp | Phase | What to Say (Spoken Script) | What to Show on Screen / Action |
| :--- | :--- | :--- | :--- |
| **0:00 - 0:45** | **The User & The Problem** | *"Hi everyone! I'm Priyanshu, a 2nd-year engineering student. When you're mid-workout doing push-ups or holding a plank, your hands are sweaty and busy. You cannot tap a screen or read tiny text. Traditional AI voice assistants fail here because if you try to interrupt them, they either ignore you, finish their paragraph, or keep counting down timers in the background. If you remove voice from our app, it's completely broken — hands-free voice is the core product."* | Show the clean white Rabto Bento interface. Point to the "Rime.ai Connected (Coda - Celeste)" badge in the header. |
| **0:45 - 1:45** | **Normal End-to-End Flow & Rep Pacing** | *"Let's start Set 1 of Push-ups. Watch how Coach Celeste paces reps out loud with dynamic encouragement."*<br>Tap **START WORKOUT**.<br>Coach speaks: *"Get ready for Push-ups. Set 1 starting in 3, 2, 1, go!"*<br>Coach counts: *"1, good form!", "2", "3...", "halfway there!"* | The circular progress ring animates smoothly, accompanied by Web Audio sound effects (crisp woodblock ticks and bell dings). The live audio waveform pulses in real time. |
| **1:45 - 3:00** | **Hard Problem 1: Interruption & State Recovery (Acceptance Test)** | *"Now, here is the primary hard problem: True Interruption & Recovery. Set 1 finishes, and the coach starts a 30-second rest: 'Rest for 30 seconds. Take deep breaths.' Midway through, at second 25, I interrupt by speaking: 'Skip it, next set!'"*<br>Speak into mic: *"Skip it, next set"* (or tap Test Barge-In).<br>Coach instantly cuts off mid-syllable, and immediately says: *"Skipping rest! Starting Set 2 now: 1..."* | Show the **Interruption Audit Log**: Prove that:<br>1. Audio stopped in **0.0ms**.<br>2. Background `setInterval` was cleared (no ghost timer ticks).<br>3. Set counter incremented to `SET 2 OF 3` with zero stale audio leakage. |
| **3:00 - 3:45** | **Hard Problem 2: Pronunciation & Controlled Delivery (Acceptance Test)** | *"Our secondary challenge is natural, human athletic pronunciation. Numbers like '12 reps' or timers like '0:30' sound robotic or fragmented if unformatted. Let's look at our Pronunciation Lab."*<br>Click **Compare** on `"12 reps" vs "twelve reps"`.<br>Listen to both variants side-by-side.<br>*"Notice how spelling out numbers and punctuating prompts allows Rime Coda to produce a smooth, rhythmic cadence without digit-by-digit synthesis hesitation."* | Point to the **Pronunciation & Delivery Lab** card and show the saved WAV file evidence. |
| **3:45 - 4:15** | **AI Coach Brain (Conversational Fitness Intelligence)** | *"What if an athlete needs advice mid-set? We integrated the open-source Gemini-Web2API. I ask: 'My triceps are burning, give me motivation!' Watch the coach deliver a punchy 1-sentence reply voiced by Rime."*<br>Type or speak question. Coach responds instantly with authoritative athletic coaching. | The subtitle bubble updates and Rime speaks the generated fitness guidance. |
| **4:15 - 4:30** | **Conclusion & Observability** | *"In summary, we solved real-time acoustic interruption, state machine recovery, and rhythmic pronunciation using Rime Coda as the primary voice engine. The provider is 100% observable in the UI, and all source code is open source on GitHub. Thank you!"* | Pan across GitHub repo link and final audit metrics. |

---

## 💡 Quick Tips for the Live Recording
- **Audio Output**: If using a laptop without headphones, lower the laptop speaker volume slightly or wear wireless earbuds so the microphone doesn't pick up speaker feedback.
- **Fail-Safe Buttons**: If ambient noise in your room prevents the mic from picking up your voice clearly, use the on-screen **⚡ Test Barge-In** and **🔬 Compare** buttons—they trigger the exact same event bus and demonstrate the millisecond audit logs cleanly.
