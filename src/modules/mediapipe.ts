import { FilesetResolver, PoseLandmarker, HandLandmarker } from '@mediapipe/tasks-vision'

export type MPResults = {
  pose: { [k: string]: [number, number] }   // normalized 0..1, keys: nose, left_hip, right_hip, left_wrist, right_wrist, left_shoulder, right_shoulder, left_elbow, right_elbow
  hands: { left?: Record<string,[number,number]>, right?: Record<string,[number,number]> }
  raw: { pose: any, hands: any }            // pass-through original results for drawing
}

let poseLandmarker: PoseLandmarker | null = null
let handLandmarker: HandLandmarker | null = null
let videoElement: HTMLVideoElement | null = null
let isInitialized = false

export async function initMediaPipe(video: HTMLVideoElement): Promise<void> {
  try {
    videoElement = video
    
    // Initialize the vision task fileset
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    )

    // Initialize Pose Landmarker
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    })

    // Initialize Hand Landmarker
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    })

    isInitialized = true
    console.log('MediaPipe initialized successfully')
  } catch (error) {
    console.error('Failed to initialize MediaPipe:', error)
    throw error
  }
}

export function processFrame(): MPResults | null {
  if (!isInitialized || !videoElement || !poseLandmarker || !handLandmarker) {
    return null
  }

  try {
    // Process pose landmarks
    const poseResults = poseLandmarker.detectForVideo(videoElement, performance.now())
    const poseLandmarks: { [k: string]: [number, number] } = {}
    
    if (poseResults.landmarks && poseResults.landmarks.length > 0) {
      const landmarks = poseResults.landmarks[0]
      
      // Map MediaPipe pose landmarks to our schema
      const poseMap: { [key: string]: number } = {
        'nose': 0, 'left_shoulder': 11, 'right_shoulder': 12,
        'left_elbow': 13, 'right_elbow': 14, 'left_wrist': 15, 'right_wrist': 16,
        'left_hip': 23, 'right_hip': 24
      }
      
      for (const [name, index] of Object.entries(poseMap)) {
        if (landmarks[index]) {
          poseLandmarks[name] = [landmarks[index].x, landmarks[index].y]
        }
      }
    }

    // Process hand landmarks
    const handResults = handLandmarker.detectForVideo(videoElement, performance.now())
    const hands: { left?: Record<string,[number,number]>, right?: Record<string,[number,number]> } = {}
    
    if (handResults.landmarks && handResults.landmarks.length > 0) {
      const handedness = handResults.handednesses || []
      
      handResults.landmarks.forEach((landmarkList, index) => {
        const handednessInfo = handedness[index]?.[0]
        const handType = handednessInfo?.categoryName?.toLowerCase()
        
        if (handType === 'left' || handType === 'right') {
          const handLandmarks: Record<string, [number, number]> = {}
          
          // Map MediaPipe hand landmarks to our schema
          const handMap: { [key: string]: number } = {
            'wrist': 0, 'thumb_cmc': 1, 'thumb_mcp': 2, 'thumb_ip': 3, 'thumb_tip': 4,
            'index_mcp': 5, 'index_pip': 6, 'index_dip': 7, 'index_tip': 8,
            'middle_mcp': 9, 'middle_pip': 10, 'middle_dip': 11, 'middle_tip': 12,
            'ring_mcp': 13, 'ring_pip': 14, 'ring_dip': 15, 'ring_tip': 16,
            'pinky_mcp': 17, 'pinky_pip': 18, 'pinky_dip': 19, 'pinky_tip': 20
          }
          
          for (const [name, landmarkIndex] of Object.entries(handMap)) {
            if (landmarkList[landmarkIndex]) {
              handLandmarks[name] = [landmarkList[landmarkIndex].x, landmarkList[landmarkIndex].y]
            }
          }
          
          hands[handType] = handLandmarks
        }
      })
    }

    return {
      pose: poseLandmarks,
      hands: hands,
      raw: { pose: poseResults, hands: handResults }
    }
  } catch (error) {
    console.error('Error processing frame:', error)
    return null
  }
}

export function destroyMediaPipe(): void {
  poseLandmarker = null
  handLandmarker = null
  videoElement = null
  isInitialized = false
}
