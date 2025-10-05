import { CaptureData } from '../types'
import { WATERMARK_TEXT, CAPTURE_QUALITY } from '../constants'
import { VideoAspect, getResolutionForAspect } from '../renderer/config'

export class CaptureSystem {
  private captures: CaptureData[] = []
  private currentCapture: CaptureData | null = null

  captureFrame(
    canvas: HTMLCanvasElement, 
    gesture: string, 
    watermarkEnabled: boolean = true,
    aspect: VideoAspect = '9:16'
  ): CaptureData {
    // Create a new canvas for the final image using the current aspect
    const finalCanvas = document.createElement('canvas')
    const finalCtx = finalCanvas.getContext('2d')!
    
    // Set dimensions based on aspect ratio
    const { w, h } = getResolutionForAspect(aspect)
    finalCanvas.width = w
    finalCanvas.height = h
    
    // Draw the original canvas to the final canvas
    finalCtx.drawImage(canvas, 0, 0, w, h)
    
    // Add watermark if enabled
    if (watermarkEnabled) {
      this.addWatermark(finalCtx, finalCanvas.width, finalCanvas.height)
    }
    
    // Convert to data URL
    const imageData = finalCanvas.toDataURL('image/png', CAPTURE_QUALITY)
    
    const capture: CaptureData = {
      id: this.generateId(),
      imageData,
      gesture,
      timestamp: Date.now()
    }
    
    this.captures.push(capture)
    this.currentCapture = capture
    
    return capture
  }

  private addWatermark(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const fontSize = Math.max(12, width * 0.015)
    const padding = 20
    
    ctx.save()
    ctx.font = `${fontSize}px Arial`
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    
    const x = width - padding
    const y = height - padding
    
    ctx.fillText(WATERMARK_TEXT, x, y)
    ctx.restore()
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  getCurrentCapture(): CaptureData | null {
    return this.currentCapture
  }

  getAllCaptures(): CaptureData[] {
    return [...this.captures]
  }

  getCaptureById(id: string): CaptureData | null {
    return this.captures.find(capture => capture.id === id) || null
  }

  clearCaptures(): void {
    this.captures = []
    this.currentCapture = null
  }
}

export class QRCodeGenerator {
  static async generateQRCode(data: string): Promise<string> {
    try {
      const QRCode = (await import('qrcode')).default
      return await QRCode.toDataURL(data, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
    } catch (error) {
      console.error('Failed to generate QR code:', error)
      return ''
    }
  }
}
