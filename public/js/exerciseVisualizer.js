/**
 * exerciseVisualizer.js
 * Real-time Athletic Biomechanics & Exercise Form Demonstration Stage
 * 
 * Features:
 * - High-definition animated SVG & Canvas athlete performing active exercises in real time:
 *   • Push-ups (Full depth, 90° elbow tuck, neutral spine)
 *   • Squats (Hips back, 90° parallel depth, knee tracking)
 *   • Mountain Climbers (Alternating rapid knee drive)
 *   • Plank Hold (Isometric core tension pulses & alignment line)
 *   • Rest & Water Break (Athlete drinking water from shaker, breathing recovery curve)
 *   • Paused / Holding (Standby state)
 * - Biomechanical angle markers & depth indicators
 * - Live synchronization with WorkoutStateMachine (rep pacing, rest timer, pause)
 * - View mode switcher (Biomechanics Demo, Robot Mascot, or Dual Split)
 */

export class ExerciseVisualizer {
  constructor(containerId, options = {}) {
    this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!this.container) return;

    this.options = options;
    this.currentExercise = 'pushups';
    this.state = 'IDLE'; // IDLE, EXERCISE_REPS, REST_TIMER, PAUSED, COMPLETED
    this.currentRep = 0;
    this.targetReps = 8;
    this.repProgress = 0;
    this.restRemaining = 30;
    this.totalRest = 30;
    this.pacingMs = 2200;

    this.rafId = null;
    this.lastTime = performance.now();
    this.animTime = 0;
    this.mode = 'demo'; // 'demo' | 'robot' | 'dual'

    this.init();
  }

  init() {
    this.renderContainer();
    this.bindControls();
    this.startLoop();
  }

  renderContainer() {
    this.container.innerHTML = `
      <div class="visualizer-stage-root" id="visualizer-stage-root">
        <!-- Stage Top Navigation Bar (Mode Switcher & Biometrics Badge) -->
        <div class="stage-nav-bar">
          <div class="stage-mode-switcher">
            <button class="stage-mode-btn active" data-mode="demo" id="btn-mode-demo">
              🏋️ Biomechanics Demo
            </button>
            <button class="stage-mode-btn" data-mode="robot" id="btn-mode-robot">
              🦾 Cyber Mascot
            </button>
            <button class="stage-mode-btn" data-mode="dual" id="btn-mode-dual">
              ⚡ Dual View
            </button>
          </div>

          <div class="stage-telemetry-badge" id="stage-telemetry-badge">
            <span class="telemetry-dot"></span>
            <span id="telemetry-text">Kinetic Form Tracking • 60 FPS</span>
          </div>
        </div>

        <!-- Main Visual Stage Arena -->
        <div class="stage-arena mode-demo" id="stage-arena">
          
          <!-- 1. Biomechanics Exercise Animation Pane -->
          <div class="stage-pane pane-exercise" id="pane-exercise">
            <div class="exercise-hud-overlay">
              <div class="hud-tag-group">
                <span class="hud-pill live-pill" id="exercise-live-badge">DEMO ACTIVE</span>
                <span class="hud-pill form-pill" id="exercise-form-cue">ELBOWS 45° TUCKED</span>
              </div>
              <div class="hud-rep-pace" id="hud-rep-pace">Pacing: 2.2s / rep</div>
            </div>

            <!-- SVG Biomechanics Avatar -->
            <div class="athlete-svg-wrapper" id="athlete-svg-wrapper">
              <svg class="athlete-canvas" id="athlete-svg" viewBox="0 0 500 360" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#D4A373"/>
                    <stop offset="100%" stop-color="#B07D48"/>
                  </linearGradient>
                  <linearGradient id="suitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#2D3142"/>
                    <stop offset="100%" stop-color="#181A20"/>
                  </linearGradient>
                  <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#E07A5F"/>
                    <stop offset="100%" stop-color="#F4A261"/>
                  </linearGradient>
                </defs>

                <!-- Ground / Mat Line -->
                <line x1="40" y1="300" x2="460" y2="300" stroke="#D4A373" stroke-width="3" stroke-linecap="round" stroke-opacity="0.35"/>
                <line x1="80" y1="300" x2="420" y2="300" stroke="#2A9D8F" stroke-width="2" stroke-linecap="round" stroke-opacity="0.6"/>

                <!-- Dynamic Exercise Figure Layer (Rendered procedurally) -->
                <g id="figure-dynamic-layer"></g>

                <!-- Dynamic Biomechanics Readout Overlay Layer -->
                <g id="telemetry-dynamic-layer"></g>
              </svg>
            </div>

            <!-- Bottom Exercise Form Cue Bar -->
            <div class="exercise-footer-cues" id="exercise-footer-cues">
              <div class="form-cue-card">
                <span class="cue-label">PRIMARY TARGET</span>
                <span class="cue-value" id="cue-primary">Pectorals & Triceps</span>
              </div>
              <div class="form-cue-card">
                <span class="cue-label">BIOMECHANICAL RULE</span>
                <span class="cue-value" id="cue-rule">Chest touches floor • Glutes squeezed</span>
              </div>
              <div class="form-cue-card">
                <span class="cue-label">CURRENT TEMPO</span>
                <span class="cue-value" id="cue-tempo">2s Down • 1s Up</span>
              </div>
            </div>
          </div>

          <!-- 2. Mascot Pane (Rabto Cyber Coach + Speech & Hearing Interface) -->
          <div class="stage-pane pane-mascot" id="pane-mascot">
            <!-- Neural Ear Sensor (Direct Robot Hearing Attached) -->
            <div class="robot-ear-hud" id="stage-robot-ear-hud">
              <div class="ear-hud-header">
                <div class="ear-live-indicator">
                  <span class="ear-pulse-dot" id="stage-ear-pulse-dot"></span>
                  <span class="ear-hud-title" id="stage-mic-indicator">EAR SENSOR • ACTIVE</span>
                </div>
                <span class="ear-audio-tag">&lt;1ms Cutoff</span>
              </div>
              <div class="ear-speech-body">
                <div id="stage-heard-transcript" class="ear-speech-text">Listening for speech...</div>
              </div>
            </div>

            <!-- Real-Time Vocalizer Mouth (Coach Speech Attached) -->
            <div class="robot-speech-hud" id="stage-robot-speech-hud">
              <div class="speech-hud-header">
                <div class="speech-live-indicator">
                  <span class="speech-live-dot"></span>
                  <span class="speech-hud-title" id="stage-speech-hud-title">COACH CELESTE • READY</span>
                </div>
                <div class="speech-eq-bars" id="stage-speech-eq-bars">
                  <span></span><span></span><span></span><span></span><span></span>
                </div>
              </div>
              <div class="speech-bubble-body">
                <p id="stage-coach-subtitle" class="coach-speech-text">"Say 'Start' or ask anything about your workout to begin!"</p>
              </div>
            </div>

            <!-- Mascot SVG Robot -->
            <div class="mascot-interactive-area" id="mascot-interactive-area">
              <div class="cyber-coach-mascot-inner" id="cyber-mascot-graphic"></div>
            </div>
          </div>

        </div>
      </div>
    `;

    this.renderRobotMascotSVG();
    this.updateExerciseCues();
  }

  renderRobotMascotSVG() {
    const el = document.getElementById('cyber-mascot-graphic');
    if (!el) return;
    el.innerHTML = `
      <svg class="coach-svg" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="rBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2D3142"/>
            <stop offset="50%" stop-color="#181A20"/>
            <stop offset="100%" stop-color="#0E1015"/>
          </linearGradient>
          <linearGradient id="rGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#D4A373"/>
            <stop offset="100%" stop-color="#B07D48"/>
          </linearGradient>
          <radialGradient id="rCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#E07A5F" stop-opacity="0.95"/>
            <stop offset="50%" stop-color="#D4A373" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#E07A5F" stop-opacity="0"/>
          </radialGradient>
        </defs>
        
        <!-- Torso & Athletic Chest Plate -->
        <path d="M68 170 L172 170 L198 240 L42 240 Z" fill="url(#rBodyGrad)" stroke="#D4A373" stroke-width="2" stroke-opacity="0.3"/>
        <path d="M85 175 L155 175 L165 210 L75 210 Z" fill="#14151B" stroke="rgba(212,163,115,0.2)" stroke-width="1.5"/>
        
        <!-- Cyber Core Reactor -->
        <circle cx="120" cy="192" r="14" fill="#0C0E12" stroke="#E07A5F" stroke-width="1.5"/>
        <circle cx="120" cy="192" r="9" fill="url(#rCoreGlow)" class="core-pulse-circle"/>
        <circle cx="120" cy="192" r="3" fill="#FFF"/>
        
        <!-- Neck Hydraulic Pivot -->
        <rect x="110" y="142" width="20" height="28" rx="4" fill="url(#rGoldGrad)" stroke="#181A20" stroke-width="1"/>
        
        <!-- Head & Helmet Assembly -->
        <g class="robot-head-group">
          <path d="M75 90 C75 48, 165 48, 165 90 C165 125, 145 145, 120 145 C95 145, 75 125, 75 90 Z" fill="url(#rBodyGrad)" stroke="#D4A373" stroke-width="2" stroke-opacity="0.4"/>
          <path d="M90 58 L150 58 L158 78 L82 78 Z" fill="url(#rGoldGrad)" opacity="0.35"/>
          
          <!-- Visor & Optical Sensor -->
          <rect x="85" y="86" width="70" height="18" rx="9" fill="#08090C" stroke="#E07A5F" stroke-width="1.5"/>
          <path d="M92 95 L148 95" stroke="#E07A5F" stroke-width="4" stroke-linecap="round" class="visor-scan-beam"/>
          <circle cx="120" cy="95" r="4" fill="#FFFFFF" class="visor-pupil"/>
          
          <!-- Speaker Grille Mouth -->
          <g class="mouth-speaker-grille">
            <rect x="103" y="118" width="34" height="14" rx="7" fill="#050608" stroke="rgba(212,163,115,0.3)" stroke-width="1"/>
            <line x1="109" y1="125" x2="113" y2="125" stroke="#E07A5F" stroke-width="2.5" stroke-linecap="round" class="mouth-bar bar-1"/>
            <line x1="116" y1="125" x2="124" y2="125" stroke="#D4A373" stroke-width="2.5" stroke-linecap="round" class="mouth-bar bar-2"/>
            <line x1="127" y1="125" x2="131" y2="125" stroke="#E07A5F" stroke-width="2.5" stroke-linecap="round" class="mouth-bar bar-3"/>
          </g>
          
          <!-- Ear Sensors -->
          <path d="M72 82 L64 75 L64 105 L72 100 Z" fill="url(#rGoldGrad)" stroke="#181A20" stroke-width="1"/>
          <circle cx="68" cy="90" r="3" fill="#2A9D8F"/>
          <path d="M168 82 L176 75 L176 105 L168 100 Z" fill="url(#rGoldGrad)" stroke="#181A20" stroke-width="1"/>
          <circle cx="172" cy="90" r="3" fill="#2A9D8F"/>
        </g>
      </svg>
    `;
  }

  bindControls() {
    const btnDemo = document.getElementById('btn-mode-demo');
    const btnRobot = document.getElementById('btn-mode-robot');
    const btnDual = document.getElementById('btn-mode-dual');

    if (btnDemo) {
      btnDemo.addEventListener('click', () => {
        this.mode = 'demo';
        this.updateModeUI();
      });
    }

    if (btnRobot) {
      btnRobot.addEventListener('click', () => {
        this.mode = 'robot';
        this.updateModeUI();
      });
    }

    if (btnDual) {
      btnDual.addEventListener('click', () => {
        this.mode = 'dual';
        this.updateModeUI();
      });
    }
  }

  updateModeUI() {
    const arena = document.getElementById('stage-arena');
    const btnDemo = document.getElementById('btn-mode-demo');
    const btnRobot = document.getElementById('btn-mode-robot');
    const btnDual = document.getElementById('btn-mode-dual');

    [btnDemo, btnRobot, btnDual].forEach(b => b && b.classList.remove('active'));
    if (arena) {
      arena.className = `stage-arena mode-${this.mode}`;
    }

    if (this.mode === 'demo' && btnDemo) btnDemo.classList.add('active');
    else if (this.mode === 'robot' && btnRobot) btnRobot.classList.add('active');
    else if (this.mode === 'dual' && btnDual) btnDual.classList.add('active');
  }

  setExercise(exerciseId) {
    this.currentExercise = (exerciseId || 'pushups').toLowerCase();
    this.updateExerciseCues();
  }

  setState(state, rep = 0, targetReps = 8, restRemaining = 30, totalRest = 30) {
    this.state = state;
    this.currentRep = rep;
    this.targetReps = targetReps;
    this.restRemaining = restRemaining;
    this.totalRest = totalRest;

    const liveBadge = document.getElementById('exercise-live-badge');
    if (liveBadge) {
      if (state === 'EXERCISE_REPS') {
        liveBadge.textContent = `SET ACTIVE • REP ${rep}/${targetReps}`;
        liveBadge.className = 'hud-pill live-pill active';
      } else if (state === 'REST_TIMER') {
        liveBadge.textContent = `REST & HYDRATION • ${restRemaining}s`;
        liveBadge.className = 'hud-pill live-pill rest';
      } else if (state === 'PAUSED') {
        liveBadge.textContent = 'WORKOUT PAUSED (HOLDING)';
        liveBadge.className = 'hud-pill live-pill paused';
      } else if (state === 'COMPLETED') {
        liveBadge.textContent = 'WORKOUT COMPLETED! 🏆';
        liveBadge.className = 'hud-pill live-pill victory';
      } else {
        liveBadge.textContent = 'COACH READY • SAY START';
        liveBadge.className = 'hud-pill live-pill';
      }
    }
  }

  updateExerciseCues() {
    const primary = document.getElementById('cue-primary');
    const rule = document.getElementById('cue-rule');
    const tempo = document.getElementById('cue-tempo');
    const formCue = document.getElementById('exercise-form-cue');

    const ex = this.currentExercise;

    if (ex.includes('push')) {
      if (primary) primary.textContent = 'Pectorals, Triceps, Anterior Delts';
      if (rule) rule.textContent = 'Elbows at 45° • Glutes tight • Chest touch floor';
      if (tempo) tempo.textContent = '2s Eccentric • 1s Concentric';
      if (formCue) formCue.textContent = 'ELBOWS 45° TUCKED';
    } else if (ex.includes('squat')) {
      if (primary) primary.textContent = 'Quadriceps, Glutes, Hamstrings';
      if (rule) rule.textContent = 'Thighs parallel • Knees track over toes • Chest tall';
      if (tempo) tempo.textContent = '2.5s Down • 1s Explode Up';
      if (formCue) formCue.textContent = 'PARALLEL DEPTH 90°';
    } else if (ex.includes('plank')) {
      if (primary) primary.textContent = 'Rectus Abdominis, Transverse Abdominis';
      if (rule) rule.textContent = 'Straight line ear-shoulder-hip-heel • Brace abs';
      if (tempo) tempo.textContent = 'Isometric Continuous Tension';
      if (formCue) formCue.textContent = 'NEUTRAL SPINE LOCK';
    } else if (ex.includes('climb')) {
      if (primary) primary.textContent = 'Core, Hip Flexors, Cardiovascular';
      if (rule) rule.textContent = 'Hips level • Drive knees to chest • Flat back';
      if (tempo) tempo.textContent = 'Rapid Cadence 1s / rep';
      if (formCue) formCue.textContent = 'PELVIS LEVEL';
    } else {
      if (primary) primary.textContent = 'Full Body Kinetic Chain';
      if (rule) rule.textContent = 'Maintain controlled breathing & tight core';
      if (tempo) tempo.textContent = 'Controlled Tempo';
      if (formCue) formCue.textContent = 'FORM VERIFIED';
    }
  }

  startLoop() {
    if (this.rafId) return;
    const loop = (now) => {
      const dt = (now - this.lastTime) * 0.001;
      this.lastTime = now;
      this.animTime += dt;

      this.renderFrame();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  renderFrame() {
    const figLayer = document.getElementById('figure-dynamic-layer');
    const telLayer = document.getElementById('telemetry-dynamic-layer');
    if (!figLayer || !telLayer) return;

    if (this.state === 'REST_TIMER') {
      this.renderRestAthlete(figLayer, telLayer);
    } else if (this.state === 'PAUSED') {
      this.renderPausedAthlete(figLayer, telLayer);
    } else if (this.state === 'COMPLETED') {
      this.renderVictoryAthlete(figLayer, telLayer);
    } else {
      if (this.currentExercise.includes('squat')) {
        this.renderSquat(figLayer, telLayer);
      } else if (this.currentExercise.includes('plank')) {
        this.renderPlank(figLayer, telLayer);
      } else if (this.currentExercise.includes('climb')) {
        this.renderClimber(figLayer, telLayer);
      } else {
        this.renderPushup(figLayer, telLayer);
      }
    }
  }

  // 1. PUSH-UP ANIMATION
  renderPushup(fig, tel) {
    const cycle = (Math.sin(this.animTime * 2.8) + 1) * 0.5;
    const yOffset = cycle * 44;
    const elbowAngle = Math.round(180 - cycle * 88);

    const headX = 140, headY = 220 + yOffset;
    const shoulderX = 180, shoulderY = 230 + yOffset;
    const elbowX = 180 - cycle * 20, elbowY = 265 + yOffset * 0.4;
    const handX = 180, handY = 300;
    const hipX = 290, hipY = 235 + yOffset * 0.9;
    const kneeX = 360, kneeY = 245 + yOffset * 0.6;
    const footX = 420, footY = 300;

    fig.innerHTML = `
      <polygon points="${shoulderX},${shoulderY} ${hipX},${hipY} ${hipX},${hipY+18} ${shoulderX},${shoulderY+20}" fill="url(#suitGrad)" stroke="#2D3142" stroke-width="2"/>
      <polygon points="${hipX},${hipY} ${kneeX},${kneeY} ${footX},${footY} ${footX-15},${footY} ${kneeX-8},${kneeY+14} ${hipX},${hipY+18}" fill="#1F222B" stroke="#2D3142" stroke-width="2"/>
      <circle cx="${headX}" cy="${headY}" r="18" fill="url(#skinGrad)"/>
      <path d="M${headX-16},${headY-6} Q${headX},${headY-24} ${headX+18},${headY-6}" fill="#2D3142"/>
      <circle cx="${headX+10}" cy="${headY+2}" r="3" fill="#FFFFFF"/>
      <line x1="${shoulderX}" y1="${shoulderY}" x2="${elbowX}" y2="${elbowY}" stroke="url(#skinGrad)" stroke-width="12" stroke-linecap="round"/>
      <line x1="${elbowX}" y1="${elbowY}" x2="${handX}" y2="${handY}" stroke="url(#skinGrad)" stroke-width="10" stroke-linecap="round"/>
      <ellipse cx="${handX}" cy="${handY}" rx="12" ry="4" fill="#2A9D8F"/>
      <ellipse cx="${footX}" cy="${footY}" rx="14" ry="4" fill="#2A9D8F"/>
    `;

    const isAtBottom = cycle > 0.85;
    const depthColor = isAtBottom ? '#2A9D8F' : '#E07A5F';
    const phaseText = cycle < 0.5 ? 'ECCENTRIC (LOWERING)' : 'CONCENTRIC (PRESSING)';

    tel.innerHTML = `
      <line x1="${shoulderX}" y1="${shoulderY}" x2="${footX}" y2="${footY}" stroke="rgba(42,157,143,0.4)" stroke-width="1.5" stroke-dasharray="4,4"/>
      <circle cx="${elbowX}" cy="${elbowY}" r="16" fill="none" stroke="${depthColor}" stroke-width="2" stroke-dasharray="25,10"/>
      <rect x="${elbowX-32}" y="${elbowY-28}" width="54" height="18" rx="4" fill="#181A20" stroke="${depthColor}" stroke-width="1"/>
      <text x="${elbowX-5}" y="${elbowY-15}" fill="#FFF" font-family="'JetBrains Mono',monospace" font-size="10" text-anchor="middle">${elbowAngle}°</text>
      <line x1="130" y1="285" x2="230" y2="285" stroke="${depthColor}" stroke-width="1.5" stroke-dasharray="3,3"/>
      <circle cx="180" cy="285" r="${isAtBottom ? 6 : 3}" fill="${depthColor}"/>
      <text x="180" y="278" fill="${depthColor}" font-family="'Inter',sans-serif" font-size="9" text-anchor="middle" font-weight="600">
        ${isAtBottom ? 'CHEST TOUCH VERIFIED' : 'TARGET DEPTH'}
      </text>
      <text x="250" y="80" fill="#D4A373" font-family="'Space Grotesk',sans-serif" font-size="12" text-anchor="middle" font-weight="700">
        ${phaseText}
      </text>
    `;
  }

  // 2. SQUAT ANIMATION
  renderSquat(fig, tel) {
    const cycle = (Math.sin(this.animTime * 2.4) + 1) * 0.5;
    const hipDrop = cycle * 68;
    const kneeAngle = Math.round(175 - cycle * 85);

    const footX = 250, footY = 300;
    const kneeX = 220 + cycle * 20, kneeY = 240 + hipDrop * 0.4;
    const hipX = 280 + cycle * 30, hipY = 170 + hipDrop;
    const shoulderX = 260 + cycle * 20, shoulderY = 100 + hipDrop;
    const headX = 250 + cycle * 15, headY = 70 + hipDrop;

    fig.innerHTML = `
      <ellipse cx="${footX}" cy="${footY+2}" rx="30" ry="6" fill="rgba(0,0,0,0.3)"/>
      <polygon points="${shoulderX-14},${shoulderY} ${shoulderX+16},${shoulderY} ${hipX+14},${hipY} ${hipX-14},${hipY}" fill="url(#suitGrad)" stroke="#2D3142" stroke-width="2"/>
      <line x1="${hipX}" y1="${hipY}" x2="${kneeX}" y2="${kneeY}" stroke="url(#suitGrad)" stroke-width="18" stroke-linecap="round"/>
      <line x1="${kneeX}" y1="${kneeY}" x2="${footX}" y2="${footY}" stroke="#1E2028" stroke-width="16" stroke-linecap="round"/>
      <circle cx="${headX}" cy="${headY}" r="17" fill="url(#skinGrad)"/>
      <circle cx="${headX-6}" cy="${headY+2}" r="3" fill="#FFF"/>
      <line x1="${shoulderX}" y1="${shoulderY}" x2="${shoulderX - 45}" y2="${shoulderY + 15}" stroke="url(#skinGrad)" stroke-width="10" stroke-linecap="round"/>
      <ellipse cx="${footX}" cy="${footY}" rx="18" ry="5" fill="#2A9D8F"/>
    `;

    const isParallel = cycle > 0.82;
    const color = isParallel ? '#2A9D8F' : '#E07A5F';

    tel.innerHTML = `
      <circle cx="${kneeX}" cy="${kneeY}" r="18" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="25,8"/>
      <rect x="${kneeX-35}" y="${kneeY-28}" width="58" height="18" rx="4" fill="#181A20" stroke="${color}" stroke-width="1"/>
      <text x="${kneeX-6}" y="${kneeY-15}" fill="#FFF" font-family="'JetBrains Mono',monospace" font-size="10" text-anchor="middle">Knee: ${kneeAngle}°</text>
      <line x1="160" y1="${hipY}" x2="340" y2="${hipY}" stroke="${color}" stroke-width="1.5" stroke-dasharray="4,4"/>
      <text x="250" y="${hipY-8}" fill="${color}" font-family="'Inter',sans-serif" font-size="9" text-anchor="middle" font-weight="600">
        ${isParallel ? 'PARALLEL DEPTH 90° REACHED' : 'DRIVE HIPS BACK'}
      </text>
      <line x1="${footX}" y1="40" x2="${footX}" y2="300" stroke="rgba(212,163,115,0.3)" stroke-width="1" stroke-dasharray="2,4"/>
    `;
  }

  // 3. PLANK ISOMETRIC ANIMATION
  renderPlank(fig, tel) {
    const breath = Math.sin(this.animTime * 2.5) * 4;
    const shoulderX = 170, shoulderY = 230 + breath;
    const hipX = 290, hipY = 232 + breath;
    const kneeX = 360, kneeY = 240;
    const footX = 420, footY = 300;
    const headX = 130, headY = 222 + breath;
    const elbowX = 170, elbowY = 300;

    fig.innerHTML = `
      <ellipse cx="${(shoulderX+hipX)*0.5}" cy="${shoulderY+15}" rx="32" ry="${14 + breath*1.5}" fill="none" stroke="#E07A5F" stroke-width="2" stroke-opacity="${0.4 + breath*0.08}"/>
      <polygon points="${shoulderX},${shoulderY} ${hipX},${hipY} ${hipX},${hipY+20} ${shoulderX},${shoulderY+22}" fill="url(#suitGrad)" stroke="#2D3142" stroke-width="2"/>
      <polygon points="${hipX},${hipY} ${kneeX},${kneeY} ${footX},${footY} ${footX-14},${footY} ${kneeX-6},${kneeY+14} ${hipX},${hipY+20}" fill="#1C1E26" stroke="#2D3142" stroke-width="2"/>
      <line x1="${shoulderX}" y1="${shoulderY}" x2="${elbowX}" y2="${elbowY}" stroke="url(#skinGrad)" stroke-width="12" stroke-linecap="round"/>
      <ellipse cx="${elbowX}" cy="${elbowY}" rx="14" ry="4" fill="#2A9D8F"/>
      <ellipse cx="${footX}" cy="${footY}" rx="14" ry="4" fill="#2A9D8F"/>
      <circle cx="${headX}" cy="${headY}" r="17" fill="url(#skinGrad)"/>
      <circle cx="${headX+8}" cy="${headY+2}" r="3" fill="#FFF"/>
    `;

    tel.innerHTML = `
      <line x1="${headX}" y1="${headY}" x2="${footX}" y2="${footY}" stroke="#2A9D8F" stroke-width="2" stroke-dasharray="5,5"/>
      <rect x="230" y="${shoulderY-35}" width="120" height="22" rx="5" fill="#181A20" stroke="#2A9D8F" stroke-width="1"/>
      <text x="290" y="${shoulderY-20}" fill="#2A9D8F" font-family="'JetBrains Mono',monospace" font-size="10" text-anchor="middle" font-weight="600">CORE LOCKED • 180°</text>
    `;
  }

  // 4. MOUNTAIN CLIMBERS
  renderClimber(fig, tel) {
    const cycle = (Math.sin(this.animTime * 5) + 1) * 0.5;
    const knee1X = 240 + cycle * 70;
    const knee2X = 310 - cycle * 70;

    fig.innerHTML = `
      <polygon points="170,225 290,230 290,248 170,245" fill="url(#suitGrad)" stroke="#2D3142" stroke-width="2"/>
      <polyline points="290,230 ${knee1X},250 420,300" stroke="#1E2028" stroke-width="14" stroke-linecap="round" fill="none"/>
      <polyline points="290,230 ${knee2X},250 380,300" stroke="url(#suitGrad)" stroke-width="14" stroke-linecap="round" fill="none"/>
      <line x1="170" y1="225" x2="170" y2="300" stroke="url(#skinGrad)" stroke-width="12" stroke-linecap="round"/>
      <ellipse cx="170" cy="300" rx="14" ry="4" fill="#2A9D8F"/>
      <circle cx="130" cy="220" r="17" fill="url(#skinGrad)"/>
    `;

    tel.innerHTML = `
      <text x="250" y="80" fill="#E07A5F" font-family="'Space Grotesk',sans-serif" font-size="13" text-anchor="middle" font-weight="700">
        CADENCE: 80 REPS/MIN • CORE STABILIZED
      </text>
    `;
  }

  // 5. REST & HYDRATION WATER BREAK ANIMATION
  renderRestAthlete(fig, tel) {
    const drinkPhase = (Math.sin(this.animTime * 1.8) + 1) * 0.5;
    const bottleY = 135 - drinkPhase * 15;
    const bottleAngle = drinkPhase * 35;

    fig.innerHTML = `
      <polygon points="235,130 265,130 270,230 230,230" fill="url(#suitGrad)" stroke="#2D3142" stroke-width="2"/>
      <line x1="240" y1="230" x2="235" y2="300" stroke="#1E2028" stroke-width="16" stroke-linecap="round"/>
      <line x1="260" y1="230" x2="265" y2="300" stroke="#1E2028" stroke-width="16" stroke-linecap="round"/>
      <circle cx="250" cy="95" r="18" fill="url(#skinGrad)"/>
      <circle cx="244" cy="95" r="3" fill="#FFF"/>
      <line x1="260" y1="135" x2="255" y2="${bottleY+25}" stroke="url(#skinGrad)" stroke-width="10" stroke-linecap="round"/>
      <g transform="translate(255, ${bottleY}) rotate(${bottleAngle})">
        <rect x="-8" y="-20" width="16" height="34" rx="4" fill="#2A9D8F" stroke="#FFF" stroke-width="1.5"/>
        <rect x="-5" y="-25" width="10" height="6" rx="2" fill="#E07A5F"/>
        <circle cx="2" cy="-10" r="2" fill="#8CE8FF"/>
      </g>
    `;

    const pct = Math.max(0, this.restRemaining / (this.totalRest || 30));
    const circumference = 2 * Math.PI * 35;
    const offset = circumference * (1 - pct);

    tel.innerHTML = `
      <g transform="translate(100, 110)">
        <circle cx="0" cy="0" r="35" fill="none" stroke="rgba(212,163,115,0.15)" stroke-width="6"/>
        <circle cx="0" cy="0" r="35" fill="none" stroke="#2A9D8F" stroke-width="6" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round" transform="rotate(-90)"/>
        <text x="0" y="6" fill="#181A20" font-family="'Space Grotesk',sans-serif" font-size="18" font-weight="800" text-anchor="middle">${this.restRemaining}s</text>
        <text x="0" y="24" fill="#2A9D8F" font-family="'Inter',sans-serif" font-size="9" font-weight="700" text-anchor="middle">REST TIMER</text>
      </g>

      <g transform="translate(380, 110)">
        <rect x="-60" y="-30" width="120" height="60" rx="8" fill="#181A20" stroke="#E07A5F" stroke-width="1.5"/>
        <text x="0" y="-8" fill="#E07A5F" font-family="'Inter',sans-serif" font-size="9" font-weight="700" text-anchor="middle">HEART RATE</text>
        <text x="0" y="14" fill="#FFF" font-family="'Space Grotesk',sans-serif" font-size="18" font-weight="800" text-anchor="middle">128 BPM</text>
      </g>

      <text x="250" y="60" fill="#E07A5F" font-family="'Space Grotesk',sans-serif" font-size="13" font-weight="700" text-anchor="middle">
        HYDRATE & RECOVER • SAY "SKIP REST" TO RESUME
      </text>
    `;
  }

  // 6. PAUSED STATE
  renderPausedAthlete(fig, tel) {
    fig.innerHTML = `
      <polygon points="235,130 265,130 270,230 230,230" fill="url(#suitGrad)" stroke="#2D3142" stroke-width="2"/>
      <line x1="240" y1="230" x2="235" y2="300" stroke="#1E2028" stroke-width="16" stroke-linecap="round"/>
      <line x1="260" y1="230" x2="265" y2="300" stroke="#1E2028" stroke-width="16" stroke-linecap="round"/>
      <circle cx="250" cy="95" r="18" fill="url(#skinGrad)"/>
    `;

    tel.innerHTML = `
      <rect x="130" y="45" width="240" height="40" rx="8" fill="#E07A5F" stroke="#FFF" stroke-width="1.5"/>
      <text x="250" y="70" fill="#FFF" font-family="'Space Grotesk',sans-serif" font-size="13" font-weight="800" text-anchor="middle">
        WORKOUT PAUSED (HOLDING)
      </text>
      <text x="250" y="115" fill="#181A20" font-family="'Inter',sans-serif" font-size="12" font-weight="600" text-anchor="middle">
        Say "Start", "Resume", or "I am okay now" to continue
      </text>
    `;
  }

  // 7. VICTORY STATE
  renderVictoryAthlete(fig, tel) {
    fig.innerHTML = `
      <polygon points="235,140 265,140 270,230 230,230" fill="url(#suitGrad)"/>
      <line x1="240" y1="230" x2="230" y2="300" stroke="#1E2028" stroke-width="16"/>
      <line x1="260" y1="230" x2="270" y2="300" stroke="#1E2028" stroke-width="16"/>
      <circle cx="250" cy="105" r="18" fill="url(#skinGrad)"/>
      <line x1="235" y1="140" x2="200" y2="70" stroke="url(#skinGrad)" stroke-width="11" stroke-linecap="round"/>
      <line x1="265" y1="140" x2="300" y2="70" stroke="url(#skinGrad)" stroke-width="11" stroke-linecap="round"/>
    `;

    tel.innerHTML = `
      <text x="250" y="45" fill="#2A9D8F" font-family="'Space Grotesk',sans-serif" font-size="18" font-weight="800" text-anchor="middle">
        WORKOUT CRUSHED! 🏆
      </text>
    `;
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
