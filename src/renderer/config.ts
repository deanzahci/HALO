export const RES_16_9 = { w: 1920, h: 1080 };
export const RES_9_16 = { w: 1080, h: 1920 };

export type VideoAspect = '16:9' | '9:16';

export function getResolutionForAspect(aspect: VideoAspect): { w: number; h: number } {
  return aspect === '16:9' ? RES_16_9 : RES_9_16;
}

// getAspectRatio removed (unused)
