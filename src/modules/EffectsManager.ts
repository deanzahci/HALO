import { GestureType, BALLOON_SPAWN_COUNT, BALLOON_RISE_SPEED, BALLOON_SWAY_AMPLITUDE, BALLOON_LIFETIME, MAX_ACTIVE_BALLOONS, BALLOON_ELLIPSE_WIDTH, BALLOON_ELLIPSE_HEIGHT, BALLOON_STRING_LENGTH, BALLOON_SHINE_ALPHA, HEART_SIZE_RANGE, HEART_LIFETIME, HEART_SPEED_RANGE, HEART_ROTATION_RANGE, HEART_SPAWN_RATE, SPARKLE_SIZE_RANGE, SPARKLE_SPAWN_RATE } from '../constants'
import { MPResults } from './mediapipe'
import { CoordinateMapping, normToCropPx, computeCenteredCrop } from '../renderer/crop'

// Performance constants
const MAX_CONFETTI = 160
const MAX_HEARTS = 70
import { MAX_ACTIVE_BOLTS as MAX_BOLTS } from '../constants'
const MAX_SPARKLES = 160
const MAX_BALLOONS = MAX_ACTIVE_BALLOONS

// Global graceful shutdown fade duration (ms) when any gesture stops
const GLOBAL_SHUTDOWN_FADE_MS = 400

// Reusable heart Path2D (base size = HEART_BASE_SIZE). This avoids reconstructing the
// vector shape every frame and is much cheaper than drawing text or recreating bezier
// curves repeatedly.
const HEART_BASE_SIZE = 40 // arbitrary base used for scaling
const HEART_PATH: Path2D = (() => {
  const s = HEART_BASE_SIZE
  const p = new Path2D()
  // Heart oriented with tip downward (positive Y). Centered at (0,0).
  // Start at top-center dip
  p.moveTo(0, -s * 0.28)
  // Left half (top dip -> bottom tip)
  p.bezierCurveTo(-s * 0.6, -s * 0.9, -s * 1.15, -s * 0.15, 0, s * 0.7)
  // Right half (bottom tip -> top dip)
  p.bezierCurveTo(s * 1.15, -s * 0.15, s * 0.6, -s * 0.9, 0, -s * 0.28)
  p.closePath()
  return p
})()

// Object pools for performance
class ObjectPool<T> {
  private pool: T[] = []
  private createFn: () => T

  constructor(createFn: () => T, initialSize = 20) {
    this.createFn = createFn
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(createFn())
    }
  }

  get(): T {
    return this.pool.pop() || this.createFn()
  }

  release(obj: T): void {
    if (this.pool.length < 50) { // Prevent memory leaks
      this.pool.push(obj)
    }
  }
}

// Base particle class
abstract class Particle {
  x = 0
  y = 0
  vx = 0
  vy = 0
  rotation = 0
  rotationSpeed = 0
  life = 0
  maxLife = 0
  active = false
  color = '#ffffff'
  size = 1
  seed = Math.random() * 1000

  abstract update(dt: number, time: number): boolean
  abstract render(ctx: CanvasRenderingContext2D, time: number): void

  reset(): void {
    this.x = this.y = this.vx = this.vy = this.rotation = this.rotationSpeed = 0
    this.life = this.maxLife = 0
    this.active = false
    this.color = '#ffffff'
    this.size = 1
    this.seed = Math.random() * 1000
  }
}

// Confetti particle
class ConfettiParticle extends Particle {
  shape: 'rect' | 'triangle' | 'circle' = 'rect'

  update(dt: number, time: number): boolean {
    if (!this.active) return false

    // Apply gentle gravity for slow descent
    this.vy += 95 * dt // px/s² gravity
    
    // Apply air drag (slightly stronger to keep motion floaty)
    this.vx *= 0.985
    this.vy *= 0.985
    
    // Add wind oscillation for floating effect
    this.vx += Math.sin(time * 1.6 + this.seed) * 28 * dt
    
    // Update position
    this.x += this.vx * dt
    this.y += this.vy * dt
    
    // Update rotation (skip for circles)
    if (this.shape !== 'circle') {
      this.rotation += this.rotationSpeed * dt
    }
    
    // Update life
    this.life -= dt
    
    return this.life > 0
  }

  render(ctx: CanvasRenderingContext2D, _time: number): void {
    if (!this.active) return

    const alpha = Math.min(1, this.life / 0.35) // Fade in last 0.35s
    
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = this.color
    ctx.translate(this.x, this.y)
    ctx.rotate(this.rotation)
    
    const halfSize = this.size / 2
    
    if (this.shape === 'rect') {
      ctx.fillRect(-halfSize, -halfSize, this.size, this.size)
    } else if (this.shape === 'triangle') {
      ctx.beginPath()
      ctx.moveTo(0, -halfSize)
      ctx.lineTo(-halfSize, halfSize)
      ctx.lineTo(halfSize, halfSize)
      ctx.closePath()
      ctx.fill()
    } else if (this.shape === 'circle') {
      ctx.beginPath()
      ctx.arc(0, 0, halfSize, 0, Math.PI * 2)
      ctx.fill()
    }
    
    ctx.restore()
  }
}

// Heart particle
class HeartParticle extends Particle {
  swayPhase = Math.random() * Math.PI * 2
  swayAmplitude = 12 + Math.random() * 10 // px
  update(dt: number, _time: number): boolean {
    if (!this.active) return false

    // Update position
    // Add a small sinusoidal sway on top of base velocity to create organic motion
    this.swayPhase += dt * (0.8 + Math.random() * 0.6)
    const sway = Math.sin(this.swayPhase) * this.swayAmplitude
    this.x += (this.vx + sway) * dt
    this.y += this.vy * dt
    
    // Update rotation
    this.rotation += this.rotationSpeed * dt
    
    // Update life
    this.life -= dt
    
    return this.life > 0
  }

  render(ctx: CanvasRenderingContext2D, _time: number): void {
    if (!this.active) return
    const alpha = Math.min(1, this.life / 0.4) // Fade in last 0.4s

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = this.color
    ctx.translate(this.x, this.y)
    ctx.rotate(this.rotation)
    const scale = (this.size || HEART_BASE_SIZE) / HEART_BASE_SIZE
    ctx.scale(scale, scale)
    // Core heart only; glow will be batched in EffectsManager.renderHearts
    ctx.fill(HEART_PATH)
    ctx.restore()
  }
}

// Firecracker burst (replaces previous lightning bolt)
// Implemented as a small, pooled burst of lightweight sparks for good perf.
class LightningBolt {
  // Rocket phase (optional) - rises up, then explodes into sparks
  // explosionScale is optional and used to scale spark count/size/life for portrait/tuned bursts
  rocket: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; targetY: number; exploded: boolean; explosionScale?: number } | null = null

  // Sparks after explosion
  sparks: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string }[] = []
  startTime = 0
  life = 0
  maxLife = 0
  active = false

  update(dt: number, _time: number): boolean {
    if (!this.active) return false

    // Rocket phase
    if (this.rocket && !this.rocket.exploded) {
      const r = this.rocket
      // simple upward motion with slight drag
      r.vy += 160 * dt // gravity pulling back (damp)
      r.vx *= 0.996
      r.vy *= 0.996
      r.x += r.vx * dt
      r.y += r.vy * dt
      r.life -= dt
      // explode if reached targetY or life expired
      if (r.y <= r.targetY || r.life <= 0) {
        r.exploded = true
        this.createSparksAt(r.x, r.y)
      }
    }

    // Update sparks
    let anyAlive = false
    for (let i = 0; i < this.sparks.length; i++) {
      const s = this.sparks[i]
      if (s.life <= 0) continue
      s.vy += 240 * dt // gravity
      s.vx *= 0.994
      s.vy *= 0.994
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.life -= dt
      if (s.life > 0) anyAlive = true
    }

    // Overall life decays; allow rocket or sparks to keep it alive
    this.life -= dt
    return (this.rocket ? !this.rocket.exploded : false) || (anyAlive && this.life > 0)
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return

    // Draw rocket if present and not exploded
    if (this.rocket && !this.rocket.exploded) {
      const r = this.rocket
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = Math.max(0.6, r.life / r.maxLife)
      // bright core
      ctx.fillStyle = '#ffdca3'
      ctx.beginPath()
      ctx.arc(r.x, r.y, 3.5, 0, Math.PI * 2)
      ctx.fill()
      // trail
      ctx.strokeStyle = 'rgba(255,200,120,0.25)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(r.x, r.y + 6)
      ctx.lineTo(r.x - r.vx * 0.02, r.y - r.vy * 0.02 + 10)
      ctx.stroke()
      ctx.restore()
      return
    }

    if (this.sparks.length === 0) return

    ctx.save()
    ctx.globalCompositeOperation = 'lighter'

    for (let i = 0; i < this.sparks.length; i++) {
      const s = this.sparks[i]
      if (s.life <= 0) continue
      const t = Math.max(0, s.life / s.maxLife)
      const rsize = s.size
      ctx.globalAlpha = t
      ctx.fillStyle = s.color
  ctx.beginPath()
  ctx.arc(s.x, s.y, rsize, 0, Math.PI * 2)
  ctx.fill()
  // small white core for every spark (cheap)
  ctx.globalAlpha = t * 0.9
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(s.x, s.y, Math.max(0.6, rsize * 0.32), 0, Math.PI * 2)
  ctx.fill()
      if (Math.abs(s.vx) > 6 || Math.abs(s.vy) > 6) {
        ctx.globalAlpha = t * 0.6
        ctx.strokeStyle = s.color
        ctx.lineWidth = Math.max(1, rsize * 0.45)
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(s.x - s.vx * 0.02, s.y - s.vy * 0.02)
        ctx.stroke()
      }
    }

    ctx.restore()
  }

  reset(): void {
    this.rocket = null
    this.sparks.length = 0
    this.startTime = this.life = this.maxLife = 0
    this.active = false
  }

  private createSparksAt(x: number, y: number) {
    // Allow scaling (density/size) from rocket.explosionScale when present
    const scale = this.rocket?.explosionScale ?? 1
    // Base count then scaled
    const baseCount = 18 + Math.floor(Math.random() * 10) // 18-27
    const sparkCount = Math.max(6, Math.round(baseCount * scale))
    // Palette: red, green, blue, golden
    const colors = ['#ff4d4d', '#4dff7a', '#4d86ff', '#ffd24d']
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2
      // Speed and size slightly larger when scaled
      const speed = (180 + Math.random() * 420) * (0.9 + 0.6 * scale)
      const vx = Math.cos(angle) * speed
      const vy = Math.sin(angle) * speed
      const life = (0.5 + Math.random() * 0.9) * (0.9 + 0.6 * scale)
      const size = (2.5 + Math.random() * 5) * (0.9 + 0.6 * scale)
      const color = colors[Math.floor(Math.random() * colors.length)]
      this.sparks.push({ x, y, vx, vy, life, maxLife: life, size, color })
    }
    // Ensure there's always at least one white highlight spark
    const whiteLife = (0.4 + Math.random() * 0.8) * (0.9 + 0.5 * scale)
    this.sparks.push({ x, y, vx: (Math.random() - 0.5) * 60 * scale, vy: -Math.random() * 60 * scale, life: whiteLife, maxLife: whiteLife, size: 2 * Math.max(0.8, scale), color: '#ffffff' })

    // set overall life to max spark life
    this.life = Math.max(...this.sparks.map(s => s.maxLife))
  }
}

// Sparkle particle
class SparkleParticle extends Particle {
  update(dt: number, time: number): boolean {
    if (!this.active) return false

    // Apply gravity
    this.vy += 260 * dt // 260 px/s² gravity
    
    // Add horizontal drift
    this.vx += Math.sin(time * 2 + this.seed) * 10 * dt
    
    // Update position
    this.x += this.vx * dt
    this.y += this.vy * dt
    
    // Update rotation
    this.rotation += this.rotationSpeed * dt
    
    // Update life
    this.life -= dt
    
    return this.life > 0
  }

  render(ctx: CanvasRenderingContext2D, _time: number): void {
    if (!this.active) return

    const alpha = Math.min(1, this.life / 0.25) // Fade in last 0.25s
    
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = this.color
    ctx.lineWidth = 2
    ctx.translate(this.x, this.y)
    ctx.rotate(this.rotation)
    
    // Draw star/cross shape
    const halfSize = this.size / 2
    ctx.beginPath()
    ctx.moveTo(0, -halfSize)
    ctx.lineTo(0, halfSize)
    ctx.moveTo(-halfSize, 0)
    ctx.lineTo(halfSize, 0)
    ctx.moveTo(-halfSize * 0.7, -halfSize * 0.7)
    ctx.lineTo(halfSize * 0.7, halfSize * 0.7)
    ctx.moveTo(halfSize * 0.7, -halfSize * 0.7)
    ctx.lineTo(-halfSize * 0.7, halfSize * 0.7)
    ctx.stroke()
    
    ctx.restore()
  }
}

// Balloon particle
class BalloonParticle extends Particle {
  swayOffset = 0
  swaySpeed = 0
  riseSpeed = 0
  swayAmplitude = 0

  update(dt: number, time: number): boolean {
    if (!this.active) return false

    // Update position - rise vertically with horizontal sway
    // Use per-instance riseSpeed and swayAmplitude computed at spawn time
    this.y -= this.riseSpeed * dt * 60 // Convert px/frame to px/s for 60 FPS
    const swayAmount = Math.sin(time * this.swaySpeed + this.swayOffset) * this.swayAmplitude
    this.x += swayAmount * dt * 60 // Convert px/frame to px/s for 60 FPS
    
    // Update life
    this.life -= dt
    
    return this.life > 0
  }

  render(ctx: CanvasRenderingContext2D, _time: number): void {
    if (!this.active) return

    const alpha = Math.min(1, this.life / (BALLOON_LIFETIME / 1000))
    
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.globalCompositeOperation = 'source-over'
    ctx.translate(this.x, this.y)
    
    // Draw balloon string (thin gray line)
    ctx.strokeStyle = '#888888'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, BALLOON_ELLIPSE_HEIGHT / 2)
    ctx.lineTo(0, BALLOON_ELLIPSE_HEIGHT / 2 + BALLOON_STRING_LENGTH)
    ctx.stroke()
    
    // Draw balloon ellipse with full color
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.ellipse(0, 0, BALLOON_ELLIPSE_WIDTH / 2, BALLOON_ELLIPSE_HEIGHT / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // Draw light shine (small white circle)
    ctx.fillStyle = `rgba(255, 255, 255, ${BALLOON_SHINE_ALPHA})`
    ctx.beginPath()
    ctx.arc(-BALLOON_ELLIPSE_WIDTH / 6, -BALLOON_ELLIPSE_HEIGHT / 6, BALLOON_ELLIPSE_WIDTH / 8, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.restore()
  }

  reset(): void {
    super.reset()
    this.swayOffset = Math.random() * Math.PI * 2
    this.swaySpeed = 0.5 + Math.random() * 1.0
  }
}

export class EffectsManager {
  private ctx: CanvasRenderingContext2D
  private time = 0
  private lastTime = 0
  // Graceful shutdown state: when a gesture ends we fade current particles out
  private shuttingDown = false
  private shutdownTimer = 0
  
  // Object pools
  private confettiPool: ObjectPool<ConfettiParticle>
  private heartPool: ObjectPool<HeartParticle>
  private boltPool: ObjectPool<LightningBolt>
  private sparklePool: ObjectPool<SparkleParticle>
  private balloonPool: ObjectPool<BalloonParticle>
  // Batched glow layer to avoid per-heart filters
  private glowCanvas: HTMLCanvasElement | null = null
  private glowCtx: CanvasRenderingContext2D | null = null
  private glowScale = 0.45 // draw glow at 45% resolution then scale up
  // Separate glow layer for firecracker bursts
  private boltGlowCanvas: HTMLCanvasElement | null = null
  private boltGlowCtx: CanvasRenderingContext2D | null = null
  private boltGlowScale = 0.35
  // Sparkle glow offscreen for batching
  private sparkleGlowCanvas: HTMLCanvasElement | null = null
  private sparkleGlowCtx: CanvasRenderingContext2D | null = null
  private sparkleGlowScale = 0.35
  // Sprite cache for cheap star-shaped sparkle cores (size bucket + color)
  private sparkleSpriteCache: Map<string, HTMLCanvasElement> = new Map()

  private getSparkleSprite(size: number, color: string): HTMLCanvasElement {
    const key = `${Math.round(size)}_${color}`
    const cached = this.sparkleSpriteCache.get(key)
    if (cached) return cached

    const s = Math.max(4, Math.round(size * 2))
    const c = document.createElement('canvas')
    c.width = s
    c.height = s
    const cx = c.getContext('2d')!
    cx.clearRect(0, 0, s, s)
    cx.translate(s/2, s/2)
    cx.globalCompositeOperation = 'lighter'
    // draw 4 thin lines to make a sparkle/star
    cx.strokeStyle = color
    cx.lineWidth = Math.max(1, s * 0.12)
    for (let i = 0; i < 4; i++) {
      cx.beginPath()
      cx.moveTo(0, -s*0.45)
      cx.lineTo(0, s*0.45)
      cx.stroke()
      cx.rotate(Math.PI/4)
    }
    // small center
    cx.fillStyle = '#ffffff'
    cx.beginPath()
    cx.arc(0, 0, Math.max(0.6, s*0.08), 0, Math.PI*2)
    cx.fill()

    this.sparkleSpriteCache.set(key, c)
    return c
  }
  
  // Active particles
  private activeConfetti: ConfettiParticle[] = []
  private activeHearts: HeartParticle[] = []
  private activeBolts: LightningBolt[] = []
  private activeSparkles: SparkleParticle[] = []
  private activeBalloons: BalloonParticle[] = []
  
  // Spawn timers
  private confettiSpawnTimer = 0
  private heartSpawnTimer = 0
  private boltSpawnTimer = 0
  private sparkleSpawnTimer = 0
  
  // Lock state tracking
  private lastGestureState = 'NONE'
  
  // Balloon state management
  private balloonsEnabled = false
  private balloonSpawnTimer = 0
  
  // Color palettes
  private confettiColors = ['#ffd60a', '#ff5d8f', '#7cf7ff', '#b48bff', '#7CFC00', '#FF8C00']
  private heartColors = ['#ff4d88', '#ff77a9', '#ff9cc4']
  private balloonColors = ['#ff5f5f', '#ffa95f', '#5fffb0', '#5fc3ff', '#c65fff', '#ffd60a', '#ff7bd1', '#9be8ff', '#b4ff9d']
  // Balloon sprite cache keyed by "width_height_color"
  private balloonSpriteCache: Map<string, HTMLCanvasElement> = new Map()

  private getBalloonSprite(w: number, h: number, color: string): HTMLCanvasElement {
    const key = `${Math.round(w)}_${Math.round(h)}_${color}`
    const cached = this.balloonSpriteCache.get(key)
    if (cached) return cached

    // make room for the string below the balloon
    const canvasW = Math.max(2, Math.round(w))
    const canvasH = Math.max(2, Math.round(h + BALLOON_STRING_LENGTH + 12))
    const c = document.createElement('canvas')
    c.width = canvasW
    c.height = canvasH
    const cx = c.getContext('2d')!
    cx.clearRect(0, 0, c.width, c.height)

    // center the ellipse leaving space for the string below
    const centerY = (canvasH - BALLOON_STRING_LENGTH) / 2
    cx.save()
    cx.translate(canvasW / 2, centerY)

    // string (drawn first so it appears behind the balloon)
    cx.strokeStyle = '#888888'
    cx.lineWidth = 1
    cx.beginPath()
    cx.moveTo(0, h / 2 - 2)
    cx.lineTo(0, h / 2 + 2 + BALLOON_STRING_LENGTH)
    cx.stroke()

    // ellipse with subtle radial-ish gradient for interest
    const grad = cx.createRadialGradient(-w * 0.15, -h * 0.15, Math.max(2, Math.round(w * 0.1)), 0, 0, Math.max(w, h))
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(0.12, color)
  grad.addColorStop(1, this.chromaSafe(color))
    cx.fillStyle = grad
    cx.beginPath()
    cx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2)
    cx.fill()

    // shine
    cx.fillStyle = `rgba(255,255,255,${BALLOON_SHINE_ALPHA})`
    cx.beginPath()
    cx.arc(-w / 6, -h / 6, w / 8, 0, Math.PI * 2)
    cx.fill()
    cx.restore()

    this.balloonSpriteCache.set(key, c)
    return c
  }

  // Helper: return a darker variant of a hex color (simple, safe fallback)
  private chromaSafe(hex: string): string {
    try {
      if (!hex || hex[0] !== '#') return hex
      const h = hex.substring(1)
      if (h.length !== 6) return hex
      const r = parseInt(h.substring(0, 2), 16)
      const g = parseInt(h.substring(2, 4), 16)
      const b = parseInt(h.substring(4, 6), 16)
      const factor = 0.65
      const rr = Math.max(0, Math.min(255, Math.round(r * factor)))
      const gg = Math.max(0, Math.min(255, Math.round(g * factor)))
      const bb = Math.max(0, Math.min(255, Math.round(b * factor)))
      const toHex = (n: number) => n.toString(16).padStart(2, '0')
      return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`
    } catch (e) {
      return hex
    }
  }

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx
    
    // Initialize object pools
    this.confettiPool = new ObjectPool(() => new ConfettiParticle(), MAX_CONFETTI)
    this.heartPool = new ObjectPool(() => new HeartParticle(), MAX_HEARTS)
    this.boltPool = new ObjectPool(() => new LightningBolt(), MAX_BOLTS)
    this.sparklePool = new ObjectPool(() => new SparkleParticle(), MAX_SPARKLES)
    this.balloonPool = new ObjectPool(() => new BalloonParticle(), MAX_BALLOONS)

    // Offscreen glow canvas
    try {
      this.glowCanvas = document.createElement('canvas')
      const gctx = this.glowCanvas.getContext('2d')
      if (gctx) {
        this.glowCtx = gctx
        this.glowCtx.imageSmoothingEnabled = true
      }
      // bolt glow canvas
      this.boltGlowCanvas = document.createElement('canvas')
      const bctx = this.boltGlowCanvas.getContext('2d')
      if (bctx) {
        this.boltGlowCtx = bctx
        this.boltGlowCtx.imageSmoothingEnabled = true
      }
      // sparkle glow canvas
      this.sparkleGlowCanvas = document.createElement('canvas')
      const sgctx = this.sparkleGlowCanvas.getContext('2d')
      if (sgctx) {
        this.sparkleGlowCtx = sgctx
        this.sparkleGlowCtx.imageSmoothingEnabled = true
      }
    } catch (e) {
      // Running in a non-browser environment (tests) - ignore
      this.glowCanvas = null
      this.glowCtx = null
      this.boltGlowCanvas = null
      this.boltGlowCtx = null
    }
  }

  private getActiveParticleCount(): number {
    // rough count of active particles across systems
    return this.activeConfetti.length + this.activeHearts.length + this.activeBolts.reduce((acc, b) => acc + (b.sparks?.length || 0) + (b.rocket ? 1 : 0), 0) + this.activeSparkles.length + this.activeBalloons.length
  }

  updateAndRender(gesture: GestureType, mpResults: MPResults, canvasWidth: number, canvasHeight: number, video?: HTMLVideoElement): void {
    const now = performance.now() / 1000
    const dt = Math.min(now - this.lastTime, 1/30) // Cap at 30 FPS
    this.time = now
    this.lastTime = now

    // Create coordinate mapping
    let mapping: CoordinateMapping | null = null
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      const crop = computeCenteredCrop(video.videoWidth, video.videoHeight, canvasWidth, canvasHeight)
      mapping = {
        toPx: (nx: number, ny: number) => normToCropPx(nx, ny, crop),
        tw: canvasWidth,
        th: canvasHeight
      }
    }

    // Check for lock events and state transitions
    const isLocked = gesture !== 'NONE'
    const wasLocked = this.lastGestureState !== 'NONE'
    const wasPeaceSign = this.lastGestureState === 'PEACE_SIGN'
    const isPeaceSign = gesture === 'PEACE_SIGN'
    
    if (!wasLocked && isLocked) {
      // If we were in a graceful shutdown, cancel it (new activation)
      if (this.shuttingDown) {
        this.shuttingDown = false
        this.shutdownTimer = 0
      }
      this.triggerLockEvent(gesture, canvasWidth, canvasHeight)
    }
    // If a previously active gesture has stopped (falling edge), start a graceful
    // fade of all currently active particles so the scene cleans up and the next
    // activation starts fresh.
    if (wasLocked && !isLocked) {
      // Begin graceful shutdown
      this.shuttingDown = true
      this.shutdownTimer = GLOBAL_SHUTDOWN_FADE_MS

      const fadeSec = GLOBAL_SHUTDOWN_FADE_MS / 1000
      // Clamp life of all active particles so they expire within fadeSec
      const clampLife = (obj: any) => {
        if (!obj || !obj.active) return
        if (typeof obj.life === 'number') {
          obj.life = Math.min(obj.life, fadeSec)
          if (typeof obj.maxLife === 'number') obj.maxLife = Math.min(obj.maxLife, obj.life)
        }
      }
      this.activeConfetti.forEach(clampLife)
      this.activeHearts.forEach(clampLife)
      this.activeBolts.forEach(clampLife)
      this.activeSparkles.forEach(clampLife)
      this.activeBalloons.forEach(clampLife)
    }
    
    // Handle balloon state transitions
    if (!wasPeaceSign && isPeaceSign && isLocked) {
      // Just became locked Peace Sign
      this.balloonsEnabled = true
      this.balloonSpawnTimer = 0
    } else if (wasPeaceSign && !isPeaceSign) {
      // No longer Peace Sign
      this.balloonsEnabled = false
    }
    
    this.lastGestureState = gesture

    // Update all particles
    this.updateParticles(dt)

    // If in graceful shutdown, tick the shutdown timer and clear when finished
    if (this.shuttingDown) {
      this.shutdownTimer -= dt * 1000
      if (this.shutdownTimer <= 0) {
        this.shuttingDown = false
        this.shutdownTimer = 0
        this.clear()
      }
    }

    // Render effects in z-order: Confetti (back) → Hearts → Lightning → Sparkles (front)
    if (gesture === 'THUMBS_UP_HALO') {
      this.renderConfetti()
      this.updateConfettiSpawn(canvasWidth, canvasHeight)
    }
    
    if (gesture === 'TWO_HAND_HEART') {
      this.renderHearts()
      // dt is in seconds; convert to ms for spawn timers
      this.updateHeartSpawn(mpResults, canvasWidth, canvasHeight, mapping, dt * 1000)
    }
    
    if (gesture === 'ROCK_SIGN') {
      this.renderLightning()
      this.updateLightningSpawn(mpResults, canvasWidth, canvasHeight, mapping)
    }
    
    if (gesture === 'POINT_SPARKLES') {
      this.renderSparkles(canvasHeight)
      this.updateSparkleSpawn(mpResults, canvasWidth, canvasHeight, mapping)
    }
    
    // Always update and render balloons if enabled (regardless of current gesture)
    if (this.balloonsEnabled) {
      this.renderBalloons()
    this.updateBalloonSpawn(mpResults, canvasWidth, canvasHeight)
    }
  }

  private triggerLockEvent(gesture: GestureType, canvasWidth: number, canvasHeight: number): void {
    // Reset relevant effect state so each activation starts from scratch
    this.resetEffectForGesture(gesture)
    
    if (gesture === 'THUMBS_UP_HALO') {
      // Confetti burst: 120 pieces
      for (let i = 0; i < 120 && this.activeConfetti.length < MAX_CONFETTI; i++) {
        this.spawnConfetti(canvasWidth, canvasHeight)
      }
    } else if (gesture === 'TWO_HAND_HEART') {
      // Heart burst: 20 pieces
      for (let i = 0; i < 20 && this.activeHearts.length < MAX_HEARTS; i++) {
        // Use center of canvas as fallback
        this.spawnHeart(canvasWidth / 2, canvasHeight / 2)
      }
    } else if (gesture === 'POINT_SPARKLES') {
      // Sparkle burst: 30 pieces
      for (let i = 0; i < 30 && this.activeSparkles.length < MAX_SPARKLES; i++) {
        // Use center of canvas as fallback
        this.spawnSparkle(canvasWidth / 2, canvasHeight / 2)
      }
    } else if (gesture === 'PEACE_SIGN') {
      // Balloon burst: 6-10 pieces
      const balloonCount = BALLOON_SPAWN_COUNT[0] + Math.floor(Math.random() * (BALLOON_SPAWN_COUNT[1] - BALLOON_SPAWN_COUNT[0] + 1))
      for (let i = 0; i < balloonCount && this.activeBalloons.length < MAX_BALLOONS; i++) {
        // Use center of canvas as fallback
        this.spawnBalloon(canvasWidth / 2, canvasHeight / 2)
      }
    }
  }

  private resetEffectForGesture(gesture: GestureType): void {
    if (gesture === 'THUMBS_UP_HALO') {
      // Clear confetti state
      for (let i = this.activeConfetti.length - 1; i >= 0; i--) {
        const c = this.activeConfetti[i]
        c.active = false
        this.confettiPool.release(c)
      }
      this.activeConfetti = []
      this.confettiSpawnTimer = 0
    } else if (gesture === 'TWO_HAND_HEART') {
      // Clear hearts
      for (let i = this.activeHearts.length - 1; i >= 0; i--) {
        const h = this.activeHearts[i]
        h.active = false
        this.heartPool.release(h)
      }
      this.activeHearts = []
      this.heartSpawnTimer = 0
    } else if (gesture === 'ROCK_SIGN') {
      // Clear lightning
      for (let i = this.activeBolts.length - 1; i >= 0; i--) {
        const b = this.activeBolts[i]
        b.active = false
        this.boltPool.release(b)
      }
      this.activeBolts = []
      this.boltSpawnTimer = 0
    } else if (gesture === 'POINT_SPARKLES') {
      // Clear sparkles
      for (let i = this.activeSparkles.length - 1; i >= 0; i--) {
        const s = this.activeSparkles[i]
        s.active = false
        this.sparklePool.release(s)
      }
      this.activeSparkles = []
      this.sparkleSpawnTimer = 0
    } else if (gesture === 'PEACE_SIGN') {
      // Clear balloons
      for (let i = this.activeBalloons.length - 1; i >= 0; i--) {
        const bl = this.activeBalloons[i]
        bl.active = false
        this.balloonPool.release(bl)
      }
      this.activeBalloons = []
      this.balloonSpawnTimer = 0
    }
  }

  private updateParticles(dt: number): void {
    // Update confetti
    for (let i = this.activeConfetti.length - 1; i >= 0; i--) {
      const confetti = this.activeConfetti[i]
      if (!confetti.update(dt, this.time) ||
          confetti.y > this.ctx.canvas.height + 40 ||
          confetti.x < -40 || confetti.x > this.ctx.canvas.width + 40) {
        confetti.active = false
        this.confettiPool.release(confetti)
        this.activeConfetti.splice(i, 1)
      }
    }

    // Update hearts
    for (let i = this.activeHearts.length - 1; i >= 0; i--) {
      const heart = this.activeHearts[i]
      if (!heart.update(dt, this.time)) {
        heart.active = false
        this.heartPool.release(heart)
        this.activeHearts.splice(i, 1)
      }
    }

    // Update bolts
    for (let i = this.activeBolts.length - 1; i >= 0; i--) {
      const bolt = this.activeBolts[i]
      if (!bolt.update(dt, this.time)) {
        bolt.active = false
        this.boltPool.release(bolt)
        this.activeBolts.splice(i, 1)
      }
    }

    // Update sparkles
    for (let i = this.activeSparkles.length - 1; i >= 0; i--) {
      const sparkle = this.activeSparkles[i]
      if (!sparkle.update(dt, this.time)) {
        sparkle.active = false
        this.sparklePool.release(sparkle)
        this.activeSparkles.splice(i, 1)
      }
    }

    // Update balloons
    for (let i = this.activeBalloons.length - 1; i >= 0; i--) {
      const balloon = this.activeBalloons[i]
      
      // Remove balloons that have exited the frame (y + radius < 0)
      if (balloon.y + BALLOON_ELLIPSE_HEIGHT / 2 < 0) {
        balloon.active = false
        this.balloonPool.release(balloon)
        this.activeBalloons.splice(i, 1)
        continue
      }
      
      // Update balloon physics
      if (!balloon.update(dt, this.time)) {
        balloon.active = false
        this.balloonPool.release(balloon)
        this.activeBalloons.splice(i, 1)
      }
    }
  }

  // Confetti system
  private updateConfettiSpawn(canvasWidth: number, canvasHeight: number): void {
    if (this.lastGestureState !== 'THUMBS_UP_HALO') return
    
    this.confettiSpawnTimer += 16 // ~60 FPS
    const spawnInterval = 1000 / 60 // 60 pieces/s
    
    while (this.confettiSpawnTimer >= spawnInterval && this.activeConfetti.length < MAX_CONFETTI) {
      this.spawnConfetti(canvasWidth, canvasHeight)
      this.confettiSpawnTimer -= spawnInterval
    }
  }

  private spawnConfetti(canvasWidth: number, canvasHeight: number): void {
    if (this.getActiveParticleCount() >= 300) return
    const confetti = this.confettiPool.get()
    // Adjust behavior for tall (portrait) screens
    const isPortrait = canvasHeight / canvasWidth > 1.6

    if (isPortrait) {
      // Spawn across the full width for a wide shower, starting just below bottom
      confetti.x = Math.random() * canvasWidth
      confetti.y = canvasHeight + 10
      // More vertical launch and slightly faster so confetti travels visibly up tall screens
      const speed = 420 + Math.random() * 360
      const launchAngle = (60 + Math.random() * 25) * Math.PI / 180 // 60°-85° upwards
      confetti.vx = (Math.random() - 0.5) * 60 // small horizontal drift
      confetti.vy = -speed * Math.sin(launchAngle)
      confetti.life = confetti.maxLife = 3.6 + Math.random() * 1.8
    } else {
      // Emit from bottom-left or bottom-right edge (desktop/wide)
      const fromLeft = Math.random() < 0.5
      const edgeSpread = 200
      confetti.x = fromLeft
        ? Math.max(0, (Math.random() * edgeSpread))
        : Math.min(canvasWidth, canvasWidth - (Math.random() * edgeSpread))
      confetti.y = canvasHeight + 10 // just below bottom edge
      // Stronger, angled burst inward for blast effect
      const speed = 360 + Math.random() * 280 // 360-640 px/s
      const launchAngle = (30 + Math.random() * 40) * Math.PI / 180 // 30°-70° upward
      const dir = fromLeft ? 1 : -1
      confetti.vx = dir * speed * Math.cos(launchAngle)
      confetti.vy = -speed * Math.sin(launchAngle)
      confetti.life = confetti.maxLife = 3.0 + Math.random() * 1.4
    }
    confetti.rotation = Math.random() * Math.PI * 2
    confetti.rotationSpeed = (-240 + Math.random() * 480) * Math.PI / 180 // ±240°/s
  confetti.size = 8 + Math.random() * 10 // 8-18px
    confetti.color = this.confettiColors[Math.floor(Math.random() * this.confettiColors.length)]
    
    // Shape distribution: 70% rect, 20% triangle, 10% circle
    const shapeRand = Math.random()
    if (shapeRand < 0.7) confetti.shape = 'rect'
    else if (shapeRand < 0.9) confetti.shape = 'triangle'
    else confetti.shape = 'circle'
    
    confetti.active = true
    this.activeConfetti.push(confetti)
  }

  private renderConfetti(): void {
    this.activeConfetti.forEach(confetti => {
      if (confetti.active) {
        confetti.render(this.ctx, this.time)
      }
    })
  }

  // Heart system
  private updateHeartSpawn(mpResults: MPResults, canvasWidth: number, canvasHeight: number, mapping: CoordinateMapping | null, dtMs: number): void {
    if (this.lastGestureState !== 'TWO_HAND_HEART') return
    
    const hands = mpResults.hands
    if (!hands || (!hands.left && !hands.right)) return
    
    // Find heart center
    let centerX = canvasWidth / 2
    let centerY = canvasHeight / 2
    
    // Try to use index tips first
    if (hands.left && hands.left.index_tip && hands.right && hands.right.index_tip) {
      if (mapping) {
        const leftMapped = mapping.toPx(hands.left.index_tip[0], hands.left.index_tip[1])
        const rightMapped = mapping.toPx(hands.right.index_tip[0], hands.right.index_tip[1])
        centerX = (leftMapped.x + rightMapped.x) / 2
        centerY = (leftMapped.y + rightMapped.y) / 2
      } else {
        centerX = (hands.left.index_tip[0] + hands.right.index_tip[0]) / 2 * canvasWidth
        centerY = (hands.left.index_tip[1] + hands.right.index_tip[1]) / 2 * canvasHeight
      }
    } else if (hands.left && hands.left.thumb_tip && hands.right && hands.right.thumb_tip) {
      // Fallback to thumb tips
      if (mapping) {
        const leftMapped = mapping.toPx(hands.left.thumb_tip[0], hands.left.thumb_tip[1])
        const rightMapped = mapping.toPx(hands.right.thumb_tip[0], hands.right.thumb_tip[1])
        centerX = (leftMapped.x + rightMapped.x) / 2
        centerY = (leftMapped.y + rightMapped.y) / 2
      } else {
        centerX = (hands.left.thumb_tip[0] + hands.right.thumb_tip[0]) / 2 * canvasWidth
        centerY = (hands.left.thumb_tip[1] + hands.right.thumb_tip[1]) / 2 * canvasHeight
      }
    }
    
    // Timer is tracked in ms. HEART_SPAWN_RATE hearts per second.
    // Increment spawn timer by actual frame time in ms
    this.heartSpawnTimer += dtMs
    const spawnInterval = 1000 / HEART_SPAWN_RATE
    while (this.heartSpawnTimer >= spawnInterval && this.activeHearts.length < MAX_HEARTS) {
      this.spawnHeart(centerX, centerY)
      this.heartSpawnTimer -= spawnInterval
    }
  }

  private spawnHeart(x: number, y: number): void {
    const heart = this.heartPool.get()
    // Wider spawn region to reduce crowding and let hearts fan outward
    const spawnX = x + (Math.random() - 0.5) * 220 // wider horizontal spread
    const spawnY = y + (Math.random() - 0.5) * 140 // taller vertical spread
    heart.x = spawnX
    heart.y = spawnY

    // Velocity: vertical upward with horizontal bias away from center
    const speed = HEART_SPEED_RANGE[0] + Math.random() * (HEART_SPEED_RANGE[1] - HEART_SPEED_RANGE[0])
    // bias horizontal velocity away from the heart center
    const dir = spawnX >= x ? 1 : -1
    heart.vx = dir * (10 + Math.random() * 40) // push outward more
    heart.vy = - (speed * (0.85 + Math.random() * 0.25)) // slightly slower, floaty

    // Rotation
    heart.rotation = (Math.random() - 0.5) * (Math.PI * 2 * (HEART_ROTATION_RANGE / 360))
    heart.rotationSpeed = (Math.random() - 0.5) * 1.2

    // Life and size
    heart.life = heart.maxLife = HEART_LIFETIME / 1000 * (0.9 + Math.random() * 0.25) // some variance
    const sizePx = HEART_SIZE_RANGE[0] + Math.random() * (HEART_SIZE_RANGE[1] - HEART_SIZE_RANGE[0])
    heart.size = sizePx
    heart.color = this.heartColors[Math.floor(Math.random() * this.heartColors.length)]
    heart.active = true
    
    this.activeHearts.push(heart)
  }

  private renderHearts(): void {
    // If we have an offscreen glow context, render glow layer at reduced resolution
    if (this.glowCtx && this.glowCanvas) {
      const mainW = this.ctx.canvas.width
      const mainH = this.ctx.canvas.height
      const scale = this.glowScale
      const gw = Math.max(1, Math.round(mainW * scale))
      const gh = Math.max(1, Math.round(mainH * scale))
      if (this.glowCanvas.width !== gw || this.glowCanvas.height !== gh) {
        this.glowCanvas.width = gw
        this.glowCanvas.height = gh
      }

      // Clear glow canvas
      this.glowCtx.clearRect(0, 0, gw, gh)

      // Draw additive blurred hearts into glow canvas
      const gctx = this.glowCtx
      gctx.save()
      gctx.globalCompositeOperation = 'lighter'
      gctx.filter = 'blur(8px)'
      this.activeHearts.forEach(heart => {
        if (!heart.active) return
        gctx.globalAlpha = Math.min(1, heart.life / 0.4) * 0.6
        gctx.fillStyle = heart.color
        gctx.translate(heart.x * scale, heart.y * scale)
        gctx.rotate(heart.rotation)
        const s = (heart.size / HEART_BASE_SIZE) * scale
        gctx.scale(s, s)
        gctx.fill(HEART_PATH)
        // Reset transform for next heart (use setTransform for speed)
        gctx.setTransform(1, 0, 0, 1, 0, 0)
      })
      gctx.restore()

      // Composite glow onto main ctx (scale up)
      this.ctx.save()
      this.ctx.globalCompositeOperation = 'lighter'
      this.ctx.globalAlpha = 0.9
      this.ctx.drawImage(this.glowCanvas, 0, 0, gw, gh, 0, 0, mainW, mainH)
      this.ctx.restore()
    }

    // Draw core hearts (sharp)
    this.activeHearts.forEach(heart => {
      if (heart.active) {
        heart.render(this.ctx, this.time)
      }
    })
  }

  // Lightning system
  private updateLightningSpawn(mpResults: MPResults, canvasWidth: number, canvasHeight: number, mapping: CoordinateMapping | null): void {
    if (this.lastGestureState !== 'ROCK_SIGN') return
    
    const hands = mpResults.hands
    if (!hands) return
    
    // Find rock sign hand
    let indexTip: { x: number; y: number } | null = null
    let pinkyTip: { x: number; y: number } | null = null
    
    if (hands.left && this.isRockSignHand(hands.left)) {
      if (mapping) {
        indexTip = mapping.toPx(hands.left.index_tip[0], hands.left.index_tip[1])
        pinkyTip = mapping.toPx(hands.left.pinky_tip[0], hands.left.pinky_tip[1])
      } else {
        indexTip = { x: hands.left.index_tip[0] * canvasWidth, y: hands.left.index_tip[1] * canvasHeight }
        pinkyTip = { x: hands.left.pinky_tip[0] * canvasWidth, y: hands.left.pinky_tip[1] * canvasHeight }
      }
    } else if (hands.right && this.isRockSignHand(hands.right)) {
      if (mapping) {
        indexTip = mapping.toPx(hands.right.index_tip[0], hands.right.index_tip[1])
        pinkyTip = mapping.toPx(hands.right.pinky_tip[0], hands.right.pinky_tip[1])
      } else {
        indexTip = { x: hands.right.index_tip[0] * canvasWidth, y: hands.right.index_tip[1] * canvasHeight }
        pinkyTip = { x: hands.right.pinky_tip[0] * canvasWidth, y: hands.right.pinky_tip[1] * canvasHeight }
      }
    }
    
    if (!indexTip || !pinkyTip) return
    
    this.boltSpawnTimer += 16
    const spawnInterval = 140 + Math.random() * 40 // 140-180ms
    
    if (this.boltSpawnTimer >= spawnInterval && this.activeBolts.length < MAX_BOLTS) {
      // Spawn firecracker burst from bottom of screen (random X) for a pleasing effect
      this.spawnBoltAtBottom(canvasWidth, canvasHeight)
      this.boltSpawnTimer = 0
    }
  }

  private isRockSignHand(hand: Record<string, [number, number]>): boolean {
    const indexExtended = this.isFingerExtended(hand, 'index')
    const pinkyExtended = this.isFingerExtended(hand, 'pinky')
    const middleCurled = !this.isFingerExtended(hand, 'middle')
    const ringCurled = !this.isFingerExtended(hand, 'ring')
    
    return indexExtended && pinkyExtended && middleCurled && ringCurled
  }

  private isFingerExtended(hand: Record<string, [number, number]>, finger: 'index' | 'middle' | 'ring' | 'pinky'): boolean {
    const mcp = hand[`${finger}_mcp`]
    const pip = hand[`${finger}_pip`]
    const tip = hand[`${finger}_tip`]

    if (!mcp || !pip || !tip) return false

    const v1 = { x: pip[0] - mcp[0], y: pip[1] - mcp[1] }
    const v2 = { x: tip[0] - pip[0], y: tip[1] - pip[1] }

    const dot = v1.x * v2.x + v1.y * v2.y
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)

    if (mag1 === 0 || mag2 === 0) return false

    const cosAngle = dot / (mag1 * mag2)
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI)
    
    return angle < 40
  }

  private spawnBolt(startPoint: { x: number; y: number }, opts?: { targetYFrac?: number; speedScale?: number; explosionScale?: number }): void {
    const bolt = this.boltPool.get()
    bolt.reset()
    bolt.startTime = this.time
    bolt.maxLife = 2.5
    bolt.active = true

    // Rocket initial position and velocity upward
    const centerX = startPoint.x
    const centerY = startPoint.y
    const canvasH = this.ctx ? this.ctx.canvas.height : 720
    const isPortrait = canvasH / (this.ctx?.canvas.width || 400) > 1.6
    const targetYFrac = opts?.targetYFrac ?? (isPortrait ? 0.18 + Math.random() * 0.14 : 0.28 + Math.random() * 0.12)
    const speedScale = opts?.speedScale ?? (isPortrait ? 1.15 + Math.random() * 0.2 : 1.0 + Math.random() * 0.15)
    const explosionScale = opts?.explosionScale ?? (isPortrait ? 1.15 + Math.random() * 0.35 : 1.0 + Math.random() * 0.25)
    // stronger launch so rockets reach higher; scale by speedScale
    const vy = - (480 + Math.random() * 360) * speedScale // upward px/s
    const vx = (Math.random() - 0.5) * 40
    const rocketLife = 0.6 + Math.random() * 0.6
    const targetY = Math.max(16, Math.round(canvasH * targetYFrac))
    bolt.rocket = { x: centerX, y: centerY, vx, vy, life: rocketLife, maxLife: rocketLife, targetY, exploded: false, explosionScale }

    this.activeBolts.push(bolt)
  }

  private spawnBoltAtBottom(canvasWidth: number, canvasHeight: number): void {
    // Guard against global particle overload
    if (this.getActiveParticleCount() >= 300) return
    // Random X across width, just above bottom
    const x = 20 + Math.random() * Math.max(0, canvasWidth - 40)
    const y = canvasHeight - 30
    const isPortrait = canvasHeight / Math.max(1, canvasWidth) > 1.6
    this.spawnBolt({ x, y }, {
      targetYFrac: isPortrait ? 0.14 + Math.random() * 0.16 : 0.26 + Math.random() * 0.12,
      speedScale: isPortrait ? 1.1 + Math.random() * 0.2 : 1.0 + Math.random() * 0.15,
      explosionScale: isPortrait ? 1.2 + Math.random() * 0.5 : 1.0 + Math.random() * 0.25,
    })
  }

  private renderLightning(): void {
    // Batch bolt glow into offscreen and composite
    if (this.boltGlowCtx && this.boltGlowCanvas) {
      const mainW = this.ctx.canvas.width
      const mainH = this.ctx.canvas.height
      const scale = this.boltGlowScale
      const gw = Math.max(1, Math.round(mainW * scale))
      const gh = Math.max(1, Math.round(mainH * scale))
      if (this.boltGlowCanvas.width !== gw || this.boltGlowCanvas.height !== gh) {
        this.boltGlowCanvas.width = gw
        this.boltGlowCanvas.height = gh
      }

      const gctx = this.boltGlowCtx
      gctx.clearRect(0, 0, gw, gh)
  gctx.save()
  gctx.globalCompositeOperation = 'lighter'
  // reduced blur to shrink halo and save GPU work
  gctx.filter = 'blur(3px)'
      // Draw soft glows for all sparks
      this.activeBolts.forEach(bolt => {
        if (!bolt.active) return
        for (let i = 0; i < bolt.sparks.length; i++) {
          const s = bolt.sparks[i]
          if (s.life <= 0) continue
          gctx.globalAlpha = Math.max(0.12, Math.min(1, s.life / s.maxLife))
          gctx.fillStyle = s.color
          gctx.beginPath()
          gctx.arc(s.x * scale, s.y * scale, Math.max(1, s.size * 1.5 * scale), 0, Math.PI * 2)
          gctx.fill()
        }
      })
      gctx.restore()

      // Composite glow onto main canvas
      this.ctx.save()
      this.ctx.globalCompositeOperation = 'lighter'
      this.ctx.globalAlpha = 0.9
      this.ctx.drawImage(this.boltGlowCanvas, 0, 0, gw, gh, 0, 0, mainW, mainH)
      this.ctx.restore()
    }

    // Draw core spark shapes
    this.activeBolts.forEach(bolt => {
      if (bolt.active) bolt.render(this.ctx)
    })
  }

  // Sparkle system
  private updateSparkleSpawn(mpResults: MPResults, canvasWidth: number, canvasHeight: number, mapping: CoordinateMapping | null): void {
    if (this.lastGestureState !== 'POINT_SPARKLES') return
    
    const hands = mpResults.hands
    if (!hands) return
    
    // Collect pointing fingertips for both hands (support dual-hand sparkles)
    const tips: { x: number; y: number }[] = []
    if (hands.left && this.isPointingHand(hands.left)) {
      if (mapping) tips.push(mapping.toPx(hands.left.index_tip[0], hands.left.index_tip[1]))
      else tips.push({ x: hands.left.index_tip[0] * canvasWidth, y: hands.left.index_tip[1] * canvasHeight })
    }
    if (hands.right && this.isPointingHand(hands.right)) {
      if (mapping) tips.push(mapping.toPx(hands.right.index_tip[0], hands.right.index_tip[1]))
      else tips.push({ x: hands.right.index_tip[0] * canvasWidth, y: hands.right.index_tip[1] * canvasHeight })
    }

    if (tips.length === 0) return

    this.sparkleSpawnTimer += 16
    const spawnInterval = 1000 / SPARKLE_SPAWN_RATE // configured spawn rate (per-hand)

    while (this.sparkleSpawnTimer >= spawnInterval) {
      for (let i = 0; i < tips.length; i++) {
        if (this.activeSparkles.length >= MAX_SPARKLES) break
        if (this.getActiveParticleCount() >= 300) break
        const t = tips[i]
        this.spawnSparkle(t.x, t.y)
      }
      this.sparkleSpawnTimer -= spawnInterval
    }
  }

  private isPointingHand(hand: Record<string, [number, number]>): boolean {
    const indexExtended = this.isFingerExtended(hand, 'index')
    const middleCurled = !this.isFingerExtended(hand, 'middle')
    const ringCurled = !this.isFingerExtended(hand, 'ring')
    const pinkyCurled = !this.isFingerExtended(hand, 'pinky')
    
    return indexExtended && middleCurled && ringCurled && pinkyCurled
  }

  private spawnSparkle(x: number, y: number): void {
    // prevent exceeding global particles budget
    if (this.getActiveParticleCount() >= 300) return
    const sparkle = this.sparklePool.get()
    // small jitter from finger point
    sparkle.x = x + (Math.random() - 0.5) * 8
    sparkle.y = y + (Math.random() - 0.5) * 8
    sparkle.vx = -20 + Math.random() * 40 // -20 to 20 px/s
    sparkle.vy = 20 + Math.random() * 20 // 20 to 40 px/s (downward)
    sparkle.rotation = 0
    sparkle.rotationSpeed = 0
    sparkle.life = sparkle.maxLife = 0.5 + Math.random() * 0.25 // 0.5-0.75s
    // Respect configured size range but clamp large extremes for perf
    const minSize = SPARKLE_SIZE_RANGE[0] / 8 // scale down - constants are px but legacy large numbers
    const maxSize = Math.min(SPARKLE_SIZE_RANGE[1] / 8, 20)
    sparkle.size = minSize + Math.random() * (maxSize - minSize)
    sparkle.color = ['#fff7ad', '#ffe57a', '#fff'][Math.floor(Math.random() * 3)]
    sparkle.active = true
    
    this.activeSparkles.push(sparkle)
  }

  private renderSparkles(canvasHeight: number): void {
    // Remove sparkles that hit the ground
    for (let i = this.activeSparkles.length - 1; i >= 0; i--) {
      const sparkle = this.activeSparkles[i]
      if (sparkle.y >= canvasHeight - 10) {
        sparkle.active = false
        this.sparklePool.release(sparkle)
        this.activeSparkles.splice(i, 1)
      }
    }

    // Prepare offscreen glow once per frame (reused for all sparkles)
    const gctx = this.sparkleGlowCtx
    const gcanvas = this.sparkleGlowCanvas
    if (gctx && gcanvas) {
      const mainW = this.ctx.canvas.width
      const mainH = this.ctx.canvas.height
      const scale = this.sparkleGlowScale
      const gw = Math.max(1, Math.round(mainW * scale))
      const gh = Math.max(1, Math.round(mainH * scale))
      if (gcanvas.width !== gw || gcanvas.height !== gh) {
        gcanvas.width = gw
        gcanvas.height = gh
      }
      // clear offscreen
      gctx.clearRect(0, 0, gw, gh)
      gctx.save()
      gctx.globalCompositeOperation = 'lighter'
      gctx.filter = 'blur(6px)'

      // Draw soft glows for sparkles into offscreen
      for (let i = 0; i < this.activeSparkles.length; i++) {
        const s = this.activeSparkles[i]
        if (!s.active) continue
        const alpha = Math.max(0.08, Math.min(1, s.life / Math.max(0.001, s.maxLife)))
        gctx.globalAlpha = alpha
        gctx.fillStyle = s.color
        const gx = Math.round(s.x * scale)
        const gy = Math.round(s.y * scale)
  // smaller radius and lower alpha for subtler halos
  const gr = Math.max(1, Math.round(s.size * 1.1 * scale))
  gctx.globalAlpha = Math.max(0.06, Math.min(0.8, s.life / Math.max(0.001, s.maxLife)) * 0.85)
  gctx.beginPath()
        gctx.arc(gx, gy, gr, 0, Math.PI * 2)
        gctx.fill()
      }

      gctx.restore()
      // composite the glow onto main canvas
      this.ctx.save()
      this.ctx.globalCompositeOperation = 'lighter'
      this.ctx.drawImage(gcanvas, 0, 0, gcanvas.width, gcanvas.height, 0, 0, mainW, mainH)
      this.ctx.restore()
    }

    // Draw star-shaped cores using cheap pre-rendered sprites
    for (let i = 0; i < this.activeSparkles.length; i++) {
      const s = this.activeSparkles[i]
      if (!s.active) continue
      const sprite = this.getSparkleSprite(Math.max(2, s.size * 0.9), s.color)
      const sw = sprite.width
      const sh = sprite.height
      this.ctx.save()
      this.ctx.globalCompositeOperation = 'lighter'
      this.ctx.globalAlpha = Math.max(0.6, s.life / Math.max(0.01, s.maxLife))
      this.ctx.drawImage(sprite, Math.round(s.x - sw/2), Math.round(s.y - sh/2))
      this.ctx.restore()
    }
  }

  // Balloon system
  private updateBalloonSpawn(mpResults: MPResults, canvasWidth: number, canvasHeight: number): void {
    if (!this.balloonsEnabled) {
      return
    }
    
    const hands = mpResults.hands
    if (!hands) {
      return
    }
    
  // peace sign detected enables balloon spawning; spawn X will be random along bottom
    
    // Ensure at least one peace sign present to enable spawning
    if (!(hands.left && this.isPeaceSignHand(hands.left)) && !(hands.right && this.isPeaceSignHand(hands.right))) {
      return
    }
    
    // Continuous spawn at ~1 balloon per 0.4s
    this.balloonSpawnTimer += 16 // ~60 FPS
    const spawnInterval = 400 // 0.4s
    
    // spawn check
    
    if (this.balloonSpawnTimer >= spawnInterval && this.activeBalloons.length < MAX_BALLOONS) {
      // Spawn multiple balloons per interval (increase by ~3)
      const spawnBatch = 3
      for (let i = 0; i < spawnBatch; i++) {
        if (this.activeBalloons.length >= MAX_BALLOONS) break
        if (this.getActiveParticleCount() >= 300) break
        const spawnX = 10 + Math.random() * Math.max(0, canvasWidth - 20)
        this.spawnBalloon(spawnX, canvasHeight + 20)
      }
      this.balloonSpawnTimer = 0
    }
    
    // debug marker removed
  }

  private isPeaceSignHand(hand: Record<string, [number, number]>): boolean {
    const indexExtended = this.isFingerExtended(hand, 'index')
    const middleExtended = this.isFingerExtended(hand, 'middle')
    const ringCurled = !this.isFingerExtended(hand, 'ring')
    const pinkyCurled = !this.isFingerExtended(hand, 'pinky')
    
    return indexExtended && middleExtended && ringCurled && pinkyCurled
  }

  private spawnBalloon(x: number, y: number): void {
    const balloon = this.balloonPool.get()
    balloon.reset() // Reset all properties first
    
    balloon.x = x + (Math.random() - 0.5) * 40 // Random horizontal offset near hand center
    balloon.y = y // Start from bottom of canvas
    balloon.life = balloon.maxLife = BALLOON_LIFETIME / 1000 // 2.5 seconds
    balloon.color = this.balloonColors[Math.floor(Math.random() * this.balloonColors.length)]
    // per-instance motion params to avoid per-frame randoms
    balloon.riseSpeed = BALLOON_RISE_SPEED[0] + Math.random() * (BALLOON_RISE_SPEED[1] - BALLOON_RISE_SPEED[0])
    balloon.swayAmplitude = BALLOON_SWAY_AMPLITUDE[0] + Math.random() * (BALLOON_SWAY_AMPLITUDE[1] - BALLOON_SWAY_AMPLITUDE[0])
    balloon.swayOffset = Math.random() * Math.PI * 2
    balloon.swaySpeed = 0.6 + Math.random() * 1.0
    balloon.active = true
    
    // Ensure balloon is within visible bounds
    balloon.x = Math.max(0, Math.min(balloon.x, this.ctx.canvas.width))
    balloon.y = Math.max(0, Math.min(balloon.y, this.ctx.canvas.height + 20))
    
  this.activeBalloons.push(balloon)
  }

  // debug helper removed

  private renderBalloons(): void {
    // Draw pre-rendered balloon sprites to reduce path drawing cost
    for (let i = 0; i < this.activeBalloons.length; i++) {
      const balloon = this.activeBalloons[i]
      if (!balloon.active) continue
      const alpha = Math.min(1, balloon.life / (BALLOON_LIFETIME / 1000))
      this.ctx.save()
      this.ctx.globalAlpha = alpha
      const sprite = this.getBalloonSprite(BALLOON_ELLIPSE_WIDTH, BALLOON_ELLIPSE_HEIGHT, balloon.color)
      const sx = Math.round(balloon.x - sprite.width / 2)
      const sy = Math.round(balloon.y - sprite.height / 2)
      this.ctx.drawImage(sprite, sx, sy)
      this.ctx.restore()
    }
  }

  clear(): void {
    // Release all active particles
    this.activeConfetti.forEach(confetti => this.confettiPool.release(confetti))
    this.activeHearts.forEach(heart => this.heartPool.release(heart))
    this.activeBolts.forEach(bolt => this.boltPool.release(bolt))
    this.activeSparkles.forEach(sparkle => this.sparklePool.release(sparkle))
    this.activeBalloons.forEach(balloon => this.balloonPool.release(balloon))
    
    this.activeConfetti = []
    this.activeHearts = []
    this.activeBolts = []
    this.activeSparkles = []
    this.activeBalloons = []
    
    this.time = this.lastTime = 0
    this.confettiSpawnTimer = this.heartSpawnTimer = this.boltSpawnTimer = this.sparkleSpawnTimer = this.balloonSpawnTimer = 0
    this.lastGestureState = 'NONE'
    this.balloonsEnabled = false
  }
}
