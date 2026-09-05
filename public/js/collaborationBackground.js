/**
 * collaborationBackground.js
 * High-Performance Vanilla Canvas 2D Animated Background
 * Visualizes the real-time collaboration between AI Intelligence & Athletic Workout Biomechanics.
 * 
 * Features:
 * - High-DPI Retina scaling with ctx.scale(dpr, dpr)
 * - Biomechanical athletic skeleton nodes connected to AI Neural Synapses
 * - Real-time energy pulses streaming between AI and human movement
 * - Biometric cadence waveform (heart rate & rep tempo)
 * - Lifecycle mount() / destroy() with AbortController and visibilitychange pause
 * - Respects prefers-reduced-motion
 */

export class CollaborationBackground {
  constructor(canvasId) {
    this.canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.abortController = new AbortController();
    this.rafId = null;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.mouse = { x: this.width * 0.5, y: this.height * 0.5, targetX: this.width * 0.5, targetY: this.height * 0.5, active: false };
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.aiNodes = [];
    this.bioNodes = [];
    this.pulses = [];
    this.time = 0;
    this.repIntensity = 0.5;

    this.init();
  }

  init() {
    this.resize();
    this.createNodes();
    this.bindEvents();
    this.start();
  }

  bindEvents() {
    const { signal } = this.abortController;

    window.addEventListener('resize', () => this.resize(), { signal, passive: true });

    window.addEventListener('pointermove', (e) => {
      this.mouse.targetX = e.clientX;
      this.mouse.targetY = e.clientY;
      this.mouse.active = true;
    }, { signal, passive: true });

    window.addEventListener('pointerleave', () => {
      this.mouse.active = false;
    }, { signal, passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stop();
      } else {
        this.start();
      }
    }, { signal });
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.scale(this.dpr, this.dpr);

    this.createNodes();
  }

  createNodes() {
    this.aiNodes = [];
    this.bioNodes = [];
    this.pulses = [];

    const cx = this.width * 0.5;
    const cy = this.height * 0.45;

    // 1. AI Neural Cluster (Warm amber / champagne nodes on upper right)
    const numAi = 14;
    for (let i = 0; i < numAi; i++) {
      const angle = (i / numAi) * Math.PI * 2;
      const radius = 90 + (i % 3) * 45;
      this.aiNodes.push({
        baseX: cx + 220 + Math.cos(angle) * radius,
        baseY: cy - 40 + Math.sin(angle) * (radius * 0.65),
        x: 0,
        y: 0,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: 3 + Math.random() * 3,
        type: 'ai'
      });
    }

    // 2. Athletic Biomechanics Joint Nodes (Human movement skeleton on left)
    const bioDefs = [
      { name: 'head', rx: -220, ry: -110, r: 5 },
      { name: 'neck', rx: -220, ry: -70, r: 4 },
      { name: 'shoulder_l', rx: -260, ry: -50, r: 4.5 },
      { name: 'shoulder_r', rx: -180, ry: -50, r: 4.5 },
      { name: 'elbow_l', rx: -290, ry: 0, r: 3.5 },
      { name: 'elbow_r', rx: -150, ry: 0, r: 3.5 },
      { name: 'wrist_l', rx: -305, ry: 45, r: 3 },
      { name: 'wrist_r', rx: -135, ry: 45, r: 3 },
      { name: 'spine', rx: -220, ry: 10, r: 4 },
      { name: 'hip_l', rx: -245, ry: 60, r: 4.5 },
      { name: 'hip_r', rx: -195, ry: 60, r: 4.5 },
      { name: 'knee_l', rx: -255, ry: 120, r: 4 },
      { name: 'knee_r', rx: -185, ry: 120, r: 4 },
      { name: 'ankle_l', rx: -260, ry: 180, r: 3.5 },
      { name: 'ankle_r', rx: -180, ry: 180, r: 3.5 }
    ];

    bioDefs.forEach((b) => {
      this.bioNodes.push({
        name: b.name,
        baseX: cx + b.rx,
        baseY: cy + b.ry,
        x: 0,
        y: 0,
        radius: b.r,
        type: 'biomechanics'
      });
    });

    // Initialize actual positions
    [...this.aiNodes, ...this.bioNodes].forEach(n => {
      n.x = n.baseX;
      n.y = n.baseY;
    });
  }

  triggerPulse(fromAI = true) {
    if (this.reducedMotion) return;
    const sourceList = fromAI ? this.aiNodes : this.bioNodes;
    const targetList = fromAI ? this.bioNodes : this.aiNodes;
    if (!sourceList.length || !targetList.length) return;

    const src = sourceList[Math.floor(Math.random() * sourceList.length)];
    const tgt = targetList[Math.floor(Math.random() * targetList.length)];

    this.pulses.push({
      x1: src.x,
      y1: src.y,
      x2: tgt.x,
      y2: tgt.y,
      progress: 0,
      speed: 0.025 + Math.random() * 0.02,
      color: fromAI ? 'rgba(212, 163, 115, 0.85)' : 'rgba(224, 122, 95, 0.85)'
    });
  }

  setRepIntensity(intensity) {
    this.repIntensity = Math.max(0.2, Math.min(1.5, intensity));
  }

  start() {
    if (this.rafId) return;
    const render = () => {
      this.draw();
      this.rafId = requestAnimationFrame(render);
    };
    this.rafId = requestAnimationFrame(render);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  draw() {
    const ctx = this.ctx;
    this.time += 0.02;

    // Smooth mouse interpolation
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

    // Clear with warm architectural studio gradient
    ctx.clearRect(0, 0, this.width, this.height);

    // Warm vanilla studio base
    const grad = ctx.createLinearGradient(0, 0, this.width, this.height);
    grad.addColorStop(0, '#FAF8F5');
    grad.addColorStop(0.5, '#F5F2EB');
    grad.addColorStop(1, '#EFECE3');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Architectural isometric subtle grid
    this.drawSubtleGrid();

    // Biometric Cadence Wave at the base
    this.drawCadenceWave();

    // Update & draw Biomechanics Skeleton (Left)
    this.drawBiomechanics();

    // Update & draw AI Neural Network (Right)
    this.drawAiNeuralNetwork();

    // Draw Cross-Collaboration Synapses (Center Bridges)
    this.drawCollaborationBridges();

    // Draw active energy pulses
    this.drawPulses();
  }

  drawSubtleGrid() {
    const ctx = this.ctx;
    const spacing = 52;
    ctx.strokeStyle = 'rgba(212, 163, 115, 0.09)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let x = 0; x < this.width; x += spacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let y = 0; y < this.height; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();

    // Subtle center vignette / radial warmth
    const radial = ctx.createRadialGradient(
      this.width * 0.5, this.height * 0.4, 80,
      this.width * 0.5, this.height * 0.4, this.width * 0.7
    );
    radial.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    radial.addColorStop(0.5, 'rgba(245, 242, 235, 0)');
    radial.addColorStop(1, 'rgba(224, 218, 206, 0.25)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawCadenceWave() {
    const ctx = this.ctx;
    const baseY = this.height - 80;
    const amplitude = 18 * this.repIntensity;
    const speed = this.time * 2;

    ctx.beginPath();
    ctx.moveTo(0, baseY);

    for (let x = 0; x < this.width; x += 10) {
      const freq = 0.012;
      const centerDist = Math.abs(x - this.width * 0.5);
      let spike = 0;
      if (centerDist < 120) {
        spike = Math.sin((centerDist / 120) * Math.PI) * Math.sin(speed * 3) * 24;
      }
      const y = baseY + Math.sin(x * freq + speed) * amplitude + spike;
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = 'rgba(224, 122, 95, 0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Secondary AI harmony wave
    ctx.beginPath();
    ctx.moveTo(0, baseY + 6);
    for (let x = 0; x < this.width; x += 12) {
      const y = baseY + 6 + Math.cos(x * 0.009 - speed * 0.7) * (amplitude * 0.6);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(212, 163, 115, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  drawBiomechanics() {
    const ctx = this.ctx;
    const sway = Math.sin(this.time) * 6;

    const connections = [
      ['head', 'neck'],
      ['neck', 'spine'],
      ['neck', 'shoulder_l'],
      ['neck', 'shoulder_r'],
      ['shoulder_l', 'elbow_l'],
      ['shoulder_r', 'elbow_r'],
      ['elbow_l', 'wrist_l'],
      ['elbow_r', 'wrist_r'],
      ['spine', 'hip_l'],
      ['spine', 'hip_r'],
      ['hip_l', 'knee_l'],
      ['hip_r', 'knee_r'],
      ['knee_l', 'ankle_l'],
      ['knee_r', 'ankle_r']
    ];

    const map = {};
    this.bioNodes.forEach(node => {
      const breath = Math.sin(this.time * 1.5) * 3;
      node.x = node.baseX + sway * 0.3;
      node.y = node.baseY + breath;
      map[node.name] = node;
    });

    ctx.strokeStyle = 'rgba(42, 157, 143, 0.35)';
    ctx.lineWidth = 2;
    connections.forEach(([a, b]) => {
      const p1 = map[a];
      const p2 = map[b];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    });

    this.bioNodes.forEach(node => {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#2A9D8F';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  drawAiNeuralNetwork() {
    const ctx = this.ctx;

    this.aiNodes.forEach(node => {
      node.x = node.baseX + Math.sin(this.time + node.baseY * 0.05) * 8;
      node.y = node.baseY + Math.cos(this.time * 0.8 + node.baseX * 0.05) * 6;
    });

    for (let i = 0; i < this.aiNodes.length; i++) {
      for (let j = i + 1; j < this.aiNodes.length; j++) {
        const n1 = this.aiNodes[i];
        const n2 = this.aiNodes[j];
        const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
        if (dist < 140) {
          const alpha = (1 - dist / 140) * 0.35;
          ctx.strokeStyle = `rgba(212, 163, 115, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(n1.x, n1.y);
          ctx.lineTo(n2.x, n2.y);
          ctx.stroke();
        }
      }
    }

    this.aiNodes.forEach(node => {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#E07A5F';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  drawCollaborationBridges() {
    const ctx = this.ctx;
    const sampleBridges = [
      ['head', 0],
      ['neck', 2],
      ['spine', 5],
      ['hip_l', 8],
      ['knee_r', 11]
    ];

    const bioMap = {};
    this.bioNodes.forEach(n => bioMap[n.name] = n);

    sampleBridges.forEach(([bioKey, aiIdx]) => {
      const bio = bioMap[bioKey];
      const ai = this.aiNodes[aiIdx];
      if (bio && ai) {
        ctx.beginPath();
        ctx.moveTo(bio.x, bio.y);
        const midX = (bio.x + ai.x) * 0.5;
        const midY = (bio.y + ai.y) * 0.5 - 25;
        ctx.quadraticCurveTo(midX, midY, ai.x, ai.y);
        ctx.strokeStyle = 'rgba(212, 163, 115, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    if (Math.random() < 0.05) {
      this.triggerPulse(Math.random() > 0.5);
    }
  }

  drawPulses() {
    const ctx = this.ctx;
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.progress += p.speed;

      if (p.progress >= 1) {
        this.pulses.splice(i, 1);
        continue;
      }

      const curX = p.x1 + (p.x2 - p.x1) * p.progress;
      const curY = p.y1 + (p.y2 - p.y1) * p.progress;

      ctx.beginPath();
      ctx.arc(curX, curY, 3, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
  }

  destroy() {
    this.stop();
    this.abortController.abort();
  }
}