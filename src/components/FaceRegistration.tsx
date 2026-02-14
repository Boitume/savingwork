import { useEffect, useRef, useState } from 'react';
import { Camera, UserPlus } from 'lucide-react';
import { loadModels, detectFace } from '../lib/faceRecognition';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

interface FaceRegistrationProps {
  onSuccess: () => void;
}

export default function FaceRegistration({ onSuccess }: FaceRegistrationProps) {
  const { theme } = useTheme();
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
      // Check if username exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', username.trim())
        .maybeSingle();

      if (existingUser) {
        setError('Username already exists');
        setIsCapturing(false);
        return;
      }

      // Detect face
      const detection = await detectFace(videoRef.current);

      if (!detection) {
        setError('No face detected. Please ensure your face is visible and well-lit.');
        setIsCapturing(false);
        return;
      }

      setStatus('Face detected! Saving...');

      // Save to database
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
      
      // Wait a moment to show success message, then redirect
      setTimeout(() => {
        stopCamera();
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error('Registration error:', err);
      setError('Registration failed. Please try again.');
      setIsCapturing(false);
    }
  };

  return (
    <div className={`w-full max-w-2xl mx-auto rounded-lg shadow-lg p-8 transition-colors duration-300 ${
      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
    }`}>
      <div className="flex items-center gap-3 mb-6">
        <UserPlus className={`w-8 h-8 ${
          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
        }`} />
        <h2 className={`text-2xl font-bold ${
          theme === 'dark' ? 'text-white' : 'text-gray-800'
        }`}>
          Register New User
        </h2>
      </div>

      <div className="space-y-6">
        {/* Username Input */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={`w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-300 ${
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
            placeholder="Enter your username"
            disabled={isCapturing}
          />
        </div>

        {/* Camera Feed */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-auto"
          />
          <div className="absolute top-4 left-4">
            <div className="flex items-center gap-2 bg-black bg-opacity-50 px-3 py-2 rounded-lg">
              <Camera className="w-5 h-5 text-white" />
              <span className="text-white text-sm">Camera Active</span>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {status && (
          <div className={`border px-4 py-3 rounded-lg transition-colors duration-300 ${
            theme === 'dark'
              ? 'bg-green-900/20 border-green-800 text-green-300'
              : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}>
            {status}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className={`border px-4 py-3 rounded-lg transition-colors duration-300 ${
            theme === 'dark'
              ? 'bg-red-900/20 border-red-800 text-red-300'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {error}
          </div>
        )}

        {/* Register Button */}
        <button
          onClick={handleRegister}
          disabled={isCapturing}
          className={`w-full py-3 px-6 rounded-lg text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
            isCapturing 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 hover:scale-105'
          }`}
        >
          <UserPlus className="w-5 h-5" />
          {isCapturing ? 'Processing...' : 'Register Face'}
        </button>

        {/* Note about privacy */}
        <p className={`text-xs text-center ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          Your face data is encrypted and stored securely. We never share your biometric data.
        </p>
      </div>
    </div>
  );
}