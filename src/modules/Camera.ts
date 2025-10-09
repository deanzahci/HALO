import { getStreamForDevice, stopStreamTracks } from '../utils/camera'
import { VideoAspect, getResolutionForAspect } from '../renderer/config'
import { updateDiagnosticsForStage } from './diagnostics'

export class Camera {
  private video: HTMLVideoElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private stream: MediaStream | null = null
  private isActive = false
  private currentDeviceId: string | null = null
  private currentAspect: VideoAspect = '9:16'

  constructor() {
    this.video = document.createElement('video')
    this.video.autoplay = true
    this.video.playsInline = true
    this.video.muted = true
    
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')!
  }

  async initialize(deviceId: string | null = null): Promise<void> {
    try {
      this.stream = await getStreamForDevice(deviceId, 30)
      this.currentDeviceId = deviceId
      
      this.video.srcObject = this.stream
      await this.video.play()
      
      // Set initial canvas size based on current aspect
      this.updateCanvasSize()
      
      this.isActive = true
      console.log('Camera initialized successfully')
    } catch (error) {
      console.error('Failed to initialize camera:', error)
      throw new Error('Camera access denied or not available')
    }
  }

  async switchCamera(deviceId: string): Promise<void> {
    try {
      // Stop current stream
      stopStreamTracks(this.stream)
      
      // Get new stream
      this.stream = await getStreamForDevice(deviceId, 30)
      this.currentDeviceId = deviceId
      
      // Update video source
      this.video.srcObject = this.stream
      await this.video.play()
      
      // Update canvas size
      this.updateCanvasSize()
      
      console.log('Camera switched successfully')
    } catch (error) {
      console.error('Failed to switch camera:', error)
      throw error
    }
  }

  setAspect(aspect: VideoAspect): void {
    this.currentAspect = aspect
    this.updateCanvasSize()
  }

  private updateCanvasSize(): void {
    const { w, h } = getResolutionForAspect(this.currentAspect)
    const DPR = Math.max(1, window.devicePixelRatio || 1)
    
    // Set internal canvas resolution
    this.canvas.width = Math.round(w * DPR)
    this.canvas.height = Math.round(h * DPR)
    
    // Update stage container size
    const stage = document.getElementById('haloStage')
    if (stage) {
      // Calculate max size that fits in viewport while maintaining aspect ratio
      const maxWidth = window.innerWidth * 0.9
      const maxHeight = window.innerHeight * 0.9
      
      let stageWidth = w
      let stageHeight = h
      
      // Scale down if too large
      if (stageWidth > maxWidth || stageHeight > maxHeight) {
        const scaleX = maxWidth / stageWidth
        const scaleY = maxHeight / stageHeight
        const scale = Math.min(scaleX, scaleY)
        
        stageWidth = stageWidth * scale
        stageHeight = stageHeight * scale
      }
      
      stage.style.width = `${stageWidth}px`
      stage.style.height = `${stageHeight}px`
      
      // Canvas fills the stage
      this.canvas.style.width = '100%'
      this.canvas.style.height = '100%'
      
      // Update diagnostics size after stage size changes
      setTimeout(() => updateDiagnosticsForStage(), 10)
    }
    
    // Scale context for device pixel ratio
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.scale(DPR, DPR)
    
    console.log('Canvas size updated:', { aspect: this.currentAspect, w, h, DPR })
  }

  getVideoElement(): HTMLVideoElement {
    return this.video
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx
  }

  drawFrame(): void {
    if (!this.isActive || this.video.videoWidth === 0) return
    
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height)
  }

  

  

  getDimensions(): { width: number; height: number } {
    return {
      width: this.canvas.width / Math.max(1, window.devicePixelRatio || 1),
      height: this.canvas.height / Math.max(1, window.devicePixelRatio || 1)
    }
  }

  getVideoResolution(): { width: number; height: number } {
    return { width: this.video.videoWidth, height: this.video.videoHeight }
  }

  getCurrentDeviceId(): string | null {
    return this.currentDeviceId
  }

  getCurrentAspect(): VideoAspect {
    return this.currentAspect
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
    this.isActive = false
  }

  isRunning(): boolean {
    return this.isActive && this.video.readyState >= 2
  }
}
