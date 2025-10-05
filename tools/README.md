# Halo Python Reference Classifier

This directory contains a Python reference implementation of the Halo gesture classifier that mirrors the same heuristics used in the web application.

## Files

- `gestures.py` - Main classifier implementation
- `schema.py` - Pydantic models for landmarks and frames
- `test_gestures.py` - Unit tests for all gesture types
- `demo.jsonl` - Example frames for testing
- `README.md` - This file

## Installation

```bash
pip install pydantic
```

## Usage

### Command Line Interface

```bash
# Basic usage
python gestures.py --input demo.jsonl

# CSV output
python gestures.py --input demo.jsonl --csv

# Show gesture intervals summary
python gestures.py --input demo.jsonl --summary
```

### Python API

```python
from gestures import GestureClassifier
from schema import DetectionFrame

# Create classifier
classifier = GestureClassifier()

# Classify a single frame
frame = DetectionFrame(timestamp=0.0, ...)
label, confidence = classifier.classify_frame(frame)

# Classify a stream of frames
frames = [frame1, frame2, ...]
results = list(classifier.classify_stream(frames))
```

## Input Format

The classifier expects JSONL (JSON Lines) input where each line contains a detection frame:

```json
{
  "timestamp": 0.033,
  "pose": {
    "nose": [0.52, 0.22],
    "left_hip": [0.42, 0.65],
    "right_hip": [0.60, 0.66],
    "left_wrist": [0.44, 0.64],
    "right_wrist": [0.58, 0.66],
    "left_shoulder": [0.40, 0.30],
    "right_shoulder": [0.60, 0.30],
    "left_elbow": [0.42, 0.45],
    "right_elbow": [0.58, 0.45]
  },
  "hands": {
    "left": {
      "wrist": [0.45, 0.56],
      "thumb_cmc": [0.44, 0.58],
      "thumb_mcp": [0.43, 0.60],
      "thumb_ip": [0.42, 0.62],
      "thumb_tip": [0.41, 0.64],
      "index_mcp": [0.46, 0.50],
      "index_pip": [0.47, 0.48],
      "index_dip": [0.48, 0.46],
      "index_tip": [0.49, 0.44],
      "middle_mcp": [0.47, 0.52],
      "middle_pip": [0.48, 0.50],
      "middle_dip": [0.49, 0.48],
      "middle_tip": [0.50, 0.46],
      "ring_mcp": [0.48, 0.54],
      "ring_pip": [0.49, 0.52],
      "ring_dip": [0.50, 0.50],
      "ring_tip": [0.51, 0.48],
      "pinky_mcp": [0.50, 0.55],
      "pinky_pip": [0.51, 0.53],
      "pinky_dip": [0.52, 0.51],
      "pinky_tip": [0.53, 0.49]
    }
  }
}
```

All coordinates are normalized to [0,1] relative to the video frame (origin top-left).

## Gesture Types

- `HIPS_HALO` - Hands on hips (concentric glowing rings around head)
- `HEART_HANDS` - Heart hands gesture (floating hearts around chest)
- `ROCK_SIGN` - Rock sign (lightning bolts from hand)
- `POINT_SPARKLES` - Finger point (sparkles at fingertip)

## Constants

The classifier uses the same thresholds as the web app:

- `HIP_THRESHOLD = 0.12` - Distance threshold for hands on hips
- `FINGER_CLOSE = 0.035` - Distance threshold for finger tips touching
- `HANDS_CLOSE = 0.11` - Distance threshold for hands being close together
- `STABILITY_FRAMES = 30` - Frames required to lock a gesture (~1s at 30 FPS)
- `LOST_GRACE_FRAMES = 12` - Grace frames before dropping a locked gesture
- `FINGER_EXTENDED_ANGLE = 40` - Angle threshold for finger extension (degrees)

## Testing

Run the unit tests:

```bash
python -m pytest test_gestures.py -v
```

Or run directly:

```bash
python test_gestures.py
```

## Web App Integration

To capture frames from the web app for testing:

1. Open browser dev tools
2. Add logging to the MediaPipe detector
3. Save frames as JSONL format
4. Run through Python classifier

Example web app logging snippet:

```javascript
// In MediaPipeDetector.ts
console.log(JSON.stringify({
  timestamp: performance.now(),
  pose: poseResults,
  hands: handsResults
}));
```
