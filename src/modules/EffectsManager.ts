import { GestureType, BALLOON_SPAWN_COUNT, BALLOON_RISE_SPEED, BALLOON_SWAY_AMPLITUDE, BALLOON_LIFETIME, MAX_ACTIVE_BALLOONS, BALLOON_ELLIPSE_WIDTH, BALLOON_ELLIPSE_HEIGHT, BALLOON_STRING_LENGTH, BALLOON_SHINE_ALPHA } from '../constants'
import { MPResults } from './mediapipe'
import { CoordinateMapping, normToCropPx, computeCenteredCrop } from '../renderer/crop'

// Performance constants
const MAX_CONFETTI = 160
const MAX_HEARTS = 70
const MAX_BOLTS = 6
const MAX_SPARKLES = 160
const MAX_BALLOONS = MAX_ACTIVE_BALLOONS

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

    // Apply gravity
    this.vy += 220 * dt // 220 px/s² gravity
    
    // Apply air drag
    this.vx *= 0.985
    this.vy *= 0.985
    
    // Add wind oscillation
    this.vx += Math.sin(time * 1.7 + this.seed) * 18 * dt
    
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
  update(dt: number, _time: number): boolean {
    if (!this.active) return false

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

    const alpha = Math.min(1, this.life / 0.4) // Fade in last 0.4s
    
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = this.color
    ctx.translate(this.x, this.y)
    ctx.rotate(this.rotation)
    ctx.scale(this.size / 20, this.size / 20)
    
    ctx.font = '20px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('♥', 0, 0)
    
    ctx.restore()
  }
}

// Lightning bolt
class LightningBolt {
  segments: { x: number; y: number }[] = []
  startTime = 0
  life = 0
  maxLife = 0
  active = false
  color = '#7cf7ff'
  glowColor = '#bafcff'

  update(dt: number, _time: number): boolean {
    if (!this.active) return false
    
    this.life -= dt
    return this.life > 0
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active || this.segments.length < 2) return

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    
    // Draw glow pass
    ctx.strokeStyle = this.glowColor
    ctx.lineWidth = 10
    ctx.globalAlpha = 0.22
    ctx.beginPath()
    ctx.moveTo(this.segments[0].x, this.segments[0].y)
    for (let i = 1; i < this.segments.length; i++) {
      ctx.lineTo(this.segments[i].x, this.segments[i].y)
    }
    ctx.stroke()
    
    // Draw core
    ctx.strokeStyle = this.color
    ctx.lineWidth = 6
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.moveTo(this.segments[0].x, this.segments[0].y)
    for (let i = 1; i < this.segments.length; i++) {
      ctx.lineTo(this.segments[i].x, this.segments[i].y)
    }
    ctx.stroke()
    
    ctx.restore()
  }

  reset(): void {
    this.segments = []
    this.startTime = this.life = this.maxLife = 0
    this.active = false
    this.color = '#7cf7ff'
    this.glowColor = '#bafcff'
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

  update(dt: number, time: number): boolean {
    if (!this.active) return false

    // Update position - rise vertically with horizontal sway
    const riseSpeed = (BALLOON_RISE_SPEED[0] + Math.random() * (BALLOON_RISE_SPEED[1] - BALLOON_RISE_SPEED[0]))
    this.y -= riseSpeed * dt * 60 // Convert px/frame to px/s for 60 FPS
    
    const swayAmount = Math.sin(time * 1.5 + this.swayOffset) * (BALLOON_SWAY_AMPLITUDE[0] + Math.random() * (BALLOON_SWAY_AMPLITUDE[1] - BALLOON_SWAY_AMPLITUDE[0]))
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
  
  // Object pools
  private confettiPool: ObjectPool<ConfettiParticle>
  private heartPool: ObjectPool<HeartParticle>
  private boltPool: ObjectPool<LightningBolt>
  private sparklePool: ObjectPool<SparkleParticle>
  private balloonPool: ObjectPool<BalloonParticle>
  
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
  private balloonColors = ['#ff5f5f', '#ffa95f', '#5fffb0', '#5fc3ff', '#c65fff']

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx
    
    // Initialize object pools
    this.confettiPool = new ObjectPool(() => new ConfettiParticle(), MAX_CONFETTI)
    this.heartPool = new ObjectPool(() => new HeartParticle(), MAX_HEARTS)
    this.boltPool = new ObjectPool(() => new LightningBolt(), MAX_BOLTS)
    this.sparklePool = new ObjectPool(() => new SparkleParticle(), MAX_SPARKLES)
    this.balloonPool = new ObjectPool(() => new BalloonParticle(), MAX_BALLOONS)
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
      this.triggerLockEvent(gesture, canvasWidth, canvasHeight)
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

    // Render effects in z-order: Confetti (back) → Hearts → Lightning → Sparkles (front)
    if (gesture === 'THUMBS_UP_HALO') {
      this.renderConfetti()
      this.updateConfettiSpawn(canvasWidth)
    }
    
    if (gesture === 'TWO_HAND_HEART') {
      this.renderHearts()
      this.updateHeartSpawn(mpResults, canvasWidth, canvasHeight, mapping)
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
      this.updateBalloonSpawn(mpResults, canvasWidth, canvasHeight, mapping)
    }
  }

  private triggerLockEvent(gesture: GestureType, canvasWidth: number, canvasHeight: number): void {
    
    if (gesture === 'THUMBS_UP_HALO') {
      // Confetti burst: 120 pieces
      for (let i = 0; i < 120 && this.activeConfetti.length < MAX_CONFETTI; i++) {
        this.spawnConfetti(canvasWidth)
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

  private updateParticles(dt: number): void {
    // Update confetti
    for (let i = this.activeConfetti.length - 1; i >= 0; i--) {
      const confetti = this.activeConfetti[i]
      if (!confetti.update(dt, this.time)) {
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
  private updateConfettiSpawn(canvasWidth: number): void {
    if (this.lastGestureState !== 'THUMBS_UP_HALO') return
    
    this.confettiSpawnTimer += 16 // ~60 FPS
    const spawnInterval = 1000 / 60 // 60 pieces/s
    
    while (this.confettiSpawnTimer >= spawnInterval && this.activeConfetti.length < MAX_CONFETTI) {
      this.spawnConfetti(canvasWidth)
      this.confettiSpawnTimer -= spawnInterval
    }
  }

  private spawnConfetti(canvasWidth: number): void {
    const confetti = this.confettiPool.get()
    confetti.x = Math.random() * canvasWidth
    confetti.y = -20 // Top edge
    confetti.vx = -80 + Math.random() * 160 // -80 to 80 px/s
    confetti.vy = 120 + Math.random() * 60 // 120 to 180 px/s
    confetti.rotation = Math.random() * Math.PI * 2
    confetti.rotationSpeed = (-180 + Math.random() * 360) * Math.PI / 180 // ±180°/s
    confetti.life = confetti.maxLife = 1.6 + Math.random() * 0.6 // 1.6-2.2s
    confetti.size = 8 + Math.random() * 8 // 8-16px
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
  private updateHeartSpawn(mpResults: MPResults, canvasWidth: number, canvasHeight: number, mapping: CoordinateMapping | null): void {
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
    
    this.heartSpawnTimer += 16
    const spawnInterval = 1000 / 9 // 9 hearts/s
    
    while (this.heartSpawnTimer >= spawnInterval && this.activeHearts.length < MAX_HEARTS) {
      this.spawnHeart(centerX, centerY)
      this.heartSpawnTimer -= spawnInterval
    }
  }

  private spawnHeart(x: number, y: number): void {
    const heart = this.heartPool.get()
    heart.x = x + (Math.random() - 0.5) * 120
    heart.y = y + (Math.random() - 0.5) * 80
    heart.vx = (Math.random() - 0.5) * 40 // ±20 px/s drift
    heart.vy = -(65 + Math.random() * 30) // -65 to -95 px/s (upward)
    heart.rotation = Math.random() * Math.PI * 3
    heart.rotationSpeed = (Math.random() - 0.5) * 3
    heart.life = heart.maxLife = 1.3 + Math.random() * 0.3 // 1.3-1.6s
    heart.size = 150 + Math.random() * 20 // 24-44px
    heart.color = this.heartColors[Math.floor(Math.random() * this.heartColors.length)]
    heart.active = true
    
    this.activeHearts.push(heart)
  }

  private renderHearts(): void {
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
      // Alternate between index and pinky
      const useIndex = this.activeBolts.length % 2 === 0
      this.spawnBolt(useIndex ? indexTip : pinkyTip, canvasHeight)
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

  private spawnBolt(startPoint: { x: number; y: number }, canvasHeight: number): void {
    const bolt = this.boltPool.get()
    bolt.startTime = this.time
    bolt.life = bolt.maxLife = 0.09 // 90ms
    bolt.active = true
    
    // Generate bolt segments
    const segmentCount = 9 + Math.floor(Math.random() * 3) // 9-11 segments
    bolt.segments = [{ x: startPoint.x, y: startPoint.y }]
    
    let currentX = startPoint.x
    let currentY = startPoint.y
    const targetY = Math.min(startPoint.y + 2000, canvasHeight) // Target 200px downward or canvas bottom
    
    for (let i = 1; i < segmentCount; i++) {
      const progress = i / segmentCount
      currentY = startPoint.y + (targetY - startPoint.y) * progress
      currentX += (Math.random() - 0.5) * 20 // ±10px jitter
      bolt.segments.push({ x: currentX, y: currentY })
    }
    
    // Add branch with 15% chance
    if (Math.random() < 0.15 && bolt.segments.length > 3) {
      const branchIndex = Math.floor(bolt.segments.length / 2)
      const branchPoint = bolt.segments[branchIndex]
      const branchLength = 2 + Math.floor(Math.random() * 2)
      
      let branchX = branchPoint.x
      let branchY = branchPoint.y
      
      for (let i = 0; i < branchLength; i++) {
        branchY += 15
        branchX += (Math.random() - 0.5) * 15
        bolt.segments.push({ x: branchX, y: branchY })
      }
    }
    
    this.activeBolts.push(bolt)
  }

  private renderLightning(): void {
    this.activeBolts.forEach(bolt => {
      if (bolt.active) {
        bolt.render(this.ctx)
      }
    })
  }

  // Sparkle system
  private updateSparkleSpawn(mpResults: MPResults, canvasWidth: number, canvasHeight: number, mapping: CoordinateMapping | null): void {
    if (this.lastGestureState !== 'POINT_SPARKLES') return
    
    const hands = mpResults.hands
    if (!hands) return
    
    // Find pointing finger
    let fingerTip: { x: number; y: number } | null = null
    
    if (hands.left && this.isPointingHand(hands.left)) {
      if (mapping) {
        fingerTip = mapping.toPx(hands.left.index_tip[0], hands.left.index_tip[1])
      } else {
        fingerTip = { x: hands.left.index_tip[0] * canvasWidth, y: hands.left.index_tip[1] * canvasHeight }
      }
    } else if (hands.right && this.isPointingHand(hands.right)) {
      if (mapping) {
        fingerTip = mapping.toPx(hands.right.index_tip[0], hands.right.index_tip[1])
      } else {
        fingerTip = { x: hands.right.index_tip[0] * canvasWidth, y: hands.right.index_tip[1] * canvasHeight }
      }
    }
    
    if (!fingerTip) return
    
    this.sparkleSpawnTimer += 16
    const spawnInterval = 1000 / 22 // 22 sparkles/s
    
    while (this.sparkleSpawnTimer >= spawnInterval && this.activeSparkles.length < MAX_SPARKLES) {
      this.spawnSparkle(fingerTip.x, fingerTip.y)
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
    const sparkle = this.sparklePool.get()
    sparkle.x = x + (Math.random() - 0.5) * 10
    sparkle.y = y + (Math.random() - 0.5) * 10
    sparkle.vx = -20 + Math.random() * 40 // -20 to 20 px/s
    sparkle.vy = 20 + Math.random() * 20 // 20 to 40 px/s (downward)
    sparkle.rotation = Math.random() * Math.PI * 2
    sparkle.rotationSpeed = (Math.random() - 0.5) * 4
    sparkle.life = sparkle.maxLife = 0.55 + Math.random() * 0.2 // 0.55-0.75s
    sparkle.size = 8 + Math.random() * 6 // 8-14px
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
    
    this.activeSparkles.forEach(sparkle => {
      if (sparkle.active) {
        sparkle.render(this.ctx, this.time)
      }
    })
  }

  // Balloon system
  private updateBalloonSpawn(mpResults: MPResults, canvasWidth: number, canvasHeight: number, mapping: CoordinateMapping | null): void {
    if (!this.balloonsEnabled) {
      console.log('Balloons not enabled')
      return
    }
    
    const hands = mpResults.hands
    if (!hands) {
      console.log('No hands detected')
      return
    }
    
    // Find peace sign hand center for X coordinate
    let handCenterX = canvasWidth / 2 // fallback to center
    
    if (hands.left && this.isPeaceSignHand(hands.left)) {
      // Use midpoint between wrist and middle base
      if (mapping) {
        const wristMapped = mapping.toPx(hands.left.wrist[0], hands.left.wrist[1])
        const middleMcpMapped = mapping.toPx(hands.left.middle_mcp[0], hands.left.middle_mcp[1])
        handCenterX = (wristMapped.x + middleMcpMapped.x) / 2
      } else {
        handCenterX = (hands.left.wrist[0] + hands.left.middle_mcp[0]) / 2 * canvasWidth
      }
    } else if (hands.right && this.isPeaceSignHand(hands.right)) {
      if (mapping) {
        const wristMapped = mapping.toPx(hands.right.wrist[0], hands.right.wrist[1])
        const middleMcpMapped = mapping.toPx(hands.right.middle_mcp[0], hands.right.middle_mcp[1])
        handCenterX = (wristMapped.x + middleMcpMapped.x) / 2
      } else {
        handCenterX = (hands.right.wrist[0] + hands.right.middle_mcp[0]) / 2 * canvasWidth
      }
    }
    
    // Continuous spawn at ~1 balloon per 0.4s
    this.balloonSpawnTimer += 16 // ~60 FPS
    const spawnInterval = 400 // 0.4s
    
    console.log('Balloon spawn check:', { 
      timer: this.balloonSpawnTimer, 
      interval: spawnInterval, 
      activeCount: this.activeBalloons.length, 
      maxBalloons: MAX_BALLOONS,
      handCenterX,
      canvasHeight 
    })
    
    if (this.balloonSpawnTimer >= spawnInterval && this.activeBalloons.length < MAX_BALLOONS) {
      console.log('Spawning balloon!')
      this.spawnBalloon(handCenterX, canvasHeight + 20) // Start from bottom + small offset
      this.balloonSpawnTimer = 0
    }
    
    // Debug: Add temporary magenta dot at spawn location
    this.drawDebugDot(handCenterX, canvasHeight + 20)
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
    balloon.active = true
    
    // Ensure balloon is within visible bounds
    balloon.x = Math.max(0, Math.min(balloon.x, this.ctx.canvas.width))
    balloon.y = Math.max(0, Math.min(balloon.y, this.ctx.canvas.height + 20))
    
    this.activeBalloons.push(balloon)
    
    console.log('Spawned balloon:', { x: balloon.x, y: balloon.y, color: balloon.color, active: balloon.active })
  }

  private drawDebugDot(x: number, y: number): void {
    this.ctx.save()
    this.ctx.fillStyle = '#ff00ff' // Magenta
    this.ctx.beginPath()
    this.ctx.arc(x, y, 3, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.restore()
  }

  private renderBalloons(): void {
    // Debug test: Draw static red circle at bottom center
    this.ctx.save()
    this.ctx.fillStyle = 'red'
    this.ctx.globalAlpha = 1
    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.beginPath()
    this.ctx.arc(this.ctx.canvas.width / 2, this.ctx.canvas.height - 20, 5, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.restore()
    
    // Render all active balloons
    this.activeBalloons.forEach(balloon => {
      if (balloon.active) {
        balloon.render(this.ctx, this.time)
      }
    })
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
