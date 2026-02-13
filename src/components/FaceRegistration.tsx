import { useEffect, useRef, useState } from 'react';
import { Camera, UserPlus } from 'lucide-react';
import { loadModels, detectFace } from '../lib/faceRecognition';
import { supabase } from '../lib/supabase';

interface FaceRegistrationProps {
  onSuccess: () => void;
}

export default function FaceRegistration({ onSuccess }: FaceRegistrationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [username, setUsername] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
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

  const handleRegister = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    if (!videoRef.current) {
      setError('Camera not ready');
      return;
    }

    setIsCapturing(true);
    setError('');
    setStatus('Detecting face...');

    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (existingUser) {
        setError('Username already exists');
        setIsCapturing(false);
        return;
      }

      const detection = await detectFace(videoRef.current);

      if (!detection) {
        setError('No face detected. Please ensure your face is visible and well-lit.');
        setIsCapturing(false);
        return;
      }

      setStatus('Face detected! Saving...');

      const faceDescriptor = Array.from(detection.descriptor);

      const { error: insertError } = await supabase
        .from('users')
        .insert({
          username: username.trim(),
          face_descriptor: faceDescriptor,
        });

      if (insertError) {
        setError('Registration failed: ' + insertError.message);
        setIsCapturing(false);
        return;
      }

      setStatus('Registration successful!');
      setTimeout(() => {
        stopCamera();
        onSuccess();
      }, 1500);
    } catch (err) {
      setError('Registration failed. Please try again.');
      setIsCapturing(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
      <div className="flex items-center gap-3 mb-6">
        <UserPlus className="w-8 h-8 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-800">Register New User</h2>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your username"
            disabled={isCapturing}
          />
        </div>

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
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
            {status}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          onClick={handleRegister}
          disabled={isCapturing}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
        >
          {isCapturing ? 'Processing...' : 'Register Face'}
        </button>
      </div>
    </div>
  );
}
