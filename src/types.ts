export interface Point {
  x: number
  y: number
}

export interface Landmark {
  x: number
  y: number
  z?: number
  visibility?: number
}

export interface HandLandmarks {
  wrist: Landmark
  thumb_cmc: Landmark
  thumb_mcp: Landmark
  thumb_ip: Landmark
  thumb_tip: Landmark
  index_mcp: Landmark
  index_pip: Landmark
  index_dip: Landmark
  index_tip: Landmark
  middle_mcp: Landmark
  middle_pip: Landmark
  middle_dip: Landmark
  middle_tip: Landmark
  ring_mcp: Landmark
  ring_pip: Landmark
  ring_dip: Landmark
  ring_tip: Landmark
  pinky_mcp: Landmark
  pinky_pip: Landmark
  pinky_dip: Landmark
  pinky_tip: Landmark
}

export interface PoseLandmarks {
  nose: Landmark
  left_hip: Landmark
  right_hip: Landmark
  left_wrist: Landmark
  right_wrist: Landmark
  left_shoulder: Landmark
  right_shoulder: Landmark
  left_elbow: Landmark
  right_elbow: Landmark
}

export interface DetectionFrame {
  timestamp: number
  pose?: PoseLandmarks
  hands?: {
    left?: HandLandmarks
    right?: HandLandmarks
  }
}

export interface GestureState {
  type: string
  confidence: number
  locked: boolean
  stabilityCount: number
}

export interface CaptureData {
  id: string
  imageData: string
  gesture: string
  timestamp: number
}
