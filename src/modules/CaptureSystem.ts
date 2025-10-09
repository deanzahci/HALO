import { CaptureData } from '../types'
import { WATERMARK_TEXT } from '../constants'
import { VideoAspect, getResolutionForAspect } from '../renderer/config'

let watermarkImg: HTMLImageElement | null = null

async function loadWatermark(): Promise<HTMLImageElement> {
  if (watermarkImg) return watermarkImg
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { watermarkImg = img; resolve(img) }
    img.onerror = reject
    img.src = '/watermark.png'
  })
}

export class CaptureSystem {
  private captures: CaptureData[] = []
  private currentCapture: CaptureData | null = null

  async captureFrame(
    canvas: HTMLCanvasElement, 
    gesture: string, 
    watermarkEnabled: boolean = true,
    aspect: VideoAspect = '9:16'
  ): Promise<CaptureData> {
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
      await this.addWatermark(finalCtx, finalCanvas.width, finalCanvas.height)
    }
    
    // Convert to data URL
    const imageData = finalCanvas.toDataURL('image/png')
    
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

  private async addWatermark(ctx: CanvasRenderingContext2D, width: number, height: number): Promise<void> {
    const padding = 20
    try {
      const img = await loadWatermark()
      const targetH = Math.max(24, Math.floor(height * 0.06))
      const aspect = img.naturalWidth / img.naturalHeight
      const targetW = Math.floor(targetH * aspect)
      ctx.drawImage(img, width - padding - targetW, height - padding - targetH, targetW, targetH)
    } catch (_err) {
      const fontSize = Math.max(68, width * 0.015)
      ctx.save()
      ctx.font = `${fontSize}px Orbitron, Arial, sans-serif`
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(WATERMARK_TEXT, width - padding, height - padding)
      ctx.restore()
    }

    // Add futuristic text alongside the image watermark
    try {
      const label = 'HCI × halo'
      const textSize = Math.max(68, width * 0.016)
      ctx.save()
      ctx.font = `${textSize}px Orbitron, Arial, sans-serif`
      ctx.fillStyle = 'rgb(255, 255, 255)'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      // Place at bottom-left with padding
      ctx.fillText(label, padding, height - padding)
      ctx.restore()
    } catch {}
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
