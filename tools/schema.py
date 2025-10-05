from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

class Landmark(BaseModel):
    x: float = Field(..., ge=0.0, le=1.0, description="Normalized x coordinate (0-1)")
    y: float = Field(..., ge=0.0, le=1.0, description="Normalized y coordinate (0-1)")
    z: Optional[float] = Field(None, description="Normalized z coordinate")
    visibility: Optional[float] = Field(None, ge=0.0, le=1.0, description="Landmark visibility (0-1)")

class HandLandmarks(BaseModel):
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

class PoseLandmarks(BaseModel):
    nose: Landmark
    left_hip: Landmark
    right_hip: Landmark
    left_wrist: Landmark
    right_wrist: Landmark
    left_shoulder: Landmark
    right_shoulder: Landmark
    left_elbow: Landmark
    right_elbow: Landmark

class DetectionFrame(BaseModel):
    timestamp: float
    pose: Optional[PoseLandmarks] = None
    hands: Optional[Dict[str, HandLandmarks]] = Field(None, description="Keys: 'left', 'right'")

class GestureResult(BaseModel):
    t: float
    raw: str
    locked: str
    conf: float

@dataclass
class GestureState:
    type: str
    confidence: float
    locked: bool
    stability_count: int
