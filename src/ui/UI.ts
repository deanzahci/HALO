import { GestureState, CaptureData } from '../types'
import { GestureType } from '../constants'
import { getDeviceLabel } from '../utils/camera'

export class UI {
  private container: HTMLElement
  private gestureStatus!: HTMLElement
  private gestureMenu!: HTMLElement
  private controls!: HTMLElement
  private haloWall!: HTMLElement
  private shareModal: HTMLElement | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.createUI()
  }

  private createUI(): void {
    this.container.innerHTML = `
      <div class="ui-overlay">
        <!-- Big centered countdown overlay (hidden by default) -->
        <div id="big-countdown" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;display:none;z-index:1001;">
          <div id="big-countdown-text" style="font-weight:bold;font-size:160px;color:white;text-align:center;text-shadow:0 0 30px rgba(255,255,255,0.9);">5</div>
        </div>
        <!-- Gesture Status -->
        <div class="gesture-status" id="gesture-status">
          <span class="status-text">None</span>
        </div>

        <!-- Gesture Menu -->
        <div class="gesture-menu" id="gesture-menu">
          <div class="gesture-item" data-gesture="THUMBS_UP_HALO">
            <div class="gesture-icon">👍</div>
            <div class="gesture-label">Thumbs Up</div>
          </div>
          <div class="gesture-item" data-gesture="TWO_HAND_HEART">
            <div class="gesture-icon">💖</div>
            <div class="gesture-label">Heart Hands</div>
          </div>
          <div class="gesture-item" data-gesture="ROCK_SIGN">
            <div class="gesture-icon">⚡</div>
            <div class="gesture-label">Rock Sign</div>
          </div>
          <div class="gesture-item" data-gesture="POINT_SPARKLES">
            <div class="gesture-icon">✨</div>
            <div class="gesture-label">Finger Point</div>
          </div>
          <div class="gesture-item" data-gesture="PEACE_SIGN">
            <div class="gesture-icon">🎈</div>
            <div class="gesture-label">Peace Sign</div>
          </div>
        </div>

        <!-- Controls -->
        <div class="controls" id="controls">
          <button class="control-btn" id="capture-btn">Capture (C)</button>
          <button class="control-btn" id="reset-btn">Reset</button>
          <button class="control-btn" id="share-btn" style="display: none;">Share</button>
          <button class="control-btn" id="diag-toggle">Diagnostics: On (D)</button>
          
          <!-- Camera and Aspect Controls -->
          <div class="device-controls">
            <select id="cameraSelect" class="device-select">
              <option value="">Loading cameras...</option>
            </select>
            <div class="aspect-toggle">
              <button class="aspect-btn" data-aspect="16:9">16:9</button>
              <button class="aspect-btn active" data-aspect="9:16">9:16</button>
            </div>
          </div>
          
          <div class="watermark-toggle">
            <label>
              <input type="checkbox" id="watermark-toggle" checked>
              Watermark
            </label>
          </div>
          <!-- Timer selection -->
          <div class="timer-select" style="margin-left: 12px; display: flex; gap: 6px; align-items: center;">
            <label style="color: white; font-size: 12px;">Timer:</label>
            <button class="timer-btn" data-seconds="3">3s</button>
            <button class="timer-btn active" data-seconds="5">5s</button>
            <button class="timer-btn" data-seconds="10">10s</button>
          </div>
        </div>

        <!-- Halo Wall -->
        <div class="halo-wall" id="halo-wall">
          <h3>Halo Wall</h3>
          <div class="wall-grid" id="wall-grid"></div>
        </div>

        <!-- Perf HUD -->
        <div class="perf-hud" id="perf-hud">—</div>
      </div>

      <style>
        .ui-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 10;
        }

        .gesture-status {
          position: absolute;
          top: 20px;
          left: 20px;
          background: rgba(0, 0, 0, 0.7);
          padding: 10px 15px;
          border-radius: 20px;
          color: white;
          font-size: 14px;
          font-weight: bold;
          pointer-events: auto;
        }

        .gesture-menu {
          position: absolute;
          top: 20px;
          right: 20px;
          display: flex;
          gap: 10px;
          pointer-events: auto;
        }

        .gesture-item {
          background: rgba(0, 0, 0, 0.7);
          padding: 10px;
          border-radius: 10px;
          text-align: center;
          color: white;
          cursor: pointer;
          transition: all 0.3s ease;
          min-width: 60px;
        }

        .gesture-item:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .gesture-item.active {
          background: rgba(255, 255, 0, 0.3);
          border: 2px solid #ffff00;
        }

        .gesture-icon {
          font-size: 20px;
          margin-bottom: 5px;
        }

        .gesture-label {
          font-size: 12px;
          font-weight: bold;
        }

        .controls {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 10px;
          align-items: center;
          pointer-events: auto;
        }

        .control-btn {
          background: rgba(0, 0, 0, 0.8);
          color: white;
          border: 2px solid #333;
          padding: 12px 20px;
          border-radius: 25px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
          transition: all 0.3s ease;
        }

        .control-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: #666;
        }

        .control-btn:active {
          transform: scale(0.95);
        }

        .device-controls {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: center;
          margin: 0 10px;
        }

        .device-select {
          background: rgba(0, 0, 0, 0.8);
          color: #fff;
          border: 1px solid #444;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 12px;
          min-width: 120px;
        }

        .device-select:focus {
          outline: none;
          border-color: #007AFF;
        }

        .aspect-toggle {
          display: flex;
          gap: 2px;
          background: rgba(0, 0, 0, 0.6);
          border-radius: 6px;
          padding: 2px;
        }

        .aspect-btn {
          background: transparent;
          color: #ccc;
          border: none;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .aspect-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .aspect-btn.active {
          background: #007AFF;
          color: #fff;
        }

        .watermark-toggle {
          color: white;
          font-size: 14px;
          margin-left: 20px;
        }

        .watermark-toggle label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .halo-wall {
          position: absolute;
          bottom: 20px;
          right: 20px;
          background: rgba(0, 0, 0, 0.8);
          padding: 15px;
          border-radius: 10px;
          max-width: 300px;
          max-height: 400px;
          overflow-y: auto;
          pointer-events: auto;
        }

        .halo-wall h3 {
          color: white;
          margin: 0 0 10px 0;
          font-size: 16px;
        }

        .wall-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 10px;
        }

        .wall-thumbnail {
          width: 80px;
          height: 80px;
          border-radius: 8px;
          cursor: pointer;
          object-fit: cover;
          border: 2px solid transparent;
          transition: all 0.3s ease;
        }

        .wall-thumbnail:hover {
          border-color: #ffff00;
          transform: scale(1.05);
        }

        .share-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          pointer-events: auto;
        }

        .share-modal-content {
          background: white;
          padding: 30px;
          border-radius: 15px;
          max-width: 500px;
          width: 90%;
          text-align: center;
          color: #333;
        }

        .share-modal h2 {
          margin: 0 0 20px 0;
          color: #333;
        }

        .share-preview {
          max-width: 100%;
          max-height: 300px;
          border-radius: 10px;
          margin: 20px 0;
        }

        .share-actions {
          display: flex;
          gap: 15px;
          justify-content: center;
          margin: 20px 0;
        }

        .share-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
        }

        .share-btn:hover {
          background: #0056b3;
        }

        .qr-code {
          margin: 20px 0;
        }

        /* Close button inside card (legacy) */
        .close-modal {
          position: absolute;
          top: 15px;
          right: 20px;
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
        }

        /* Close button above the card (centered) */
        .close-modal.above {
          position: absolute;
          left: 50%;
          top: 0;
          transform: translate(-50%, -100%); /* sit just above the top edge of the wrapper */
          margin-top: -12px; /* nudge 12px above the card */
          background: rgba(0,0,0,0.75);
          color: #fff;
          border-radius: 18px;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          border: none;
          cursor: pointer;
          z-index: 1002;
          box-shadow: 0 6px 18px rgba(0,0,0,0.45);
          transition: transform 120ms ease, background 120ms ease;
        }

        .close-modal.above:hover {
          transform: translate(-50%, -105% ) scale(1.02);
          background: rgba(0,0,0,0.85);
        }

        .diag {
          position: absolute;
          left: 16px;
          top: 16px;
          width: 240px;
          height: 180px;
          border-radius: 12px;
          background: rgba(17, 17, 17, 0.8);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
          z-index: 5;
        }

        .perf-hud {
          position: absolute;
          left: 16px;
          bottom: 16px;
          background: rgba(0, 0, 0, 0.7);
          color: #fff;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 12px;
          line-height: 1;
          pointer-events: none;
        }
      </style>
    `

    this.gestureStatus = this.container.querySelector('#gesture-status')!
    this.gestureMenu = this.container.querySelector('#gesture-menu')!
    this.controls = this.container.querySelector('#controls')!
    this.haloWall = this.container.querySelector('#halo-wall')!
    // Initialize timer button handlers
    this.initTimerButtons()
  }

  updateGestureStatus(state: GestureState): void {
    const statusText = this.gestureStatus.querySelector('.status-text') as HTMLElement
    
    if (state.locked) {
      statusText.textContent = `Locked: ${this.getGestureDisplayName(state.type)}`
      statusText.style.color = '#00ff00'
    } else if (state.type !== 'NONE') {
      statusText.textContent = `Detecting: ${this.getGestureDisplayName(state.type)}`
      statusText.style.color = '#ffff00'
    } else {
      statusText.textContent = 'None'
      statusText.style.color = '#ffffff'
    }

    // Update active gesture in menu
    this.gestureMenu.querySelectorAll('.gesture-item').forEach(item => {
      item.classList.remove('active')
      if (item.getAttribute('data-gesture') === state.type) {
        item.classList.add('active')
      }
    })
  }

  updatePerfHud(width: number, height: number, fps: number): void {
    const hud = this.container.querySelector('#perf-hud') as HTMLElement
    const res = (width && height) ? `${width}×${height}` : '—'
    const fpsText = Number.isFinite(fps) && fps > 0 ? `${Math.round(fps)} fps` : '— fps'
    hud.textContent = `${res} • ${fpsText}`
  }

  private getGestureDisplayName(gesture: string): string {
    const names: { [key: string]: string } = {
      'THUMBS_UP_HALO': 'Thumbs Up',
      'TWO_HAND_HEART': 'Heart Hands',
      'ROCK_SIGN': 'Rock Sign',
      'POINT_SPARKLES': 'Finger Point',
      'PEACE_SIGN': 'Peace Sign'
    }
    return names[gesture] || gesture
  }

  addThumbnailToWall(capture: CaptureData): void {
    const wallGrid = this.haloWall.querySelector('#wall-grid')!
    
    const thumbnail = document.createElement('img')
    thumbnail.src = capture.imageData
    thumbnail.className = 'wall-thumbnail'
    thumbnail.title = `${this.getGestureDisplayName(capture.gesture)} - ${new Date(capture.timestamp).toLocaleTimeString()}`
    
    thumbnail.addEventListener('click', () => {
      this.showShareModal(capture)
    })
    
    wallGrid.appendChild(thumbnail)
  }

  showShareModal(capture: CaptureData): void {
    this.hideShareModal() // Remove existing modal if any
    
    const modal = document.createElement('div')
    modal.className = 'share-modal'
    modal.innerHTML = `
      <div class="share-modal-content-wrapper" style="position:relative; display:inline-block;">
        <div class="share-modal-content">
          <h2>Share Your Halo</h2>
          <img src="${capture.imageData}" class="share-preview" alt="Captured image">
          <div class="share-actions">
            <button class="share-btn" id="download-btn">Download PNG</button>
          </div>
          <div class="qr-code" id="qr-container"></div>
        </div>
        <button class="close-modal above" aria-label="Close">&times;</button>
      </div>
    `
    
    document.body.appendChild(modal)
    this.shareModal = modal
    
    // Add event listeners
  // Prefer the above close button if present
  const aboveBtn = modal.querySelector('.close-modal.above')
  const insideBtn = modal.querySelector('.close-modal')
  ;(aboveBtn || insideBtn)!.addEventListener('click', () => this.hideShareModal())
    modal.querySelector('#download-btn')!.addEventListener('click', () => this.downloadImage(capture))
    
    // Generate QR code
    this.generateQRCode(capture.imageData, modal.querySelector('#qr-container') as HTMLElement)
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideShareModal()
      }
    })
  }

  // Simple capture shutter sound using WebAudio API
  playCaptureSound(): void {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'triangle'
      o.frequency.setValueAtTime(1000, ctx.currentTime)
      g.gain.setValueAtTime(0, ctx.currentTime)
      g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.001)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
      o.connect(g)
      g.connect(ctx.destination)
      o.start()
      o.stop(ctx.currentTime + 0.3)
    } catch (error) {
      // ignore if audio not available
      console.warn('Could not play capture sound', error)
    }
  }

  private async generateQRCode(dataUrl: string, container: HTMLElement): Promise<void> {
    try {
      const QRCode = (await import('qrcode')).default
      const qrDataUrl = await QRCode.toDataURL(dataUrl, {
        width: 150,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      
      container.innerHTML = `
        <img src="${qrDataUrl}" alt="QR Code" style="max-width: 150px;">
        <p style="font-size: 12px; color: #666; margin-top: 10px;">Scan to view on phone</p>
      `
    } catch (error) {
      console.error('Failed to generate QR code:', error)
      container.innerHTML = '<p style="color: #666;">QR code unavailable</p>'
    }
  }

  private downloadImage(capture: CaptureData): void {
    const link = document.createElement('a')
    link.download = `halo-${capture.id}.png`
    link.href = capture.imageData
    link.click()
  }

  hideShareModal(): void {
    if (this.shareModal) {
      this.shareModal.remove()
      this.shareModal = null
    }
  }

  showShareButton(): void {
    const shareBtn = this.controls.querySelector('#share-btn') as HTMLElement
    shareBtn.style.display = 'block'
  }

  hideShareButton(): void {
    const shareBtn = this.controls.querySelector('#share-btn') as HTMLElement
    shareBtn.style.display = 'none'
  }

  getWatermarkEnabled(): boolean {
    const toggle = this.controls.querySelector('#watermark-toggle') as HTMLInputElement
    return toggle.checked
  }

  onCaptureClick(callback: () => void): void {
    this.controls.querySelector('#capture-btn')!.addEventListener('click', callback)
  }

  // Update the capture button to display a countdown (secondsLeft > 0)
  // or reset text when secondsLeft is 0.
  updateCaptureCountdown(secondsLeft: number): void {
    const btn = this.controls.querySelector('#capture-btn') as HTMLButtonElement
    if (!btn) return

    if (secondsLeft > 0) {
      btn.textContent = `Capture (${secondsLeft})`
      btn.classList.add('countdown')
    } else {
      btn.textContent = 'Capture (C)'
      btn.classList.remove('countdown')
    }
  }

  onResetClick(callback: () => void): void {
    this.controls.querySelector('#reset-btn')!.addEventListener('click', callback)
  }

  onShareClick(callback: () => void): void {
    this.controls.querySelector('#share-btn')!.addEventListener('click', callback)
  }

  onManualGestureSelect(callback: (gesture: GestureType) => void): void {
    this.gestureMenu.querySelectorAll('.gesture-item').forEach(item => {
      item.addEventListener('click', () => {
        const gesture = item.getAttribute('data-gesture') as GestureType
        callback(gesture)
      })
    })
  }

  onDiagnosticsToggle(callback: (enabled: boolean) => void): void {
    const toggle = this.controls.querySelector('#diag-toggle')!
    toggle.addEventListener('click', () => {
      const currentText = toggle.textContent!
      const isEnabled = currentText.includes('On')
      const newEnabled = !isEnabled
      toggle.textContent = `Diagnostics: ${newEnabled ? 'On' : 'Off'} (D)`
      callback(newEnabled)
    })
  }

  updateDiagnosticsToggle(enabled: boolean): void {
    const toggle = this.controls.querySelector('#diag-toggle')!
    toggle.textContent = `Diagnostics: ${enabled ? 'On' : 'Off'} (D)`
  }

  populateCameraSelector(devices: MediaDeviceInfo[], currentDeviceId: string | null): void {
    const select = this.controls.querySelector('#cameraSelect') as HTMLSelectElement
    select.innerHTML = ''
    
    devices.forEach(device => {
      const option = document.createElement('option')
      option.value = device.deviceId
      option.textContent = getDeviceLabel(device)
      option.selected = device.deviceId === currentDeviceId
      select.appendChild(option)
    })
  }

  onCameraChange(callback: (deviceId: string) => void): void {
    const select = this.controls.querySelector('#cameraSelect') as HTMLSelectElement
    select.addEventListener('change', () => {
      callback(select.value)
    })
  }

  onAspectChange(callback: (aspect: '16:9' | '9:16') => void): void {
    const buttons = this.controls.querySelectorAll('.aspect-btn')
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const aspect = button.getAttribute('data-aspect') as '16:9' | '9:16'
        
        // Update active state
        buttons.forEach(btn => btn.classList.remove('active'))
        button.classList.add('active')
        
        callback(aspect)
      })
    })
  }

  // Capture timer selection (3/5/10s)
  getCaptureTimerSeconds(): number {
    const active = this.controls.querySelector('.timer-btn.active') as HTMLElement | null
    if (!active) return 5
    return Number(active.getAttribute('data-seconds')) || 5
  }

  private initTimerButtons(): void {
    const buttons = this.controls.querySelectorAll('.timer-btn')
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
      })
    })
  }

  // Big centered countdown overlay controls
  showBigCountdown(secondsLeft: number): void {
    const wrapper = document.getElementById('big-countdown')
    const text = document.getElementById('big-countdown-text')
    if (!wrapper || !text) return
    text.textContent = String(secondsLeft)
    wrapper.style.display = 'block'
  }

  updateBigCountdown(secondsLeft: number): void {
    const text = document.getElementById('big-countdown-text')
    if (!text) return
    text.textContent = String(secondsLeft)
  }

  hideBigCountdown(): void {
    const wrapper = document.getElementById('big-countdown')
    if (!wrapper) return
    wrapper.style.display = 'none'
  }

  setAspect(aspect: '16:9' | '9:16'): void {
    const buttons = this.controls.querySelectorAll('.aspect-btn')
    buttons.forEach(button => {
      const buttonAspect = button.getAttribute('data-aspect') as '16:9' | '9:16'
      button.classList.toggle('active', buttonAspect === aspect)
    })
  }
}



