export type VideoAspect = '16:9' | '9:16';

export async function listVideoInputs(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'videoinput');
}

export async function getStreamForDevice(deviceId: string | null, fps = 30): Promise<MediaStream> {
  // Wide constraints; browser will pick closest it can
  const base: MediaTrackConstraints = deviceId
    ? { deviceId: { exact: deviceId } }
    : { facingMode: 'user' };

  const constraints: MediaStreamConstraints = {
    video: {
      ...base,
      width: { ideal: 1920 }, 
      height: { ideal: 1080 },
      frameRate: { ideal: fps, max: 60 }
    },
    audio: false
  };
  
  return navigator.mediaDevices.getUserMedia(constraints);
}

export async function unlockDeviceLabels(): Promise<void> {
  // Request permission once to unlock device labels
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'user' }, 
      audio: false 
    });
    // Stop the stream immediately - we just needed permission
    stream.getTracks().forEach(track => track.stop());
  } catch (error) {
    console.warn('Failed to unlock device labels:', error);
  }
}

export function stopStreamTracks(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
}

export function getDeviceLabel(device: MediaDeviceInfo): string {
  if (device.label) {
    return device.label;
  }
  
  // Generate fallback labels for common device types
  const fallbacks: { [key: string]: string } = {
    'camera': 'Camera',
    'webcam': 'Webcam',
    'facetime': 'FaceTime Camera',
    'continuity': 'Continuity Camera',
    'camo': 'Camo',
    'epoccam': 'EpocCam'
  };
  
  const lowerLabel = device.label?.toLowerCase() || '';
  for (const [key, label] of Object.entries(fallbacks)) {
    if (lowerLabel.includes(key)) {
      return label;
    }
  }
  
  return `Camera ${device.deviceId.slice(-4)}`;
}
