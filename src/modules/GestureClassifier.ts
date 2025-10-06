import { GestureState } from '../types'
import { GestureType, HEART_THRESHOLD, STABILITY_FRAMES, LOST_GRACE_FRAMES, FINGER_EXTENDED_ANGLE } from '../constants'
import { MPResults } from './mediapipe'

export class GestureClassifier {
  private currentState: GestureState = {
    type: 'NONE',
    confidence: 0,
    locked: false,
    stabilityCount: 0
  }

  
  private graceFramesRemaining = 0

  classifyFrame(mpResults: MPResults): { type: GestureType; confidence: number } {
    if (!mpResults.pose && !mpResults.hands) {
      return { type: 'NONE', confidence: 0 }
    }

    // Check each gesture type
    const gestures = [
      this.detectThumbsUp(mpResults),
      this.detectTwoHandHeart(mpResults),
      this.detectRockSign(mpResults),
      this.detectFingerPoint(mpResults),
      this.detectPeaceSign(mpResults)
    ]

    // Find the gesture with highest confidence
    const bestGesture = gestures.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    )

    return bestGesture
  }

  updateState(mpResults: MPResults): GestureState {
    const { type, confidence } = this.classifyFrame(mpResults)

    // If we have a locked gesture and it's still the same type, keep it
    if (this.currentState.locked && this.currentState.type === type) {
      return this.currentState
    }

    // If we have a locked gesture but it's different, start grace period
    if (this.currentState.locked && this.currentState.type !== type) {
      if (this.graceFramesRemaining > 0) {
        this.graceFramesRemaining--
        return this.currentState
      } else {
        // Grace period expired, unlock
        this.currentState.locked = false
        this.currentState.stabilityCount = 0
      }
    }

    // If we're detecting the same gesture as before, increment stability
    if (this.currentState.type === type && type !== 'NONE') {
      this.currentState.stabilityCount++
      this.currentState.confidence = Math.max(this.currentState.confidence, confidence)
      
            // Check if we should lock this gesture
            if (this.currentState.stabilityCount >= STABILITY_FRAMES) {
              this.currentState.locked = true
              
              this.graceFramesRemaining = LOST_GRACE_FRAMES
            }
    } else {
      // Different gesture or none detected, reset
      this.currentState.type = type
      this.currentState.confidence = confidence
      this.currentState.stabilityCount = 1
    }

    return this.currentState
  }

  private detectThumbsUp(mpResults: MPResults): { type: GestureType; confidence: number } {
    if (!mpResults.hands) return { type: 'NONE', confidence: 0 }

    // Check both hands, return the best result
    let bestResult = { type: 'NONE' as GestureType, confidence: 0 }

    if (mpResults.hands.left) {
      const leftResult = this.checkThumbsUpHand(mpResults.hands.left)
      if (leftResult.confidence > bestResult.confidence) {
        bestResult = leftResult
      }
    }

    if (mpResults.hands.right) {
      const rightResult = this.checkThumbsUpHand(mpResults.hands.right)
      if (rightResult.confidence > bestResult.confidence) {
        bestResult = rightResult
      }
    }

    return bestResult
  }

  private checkThumbsUpHand(hand: Record<string, [number, number]>): { type: GestureType; confidence: number } {
    // Check if thumb is extended upward (thumb_tip above thumb_ip)
    const thumb_tip = hand.thumb_tip
    const thumb_ip = hand.thumb_ip
    
    if (!thumb_tip || !thumb_ip) return { type: 'NONE', confidence: 0 }

    const thumbExtended = thumb_tip[1] < thumb_ip[1] // thumb_tip above thumb_ip (smaller y value)

    // Check if other fingers are curled (tips close to palm)
    const indexCurled = this.isFingerCurled(hand, 'index')
    const middleCurled = this.isFingerCurled(hand, 'middle')
    const ringCurled = this.isFingerCurled(hand, 'ring')
    const pinkyCurled = this.isFingerCurled(hand, 'pinky')

    if (thumbExtended && indexCurled && middleCurled && ringCurled && pinkyCurled) {
      // Calculate confidence based on how well the gesture matches
      const thumbConf = thumb_tip[1] < thumb_ip[1] ? 1.0 : 0.0
      const indexConf = this.getFingerCurlConfidence(hand, 'index')
      const middleConf = this.getFingerCurlConfidence(hand, 'middle')
      const ringConf = this.getFingerCurlConfidence(hand, 'ring')
      const pinkyConf = this.getFingerCurlConfidence(hand, 'pinky')

      const confidence = (thumbConf + indexConf + middleConf + ringConf + pinkyConf) / 5
      return { type: 'THUMBS_UP_HALO', confidence }
    }

    return { type: 'NONE', confidence: 0 }
  }

  private detectTwoHandHeart(mpResults: MPResults): { type: GestureType; confidence: number } {
    if (!mpResults.hands || !mpResults.hands.left || !mpResults.hands.right) {
      return { type: 'NONE', confidence: 0 }
    }

    const leftHand = mpResults.hands.left
    const rightHand = mpResults.hands.right

    // Check if both hands have thumb and index tips
    if (!leftHand.thumb_tip || !leftHand.index_tip || !rightHand.thumb_tip || !rightHand.index_tip) {
      return { type: 'NONE', confidence: 0 }
    }

    // Check if left thumb tip + right thumb tip are within small distance
    const thumbDistance = this.distance(leftHand.thumb_tip, rightHand.thumb_tip)
    const thumbsClose = thumbDistance < HEART_THRESHOLD

    // Check if left index tip + right index tip are within small distance
    const indexDistance = this.distance(leftHand.index_tip, rightHand.index_tip)
    const indexClose = indexDistance < HEART_THRESHOLD

    // Check if y-coordinates are roughly aligned (same vertical band)
    const yDiffThumbs = Math.abs(leftHand.thumb_tip[1] - rightHand.thumb_tip[1])
    const yDiffIndex = Math.abs(leftHand.index_tip[1] - rightHand.index_tip[1])
    const thumbsAligned = yDiffThumbs < 0.1 // within 10% of screen height
    const indexAligned = yDiffIndex < 0.1

    if (thumbsClose && indexClose && thumbsAligned && indexAligned) {
      const avgDistance = (thumbDistance + indexDistance) / 2
      const confidence = 1 - avgDistance / HEART_THRESHOLD
      return { type: 'TWO_HAND_HEART', confidence: Math.max(0, confidence) }
    }

    return { type: 'NONE', confidence: 0 }
  }

  private detectRockSign(mpResults: MPResults): { type: GestureType; confidence: number } {
    const hands = mpResults.hands
    if (!hands) return { type: 'NONE', confidence: 0 }

    // Check both hands, return the best result
    let bestResult = { type: 'NONE' as GestureType, confidence: 0 }

    if (hands.left) {
      const leftResult = this.checkRockSignHand(hands.left)
      if (leftResult.confidence > bestResult.confidence) {
        bestResult = leftResult
      }
    }

    if (hands.right) {
      const rightResult = this.checkRockSignHand(hands.right)
      if (rightResult.confidence > bestResult.confidence) {
        bestResult = rightResult
      }
    }

    return bestResult
  }

  private checkRockSignHand(hand: Record<string, [number, number]>): { type: GestureType; confidence: number } {
    const indexExtended = this.isFingerExtended(hand, 'index')
    const pinkyExtended = this.isFingerExtended(hand, 'pinky')
    const middleCurled = !this.isFingerExtended(hand, 'middle')
    const ringCurled = !this.isFingerExtended(hand, 'ring')

    if (indexExtended && pinkyExtended && middleCurled && ringCurled) {
      // Calculate confidence based on how well the gesture matches
      const indexConf = this.getFingerExtensionConfidence(hand, 'index')
      const pinkyConf = this.getFingerExtensionConfidence(hand, 'pinky')
      const middleConf = 1 - this.getFingerExtensionConfidence(hand, 'middle')
      const ringConf = 1 - this.getFingerExtensionConfidence(hand, 'ring')

      const confidence = (indexConf + pinkyConf + middleConf + ringConf) / 4
      return { type: 'ROCK_SIGN', confidence }
    }

    return { type: 'NONE', confidence: 0 }
  }

  private detectFingerPoint(mpResults: MPResults): { type: GestureType; confidence: number } {
    const hands = mpResults.hands
    if (!hands) return { type: 'NONE', confidence: 0 }

    // Check both hands, return the best result
    let bestResult = { type: 'NONE' as GestureType, confidence: 0 }

    if (hands.left) {
      const leftResult = this.checkPointHand(hands.left)
      if (leftResult.confidence > bestResult.confidence) {
        bestResult = leftResult
      }
    }

    if (hands.right) {
      const rightResult = this.checkPointHand(hands.right)
      if (rightResult.confidence > bestResult.confidence) {
        bestResult = rightResult
      }
    }

    return bestResult
  }

  private checkPointHand(hand: Record<string, [number, number]>): { type: GestureType; confidence: number } {
    const indexExtended = this.isFingerExtended(hand, 'index')
    const middleCurled = !this.isFingerExtended(hand, 'middle')
    const ringCurled = !this.isFingerExtended(hand, 'ring')
    const pinkyCurled = !this.isFingerExtended(hand, 'pinky')

    if (indexExtended && middleCurled && ringCurled && pinkyCurled) {
      const indexConf = this.getFingerExtensionConfidence(hand, 'index')
      const middleConf = 1 - this.getFingerExtensionConfidence(hand, 'middle')
      const ringConf = 1 - this.getFingerExtensionConfidence(hand, 'ring')
      const pinkyConf = 1 - this.getFingerExtensionConfidence(hand, 'pinky')

      const confidence = (indexConf + middleConf + ringConf + pinkyConf) / 4
      return { type: 'POINT_SPARKLES', confidence }
    }

    return { type: 'NONE', confidence: 0 }
  }

  private isFingerExtended(hand: Record<string, [number, number]>, finger: 'index' | 'middle' | 'ring' | 'pinky'): boolean {
    const angle = this.getFingerAngle(hand, finger)
    return angle < FINGER_EXTENDED_ANGLE
  }

  private isFingerCurled(hand: Record<string, [number, number]>, finger: 'index' | 'middle' | 'ring' | 'pinky'): boolean {
    const angle = this.getFingerAngle(hand, finger)
    return angle > FINGER_EXTENDED_ANGLE
  }

  private getFingerCurlConfidence(hand: Record<string, [number, number]>, finger: 'index' | 'middle' | 'ring' | 'pinky'): number {
    const angle = this.getFingerAngle(hand, finger)
    return Math.max(0, (angle - FINGER_EXTENDED_ANGLE) / (180 - FINGER_EXTENDED_ANGLE))
  }

  private getFingerExtensionConfidence(hand: Record<string, [number, number]>, finger: 'index' | 'middle' | 'ring' | 'pinky'): number {
    const angle = this.getFingerAngle(hand, finger)
    return Math.max(0, 1 - angle / FINGER_EXTENDED_ANGLE)
  }

  private getFingerAngle(hand: Record<string, [number, number]>, finger: 'index' | 'middle' | 'ring' | 'pinky'): number {
    const mcp = hand[`${finger}_mcp`]
    const pip = hand[`${finger}_pip`]
    const tip = hand[`${finger}_tip`]

    if (!mcp || !pip || !tip) return 180

    const v1 = { x: pip[0] - mcp[0], y: pip[1] - mcp[1] }
    const v2 = { x: tip[0] - pip[0], y: tip[1] - pip[1] }

    const dot = v1.x * v2.x + v1.y * v2.y
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)

    if (mag1 === 0 || mag2 === 0) return 180

    const cosAngle = dot / (mag1 * mag2)
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI)
    
    return angle
  }

  private distance(p1: [number, number], p2: [number, number]): number {
    const dx = p1[0] - p2[0]
    const dy = p1[1] - p2[1]
    return Math.sqrt(dx * dx + dy * dy)
  }

  getCurrentState(): GestureState {
    return { ...this.currentState }
  }

  private detectPeaceSign(mpResults: MPResults): { type: GestureType; confidence: number } {
    const hands = mpResults.hands
    if (!hands) return { type: 'NONE', confidence: 0 }

    // Check both hands, return the best result
    let bestResult = { type: 'NONE' as GestureType, confidence: 0 }

    if (hands.left) {
      const leftResult = this.checkPeaceSignHand(hands.left)
      if (leftResult.confidence > bestResult.confidence) {
        bestResult = leftResult
      }
    }

    if (hands.right) {
      const rightResult = this.checkPeaceSignHand(hands.right)
      if (rightResult.confidence > bestResult.confidence) {
        bestResult = rightResult
      }
    }

    return bestResult
  }

  private checkPeaceSignHand(hand: Record<string, [number, number]>): { type: GestureType; confidence: number } {
    // Check if index and middle fingers are extended
    const indexExtended = this.isFingerExtended(hand, 'index')
    const middleExtended = this.isFingerExtended(hand, 'middle')
    const ringCurled = !this.isFingerExtended(hand, 'ring')
    const pinkyCurled = !this.isFingerExtended(hand, 'pinky')

    if (indexExtended && middleExtended && ringCurled && pinkyCurled) {
      // Check if finger tips are above wrist and separated by at least 0.05 × palm width
      const indexTip = hand.index_tip
      const middleTip = hand.middle_tip
      const wrist = hand.wrist

      if (!indexTip || !middleTip || !wrist) {
        return { type: 'NONE', confidence: 0 }
      }

      // Check if tips are above wrist
      const tipsAboveWrist = indexTip[1] < wrist[1] && middleTip[1] < wrist[1]

      // Calculate palm width (distance between pinky_mcp and index_mcp)
      const pinkyMcp = hand.pinky_mcp
      const indexMcp = hand.index_mcp
      if (!pinkyMcp || !indexMcp) {
        return { type: 'NONE', confidence: 0 }
      }

      const palmWidth = this.distance(pinkyMcp, indexMcp)
      const fingerSeparation = this.distance(indexTip, middleTip)
      const minSeparation = 0.05 * palmWidth
      const fingersSeparated = fingerSeparation >= minSeparation

      if (tipsAboveWrist && fingersSeparated) {
        // Calculate confidence based on how well the gesture matches
        const indexConf = this.getFingerExtensionConfidence(hand, 'index')
        const middleConf = this.getFingerExtensionConfidence(hand, 'middle')
        const ringConf = 1 - this.getFingerExtensionConfidence(hand, 'ring')
        const pinkyConf = 1 - this.getFingerExtensionConfidence(hand, 'pinky')
        const separationConf = Math.min(1, fingerSeparation / (minSeparation * 2))

        const confidence = (indexConf + middleConf + ringConf + pinkyConf + separationConf) / 5
        return { type: 'PEACE_SIGN', confidence }
      }
    }

    return { type: 'NONE', confidence: 0 }
  }

  reset(): void {
    this.currentState = {
      type: 'NONE',
      confidence: 0,
      locked: false,
      stabilityCount: 0
    }
    
    this.graceFramesRemaining = 0
  }
}
