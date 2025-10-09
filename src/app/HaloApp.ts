import { Camera } from '../modules/Camera'
import { initMediaPipe, processFrame, destroyMediaPipe, MPResults } from '../modules/mediapipe'
import { GestureClassifier } from '../modules/GestureClassifier'
import { EffectsManager } from '../modules/EffectsManager'
import { CaptureSystem } from '../modules/CaptureSystem'
import { UI } from '../ui/UI'
import { initDiagnostics, drawDiagnostics, setDiagnosticsEnabled } from '../modules/diagnostics'
import { GestureType } from '../constants'
import { GestureState } from '../types'
import { listVideoInputs, unlockDeviceLabels } from '../utils/camera'
import { VideoAspect } from '../renderer/config'
import { computeCenteredCrop } from '../renderer/crop'

export class HaloApp {
  private camera: Camera
  private classifier: GestureClassifier
  private effectsManager: EffectsManager
  private captureSystem: CaptureSystem
  private ui: UI
  private container: HTMLElement
  private isRunning = false
  private animationId: number | null = null
  private currentGesture: GestureType = 'NONE'
  private manualMode = false
  private diagnosticsEnabled = true
  private currentMPResults: MPResults | null = null
  private lastGestureState: GestureState | null = null
  private countdownActive = false
  private countdownValue = 0
  private countdownStartTime = 0
  private countdownDuration = 3000 // 3 seconds (gesture-locked countdown)
  // Manual capture countdown (5 seconds) when user presses capture button
  private manualCountdownActive = false
  private manualCountdownStart = 0
  private manualCountdownDuration = 5000 // 5 seconds
  // Handle returned by the File System Access API when user picks a folder
  private captureDirHandle: any = null
  private currentAspect: VideoAspect = '9:16'
  private fps = 0
  private lastFpsTime = 0
  private frameCount = 0

  constructor() {
    this.container = document.getElementById('app')!
    this.camera = new Camera()
    this.classifier = new GestureClassifier()
    this.captureSystem = new CaptureSystem()
    this.ui = new UI(this.container)
    
    // Initialize effects manager after camera is ready
    this.effectsManager = new EffectsManager(this.camera.getContext())
  }

  async init(): Promise<void> {
    try {
      // Load saved preferences
      const savedCameraId = localStorage.getItem('halo.cameraId')
      const savedAspect = (localStorage.getItem('halo.aspect') as VideoAspect) || '9:16'

      // Create stage container before camera initialization so sizing works
      const stage = document.createElement('div')
      stage.className = 'halo-stage'
      stage.id = 'haloStage'
      this.container.appendChild(stage)
      
      // Add camera elements to stage
      stage.appendChild(this.camera.getVideoElement())
      stage.appendChild(this.camera.getCanvas())
      
      // Initialize diagnostics within stage
      const diagCanvas = document.createElement('canvas')
      diagCanvas.className = 'diag'
      diagCanvas.id = 'diagCanvas'
      stage.appendChild(diagCanvas)
      initDiagnostics(diagCanvas, this.camera.getVideoElement())

      // Initialize camera with saved device now that stage is ready
      await this.camera.initialize(savedCameraId)
      this.currentAspect = savedAspect
      this.camera.setAspect(this.currentAspect)
      
      // Initialize MediaPipe
      await initMediaPipe(this.camera.getVideoElement())
      
      // Set up event listeners
      this.setupEventListeners()
      
      // Populate camera selector
      await this.populateCameraSelector()
      
      // Set initial aspect in UI
      this.ui.setAspect(this.currentAspect)
      
      // Start the main loop
      this.start()
      
    } catch (error) {
      console.error('Failed to initialize Halo app:', error)
      this.showError('Camera access denied or not available. Please refresh and allow camera access.')
      this.enableManualMode()
    }
  }

  private setupEventListeners(): void {
    // Capture button - start/cancel a 5s manual countdown
    this.ui.onCaptureClick(() => this.toggleManualCountdown())
    
    // Reset button
    this.ui.onResetClick(() => this.reset())
    
    // Share button
    this.ui.onShareClick(() => {
      const currentCapture = this.captureSystem.getCurrentCapture()
      if (currentCapture) {
        this.ui.showShareModal(currentCapture)
      }
    })
    
    // Manual gesture selection
    this.ui.onManualGestureSelect((gesture: GestureType) => {
      this.manualMode = true
      this.currentGesture = gesture
      this.updateUI()
    })
    
    // Diagnostics toggle
    this.ui.onDiagnosticsToggle((enabled: boolean) => {
      this.diagnosticsEnabled = enabled
      setDiagnosticsEnabled(enabled)
    })
    
    // Camera selection
    this.ui.onCameraChange(async (deviceId: string) => {
      try {
        console.log('Switching to camera:', deviceId)
        await this.camera.switchCamera(deviceId)
        localStorage.setItem('halo.cameraId', deviceId)
        console.log('Camera switched successfully')
      } catch (error) {
        console.error('Failed to switch camera:', error)
        this.showError('Failed to switch camera. Please try again.')
      }
    })
    
    // Aspect ratio toggle
    this.ui.onAspectChange((aspect: VideoAspect) => {
      console.log('Changing aspect to:', aspect)
      this.currentAspect = aspect
      this.camera.setAspect(aspect)
      localStorage.setItem('halo.aspect', aspect)
      console.log('Aspect changed successfully')
    })
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'c' || e.key === 'C') {
        // Toggle manual 5s countdown on keyboard as well
        this.toggleManualCountdown()
      } else if (e.key === 'Escape') {
        this.ui.hideShareModal()
      } else if (e.key === 'd' || e.key === 'D') {
        this.diagnosticsEnabled = !this.diagnosticsEnabled
        setDiagnosticsEnabled(this.diagnosticsEnabled)
        this.ui.updateDiagnosticsToggle(this.diagnosticsEnabled)
      }
    })
  }

  private toggleManualCountdown(): void {
    if (this.manualCountdownActive) {
      this.cancelManualCountdown()
    } else {
      this.startManualCountdown()
    }
  }

  private startManualCountdown(): void {
    if (!this.camera.isRunning()) return
    this.manualCountdownActive = true
    this.manualCountdownStart = performance.now()
    // Use UI selected timer seconds
    const seconds = this.ui.getCaptureTimerSeconds()
    this.manualCountdownDuration = seconds * 1000
    // Initialize UI with selected seconds
    this.ui.updateCaptureCountdown(seconds)
    // Show big overlay countdown so it doesn't get captured
    this.ui.showBigCountdown(seconds)
  }

  private cancelManualCountdown(): void {
    this.manualCountdownActive = false
    this.ui.updateCaptureCountdown(0)
    this.ui.hideBigCountdown()
  }

  private updateManualCountdown(): void {
    if (!this.manualCountdownActive) return

    const elapsed = performance.now() - this.manualCountdownStart
    const remaining = Math.max(0, this.manualCountdownDuration - elapsed)
    const secondsLeft = Math.ceil(remaining / 1000)

    // Update UI when value changes
    if (secondsLeft !== this.countdownValue) {
      this.ui.updateCaptureCountdown(secondsLeft)
      this.ui.updateBigCountdown(secondsLeft)
      this.countdownValue = secondsLeft
    }

    if (remaining <= 0) {
      // Stop and capture
      this.cancelManualCountdown()
      this.capture()
    }
  }

  private start(): void {
    this.isRunning = true
    this.loop()
  }

  private loop(): void {
    if (!this.isRunning) return
    
    this.update()
    this.render()
    this.updateFps()
    
    this.animationId = requestAnimationFrame(() => this.loop())
  }

  private async update(): Promise<void> {
    if (!this.camera.isRunning()) return
    
    // Camera frame is drawn in render() with aspect-aware crop
    
    if (!this.manualMode) {
      // Process MediaPipe frame
      const mpResults = processFrame()
      
      if (mpResults) {
        this.currentMPResults = mpResults
        
        // Classify gesture
        const state = this.classifier.updateState(mpResults)
        this.currentGesture = state.type as GestureType
        
        // Handle gesture state changes for countdown
        this.handleGestureStateChange(state)
        
        // Update UI
        this.updateUI(state)
        
        // Draw diagnostics
        if (this.diagnosticsEnabled) {
          drawDiagnostics(mpResults)
        }
      }
    } else {
      // Manual mode - simulate locked state for effects
      this.currentMPResults = null
    }
    
    // Update countdown
    this.updateCountdown()
    // Update manual (button) countdown if active
    this.updateManualCountdown()
  }

  private render(): void {
    if (!this.camera.isRunning()) return
    
    const { width, height } = this.camera.getDimensions()
    const srcRes = this.camera.getVideoResolution()
    const video = this.camera.getVideoElement()
    const ctx = this.camera.getContext()
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height)
    
    // Draw video with aspect-aware cropping
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      const crop = computeCenteredCrop(video.videoWidth, video.videoHeight, width, height)
      ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height)
    }
    
    // Render effects - always show when gesture is locked (or manual mode)
    const shouldShowEffects = this.manualMode || (this.lastGestureState?.locked && this.currentGesture !== 'NONE')
    
    if (shouldShowEffects) {
      const stubResults = this.currentMPResults || { pose: {}, hands: {}, raw: { pose: null, hands: null } }
      this.effectsManager.updateAndRender(this.currentGesture, stubResults, width, height, video)
    }
    
    // Render countdown
    if (this.countdownActive) {
      this.renderCountdown(ctx, width, height)
    }
    // Manual countdown is shown via UI overlay (so it won't be captured)

    // Update perf HUD (camera source resolution and app FPS)
    this.ui.updatePerfHud(srcRes.width, srcRes.height, this.fps)
  }

  private updateFps(): void {
    const now = performance.now()
    if (this.lastFpsTime === 0) {
      this.lastFpsTime = now
      this.frameCount = 0
      this.fps = 0
      return
    }
    this.frameCount++
    const elapsed = now - this.lastFpsTime
    if (elapsed >= 500) { // update twice per second
      this.fps = (this.frameCount * 1000) / elapsed
      this.frameCount = 0
      this.lastFpsTime = now
    }
  }

  private handleGestureStateChange(state: GestureState): void {
    const wasLocked = this.lastGestureState?.locked || false
    const isNowLocked = state.locked
    
    // Gesture just became locked - start countdown
    if (!wasLocked && isNowLocked && state.type !== 'NONE') {
      this.startCountdown()
    }
    
    // Gesture lost lock - cancel countdown
    if (wasLocked && !isNowLocked) {
      this.cancelCountdown()
    }
    
    this.lastGestureState = state
  }
  
  private startCountdown(): void {
    this.countdownActive = true
    this.countdownValue = 3
    this.countdownStartTime = performance.now()
    // countdown started
  }
  
  private cancelCountdown(): void {
    this.countdownActive = false
    this.countdownValue = 0
    // countdown cancelled
  }
  
  private updateCountdown(): void {
    if (!this.countdownActive) return
    
    const elapsed = performance.now() - this.countdownStartTime
    const remaining = Math.max(0, this.countdownDuration - elapsed)
    
    // Update countdown value (3, 2, 1, 0)
    const newValue = Math.ceil(remaining / 1000)
    if (newValue !== this.countdownValue) {
      this.countdownValue = newValue
      // tick
    }
    
    // Auto-capture when countdown reaches 0
    if (remaining <= 0) {
      this.cancelCountdown()
      // auto-capturing
      this.capture()
    }
  }
  
  private renderCountdown(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const centerX = width / 2
    const centerY = height / 2
    
    ctx.save()
    ctx.font = 'bold 120px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // Neon glow effect
    ctx.shadowColor = '#ffffff'
    ctx.shadowBlur = 20
    ctx.fillStyle = `rgba(255, 255, 255, 0.8)`
    
    ctx.fillText(this.countdownValue.toString(), centerX, centerY)
    ctx.restore()
  }

  // manual countdown is handled via UI overlay methods
  
  private updateUI(state?: GestureState): void {
    if (this.manualMode) {
      // Manual mode - show current gesture
      const mockState: GestureState = {
        type: this.currentGesture,
        confidence: 1.0,
        locked: true,
        stabilityCount: 0
      }
      this.ui.updateGestureStatus(mockState)
    } else if (state) {
      this.ui.updateGestureStatus(state)
    }
  }

  private async populateCameraSelector(): Promise<void> {
    try {
      // Unlock device labels first
      await unlockDeviceLabels()
      
      // Get list of video devices
      const devices = await listVideoInputs()
      
      // Populate UI selector
      this.ui.populateCameraSelector(devices, this.camera.getCurrentDeviceId())
      
      console.log('Camera selector populated:', devices.length, 'devices found')
    } catch (error) {
      console.error('Failed to populate camera selector:', error)
    }
  }

  private async capture(): Promise<void> {
    if (!this.camera.isRunning()) return

    const canvas = this.camera.getCanvas()
    const watermarkEnabled = this.ui.getWatermarkEnabled()
    // Play capture sound (UI handles browser compatibility)
    this.ui.playCaptureSound()

    // Capture the current frame with aura
    const capture = await this.captureSystem.captureFrame(canvas, this.currentGesture, watermarkEnabled, this.currentAspect)

    // Add to Halo Wall
    this.ui.addThumbnailToWall(capture)

    // Show share button and modal
    this.ui.showShareButton()
    this.ui.showShareModal(capture)

    // Save locally to `captures/halo_<timestamp>.png` using File System Access API when available.
    ;(async () => {
      try {
        const timestamp = Date.now()
        const filename = `halo_${timestamp}.png`
        const dataUrl = capture.imageData

        // File System Access API path
        if ((window as any).showDirectoryPicker) {
          // Ask for a directory once
          if (!this.captureDirHandle) {
            this.captureDirHandle = await (window as any).showDirectoryPicker()
          }

          // Ensure a 'captures' subfolder exists
          let targetDir = this.captureDirHandle
          try {
            targetDir = await this.captureDirHandle.getDirectoryHandle('captures', { create: true })
          } catch (e) {
            // fall back to root handle
            targetDir = this.captureDirHandle
          }

          const fh = await targetDir.getFileHandle(filename, { create: true })
          const writable = await fh.createWritable()
          const res = await fetch(dataUrl)
          const blob = await res.blob()
          await writable.write(blob)
          await writable.close()
          console.log('Saved capture to local folder as', filename)
        } else {
          // Fallback: trigger download
          const a = document.createElement('a')
          a.href = dataUrl
          a.download = filename
          document.body.appendChild(a)
          a.click()
          a.remove()
          console.log('Downloaded capture as', filename)
        }
      } catch (err) {
        console.warn('Failed to save capture locally:', err)
      }
    })()

    console.log('Captured:', capture.gesture)
  }

  private reset(): void {
    this.classifier.reset()
    this.effectsManager.clear()
    this.currentGesture = 'NONE'
    this.manualMode = false
    this.updateUI()
  }

  private enableManualMode(): void {
    this.manualMode = true
    this.currentGesture = 'NONE'
    this.updateUI()
    
    // Show error message
    const errorDiv = document.createElement('div')
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 0, 0, 0.9);
      color: white;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
      z-index: 1000;
    `
    errorDiv.innerHTML = `
      <h3>Camera Not Available</h3>
      <p>Using manual gesture selection mode</p>
      <p>Click on a gesture below to select an effect</p>
    `
    document.body.appendChild(errorDiv)
    
    // Remove error message after 5 seconds
    setTimeout(() => {
      errorDiv.remove()
    }, 5000)
  }

  private showError(message: string): void {
    console.error(message)
    // Error handling is done in enableManualMode for this MVP
  }

  destroy(): void {
    this.isRunning = false
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
    }
    this.camera.stop()
    destroyMediaPipe()
  }
}
