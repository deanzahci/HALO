#!/usr/bin/env python3
"""
Unit tests for the Halo gesture classifier.
"""

import unittest
import math
from gestures import GestureClassifier
from schema import DetectionFrame, HandLandmarks, PoseLandmarks, Landmark

class TestGestureClassifier(unittest.TestCase):
    def setUp(self):
        self.classifier = GestureClassifier()

    def test_hands_on_hips(self):
        """Test hands on hips detection."""
        # Create a frame with hands on hips
        frame = DetectionFrame(
            timestamp=0.0,
            pose=PoseLandmarks(
                nose=Landmark(x=0.5, y=0.2),
                left_hip=Landmark(x=0.4, y=0.6),
                right_hip=Landmark(x=0.6, y=0.6),
                left_wrist=Landmark(x=0.4, y=0.6),  # Close to left hip
                right_wrist=Landmark(x=0.6, y=0.6),  # Close to right hip
                left_shoulder=Landmark(x=0.4, y=0.3),
                right_shoulder=Landmark(x=0.6, y=0.3),
                left_elbow=Landmark(x=0.4, y=0.45),
                right_elbow=Landmark(x=0.6, y=0.45)
            )
        )
        
        label, confidence = self.classifier.classify_frame(frame)
        self.assertEqual(label, "HIPS_HALO")
        self.assertGreater(confidence, 0.5)

    def test_heart_hands(self):
        """Test heart hands detection."""
        # Create hands with index and thumb tips close together
        left_hand = HandLandmarks(
            wrist=Landmark(x=0.3, y=0.5),
            thumb_cmc=Landmark(x=0.35, y=0.5),
            thumb_mcp=Landmark(x=0.4, y=0.5),
            thumb_ip=Landmark(x=0.45, y=0.5),
            thumb_tip=Landmark(x=0.5, y=0.5),  # Close to index_tip
            index_mcp=Landmark(x=0.4, y=0.4),
            index_pip=Landmark(x=0.45, y=0.4),
            index_dip=Landmark(x=0.48, y=0.4),
            index_tip=Landmark(x=0.5, y=0.5),  # Close to thumb_tip
            middle_mcp=Landmark(x=0.4, y=0.35),
            middle_pip=Landmark(x=0.45, y=0.35),
            middle_dip=Landmark(x=0.48, y=0.35),
            middle_tip=Landmark(x=0.5, y=0.35),
            ring_mcp=Landmark(x=0.4, y=0.3),
            ring_pip=Landmark(x=0.45, y=0.3),
            ring_dip=Landmark(x=0.48, y=0.3),
            ring_tip=Landmark(x=0.5, y=0.3),
            pinky_mcp=Landmark(x=0.4, y=0.25),
            pinky_pip=Landmark(x=0.45, y=0.25),
            pinky_dip=Landmark(x=0.48, y=0.25),
            pinky_tip=Landmark(x=0.5, y=0.25)
        )
        
        right_hand = HandLandmarks(
            wrist=Landmark(x=0.7, y=0.5),
            thumb_cmc=Landmark(x=0.65, y=0.5),
            thumb_mcp=Landmark(x=0.6, y=0.5),
            thumb_ip=Landmark(x=0.55, y=0.5),
            thumb_tip=Landmark(x=0.5, y=0.5),  # Close to index_tip
            index_mcp=Landmark(x=0.6, y=0.4),
            index_pip=Landmark(x=0.55, y=0.4),
            index_dip=Landmark(x=0.52, y=0.4),
            index_tip=Landmark(x=0.5, y=0.5),  # Close to thumb_tip
            middle_mcp=Landmark(x=0.6, y=0.35),
            middle_pip=Landmark(x=0.55, y=0.35),
            middle_dip=Landmark(x=0.52, y=0.35),
            middle_tip=Landmark(x=0.5, y=0.35),
            ring_mcp=Landmark(x=0.6, y=0.3),
            ring_pip=Landmark(x=0.55, y=0.3),
            ring_dip=Landmark(x=0.52, y=0.3),
            ring_tip=Landmark(x=0.5, y=0.3),
            pinky_mcp=Landmark(x=0.6, y=0.25),
            pinky_pip=Landmark(x=0.55, y=0.25),
            pinky_dip=Landmark(x=0.52, y=0.25),
            pinky_tip=Landmark(x=0.5, y=0.25)
        )
        
        frame = DetectionFrame(
            timestamp=0.0,
            hands={"left": left_hand, "right": right_hand}
        )
        
        label, confidence = self.classifier.classify_frame(frame)
        self.assertEqual(label, "HEART_HANDS")
        self.assertGreater(confidence, 0.5)

    def test_rock_sign(self):
        """Test rock sign detection."""
        # Create a hand with index and pinky extended, middle and ring curled
        hand = HandLandmarks(
            wrist=Landmark(x=0.5, y=0.6),
            thumb_cmc=Landmark(x=0.45, y=0.6),
            thumb_mcp=Landmark(x=0.4, y=0.6),
            thumb_ip=Landmark(x=0.35, y=0.6),
            thumb_tip=Landmark(x=0.3, y=0.6),
            index_mcp=Landmark(x=0.5, y=0.5),
            index_pip=Landmark(x=0.5, y=0.4),  # Extended
            index_dip=Landmark(x=0.5, y=0.3),
            index_tip=Landmark(x=0.5, y=0.2),  # Extended
            middle_mcp=Landmark(x=0.52, y=0.5),
            middle_pip=Landmark(x=0.52, y=0.52),  # Curled - bent back
            middle_dip=Landmark(x=0.52, y=0.54),
            middle_tip=Landmark(x=0.52, y=0.56),  # Curled - bent back
            ring_mcp=Landmark(x=0.54, y=0.5),
            ring_pip=Landmark(x=0.54, y=0.52),  # Curled - bent back
            ring_dip=Landmark(x=0.54, y=0.54),
            ring_tip=Landmark(x=0.54, y=0.56),  # Curled - bent back
            pinky_mcp=Landmark(x=0.56, y=0.5),
            pinky_pip=Landmark(x=0.56, y=0.4),  # Extended
            pinky_dip=Landmark(x=0.56, y=0.3),
            pinky_tip=Landmark(x=0.56, y=0.2)  # Extended
        )
        
        frame = DetectionFrame(
            timestamp=0.0,
            hands={"right": hand}
        )
        
        label, confidence = self.classifier.classify_frame(frame)
        self.assertEqual(label, "ROCK_SIGN")
        self.assertGreater(confidence, 0.5)

    def test_finger_point(self):
        """Test finger point detection."""
        # Create a hand with only index finger extended
        hand = HandLandmarks(
            wrist=Landmark(x=0.5, y=0.6),
            thumb_cmc=Landmark(x=0.45, y=0.6),
            thumb_mcp=Landmark(x=0.4, y=0.6),
            thumb_ip=Landmark(x=0.35, y=0.6),
            thumb_tip=Landmark(x=0.3, y=0.6),
            index_mcp=Landmark(x=0.5, y=0.5),
            index_pip=Landmark(x=0.5, y=0.4),  # Extended
            index_dip=Landmark(x=0.5, y=0.3),
            index_tip=Landmark(x=0.5, y=0.2),  # Extended
            middle_mcp=Landmark(x=0.52, y=0.5),
            middle_pip=Landmark(x=0.52, y=0.52),  # Curled - bent back
            middle_dip=Landmark(x=0.52, y=0.54),
            middle_tip=Landmark(x=0.52, y=0.56),  # Curled - bent back
            ring_mcp=Landmark(x=0.54, y=0.5),
            ring_pip=Landmark(x=0.54, y=0.52),  # Curled - bent back
            ring_dip=Landmark(x=0.54, y=0.54),
            ring_tip=Landmark(x=0.54, y=0.56),  # Curled - bent back
            pinky_mcp=Landmark(x=0.56, y=0.5),
            pinky_pip=Landmark(x=0.56, y=0.52),  # Curled - bent back
            pinky_dip=Landmark(x=0.56, y=0.54),
            pinky_tip=Landmark(x=0.56, y=0.56)  # Curled - bent back
        )
        
        frame = DetectionFrame(
            timestamp=0.0,
            hands={"right": hand}
        )
        
        label, confidence = self.classifier.classify_frame(frame)
        self.assertEqual(label, "POINT_SPARKLES")
        self.assertGreater(confidence, 0.5)

    def test_temporal_stability(self):
        """Test temporal stability/hold logic."""
        # Create frames with consistent gesture
        frames = []
        for i in range(35):  # More than STABILITY_FRAMES
            frame = DetectionFrame(
                timestamp=i * 0.033,  # ~30 FPS
                pose=PoseLandmarks(
                    nose=Landmark(x=0.5, y=0.2),
                    left_hip=Landmark(x=0.4, y=0.6),
                    right_hip=Landmark(x=0.6, y=0.6),
                    left_wrist=Landmark(x=0.4, y=0.6),  # Close to left hip
                    right_wrist=Landmark(x=0.6, y=0.6),  # Close to right hip
                    left_shoulder=Landmark(x=0.4, y=0.3),
                    right_shoulder=Landmark(x=0.6, y=0.3),
                    left_elbow=Landmark(x=0.4, y=0.45),
                    right_elbow=Landmark(x=0.6, y=0.45)
                )
            )
            frames.append(frame)

        results = list(self.classifier.classify_stream(frames))
        
        # Check that gesture gets locked after stability_frames
        locked_frames = [r for r in results if r.locked == "HIPS_HALO"]
        self.assertGreater(len(locked_frames), 0, "Gesture should be locked after stability period")

    def test_grace_period(self):
        """Test grace period when gesture changes."""
        classifier = GestureClassifier(stability_frames=5, lost_grace_frames=3)
        
        # Create frames with consistent gesture to lock it
        frames = []
        for i in range(10):
            frame = DetectionFrame(
                timestamp=i * 0.033,
                pose=PoseLandmarks(
                    nose=Landmark(x=0.5, y=0.2),
                    left_hip=Landmark(x=0.4, y=0.6),
                    right_hip=Landmark(x=0.6, y=0.6),
                    left_wrist=Landmark(x=0.4, y=0.6),
                    right_wrist=Landmark(x=0.6, y=0.6),
                    left_shoulder=Landmark(x=0.4, y=0.3),
                    right_shoulder=Landmark(x=0.6, y=0.3),
                    left_elbow=Landmark(x=0.4, y=0.45),
                    right_elbow=Landmark(x=0.6, y=0.45)
                )
            )
            frames.append(frame)

        results = list(classifier.classify_stream(frames))
        
        # Should have locked gesture
        self.assertTrue(any(r.locked == "HIPS_HALO" for r in results), "Should lock gesture")
        
        # Now add frames with different gesture
        for i in range(10, 15):
            frame = DetectionFrame(timestamp=i * 0.033)  # No pose/hands
            frames.append(frame)

        results = list(classifier.classify_stream(frames))
        
        # Should still be locked during grace period
        locked_count = sum(1 for r in results if r.locked == "HIPS_HALO")
        self.assertGreater(locked_count, 0, "Should maintain lock during grace period")

    def test_no_gesture(self):
        """Test detection when no gesture is present."""
        frame = DetectionFrame(timestamp=0.0)
        
        label, confidence = self.classifier.classify_frame(frame)
        self.assertEqual(label, "NONE")
        self.assertEqual(confidence, 0.0)

    def test_finger_angle_calculation(self):
        """Test finger angle calculation."""
        # Create a hand with known finger angles
        hand = HandLandmarks(
            wrist=Landmark(x=0.5, y=0.6),
            thumb_cmc=Landmark(x=0.45, y=0.6),
            thumb_mcp=Landmark(x=0.4, y=0.6),
            thumb_ip=Landmark(x=0.35, y=0.6),
            thumb_tip=Landmark(x=0.3, y=0.6),
            index_mcp=Landmark(x=0.5, y=0.5),
            index_pip=Landmark(x=0.5, y=0.4),  # Straight line
            index_dip=Landmark(x=0.5, y=0.3),
            index_tip=Landmark(x=0.5, y=0.2),  # Straight line
            middle_mcp=Landmark(x=0.52, y=0.5),
            middle_pip=Landmark(x=0.52, y=0.52),  # Curled - bent back
            middle_dip=Landmark(x=0.52, y=0.54),
            middle_tip=Landmark(x=0.52, y=0.56),  # Curled - bent back
            ring_mcp=Landmark(x=0.54, y=0.5),
            ring_pip=Landmark(x=0.54, y=0.52),  # Curled - bent back
            ring_dip=Landmark(x=0.54, y=0.54),
            ring_tip=Landmark(x=0.54, y=0.56),  # Curled - bent back
            pinky_mcp=Landmark(x=0.56, y=0.5),
            pinky_pip=Landmark(x=0.56, y=0.52),  # Curled - bent back
            pinky_dip=Landmark(x=0.56, y=0.54),
            pinky_tip=Landmark(x=0.56, y=0.56)  # Curled - bent back
        )
        
        # Index finger should be extended (small angle)
        index_angle = self.classifier._get_finger_angle(hand, "index")
        self.assertLess(index_angle, 40, "Index finger should be extended")
        
        # Middle finger should be curled (large angle)
        middle_angle = self.classifier._get_finger_angle(hand, "middle")
        self.assertGreater(middle_angle, 40, "Middle finger should be curled")


if __name__ == "__main__":
    unittest.main()
