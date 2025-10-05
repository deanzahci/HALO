# Halo - Gesture Photo Booth

A single-page web application that uses computer vision to detect hand gestures and overlay magical aura effects in real-time. Built with TypeScript, Vite, and MediaPipe.

## Features

### Core Flow
- **Live Camera Feed**: Full-screen webcam display with real-time gesture detection
- **Gesture Status**: Shows current gesture state (None/Detecting/Holding/Locked)
- **Capture System**: Freeze frame with aura effect and export as PNG
- **Share Modal**: Preview, download, and QR code for easy sharing

### Gesture Recognition
- **Hands on Hips** → Halo (concentric glowing rings around head)
- **Heart Hands** → Hearts (floating heart sprites around chest)
- **Rock Sign** → Lightning (branching bolts from hand)
- **Finger Point** → Sparkles (particle emitter at fingertip)

### UI Components
- **Gesture Menu**: Visual indicators for each gesture type
- **Controls**: Capture (C key), Reset, Share buttons
- **Watermark Toggle**: Enable/disable "De Anza HCI • Halo" watermark
- **Halo Wall**: Thumbnail grid of captured images

### Performance & Robustness
- **Target**: ~30 FPS at 720p input
- **Stability Logic**: Requires ~1 second of consistent detection to lock gestures
- **Fallback Mode**: Manual gesture selection if camera/MediaPipe unavailable
- **Grace Period**: Prevents flickering between gestures

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Open in Browser**
   - Navigate to the HTTPS URL shown in terminal
   - Allow camera access when prompted
   - Start making gestures!

## Usage

### Gestures
1. **Halo**: Place both hands on your hips
2. **Hearts**: Form heart shapes with both hands near chest
3. **Lightning**: Make rock sign (index + pinky extended, middle + ring curled)
4. **Sparkles**: Point with index finger (index extended, others curled)

### Controls
- **C Key** or **Capture Button**: Take a photo with current aura
- **Reset Button**: Clear current gesture and resume live feed
- **Share Button**: Reopen share modal for last capture
- **Watermark Toggle**: Show/hide watermark on captures

## Python Reference Implementation

The `tools/` directory contains a Python reference implementation that mirrors the web app's gesture detection logic:

```bash
cd tools
pip install pydantic
python gestures.py --input demo.jsonl
python test_gestures.py
```

## Technical Details

### Architecture
- **Camera Module**: WebRTC camera access and frame capture
- **MediaPipe Integration**: Hand and pose landmark detection
- **Gesture Classifier**: Real-time gesture recognition with stability logic
- **Aura Renderer**: Canvas2D effects for each gesture type
- **Capture System**: PNG export with watermark and QR code generation

### Constants
- `HIP_THRESHOLD = 0.12` - Distance threshold for hands on hips
- `FINGER_CLOSE = 0.035` - Distance threshold for finger tips touching
- `HANDS_CLOSE = 0.11` - Distance threshold for hands being close together
- `STABILITY_FRAMES = 30` - Frames required to lock a gesture (~1s at 30 FPS)
- `LOST_GRACE_FRAMES = 12` - Grace frames before dropping a locked gesture

## Browser Requirements

- **Chrome** (recommended for best MediaPipe performance)
- **HTTPS** (required for camera access)
- **WebRTC** support
- **Canvas2D** support

## Development

### Project Structure
```
src/
├── main.ts                 # Application entry point
├── constants.ts           # Configuration constants
├── types.ts              # TypeScript type definitions
├── app/
│   └── HaloApp.ts        # Main application class
├── modules/
│   ├── Camera.ts         # Webcam access and frame capture
│   ├── MediaPipeDetector.ts # Hand/pose landmark detection
│   ├── GestureClassifier.ts # Gesture recognition logic
│   ├── AuraRenderer.ts   # Visual effects rendering
│   └── CaptureSystem.ts  # PNG export and sharing
└── ui/
    └── UI.ts             # User interface components

tools/
├── gestures.py           # Python reference classifier
├── schema.py            # Pydantic data models
├── test_gestures.py     # Unit tests
├── demo.jsonl          # Example test data
└── README.md           # Python tools documentation
```

### Building for Production
```bash
npm run build
```

The built files will be in the `dist/` directory.

## License

MIT License - Built for De Anza HCI course.
