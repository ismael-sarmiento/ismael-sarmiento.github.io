// Lightweight particle FX shared by every site (IsAcademy's opening, the intro exit of Inicio and CV Online):
// discreet glints, gold ink drops (the human "Is") and digital pixels (the artificial word).
import { reducedMotion } from './ds.js';

const reduced = reducedMotion();
let cv, ctx, dpr = 1, particles = [], running = false;
const MAX = innerWidth < 640 ? 260 : 600;

function ensure() {
  if (cv) return;
  cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100vw', height: '100dvh', zIndex: '60', pointerEvents: 'none' });
  document.body.appendChild(cv);
  ctx = cv.getContext('2d');
  resize();
  addEventListener('resize', resize);
}
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
}

function loop() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.life -= p.decay;
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.gravity;
    p.x += p.vx; p.y += p.vy;
    const a = Math.max(0, p.life);
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
    ctx.fillStyle = p.color;
    if (p.shape === 'square') {
      const s = p.size * (0.6 + a * 0.4);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    } else if (p.shape === 'streak') {
      ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, 7); ctx.fill();
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (particles.length) requestAnimationFrame(loop);
  else { running = false; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); }
}

function add(p) {
  if (reduced || particles.length >= MAX) return;
  particles.push({ life: 1, drag: 0.96, gravity: 0, decay: 0.02, glow: false, shape: 'dot', ...p });
  if (!running) { running = true; requestAnimationFrame(loop); }
}

// radial sparks at a point (the pinch moment)
export function burst(x, y, { color = '#ffd27a', count = 26, speed = 4 } = {}) {
  ensure();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random());
    add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: 1.2 + Math.random(), color, shape: 'streak', glow: false, decay: 0.05 + Math.random() * 0.02, drag: 0.9 });
  }
}

// gold ink drops trailing behind the calligraphic "Is"
export function ink(x, y, dir = -1, n = 3) {
  ensure();
  for (let i = 0; i < n; i++) {
    add({ x: x + Math.random() * 10, y: y + (Math.random() - 0.5) * 30, vx: dir * (0.5 + Math.random() * 1.5), vy: (Math.random() - 0.6) * 1.2,
      size: 1.5 + Math.random() * 2.5, color: ['#e2b25c', '#c8953f', '#f2d18b'][i % 3], gravity: 0.05, decay: 0.022 + Math.random() * 0.012, drag: 0.97 });
  }
}

// digital pixels breaking off the decoded word
export function pixels(x, y, h, dir = 1, n = 4) {
  ensure();
  for (let i = 0; i < n; i++) {
    add({ x: x - Math.random() * 8, y: y + (Math.random() - 0.5) * h, vx: dir * (0.8 + Math.random() * 2.4), vy: (Math.random() - 0.5) * 0.6,
      size: 1.5 + Math.random() * 2.5, color: ['#5fd0ff', '#7f93d9', '#3aa8d8'][i % 3], shape: 'square', glow: false, decay: 0.026 + Math.random() * 0.015, drag: 0.985 });
  }
}
