#!/usr/bin/env python3
"""
Python reference implementation of the Halo gesture classifier.
Mirrors the same heuristics used in the web application.
"""

import json
import argparse
import sys
from typing import Dict, List, Tuple, Optional, Iterable
from dataclasses import dataclass
import math

from schema import DetectionFrame, HandLandmarks, PoseLandmarks, GestureResult, GestureState

# Constants matching the web app
HIP_THRESHOLD = 0.12
FINGER_CLOSE = 0.035
HANDS_CLOSE = 0.11
STABILITY_FRAMES = 30  # ~1s at 30 FPS
LOST_GRACE_FRAMES = 12
FINGER_EXTENDED_ANGLE = 40  # degrees

GestureLabel = str  # "NONE" | "HIPS_HALO" | "HEART_HANDS" | "ROCK_SIGN" | "POINT_SPARKLES"

class GestureClassifier:
    def __init__(
        self,
        hip_threshold: float = HIP_THRESHOLD,
        finger_close: float = FINGER_CLOSE,
        hands_close: float = HANDS_CLOSE,
        stability_frames: int = STABILITY_FRAMES,
        lost_grace_frames: int = LOST_GRACE_FRAMES,
    ):
        self.hip_threshold = hip_threshold
        self.finger_close = finger_close
        self.hands_close = hands_close
        self.stability_frames = stability_frames
        self.lost_grace_frames = lost_grace_frames
        
        self.current_state = GestureState(
            type="NONE",
            confidence=0.0,
            locked=False,
            stability_count=0
        )
        self.last_locked_gesture = "NONE"
        self.grace_frames_remaining = 0

    def classify_frame(self, frame: DetectionFrame) -> Tuple[GestureLabel, float]:
        """Return (label, confidence[0..1]) for this frame (no temporal hold applied)."""
        if not frame.pose and not frame.hands:
            return "NONE", 0.0

        # Check each gesture type
        gestures = [
            self._detect_hands_on_hips(frame),
            self._detect_heart_hands(frame),
            self._detect_rock_sign(frame),
            self._detect_finger_point(frame)
        ]

        # Find the gesture with highest confidence
        best_gesture = max(gestures, key=lambda g: g[1])
        return best_gesture

    def classify_stream(self, frames: Iterable[DetectionFrame]) -> Iterable[GestureResult]:
        """
        Apply temporal stability/hold across frames.
        Yields dicts like: {"t": float, "raw": label, "locked": locked_label_or_NONE, "conf": float}
        """
        for frame in frames:
            raw_label, confidence = self.classify_frame(frame)
            locked_label = self._update_state(raw_label, confidence)
            
            yield GestureResult(
                t=frame.timestamp,
                raw=raw_label,
                locked=locked_label,
                conf=confidence
            )

    def _update_state(self, label: GestureLabel, confidence: float) -> str:
        """Update internal state and return locked gesture if any."""
        # If we have a locked gesture and it's still the same type, keep it
        if self.current_state.locked and self.current_state.type == label:
            return self.current_state.type

        # If we have a locked gesture but it's different, start grace period
        if self.current_state.locked and self.current_state.type != label:
            if self.grace_frames_remaining > 0:
                self.grace_frames_remaining -= 1
                return self.current_state.type
            else:
                # Grace period expired, unlock
                self.current_state.locked = False
                self.current_state.stability_count = 0

        # If we're detecting the same gesture as before, increment stability
        if self.current_state.type == label and label != "NONE":
            self.current_state.stability_count += 1
            self.current_state.confidence = max(self.current_state.confidence, confidence)
            
            # Check if we should lock this gesture
            if self.current_state.stability_count >= self.stability_frames:
                self.current_state.locked = True
                self.last_locked_gesture = label
                self.grace_frames_remaining = self.lost_grace_frames
        else:
            # Different gesture or none detected, reset
            self.current_state.type = label
            self.current_state.confidence = confidence
            self.current_state.stability_count = 1

        return self.current_state.type if self.current_state.locked else "NONE"

    def _detect_hands_on_hips(self, frame: DetectionFrame) -> Tuple[GestureLabel, float]:
        """Detect hands on hips gesture (HIPS_HALO)."""
        if not frame.pose:
            return "NONE", 0.0

        pose = frame.pose
        if not all([pose.left_wrist, pose.right_wrist, pose.left_hip, pose.right_hip]):
            return "NONE", 0.0

        left_distance = self._distance(pose.left_wrist, pose.left_hip)
        right_distance = self._distance(pose.right_wrist, pose.right_hip)

        left_close = left_distance < self.hip_threshold
        right_close = right_distance < self.hip_threshold

        if left_close and right_close:
            confidence = 1 - max(left_distance, right_distance) / self.hip_threshold
            return "HIPS_HALO", max(0.0, confidence)

        return "NONE", 0.0

    def _detect_heart_hands(self, frame: DetectionFrame) -> Tuple[GestureLabel, float]:
        """Detect heart hands gesture (HEART_HANDS)."""
        if not frame.hands or "left" not in frame.hands or "right" not in frame.hands:
            return "NONE", 0.0

        left_hand = frame.hands["left"]
        right_hand = frame.hands["right"]

        # Check if index and thumb tips are close on both hands
        left_heart = self._distance(left_hand.index_tip, left_hand.thumb_tip) < self.finger_close
        right_heart = self._distance(right_hand.index_tip, right_hand.thumb_tip) < self.finger_close

        if not left_heart or not right_heart:
            return "NONE", 0.0

        # Check if the two heart shapes are close together
        hands_distance = self._distance(left_hand.index_tip, right_hand.index_tip)
        hands_close = hands_distance < self.hands_close

        if hands_close:
            confidence = 1 - hands_distance / self.hands_close
            return "HEART_HANDS", max(0.0, confidence)

        return "NONE", 0.0

    def _detect_rock_sign(self, frame: DetectionFrame) -> Tuple[GestureLabel, float]:
        """Detect rock sign gesture (ROCK_SIGN)."""
        if not frame.hands:
            return "NONE", 0.0

        # Check both hands, return the best result
        best_result = ("NONE", 0.0)

        if "left" in frame.hands:
            left_result = self._check_rock_sign_hand(frame.hands["left"])
            if left_result[1] > best_result[1]:
                best_result = left_result

        if "right" in frame.hands:
            right_result = self._check_rock_sign_hand(frame.hands["right"])
            if right_result[1] > best_result[1]:
                best_result = right_result

        return best_result

    def _check_rock_sign_hand(self, hand: HandLandmarks) -> Tuple[GestureLabel, float]:
        """Check if a single hand is doing rock sign."""
        index_extended = self._is_finger_extended(hand, "index")
        pinky_extended = self._is_finger_extended(hand, "pinky")
        middle_curled = not self._is_finger_extended(hand, "middle")
        ring_curled = not self._is_finger_extended(hand, "ring")

        if index_extended and pinky_extended and middle_curled and ring_curled:
            # Calculate confidence based on how well the gesture matches
            index_conf = self._get_finger_extension_confidence(hand, "index")
            pinky_conf = self._get_finger_extension_confidence(hand, "pinky")
            middle_conf = 1 - self._get_finger_extension_confidence(hand, "middle")
            ring_conf = 1 - self._get_finger_extension_confidence(hand, "ring")

            confidence = (index_conf + pinky_conf + middle_conf + ring_conf) / 4
            return "ROCK_SIGN", confidence

        return "NONE", 0.0

    def _detect_finger_point(self, frame: DetectionFrame) -> Tuple[GestureLabel, float]:
        """Detect finger point gesture (POINT_SPARKLES)."""
        if not frame.hands:
            return "NONE", 0.0

        # Check both hands, return the best result
        best_result = ("NONE", 0.0)

        if "left" in frame.hands:
            left_result = self._check_point_hand(frame.hands["left"])
            if left_result[1] > best_result[1]:
                best_result = left_result

        if "right" in frame.hands:
            right_result = self._check_point_hand(frame.hands["right"])
            if right_result[1] > best_result[1]:
                best_result = right_result

        return best_result

    def _check_point_hand(self, hand: HandLandmarks) -> Tuple[GestureLabel, float]:
        """Check if a single hand is doing point gesture."""
        index_extended = self._is_finger_extended(hand, "index")
        middle_curled = not self._is_finger_extended(hand, "middle")
        ring_curled = not self._is_finger_extended(hand, "ring")
        pinky_curled = not self._is_finger_extended(hand, "pinky")

        if index_extended and middle_curled and ring_curled and pinky_curled:
            index_conf = self._get_finger_extension_confidence(hand, "index")
            middle_conf = 1 - self._get_finger_extension_confidence(hand, "middle")
            ring_conf = 1 - self._get_finger_extension_confidence(hand, "ring")
            pinky_conf = 1 - self._get_finger_extension_confidence(hand, "pinky")

            confidence = (index_conf + middle_conf + ring_conf + pinky_conf) / 4
            return "POINT_SPARKLES", confidence

        return "NONE", 0.0

    def _is_finger_extended(self, hand: HandLandmarks, finger: str) -> bool:
        """Check if a finger is extended based on joint angles."""
        angle = self._get_finger_angle(hand, finger)
        return angle < FINGER_EXTENDED_ANGLE

    def _get_finger_extension_confidence(self, hand: HandLandmarks, finger: str) -> float:
        """Get confidence for finger extension (0-1)."""
        angle = self._get_finger_angle(hand, finger)
        return max(0.0, 1 - angle / FINGER_EXTENDED_ANGLE)

    def _get_finger_angle(self, hand: HandLandmarks, finger: str) -> float:
        """Calculate the bend angle of a finger in degrees."""
        mcp = getattr(hand, f"{finger}_mcp")
        pip = getattr(hand, f"{finger}_pip")
        tip = getattr(hand, f"{finger}_tip")

        v1 = (pip.x - mcp.x, pip.y - mcp.y)
        v2 = (tip.x - pip.x, tip.y - pip.y)

        dot = v1[0] * v2[0] + v1[1] * v2[1]
        mag1 = math.sqrt(v1[0] ** 2 + v1[1] ** 2)
        mag2 = math.sqrt(v2[0] ** 2 + v2[1] ** 2)

        if mag1 == 0 or mag2 == 0:
            return 180

        cos_angle = dot / (mag1 * mag2)
        cos_angle = max(-1, min(1, cos_angle))  # Clamp to valid range
        angle = math.acos(cos_angle) * (180 / math.pi)
        
        # For finger extension, we want to measure how much the finger is bent
        # If the vectors are pointing in the same direction (extended), angle is small
        # If they're pointing in opposite directions (curled), angle is large
        return angle

    def _distance(self, p1, p2) -> float:
        """Calculate Euclidean distance between two landmarks."""
        dx = p1.x - p2.x
        dy = p1.y - p2.y
        return math.sqrt(dx ** 2 + dy ** 2)

    def reset(self):
        """Reset the classifier state."""
        self.current_state = GestureState(
            type="NONE",
            confidence=0.0,
            locked=False,
            stability_count=0
        )
        self.last_locked_gesture = "NONE"
        self.grace_frames_remaining = 0


def load_frames_from_jsonl(filepath: str) -> List[DetectionFrame]:
    """Load detection frames from a JSONL file."""
    frames = []
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line:
                data = json.loads(line)
                frames.append(DetectionFrame(**data))
    return frames


def main():
    parser = argparse.ArgumentParser(description='Halo Gesture Classifier')
    parser.add_argument('--input', '-i', required=True, help='Input JSONL file')
    parser.add_argument('--csv', action='store_true', help='Output CSV format')
    parser.add_argument('--summary', action='store_true', help='Show gesture intervals summary')
    
    args = parser.parse_args()

    # Load frames
    try:
        frames = load_frames_from_jsonl(args.input)
    except FileNotFoundError:
        print(f"Error: File '{args.input}' not found", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error loading frames: {e}", file=sys.stderr)
        sys.exit(1)

    # Classify frames
    classifier = GestureClassifier()
    results = list(classifier.classify_stream(frames))

    if args.csv:
        # CSV output
        print("timestamp,raw_label,locked_label,confidence")
        for result in results:
            print(f"{result.t:.3f},{result.raw},{result.locked},{result.conf:.3f}")
    else:
        # Default output
        for result in results:
            print(f"t={result.t:.3f} raw={result.raw} conf={result.conf:.3f} locked={result.locked}")

    if args.summary:
        # Show gesture intervals
        print("\n--- Gesture Intervals ---")
        current_gesture = None
        start_time = None
        
        for result in results:
            if result.locked != current_gesture:
                if current_gesture and current_gesture != "NONE":
                    print(f"{current_gesture}: {start_time:.3f}s - {result.t:.3f}s")
                current_gesture = result.locked
                start_time = result.t
        
        if current_gesture and current_gesture != "NONE":
            print(f"{current_gesture}: {start_time:.3f}s - {results[-1].t:.3f}s")


if __name__ == "__main__":
    main()
