import * as faceapi from 'face-api.js';

let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) return;

  const MODEL_URL = '/models';

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);

  modelsLoaded = true;
}

export async function detectFace(video: HTMLVideoElement) {
  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection;
}

export function calculateDistance(descriptor1: Float32Array | number[], descriptor2: number[]) {
  const arr1 = Array.from(descriptor1);
  return faceapi.euclideanDistance(arr1, descriptor2);
}
