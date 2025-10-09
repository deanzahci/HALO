export interface CropResult {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  tw: number;
  th: number;
  // source video dimensions (added so normalized coords can be mapped correctly)
  vw: number;
  vh: number;
}

export interface CoordinateMapping {
  toPx: (nx: number, ny: number) => { x: number; y: number };
  tw: number;
  th: number;
}

export function computeCenteredCrop(
  vw: number, 
  vh: number, 
  tw: number, 
  th: number
): CropResult {
  const srcAspect = vw / vh;
  const tgtAspect = tw / th;
  
  let sx = 0, sy = 0, sw = vw, sh = vh;
  
  if (srcAspect > tgtAspect) { 
    // Video is too wide - crop sides
    sh = vh; 
    sw = Math.round(sh * tgtAspect);
    sx = Math.round((vw - sw) / 2);
  } else { 
    // Video is too tall - crop top/bottom
    sw = vw; 
    sh = Math.round(sw / tgtAspect);
    sy = Math.round((vh - sh) / 2);
  }
  
  return { sx, sy, sw, sh, tw, th, vw, vh };
}

export function normToCropPx(
  nx: number, 
  ny: number, 
  crop: CropResult
): { x: number; y: number } {
  // Map normalized coordinates (relative to source video: 0..1) into
  // pixel coordinates on the destination canvas that receives the cropped
  // video region. Steps:
  // 1) Convert normalized -> source video pixels: sx = nx * vw
  // 2) Convert source pixel into position within the crop: rel = sx - crop.sx
  // 3) Scale rel from crop pixels to target canvas pixels: x = (rel / crop.sw) * crop.tw
  // Handle edge cases where crop.sw/sh might be zero.
  const srcX = nx * crop.vw
  const srcY = ny * crop.vh

  const relX = srcX - crop.sx
  const relY = srcY - crop.sy

  const x = crop.sw > 0 ? (relX / crop.sw) * crop.tw : 0
  const y = crop.sh > 0 ? (relY / crop.sh) * crop.th : 0

  return { x, y }
}

export function createCoordinateMapping(crop: CropResult): CoordinateMapping {
  return {
    toPx: (nx: number, ny: number) => normToCropPx(nx, ny, crop),
    tw: crop.tw,
    th: crop.th
  };
}
