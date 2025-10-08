// Gesture detection thresholds
export const HEART_THRESHOLD = 0.07  // max normalized distance between matching tips
export const FINGER_CLOSE = 0.035
export const HANDS_CLOSE = 0.11
export const STABILITY_FRAMES = 30 // ~1s at 30 FPS
export const LOST_GRACE_FRAMES = 12

// Finger extension thresholds (degrees)
export const FINGER_EXTENDED_ANGLE = 40

// Gesture types
export type GestureType = 'NONE' | 'THUMBS_UP_HALO' | 'TWO_HAND_HEART' | 'ROCK_SIGN' | 'POINT_SPARKLES' | 'PEACE_SIGN'

// UI constants
export const WATERMARK_TEXT = 'De Anza HCI • Halo'
export const TARGET_FPS = 30
export const CAPTURE_QUALITY = 0.9

// Fixed Effect Sizes (Performance Optimized)
// Halo (Thumbs Up)
export const HALO_RING_COUNT = 3
export const HALO_RADII = [140, 200, 260] // px
export const HALO_STROKE_WIDTHS = [10, 8, 6] // px (outermost thinnest)
export const HALO_PULSE_AMPLITUDE = 8 // px
export const HALO_PULSE_FREQUENCY = 1.2 // Hz
export const HALO_ALPHA_RANGE = [0.85, 0.55]
export const HALO_COLOR_CYCLE_DURATION = 3000 // ms
export const HALO_MAX_GLOW_BLUR = 4 // px

// Heart Hands (Normalized for Performance)
export const HEART_SIZE_RANGE = [24, 44] // px (reduced from 36-72)
export const HEART_SPAWN_RATE = 9 // per second (reduced from 14)
export const HEART_LIFETIME = 1400 // ms (reduced from 1800)
export const HEART_FADE_DURATION = 400 // ms
export const HEART_SPEED_RANGE = [50, 70] // px/s (reduced max)
export const HEART_ROTATION_RANGE = 18 // degrees
export const MAX_ACTIVE_HEARTS = 70 // reduced from 100

// Rock Sign Lightning (Normalized for Performance)
export const MAX_ACTIVE_BOLTS = 3 // reduced from 12
export const BOLT_SPAWN_INTERVAL = [120, 160] // ms (not continuous)
export const BOLT_LIFETIME = 100 // ms (increased from 80)
export const BOLT_SEGMENTS_RANGE = [6, 9] // reduced complexity
export const BOLT_BRANCH_CHANCE = 0.15 // reduced from 0.2
export const BOLT_CORE_THICKNESS_RANGE = [5, 7] // px range
export const BOLT_GLOW_THICKNESS = 10 // px (reduced from 14)
export const BOLT_GLOW_ALPHA = 0.2 // reduced from 0.25
export const BOLT_HORIZONTAL_VARIANCE = 8 // px

// Finger Point Sparkles
export const SPARKLE_SIZE_RANGE = [12, 128] // px
export const SPARKLE_SPAWN_RATE = 24 // per second
export const SPARKLE_BURST_COUNT = 30 // on lock event
export const SPARKLE_LIFETIME = 600 // ms
export const MAX_ACTIVE_SPARKLES = 160
export const SPARKLE_BURST_MAX_PARTICLES = 40
export const SPARKLE_BURST_DURATION = 400 // ms

// Peace Sign Balloons
export const BALLOON_SPAWN_COUNT = [6, 10] // range of balloons per activation
export const BALLOON_RISE_SPEED = [3, 5] // px/frame upward
export const BALLOON_SWAY_AMPLITUDE = [1, 2] // px horizontal sway
export const BALLOON_LIFETIME = 3500 // ms (increased by 1000ms -> 1s longer)
export const MAX_ACTIVE_BALLOONS = 20
export const BALLOON_ELLIPSE_WIDTH = 90 // px
export const BALLOON_ELLIPSE_HEIGHT = 135 // px
export const BALLOON_STRING_LENGTH = 25 // px
export const BALLOON_SHINE_ALPHA = 0.15
export const BALLOON_MAX_BLUR = 3 // px

// Performance Constants
export const MAX_PARTICLES_TOTAL = 300 // Global cap
export const RENDER_BATCH_SIZE = 50 // Particles per batch
