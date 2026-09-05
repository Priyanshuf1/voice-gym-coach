/**
 * exerciseVisualizer.js
 * Virtual Workout Form Demonstration & Biomechanics Video Player
 * 
 * Features:
 * - High-definition 60 FPS animated biomechanical avatar for all 8+ exercises:
 *   • Push-ups (Standard, Wide, Tempo)
 *   • Diamond Push-ups (Triceps isolation, diamond hands under sternum)
 *   • Bench / Chair Dips (Triceps lockout, 90° elbow depth)
 *   • Bodyweight Squats & Squat Pulses (Parallel depth, knee tracking)
 *   • Alternating Lunges (90° knee angles, upright torso)
 *   • Forearm Plank & Core Holds (Spine alignment, abdominal brace)
 *   • Mountain Climbers (Rapid knee drive cadence)
 *   • Pike Push-ups (Shoulder deltoid press, inverted V)
 *   • Rest & Water Break (Athlete drinking water from bottle, heart rate & timer telemetry)
 *   • Paused / Holding (Standby state)
 *   • Workout Completed (Champion victory pose)
 * - Mode Switcher:
 *   • ⚡ 60 FPS Kinetic Simulation (Real-time joint angles, depth guidelines, muscle glow)
 *   • 🎥 Video / Tutorial Masterclass (Biomechanical form breakdown, common errors, setup)
 * - Synchronized live with WorkoutStateMachine rep pacing and states.
 */

export class ExerciseVisualizer {
  constructor(containerId, options = {}) {
    this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!this.container) return;

    this.options = options;
    this.currentExercise = 'pushups';
    this.state = 'IDLE'; // IDLE, COUNTDOWN, EXERCISE_REPS, REST_TIMER, PAUSED, COMPLETED
    this.currentRep = 0;
    this.targetReps = 8;
    this.restRemaining = 30;
    this.totalRest = 30;
    this.pacingMs = 2200;

    this.rafId = null;
    this.lastTime = performance.now();
    this.animTime = 0;
    this.mode = 'simulation'; // 'simulation' | 'tutorial'

    this.init();
  }

  init() {
    this.renderContainer();
    this.bindControls();
    this.startLoop();
  }

  renderContainer() {
    this.container.innerHTML = `
      <div class="visualizer-demo-card" id="visualizer-demo-card">
        <!-- Stage Top Bar: Exercise Header & Mode Toggle -->
        <div class="demo-card-header">
          <div class="demo-title-group">
            <span class="demo-pill-live" id="demo-live-badge">FORM COACH ACTIVE</span>
            <h3 class="demo-exercise-name" id="demo-exercise-name">Push-Ups</h3>
          </div>

          <div class="demo-mode-switcher">
            <button class="demo-mode-btn active" data-mode="simulation" id="btn-mode-sim">
              ⚡ Kinetic 60 FPS
            </button>
            <button class="demo-mode-btn" data-mode="tutorial" id="btn-mode-tut">
              🎥 Video Masterclass
            </button>
          </div>
        </div>

        <!-- Stage Main Canvas & Video Area -->
        <div class="demo-stage-arena" id="demo-stage-arena">
          
          <!-- Mode 1: 60 FPS Kinetic Simulation Canvas / SVG -->
          <div class="demo-view-pane view-simulation" id="view-simulation">
            <div class="sim-svg-wrapper">
              <svg class="sim-svg" id="sim-svg" viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#D4A373"/>
                    <stop offset="100%" stop-color="#B07D48"/>
                  </linearGradient>
                  <linearGradient id="suitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#2D3142"/>
                    <stop offset="100%" stop-color="#181A20"/>
                  </linearGradient>
                  <linearGradient id="goldGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#E07A5F"/>
                    <stop offset="100%" stop-color="#F4A261"/>
                  </linearGradient>
                  <filter id="simGlow">
                    <feGaussianBlur stdDeviation="3" result="blur"/>
                    <feMerge>
                      <feMergeNode in="blur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                <!-- Ground Floor Guide -->
                <line x1="40" y1="280" x2="460" y2="280" stroke="#D4A373" stroke-width="2" stroke-linecap="round" stroke-opacity="0.3"/>
                <line x1="80" y1="280" x2="420" y2="280" stroke="#2A9D8F" stroke-width="2" stroke-linecap="round" stroke-opacity="0.5"/>

                <!-- Dynamic Exercise Figure Layer -->
                <g id="fig-dynamic-layer"></g>

                <!-- Dynamic Telemetry Readout Overlay Layer -->
                <g id="tel-dynamic-layer"></g>
              </svg>
            </div>
          </div>

          <!-- Mode 2: Video & Form Masterclass Breakdown -->
          <div class="demo-view-pane view-tutorial" id="view-tutorial" style="display: none;">
            <div class="tutorial-card-body" id="tutorial-card-body">
              <!-- Dynamically populated per exercise -->
            </div>
          </div>

        </div>

        <!-- Stage Bottom Telemetry & Form Cues -->
        <div class="demo-footer-cues" id="demo-footer-cues">
          <div class="cue-box">
            <span class="cue-box-label">PRIMARY TARGET</span>
            <span class="cue-box-val" id="cue-val-target">Pectorals & Triceps</span>
          </div>
          <div class="cue-box">
            <span class="cue-box-label">BIOMECHANICAL RULE</span>
            <span class="cue-box-val" id="cue-val-rule">Elbows 45° • Chest touch floor</span>
          </div>
          <div class="cue-box">
            <span class="cue-box-label">BREATHING RHYTHM</span>
            <span class="cue-box-val" id="cue-val-breath">↘ Inhale Down • ↗ Exhale Up</span>
          </div>
        </div>
      </div>
    `;

    this.updateExerciseDetails();
  }

  bindControls() {
    const btnSim = document.getElementById('btn-mode-sim');
    const btnTut = document.getElementById('btn-mode-tut');

    if (btnSim) {
      btnSim.addEventListener('click', () => {
        this.mode = 'simulation';
        this.updateModeUI();
      });
    }

    if (btnTut) {
      btnTut.addEventListener('click', () => {
        this.mode = 'tutorial';
        this.updateModeUI();
      });
    }
  }

  updateModeUI() {
    const btnSim = document.getElementById('btn-mode-sim');
    const btnTut = document.getElementById('btn-mode-tut');
    const viewSim = document.getElementById('view-simulation');
    const viewTut = document.getElementById('view-tutorial');

    if (this.mode === 'simulation') {
      if (btnSim) btnSim.classList.add('active');
      if (btnTut) btnTut.classList.remove('active');
      if (viewSim) viewSim.style.display = 'block';
      if (viewTut) viewTut.style.display = 'none';
    } else {
      if (btnSim) btnSim.classList.remove('active');
      if (btnTut) btnTut.classList.add('active');
      if (viewSim) viewSim.style.display = 'none';
      if (viewTut) viewTut.style.display = 'block';
      this.renderTutorialCard();
    }
  }

  setExercise(exerciseId, exerciseName = '') {
    this.currentExercise = (exerciseId || 'pushups').toLowerCase();
    const titleEl = document.getElementById('demo-exercise-name');
    if (titleEl && exerciseName) {
      titleEl.textContent = exerciseName;
    }
    this.updateExerciseDetails();
    if (this.mode === 'tutorial') {
      this.renderTutorialCard();
    }
  }

  setState(state, rep = 0, targetReps = 8, restRemaining = 30, totalRest = 30) {
    this.state = state;
    this.currentRep = rep;
    this.targetReps = targetReps;
    this.restRemaining = restRemaining;
    this.totalRest = totalRest;

    const badge = document.getElementById('demo-live-badge');
    if (badge) {
      if (state === 'EXERCISE_REPS') {
        badge.textContent = `SET ACTIVE • REP ${rep}/${targetReps}`;
        badge.className = 'demo-pill-live active';
      } else if (state === 'REST_TIMER') {
        badge.textContent = `WATER BREAK • ${restRemaining}s`;
        badge.className = 'demo-pill-live rest';
      } else if (state === 'PAUSED') {
        badge.textContent = 'WORKOUT PAUSED (HOLDING)';
        badge.className = 'demo-pill-live paused';
      } else if (state === 'COMPLETED') {
        badge.textContent = 'CHAMPION • WORKOUT COMPLETE 🏆';
        badge.className = 'demo-pill-live victory';
      } else {
        badge.textContent = 'FORM COACH READY';
        badge.className = 'demo-pill-live';
      }
    }
  }

  updateExerciseDetails() {
    const ex = this.currentExercise;
    const targetEl = document.getElementById('cue-val-target');
    const ruleEl = document.getElementById('cue-val-rule');
    const breathEl = document.getElementById('cue-val-breath');

    if (ex.includes('diamond')) {
      if (targetEl) targetEl.textContent = 'Triceps Brachii (Lateral & Medial)';
      if (ruleEl) ruleEl.textContent = 'Thumbs & index form diamond • Elbows pinned to ribs';
      if (breathEl) breathEl.textContent = '↘ Inhale 2s down • ↗ Exhale 1s drive';
    } else if (ex.includes('dip')) {
      if (targetEl) targetEl.textContent = 'Triceps & Anterior Deltoids';
      if (ruleEl) ruleEl.textContent = 'Spine grazes bench edge • Lower to 90° elbow bend';
      if (breathEl) breathEl.textContent = '↘ Inhale down • ↗ Exhale lock triceps';
    } else if (ex.includes('squat')) {
      if (targetEl) targetEl.textContent = 'Quadriceps, Gluteus Maximus, Hamstrings';
      if (ruleEl) ruleEl.textContent = 'Hips below knees • Knees track over toes • Chest tall';
      if (breathEl) breathEl.textContent = '↘ Inhale 2.5s down • ↗ Exhale drive heels';
    } else if (ex.includes('lunge')) {
      if (targetEl) targetEl.textContent = 'Quadriceps, Glutes & Hip Stabilizers';
      if (ruleEl) ruleEl.textContent = '90° front knee • 90° rear knee hover • Torso upright';
      if (breathEl) breathEl.textContent = '↘ Inhale step • ↗ Exhale press back';
    } else if (ex.includes('plank') || ex.includes('hollow') || ex.includes('bear')) {
      if (targetEl) targetEl.textContent = 'Rectus Abdominis, Transverse Core';
      if (ruleEl) ruleEl.textContent = '180° straight line • Squeeze glutes • Pull belly button in';
      if (breathEl) breathEl.textContent = 'Continuous slow diaphragmatic breathing';
    } else if (ex.includes('climb')) {
      if (targetEl) targetEl.textContent = 'Core, Hip Flexors, Conditioning';
      if (ruleEl) ruleEl.textContent = 'Flat back • Drive knees toward sternum • Level hips';
      if (breathEl) breathEl.textContent = 'Rhythmic cadence 1 breath / 2 drives';
    } else if (ex.includes('pike')) {
      if (targetEl) targetEl.textContent = 'Anterior Deltoids & Upper Trapezius';
      if (ruleEl) ruleEl.textContent = 'Inverted V hips high • Head to tripod floor target';
      if (breathEl) breathEl.textContent = '↘ Inhale descent • ↗ Exhale shoulder press';
    } else {
      if (targetEl) targetEl.textContent = 'Pectoralis Major & Triceps';
      if (ruleEl) ruleEl.textContent = 'Elbows 45° tucked • Squeeze glutes • Chest touch floor';
      if (breathEl) breathEl.textContent = '↘ Inhale 2s down • ↗ Exhale explode up';
    }
  }

  renderTutorialCard() {
    const container = document.getElementById('tutorial-card-body');
    if (!container) return;

    const ex = this.currentExercise;
    let guide = {
      title: 'Standard Push-Up Technique Masterclass',
      focus: 'Pectoralis Major, Anterior Deltoids, Triceps',
      steps: [
        { label: 'Setup', text: 'Place hands slightly wider than shoulder-width. Screw hands into the floor to activate external rotators.' },
        { label: 'Movement', text: 'Lower your body in one rigid plank until your sternum lightly brushes the floor. Keep elbows at 45 degrees.' },
        { label: 'Drive', text: 'Press aggressively through full palm, locking out elbows and protracting shoulder blades at the peak.' },
        { label: 'Mistake Avoided', text: 'Never flare elbows out to 90 degrees (causes shoulder impingement). Never sag lower back.' }
      ],
      videoBadge: '4K Biomechanics Breakdown'
    };

    if (ex.includes('diamond')) {
      guide = {
        title: 'Diamond Push-Up Triceps Masterclass',
        focus: 'Triceps Brachii (Lateral, Medial, Long Head)',
        steps: [
          { label: 'Hand Setup', text: 'Join thumbs and index fingers under sternum forming a diamond/triangle shape.' },
          { label: 'Descent', text: 'Lower chest directly toward diamond. Pin elbows flush against your ribcage to isolate triceps.' },
          { label: 'Peak Squeeze', text: 'Drive straight up, contracting triceps hard at the peak lockout.' },
          { label: 'Pro Tip', text: 'If wrist mobility is tight, angle hands slightly outward or place feet wider for balance.' }
        ],
        videoBadge: 'Triceps Hypertrophy Guide'
      };
    } else if (ex.includes('dip')) {
      guide = {
        title: 'Bench / Chair Dips Masterclass',
        focus: 'Triceps Brachii & Chest Dip Depths',
        steps: [
          { label: 'Hand Grip', text: 'Place palms on chair/bench edge, fingers forward, knuckles gripping firm.' },
          { label: 'Trajectory', text: 'Keep your back grazing within 2 inches of the bench. Lower until elbows hit a clean 90-degree bend.' },
          { label: 'Lockout', text: 'Drive vertically upward through palms, squeezing triceps at full extension.' },
          { label: 'Safety Cue', text: 'Do not drop past 90 degrees to protect the anterior shoulder capsule.' }
        ],
        videoBadge: 'Olympic Calisthenics Guide'
      };
    } else if (ex.includes('squat')) {
      guide = {
        title: 'Bodyweight Squat Kinetic Masterclass',
        focus: 'Quadriceps, Gluteus Maximus, Hamstring Chain',
        steps: [
          { label: 'Foot Stance', text: 'Feet shoulder-width apart, toes flared slightly out 15 to 25 degrees.' },
          { label: 'Hip Hinge', text: 'Initiate by unlocking hips back, driving knees outward tracking directly over pinky toes.' },
          { label: 'Depth', text: 'Sink until hip crease is parallel to or slightly below knee joint (90° flexion).' },
          { label: 'Drive', text: 'Push the floor away through midfoot and heels, standing tall without hyperextending.' }
        ],
        videoBadge: 'Kinetic Squat Standard'
      };
    } else if (ex.includes('lunge')) {
      guide = {
        title: 'Alternating Lunges Symmetry Masterclass',
        focus: 'Unilateral Quad Strength & Pelvic Stability',
        steps: [
          { label: 'Step Length', text: 'Take an intentional stride forward, landing midfoot with heel planted.' },
          { label: 'Angle Rule', text: 'Lower until front thigh is parallel and rear knee hovers 1 inch off the floor (90° / 90°).' },
          { label: 'Return', text: 'Drive through front heel to return cleanly to standing position.' },
          { label: 'Balance Cue', text: 'Keep torso upright as if balancing a book on your head.' }
        ],
        videoBadge: 'Unilateral Balance Guide'
      };
    } else if (ex.includes('plank')) {
      guide = {
        title: 'Forearm Plank Core Stability Masterclass',
        focus: 'Anti-Extension Core Shield (Rectus & Transverse Abs)',
        steps: [
          { label: 'Elbow Stack', text: 'Elbows directly under shoulders, forearms parallel on mat.' },
          { label: 'Core Tension', text: 'Brace your abdominal wall like preparing for a boxing punch. Squeeze glutes 100%.' },
          { label: 'Alignment', text: 'Maintain a straight line from back of head, thoracic spine, hips, down to heels.' },
          { label: 'Common Fault', text: 'Do not arch lower back or pike hips into the air. Keep pelvis neutral.' }
        ],
        videoBadge: 'Isometric Core Standard'
      };
    } else if (ex.includes('climb')) {
      guide = {
        title: 'Mountain Climbers Dynamic Cadence Masterclass',
        focus: 'Core Flexion, Hip Flexors, High-Cadence Engine',
        steps: [
          { label: 'Base Position', text: 'Solid high-plank position, hands stacked beneath shoulders, fingers spread.' },
          { label: 'Knee Drive', text: 'Drive right knee rapidly toward chest without letting hips bounce upward.' },
          { label: 'Cadence', text: 'Alternate legs rhythmically, maintaining a stable flat tabletop back.' },
          { label: 'Pacing', text: 'Focus on precision knee drives rather than frantic sloppy bouncing.' }
        ],
        videoBadge: 'Conditioning Form Guide'
      };
    } else if (ex.includes('pike')) {
      guide = {
        title: 'Pike Push-Up Overhead Deltoid Masterclass',
        focus: 'Anterior Deltoids, Clavicular Pec, Triceps',
        steps: [
          { label: 'Pike Stance', text: 'Walk feet toward hands into an inverted V shape with hips elevated high.' },
          { label: 'Tripod Path', text: 'Lower the crown of your head forward between hands to create an equilateral tripod.' },
          { label: 'Press Path', text: 'Press back and upward, driving your head through shoulders at top extension.' },
          { label: 'Progression', text: 'Elevate feet on a low bench to advance toward full handstand push-up.' }
        ],
        videoBadge: 'Shoulder Power Breakdown'
      };
    }

    container.innerHTML = `
      <div class="tut-masterclass-view">
        <div class="tut-header-row">
          <span class="tut-tag">${guide.videoBadge}</span>
          <span class="tut-focus">${guide.focus}</span>
        </div>
        <h4 class="tut-title">${guide.title}</h4>
        
        <div class="tut-steps-grid">
          ${guide.steps.map((s, i) => `
            <div class="tut-step-card">
              <div class="tut-step-num">${i + 1}</div>
              <div class="tut-step-content">
                <div class="tut-step-label">${s.label}</div>
                <div class="tut-step-text">${s.text}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="tut-action-row">
          <div class="tut-badge-pro">🏅 Sports Science Certified</div>
          <button class="btn-listen-form" id="btn-listen-form" data-ex="${ex}">
            🔊 Listen to Spoken Masterclass
          </button>
        </div>
      </div>
    `;

    const btnListen = document.getElementById('btn-listen-form');
    if (btnListen) {
      btnListen.addEventListener('click', () => {
        if (window.__triggerSpokenMasterclass) {
          window.__triggerSpokenMasterclass(this.currentExercise);
        }
      });
    }
  }

  startLoop() {
    if (this.rafId) return;
    const loop = (now) => {
      const dt = (now - this.lastTime) * 0.001;
      this.lastTime = now;
      this.animTime += dt;

      if (this.mode === 'simulation') {
        this.renderFrame();
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  renderFrame() {
    const fig = document.getElementById('fig-dynamic-layer');
    const tel = document.getElementById('tel-dynamic-layer');
    if (!fig || !tel) return;

    if (this.state === 'REST_TIMER') {
      this.renderRest(fig, tel);
    } else if (this.state === 'PAUSED') {
      this.renderPaused(fig, tel);
    } else if (this.state === 'COMPLETED') {
      this.renderVictory(fig, tel);
    } else {
      const ex = this.currentExercise;
      if (ex.includes('diamond')) {
        this.renderDiamondPushup(fig, tel);
      } else if (ex.includes('dip')) {
        this.renderBenchDips(fig, tel);
      } else if (ex.includes('squat')) {
        this.renderSquat(fig, tel);
      } else if (ex.includes('lunge')) {
        this.renderLunge(fig, tel);
      } else if (ex.includes('plank') || ex.includes('hollow') || ex.includes('bear')) {
        this.renderPlank(fig, tel);
      } else if (ex.includes('climb')) {
        this.renderClimber(fig, tel);
      } else if (ex.includes('pike')) {
        this.renderPikePushup(fig, tel);
      } else {
        this.renderStandardPushup(fig, tel);
      }
    }
  }

  // 1. STANDARD PUSH-UPS
  renderStandardPushup(fig, tel) {
    const cycle = (Math.sin(this.animTime * 2.6) + 1) * 0.5;
    const yOffset = cycle * 42;
    const elbowAngle = Math.round(180 - cycle * 88);

    const headX = 140, headY = 205 + yOffset;
    const shoulderX = 180, shoulderY = 215 + yOffset;
    const elbowX = 180 - cycle * 20, elbowY = 248 + yOffset * 0.4;
    const handX = 180, handY = 280;
    const hipX = 290, hipY = 220 + yOffset * 0.9;
    const kneeX = 360, kneeY = 230 + yOffset * 0.6;
    const footX = 420, footY = 280;

    fig.innerHTML = `
      <polygon points="${shoulderX},${shoulderY} ${hipX},${hipY} ${hipX},${hipY+18} ${shoulderX},${shoulderY+20}" fill="url(#suitGrad)" stroke="#2D3142" stroke-width="2"/>
      <polygon points="${hipX},${hipY} ${kneeX},${kneeY} ${footX},${footY} ${footX-15},${footY} ${kneeX-8},${kneeY+14} ${hipX},${hipY+18}" fill="#1F222B" stroke="#2D3142" stroke-width="2"/>
      <circle cx="${headX}" cy="${headY}" r="17" fill="url(#skinGrad)"/>
      <path d="M${headX-15},${headY-6} Q${headX},${headY-23} ${headX+17},${headY-6}" fill="#2D3142"/>
      <line x1="${shoulderX}" y1="${shoulderY}" x2="${elbowX}" y2="${elbowY}" stroke="url(#skinGrad)" stroke-width="12" stroke-linecap="round"/>
      <line x1="${elbowX}" y1="${elbowY}" x2="${handX}" y2="${handY}" stroke="url(#skinGrad)" stroke-width="10" stroke-linecap="round"/>
      <ellipse cx="${handX}" cy="${handY}" rx="12" ry="4" fill="#2A9D8F"/>
      <ellipse cx="${footX}" cy="${footY}" rx="14" ry="4" fill="#2A9D8F"/>
    `;

    const isBottom = cycle > 0.85;
    const color = isBottom ? '#2A9D8F' : '#E07A5F';

    tel.innerHTML = `
      <line x1="${shoulderX}" y1="${shoulderY}" x2="${footX}" y2="${footY}" stroke="rgba(42,157,143,0.3)" stroke-width="1.5" stroke-dasharray="4,4"/>
      <circle cx="${elbowX}" cy="${elbowY}" r="14" fill="none" stroke="${color}" stroke-width="2"/>
      <rect x="${elbowX-28}" y="${elbowY-25}" width="50" height="16" rx="4" fill="#181A20" stroke="${color}" stroke-width="1"/>
      <text x="${elbowX-3}" y="${elbowY-13}" fill="#FFF" font-family="'JetBrains Mono',monospace" font-size="9" text-anchor="middle">${elbowAngle}°</text>
      <text x="250" y="55" fill="#D4A373" font-family="'Space Grotesk',sans-serif" font-size="12" text-anchor="middle" font-weight="700">
        ${cycle < 0.5 ? 'ECCENTRIC: 2s LOWERING' : 'CONCENTRIC: 1s EXPLOSION'}
      </text>
    `;
  }

  // 2. DIAMOND PUSH-UPS (Triceps Blast)
  renderDiamondPushup(fig, tel) {
    const cycle = (Math.sin(this.animTime * 2.6) + 1) * 0.5;
    const yOffset = cycle * 40;
    const elbowAngle = Math.round(175 - cycle * 85);

    const headX = 145, headY = 205 + yOffset;
    const shoulderX = 185, shoulderY = 215 + yOffset;
    const elbowX = 200 + cycle * 8, elbowY = 246 + yOffset * 0.4;
    const handX = 180, handY = 280;
    const hipX = 295, hipY = 220 + yOffset * 0.88;
    const footX = 420, footY = 280;

    fig.innerHTML = `
      <polygon points="${shoulderX},${shoulderY} ${hipX},${hipY} ${hipX},${hipY+18} ${shoulderX},${shoulderY+20}" fill="url(#suitGrad)" stroke="#2D3142" stroke-width="2"/>
      <line x1="${hipX}" y1="${hipY}" x2="${footX}" y2="${footY}" stroke="#1F222B" stroke-width="16" stroke-linecap="round"/>
      <circle cx="${headX}" cy="${headY}" r="17" fill="url(#skinGrad)"/>
      <line x1="${shoulderX}" y1="${shoulderY}" x2="${elbowX}" y2="${elbowY}" stroke="#E07A5F" stroke-width="13" stroke-linecap="round" filter="url(#simGlow)"/>
      <line x1="${elbowX}" y1="${elbowY}" x2="${handX}" y2="${handY}" stroke="url(#skinGrad)" stroke-width="10" stroke-linecap="round"/>
      <!-- Diamond Hand Shape on floor -->
      <polygon points="${handX-8},${handY} ${handX},${handY-6} ${handX+8},${handY} ${handX},${handY+6}" fill="#D4A373" stroke="#181A20" stroke-width="1.5"/>
      <ellipse cx="${footX}" cy="${footY}" rx="14" ry="4" fill="#2A9D8F"/>
    `;

    tel.innerHTML = `
      <rect x="${elbowX-10}" y="${elbowY-25}" width="75" height="18" rx="4" fill="#181A20" stroke="#E07A5F" stroke-width="1"/>
      <text x="${elbowX+27}" y="${elbowY-12}" fill="#E07A5F" font-family="'JetBrains Mono',monospace" font-size="9" text-anchor="middle" font-weight="700">TRICEPS: ${elbowAngle}°</text>
      <text x="250" y="55" fill="#E07A5F" font-family="'Space Grotesk',sans-serif" font-size="12" text-anchor="middle" font-weight="700">
        DIAMOND HANDS UNDER STERNUM • ELBOWS TIGHT
      </text>
    `;
  }

  // 3. BENCH / CHAIR DIPS
  renderBenchDips(fig, tel) {
    const cycle = (Math.sin(this.animTime * 2.5) + 1) * 0.5;
    const dipY = cycle * 44;
    const elbowAngle = Math.round(175 - cycle * 85);

    const benchX = 140, benchY = 190;
    const handX = 160, handY = 190;
    const shoulderX = 175, shoulderY = 175 + dipY;
    const elbowX = 145 - cycle * 12, elbowY = 185 + dipY * 0.5;
    const hipX = 185, hipY = 225 + dipY;
    const kneeX = 240, kneeY = 225 + dipY * 0.5;
    const footX = 280, footY = 280;

    fig.innerHTML = `
      <!-- Bench Object -->
      <rect x="${benchX-40}" y="${benchY}" width="50" height="90" rx="4" fill="#D4A373" stroke="#2D3142" stroke-width="2"/>
      <rect x="${benchX-45}" y="${benchY}" width="60" height="14" rx="3" fill="#B07D48"/>
      <!-- Body -->
      <polygon points="${shoulderX-12},${shoulderY} ${shoulderX+14},${shoulderY} ${hipX+12},${hipY} ${hipX-12},${hipY}" fill="url(#suitGrad)"/>
      <line x1="${hipX}" y1="${hipY}" x2="${kneeX}" y2="${kneeY}" stroke="url(#suitGrad)" stroke-width="16" stroke-linecap="round"/>
      <line x1="${kneeX}" y1="${kneeY}" x2="${footX}" y2="${footY}" stroke="#1E2028" stroke-width="14" stroke-linecap="round"/>
      <circle cx="${shoulderX+5}" cy="${shoulderY-25}" r="16" fill="url(#skinGrad)"/>
      <!-- Triceps & Arm -->
      <line x1="${shoulderX}" y1="${shoulderY}" x2="${elbowX}" y2="${elbowY}" stroke="#E07A5F" stroke-width="12" stroke-linecap="round"/>
      <line x1="${elbowX}" y1="${elbowY}" x2="${handX}" y2="${handY}" stroke="url(#skinGrad)" stroke-width="10" stroke-linecap="round"/>
      <ellipse cx="${footX}" cy="${footY}" rx="14" ry="4" fill="#2A9D8F"/>
    `;

    tel.innerHTML = `
      <circle cx="${elbowX}" cy="${elbowY}" r="14" fill="none" stroke="#E07A5F" stroke-width="2"/>
      <text x="${elbowX-20}" y="${elbowY-8}" fill="#E07A5F" font-family="'JetBrains Mono',monospace" font-size="9" text-anchor="middle" font-weight="700">${elbowAngle}°</text>
      <text x="320" y="70" fill="#D4A373" font-family="'Space Grotesk',sans-serif" font-size="12" text-anchor="middle" font-weight="700">
        KEEP BACK GRAZING BENCH • LOCK TRICEPS
      </text>
    `;
  }

  // 4. BODYWEIGHT SQUATS
  renderSquat(fig, tel) {
    const cycle = (Math.sin(this.animTime * 2.3) + 1) * 0.5;
    const hipDrop = cycle * 64;
    const kneeAngle = Math.round(175 - cycle * 85);

    const footX = 250, footY = 280;
    const kneeX = 220 + cycle * 18, kneeY = 230 + hipDrop * 0.38;
    const hipX = 280 + cycle * 28, hipY = 160 + hipDrop;
    const shoulderX = 260 + cycle * 18, shoulderY = 95 + hipDrop;
    const headX = 250 + cycle * 14, headY = 65 + hipDrop;

    fig.innerHTML = `
      <polygon points="${shoulderX-14},${shoulderY} ${shoulderX+16},${shoulderY} ${hipX+14},${hipY} ${hipX-14},${hipY}" fill="url(#suitGrad)"/>
      <line x1="${hipX}" y1="${hipY}" x2="${kneeX}" y2="${kneeY}" stroke="#E07A5F" stroke-width="18" stroke-linecap="round"/>
      <line x1="${kneeX}" y1="${kneeY}" x2="${footX}" y2="${footY}" stroke="#1E2028" stroke-width="16" stroke-linecap="round"/>
      <circle cx="${headX}" cy="${headY}" r="17" fill="url(#skinGrad)"/>
      <ellipse cx="${footX}" cy="${footY}" rx="20" ry="5" fill="#2A9D8F"/>
    `;

    const isParallel = cycle > 0.82;
    const color = isParallel ? '#2A9D8F' : '#E07A5F';

    tel.innerHTML = `
      <circle cx="${kneeX}" cy="${kneeY}" r="16" fill="none" stroke="${color}" stroke-width="2"/>
      <text x="${kneeX-32}" y="${kneeY}" fill="${color}" font-family="'JetBrains Mono',monospace" font-size="9" font-weight="700">Knee: ${kneeAngle}°</text>
      <text x="250" y="45" fill="${color}" font-family="'Space Grotesk',sans-serif" font-size="12" text-anchor="middle" font-weight="700">
        ${isParallel ? 'PARALLEL DEPTH 90° REACHED' : 'DRIVE HIPS BACK & DOWN'}
      </text>
    `;
  }

  // 5. ALTERNATING LUNGES
  renderLunge(fig, tel) {
    const cycle = (Math.sin(this.animTime * 2.2) + 1) * 0.5;
    const lungeDrop = cycle * 45;

    const frontFootX = 180, frontFootY = 280;
    const frontKneeX = 210, frontKneeY = 210 + lungeDrop * 0.4;
    const hipX = 250, hipY = 160 + lungeDrop;
    const shoulderX = 250, shoulderY = 100 + lungeDrop;
    const rearKneeX = 280, rearKneeY = 220 + lungeDrop * 0.85;
    const rearFootX = 340, rearFootY = 280;

    fig.innerHTML = `
      <polygon points="${shoulderX-12},${shoulderY} ${shoulderX+12},${shoulderY} ${hipX+12},${hipY} ${hipX-12},${hipY}" fill="url(#suitGrad)"/>
      <!-- Front Leg -->
      <line x1="${hipX}" y1="${hipY}" x2="${frontKneeX}" y2="${frontKneeY}" stroke="#E07A5F" stroke-width="16" stroke-linecap="round"/>
      <line x1="${frontKneeX}" y1="${frontKneeY}" x2="${frontFootX}" y2="${frontFootX}" stroke="#1E2028" stroke-width="15" stroke-linecap="round"/>
      <!-- Rear Leg -->
      <line x1="${hipX}" y1="${hipY}" x2="${rearKneeX}" y2="${rearKneeY}" stroke="url(#suitGrad)" stroke-width="14" stroke-linecap="round"/>
      <line x1="${rearKneeX}" y1="${rearKneeY}" x2="${rearFootX}" y2="${rearFootY}" stroke="#1E2028" stroke-width="13" stroke-linecap="round"/>
      <circle cx="${shoulderX}" cy="${shoulderY-28}" r="16" fill="url(#skinGrad)"/>
      <ellipse cx="${frontFootX}" cy="${frontFootY}" rx="14" ry="4" fill="#2A9D8F"/>
      <ellipse cx="${rearFootX}" cy="${rearFootY}" rx="12" ry="4" fill="#2A9D8F"/>
    `;

    tel.innerHTML = `
      <text x="250" y="55" fill="#2A9D8F" font-family="'Space Grotesk',sans-serif" font-size="12" text-anchor="middle" font-weight="700">
        90° FRONT KNEE • 90° REAR KNEE HOVER • TORSO TALL
      </text>
    `;
  }

  // 6. FOREARM PLANK
  renderPlank(fig, tel) {
    const breath = Math.sin(this.animTime * 2.5) * 3;
    const shoulderX = 170, shoulderY = 215 + breath;
    const hipX = 290, hipY = 218 + breath;
    const kneeX = 360, kneeY = 225;
    const footX = 420, footY = 280;
    const headX = 130, headY = 208 + breath;
    const elbowX = 170, elbowY = 280;

    fig.innerHTML = `
      <!-- Core tension pulse -->
      <ellipse cx="${(shoulderX+hipX)*0.5}" cy="${shoulderY+14}" rx="30" ry="${12 + breath*1.5}" fill="none" stroke="#E07A5F" stroke-width="2" stroke-opacity="0.8" filter="url(#simGlow)"/>
      <polygon points="${shoulderX},${shoulderY} ${hipX},${hipY} ${hipX},${hipY+18} ${shoulderX},${shoulderY+20}" fill="url(#suitGrad)"/>
      <polygon points="${hipX},${hipY} ${kneeX},${kneeY} ${footX},${footY} ${footX-14},${footY} ${kneeX-6},${kneeY+14} ${hipX},${hipY+18}" fill="#1C1E26"/>
      <line x1="${shoulderX}" y1="${shoulderY}" x2="${elbowX}" y2="${elbowY}" stroke="url(#skinGrad)" stroke-width="12" stroke-linecap="round"/>
      <ellipse cx="${elbowX}" cy="${elbowY}" rx="14" ry="4" fill="#2A9D8F"/>
      <ellipse cx="${footX}" cy="${footY}" rx="14" ry="4" fill="#2A9D8F"/>
      <circle cx="${headX}" cy="${headY}" r="16" fill="url(#skinGrad)"/>
    `;

    tel.innerHTML = `
      <line x1="${headX}" y1="${headY}" x2="${footX}" y2="${footY}" stroke="#2A9D8F" stroke-width="2" stroke-dasharray="4,4"/>
      <text x="250" y="55" fill="#2A9D8F" font-family="'Space Grotesk',sans-serif" font-size="12" text-anchor="middle" font-weight="700">
        NEUTRAL SPINE 180° LOCKED • SQUEEZE GLUTES
      </text>
    `;
  }

  // 7. MOUNTAIN CLIMBERS
  renderClimber(fig, tel) {
    const cycle = (Math.sin(this.animTime * 5.2) + 1) * 0.5;
    const knee1X = 230 + cycle * 65;
    const knee2X = 310 - cycle * 65;

    fig.innerHTML = `
      <polygon points="170,210 290,215 290,232 170,230" fill="url(#suitGrad)"/>
      <polyline points="290,215 ${knee1X},235 410,280" stroke="#1E2028" stroke-width="14" stroke-linecap="round" fill="none"/>
      <polyline points="290,215 ${knee2X},235 370,280" stroke="#E07A5F" stroke-width="14" stroke-linecap="round" fill="none"/>
      <line x1="170" y1="210" x2="170" y2="280" stroke="url(#skinGrad)" stroke-width="12" stroke-linecap="round"/>
      <ellipse cx="170" cy="280" rx="14" ry="4" fill="#2A9D8F"/>
      <circle cx="130" cy="205" r="16" fill="url(#skinGrad)"/>
    `;

    tel.innerHTML = `
      <text x="250" y="55" fill="#E07A5F" font-family="'Space Grotesk',sans-serif" font-size="12" text-anchor="middle" font-weight="700">
        RAPID KNEE DRIVES • FLAT TABLETOP SPINE
      </text>
    `;
  }

  // 8. PIKE PUSH-UPS (Shoulders & Delts)
  renderPikePushup(fig, tel) {
    const cycle = (Math.sin(this.animTime * 2.4) + 1) * 0.5;
    const dive = cycle * 38;

    const handX = 180, handY = 280;
    const footX = 350, footY = 280;
    const hipX = 270 - cycle * 8, hipY = 120 + dive * 0.4;
    const shoulderX = 215 - cycle * 12, shoulderY = 185 + dive;
    const headX = 185 - cycle * 10, headY = 220 + dive;

    fig.innerHTML = `
      <!-- Inverted V Pike -->
      <line x1="${footX}" y1="${footY}" x2="${hipX}" y2="${hipY}" stroke="#1E2028" stroke-width="16" stroke-linecap="round"/>
      <polygon points="${hipX-10},${hipY} ${hipX+10},${hipY} ${shoulderX+10},${shoulderY} ${shoulderX-10},${shoulderY}" fill="url(#suitGrad)"/>
      <circle cx="${headX}" cy="${headY}" r="16" fill="url(#skinGrad)"/>
      <line x1="${shoulderX}" y1="${shoulderY}" x2="${handX}" y2="${handY}" stroke="#E07A5F" stroke-width="13" stroke-linecap="round" filter="url(#simGlow)"/>
      <ellipse cx="${handX}" cy="${handY}" rx="14" ry="4" fill="#2A9D8F"/>
      <ellipse cx="${footX}" cy="${footY}" rx="14" ry="4" fill="#2A9D8F"/>
    `;

    tel.innerHTML = `
      <text x="250" y="55" fill="#E07A5F" font-family="'Space Grotesk',sans-serif" font-size="12" text-anchor="middle" font-weight="700">
        INVERTED V HIPS HIGH • LOWER CROWN TO TRIPOD
      </text>
    `;
  }

  // REST & WATER BREAK
  renderRest(fig, tel) {
    const drinkPhase = (Math.sin(this.animTime * 1.8) + 1) * 0.5;
    const bottleY = 125 - drinkPhase * 15;
    const bottleAngle = drinkPhase * 35;

    fig.innerHTML = `
      <polygon points="235,120 265,120 270,220 230,220" fill="url(#suitGrad)"/>
      <line x1="240" y1="220" x2="235" y2="280" stroke="#1E2028" stroke-width="16" stroke-linecap="round"/>
      <line x1="260" y1="220" x2="265" y2="280" stroke="#1E2028" stroke-width="16" stroke-linecap="round"/>
      <circle cx="250" cy="85" r="18" fill="url(#skinGrad)"/>
      <line x1="260" y1="125" x2="255" y2="${bottleY+25}" stroke="url(#skinGrad)" stroke-width="10" stroke-linecap="round"/>
      <!-- Shaker Bottle -->
      <g transform="translate(255, ${bottleY}) rotate(${bottleAngle})">
        <rect x="-8" y="-20" width="16" height="34" rx="4" fill="#2A9D8F" stroke="#FFF" stroke-width="1.5"/>
        <rect x="-5" y="-25" width="10" height="6" rx="2" fill="#E07A5F"/>
      </g>
    `;

    tel.innerHTML = `
      <text x="250" y="55" fill="#2A9D8F" font-family="'Space Grotesk',sans-serif" font-size="13" text-anchor="middle" font-weight="700">
        💧 REHYDRATE & CATCH BREATH • SAY "RESUME" OR "SKIP REST"
      </text>
    `;
  }

  // PAUSED
  renderPaused(fig, tel) {
    fig.innerHTML = `
      <polygon points="235,120 265,120 270,220 230,220" fill="url(#suitGrad)"/>
      <line x1="240" y1="220" x2="235" y2="280" stroke="#1E2028" stroke-width="16" stroke-linecap="round"/>
      <line x1="260" y1="220" x2="265" y2="280" stroke="#1E2028" stroke-width="16" stroke-linecap="round"/>
      <circle cx="250" cy="85" r="18" fill="url(#skinGrad)"/>
    `;

    tel.innerHTML = `
      <text x="250" y="55" fill="#E07A5F" font-family="'Space Grotesk',sans-serif" font-size="13" text-anchor="middle" font-weight="700">
        ⏸ WORKOUT PAUSED • SAY "RESUME" OR "START" TO CONTINUE
      </text>
    `;
  }

  // VICTORY
  renderVictory(fig, tel) {
    fig.innerHTML = `
      <polygon points="235,130 265,130 270,220 230,220" fill="url(#suitGrad)"/>
      <line x1="240" y1="220" x2="230" y2="280" stroke="#1E2028" stroke-width="16"/>
      <line x1="260" y1="220" x2="270" y2="280" stroke="#1E2028" stroke-width="16"/>
      <circle cx="250" cy="95" r="18" fill="url(#skinGrad)"/>
      <line x1="235" y1="130" x2="200" y2="60" stroke="url(#skinGrad)" stroke-width="11" stroke-linecap="round"/>
      <line x1="265" y1="130" x2="300" y2="60" stroke="url(#skinGrad)" stroke-width="11" stroke-linecap="round"/>
    `;

    tel.innerHTML = `
      <text x="250" y="45" fill="#2A9D8F" font-family="'Space Grotesk',sans-serif" font-size="16" font-weight="800" text-anchor="middle">
        🏆 WORKOUT COMPLETED! OUTSTANDING EFFORT!
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
