import * as faceapi from 'face-api.js';

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

export async function loadModels() {
  if (modelsLoaded) return;
  
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      console.log('Loading face detection models...');
      
      await faceapi.tf.setBackend('webgl');
      await faceapi.tf.ready();
      
      const modelPath = '/models';
      
      await faceapi.nets.tinyFaceDetector.load(modelPath);
      await faceapi.nets.faceLandmark68Net.load(modelPath);
      await faceapi.nets.faceRecognitionNet.load(modelPath);
      
      modelsLoaded = true;
      console.log('✅ All models loaded successfully');
    } catch (error) {
      console.error('❌ Error loading models:', error);
      loadingPromise = null;
      throw error;
    }
  })();

  return loadingPromise;
}

export async function detectFace(videoElement: HTMLVideoElement) {
  try {
    await loadModels();
    
    const detection = await faceapi
      .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.5
      }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    return detection;
  } catch (error) {
    console.error('Error detecting face:', error);
    return null;
  }
}

// Calculate Euclidean distance between two face descriptors
export function calculateDistance(descriptor1: Float32Array, descriptor2: number[]): number {
  const desc2 = new Float32Array(descriptor2);
  
  // Euclidean distance
  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - desc2[i];
    sum += diff * diff;
  }
  
  return Math.sqrt(sum);
}

// Calculate cosine similarity (alternative method)
export function calculateCosineSimilarity(descriptor1: Float32Array, descriptor2: number[]): number {
  const desc2 = new Float32Array(descriptor2);
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < descriptor1.length; i++) {
    dotProduct += descriptor1[i] * desc2[i];
    norm1 += descriptor1[i] * descriptor1[i];
    norm2 += desc2[i] * desc2[i];
  }
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// Normalize descriptor for better comparison
export function normalizeDescriptor(descriptor: Float32Array): Float32Array {
  const norm = Math.sqrt(descriptor.reduce((sum, val) => sum + val * val, 0));
  return new Float32Array(descriptor.map(val => val / norm));
}