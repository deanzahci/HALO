import { MPResults } from './mediapipe'

let diagCanvas: HTMLCanvasElement | null = null
let diagCtx: CanvasRenderingContext2D | null = null
let videoElement: HTMLVideoElement | null = null
let isEnabled = true

export function initDiagnostics(canvas: HTMLCanvasElement, video: HTMLVideoElement): void {
  diagCanvas = canvas
  diagCtx = canvas.getContext('2d')
  videoElement = video
  
  // Set responsive canvas size (16:9 aspect ratio)
  const baseWidth = 200
  const baseHeight = 150
  canvas.width = baseWidth
  canvas.height = baseHeight
  
  // Update diagnostics size when stage changes
  updateDiagnosticsSize()
}

function updateDiagnosticsSize(): void {
  if (!diagCanvas) return
  
  const stage = document.getElementById('haloStage')
  if (!stage) return
  
  const stageWidth = stage.clientWidth
  const stageHeight = stage.clientHeight
  
  // Calculate diagnostics size as percentage of stage (max 25% width)
  const maxWidth = Math.min(stageWidth * 0.25, 200)
  const diagHeight = maxWidth * (9 / 16) // Maintain 16:9 aspect
  
  // Ensure diagnostics doesn't overflow stage
  if (diagHeight > stageHeight * 0.3) {
    const maxHeight = stageHeight * 0.3
    const diagWidth = maxHeight * (16 / 9)
    diagCanvas.style.width = `${diagWidth}px`
    diagCanvas.style.height = `${maxHeight}px`
  } else {
    diagCanvas.style.width = `${maxWidth}px`
    diagCanvas.style.height = `${diagHeight}px`
  }
  
  // Update internal canvas resolution
  const rect = diagCanvas.getBoundingClientRect()
  diagCanvas.width = rect.width
  diagCanvas.height = rect.height
}

export function drawDiagnostics(mp: MPResults): void {
  if (!diagCtx || !videoElement || !isEnabled) return

  const ctx = diagCtx
  const canvas = diagCanvas!
  
  // Clear canvas
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // Draw video frame (downscaled)
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
  
  // Draw pose skeleton
  if (mp.pose) {
    drawPoseSkeleton(ctx, mp.pose, canvas.width, canvas.height)
  }
  
  // Draw hand landmarks
  if (mp.hands) {
    if (mp.hands.left) {
      drawHandLandmarks(ctx, mp.hands.left, canvas.width, canvas.height, '#00ff00')
    }
    if (mp.hands.right) {
      drawHandLandmarks(ctx, mp.hands.right, canvas.width, canvas.height, '#ff0000')
    }
  }
}

function drawPoseSkeleton(ctx: CanvasRenderingContext2D, pose: { [k: string]: [number, number] }, width: number, height: number): void {
  ctx.strokeStyle = '#ffff00'
  ctx.lineWidth = 2
  
  // Draw pose connections
  const connections = [
    ['left_shoulder', 'right_shoulder'],
    ['left_shoulder', 'left_elbow'],
    ['left_elbow', 'left_wrist'],
    ['right_shoulder', 'right_elbow'],
    ['right_elbow', 'right_wrist'],
    ['left_shoulder', 'left_hip'],
    ['right_shoulder', 'right_hip'],
    ['left_hip', 'right_hip']
  ]
  
  connections.forEach(([start, end]) => {
    const startPoint = pose[start]
    const endPoint = pose[end]
    
    if (startPoint && endPoint) {
      ctx.beginPath()
      ctx.moveTo(startPoint[0] * width, startPoint[1] * height)
      ctx.lineTo(endPoint[0] * width, endPoint[1] * height)
      ctx.stroke()
    }
  })
  
  // Draw pose landmarks
  ctx.fillStyle = '#ffff00'
  Object.values(pose).forEach(([x, y]) => {
    ctx.beginPath()
    ctx.arc(x * width, y * height, 3, 0, 2 * Math.PI)
    ctx.fill()
  })
}

function drawHandLandmarks(ctx: CanvasRenderingContext2D, hand: Record<string, [number, number]>, width: number, height: number, color: string): void {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1
  
  // Draw hand connections
  const connections = [
    ['wrist', 'thumb_cmc'],
    ['thumb_cmc', 'thumb_mcp'],
    ['thumb_mcp', 'thumb_ip'],
    ['thumb_ip', 'thumb_tip'],
    ['wrist', 'index_mcp'],
    ['index_mcp', 'index_pip'],
    ['index_pip', 'index_dip'],
    ['index_dip', 'index_tip'],
    ['wrist', 'middle_mcp'],
    ['middle_mcp', 'middle_pip'],
    ['middle_pip', 'middle_dip'],
    ['middle_dip', 'middle_tip'],
    ['wrist', 'ring_mcp'],
    ['ring_mcp', 'ring_pip'],
    ['ring_pip', 'ring_dip'],
    ['ring_dip', 'ring_tip'],
    ['wrist', 'pinky_mcp'],
    ['pinky_mcp', 'pinky_pip'],
    ['pinky_pip', 'pinky_dip'],
    ['pinky_dip', 'pinky_tip']
  ]
  
  connections.forEach(([start, end]) => {
    const startPoint = hand[start]
    const endPoint = hand[end]
    
    if (startPoint && endPoint) {
      ctx.beginPath()
      ctx.moveTo(startPoint[0] * width, startPoint[1] * height)
      ctx.lineTo(endPoint[0] * width, endPoint[1] * height)
      ctx.stroke()
    }
  })
  
  // Draw hand landmarks with highlights for fingertips
  Object.entries(hand).forEach(([key, [x, y]]) => {
    const isFingertip = key === 'thumb_tip' || key === 'index_tip' || key === 'middle_tip' || key === 'ring_tip' || key === 'pinky_tip'
    
    ctx.beginPath()
    const radius = isFingertip ? 4 : 2
    const highlightColor = isFingertip ? '#FF00FF' : color // Magenta for fingertips
    ctx.fillStyle = highlightColor
    ctx.arc(x * width, y * height, radius, 0, 2 * Math.PI)
    ctx.fill()
  })
}

export function setDiagnosticsEnabled(on: boolean): void {
  isEnabled = on
  if (diagCanvas) {
    diagCanvas.style.display = on ? 'block' : 'none'
  }
}

export function updateDiagnosticsForStage(): void {
  updateDiagnosticsSize()
}
