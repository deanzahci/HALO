export interface CropResult {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  tw: number;
  th: number;
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
  
  return { sx, sy, sw, sh, tw, th };
}

export function normToCropPx(
  nx: number, 
  ny: number, 
  crop: CropResult
): { x: number; y: number } {
  const scaleX = crop.tw / crop.sw;
  const scaleY = crop.th / crop.sh;
  
  return { 
    x: nx * crop.sw * scaleX, 
    y: ny * crop.sh * scaleY 
  };
}

export function createCoordinateMapping(crop: CropResult): CoordinateMapping {
  return {
    toPx: (nx: number, ny: number) => normToCropPx(nx, ny, crop),
    tw: crop.tw,
    th: crop.th
  };
}
