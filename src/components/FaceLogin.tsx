import { useEffect, useRef, useState } from 'react';
import { Camera, LogIn } from 'lucide-react';
import { loadModels, detectFace, calculateDistance } from '../lib/faceRecognition';
import { supabase, User } from '../lib/supabase';

interface FaceLoginProps {
  onSuccess: (user: User) => void;
}

const RECOGNITION_THRESHOLD = 0.6;

export default function FaceLogin({ onSuccess }: FaceLoginProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startCamera();
    loadModels().catch(err => setError('Failed to load face detection models'));

    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      setError('Failed to access camera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleLogin = async () => {
    if (!videoRef.current) {
      setError('Camera not ready');
      return;
    }

    setIsScanning(true);
    setError('');
    setStatus('Detecting face...');

    try {
      const detection = await detectFace(videoRef.current);

      if (!detection) {
        setError('No face detected. Please ensure your face is visible and well-lit.');
        setIsScanning(false);
        return;
      }

      setStatus('Face detected! Comparing with registered users...');

      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('*');

      if (fetchError || !users || users.length === 0) {
        setError('No registered users found');
        setIsScanning(false);
        return;
      }

      const detectedDescriptor = detection.descriptor;
      let bestMatch: User | null = null;
      let bestDistance = Infinity;

      for (const user of users) {
        const distance = calculateDistance(detectedDescriptor, user.face_descriptor);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatch = user;
        }
      }

      if (bestMatch && bestDistance < RECOGNITION_THRESHOLD) {
        setStatus(`Welcome back, ${bestMatch.username}!`);
        setTimeout(() => {
          stopCamera();
          onSuccess(bestMatch);
        }, 1500);
      } else {
        setError('Face not recognized. Please try again or register first.');
        setIsScanning(false);
      }
    } catch (err) {
      setError('Login failed. Please try again.');
      setIsScanning(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
      <div className="flex items-center gap-3 mb-6">
        <LogIn className="w-8 h-8 text-green-600" />
        <h2 className="text-2xl font-bold text-gray-800">Face Recognition Login</h2>
      </div>

      <div className="space-y-6">
        <div className="relative bg-gray-900 rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            muted
            className="w-full h-auto"
          />
          <div className="absolute top-4 left-4">
            <div className="flex items-center gap-2 bg-black bg-opacity-50 px-3 py-2 rounded-lg">
              <Camera className="w-5 h-5 text-white" />
              <span className="text-white text-sm">Camera Active</span>
            </div>
          </div>
        </div>

        {status && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {status}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={isScanning}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
        >
          {isScanning ? 'Scanning...' : 'Login with Face'}
        </button>
      </div>
    </div>
  );
}
