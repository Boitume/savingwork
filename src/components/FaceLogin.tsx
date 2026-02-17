import { useEffect, useRef, useState } from 'react';
import { Camera, LogIn } from 'lucide-react';
import { loadModels, detectFace, calculateDistance } from '../lib/faceRecognition';
import { supabase, User } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

interface FaceLoginProps {
  onSuccess: (user: User) => void;
}

const RECOGNITION_THRESHOLD = 0.5; // 50% confidence threshold
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export default function FaceLogin({ onSuccess }: FaceLoginProps) {
  const { theme } = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);

  useEffect(() => {
    startCamera();
    loadModels().catch(err => setError('Failed to load face detection models'));

    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    // Check for lockout
    if (lockedUntil && new Date() > lockedUntil) {
      setLockedUntil(null);
      setLoginAttempts(0);
    }
  }, [lockedUntil]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
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

    // Check if locked
    if (lockedUntil) {
      const minutesLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
      setError(`Too many attempts. Try again in ${minutesLeft} minutes.`);
      return;
    }

    setIsScanning(true);
    setError('');
    setStatus('Detecting face...');

    try {
      const detection = await detectFace(videoRef.current);

      if (!detection) {
        handleFailedAttempt();
        setError('No face detected. Please ensure your face is visible and well-lit.');
        setIsScanning(false);
        return;
      }

      setStatus('Face detected! Verifying identity...');

      // Get all users
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('*');

      if (fetchError || !users || users.length === 0) {
        handleFailedAttempt();
        setError('No registered users found');
        setIsScanning(false);
        return;
      }

      const detectedDescriptor = detection.descriptor;
      let bestMatch: User | null = null;
      let bestDistance = Infinity;
      let secondBestDistance = Infinity;

      // Find the best match and second best match
      for (const user of users) {
        const distance = calculateDistance(detectedDescriptor, user.face_descriptor);
        
        if (distance < bestDistance) {
          secondBestDistance = bestDistance;
          bestDistance = distance;
          bestMatch = user;
        } else if (distance < secondBestDistance) {
          secondBestDistance = distance;
        }
      }

      // Calculate confidence (1 - distance, where distance is between 0 and 2)
      const confidence = 1 - (bestDistance / 2); // Normalize to 0-1

      console.log('Login attempt:', {
        bestMatch: bestMatch?.username,
        confidence: (confidence * 100).toFixed(1) + '%',
        distance: bestDistance.toFixed(3)
      });

      // If we have a match with confidence above threshold, LOGIN SUCCESSFUL!
      if (bestMatch && confidence >= RECOGNITION_THRESHOLD) {
        setStatus(`Welcome back, ${bestMatch.username}!`);
        
        // Reset attempts on successful login
        setLoginAttempts(0);
        
        // Update last login
        await supabase
          .from('users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', bestMatch.id);

        setTimeout(() => {
          stopCamera();
          onSuccess(bestMatch);
        }, 1500);
      } 
      // No match found
      else {
        handleFailedAttempt();
        setError('Face not recognized. Please try again or register.');
        setIsScanning(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      handleFailedAttempt();
      setError('Login failed. Please try again.');
      setIsScanning(false);
    }
  };

  const handleFailedAttempt = () => {
    const newAttempts = loginAttempts + 1;
    setLoginAttempts(newAttempts);

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCKOUT_DURATION);
      setLockedUntil(lockUntil);
    }
  };

  if (lockedUntil) {
    const minutesLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
    return (
      <div className={`w-full max-w-2xl mx-auto rounded-lg shadow-lg p-8 ${
        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className="text-center">
          <h2 className={`text-2xl font-bold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-800'
          }`}>
            Account Temporarily Locked
          </h2>
          <p className={`mb-6 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            Too many failed login attempts. Please try again in {minutesLeft} minutes.
          </p>
          <button
            onClick={() => {
              setLockedUntil(null);
              setLoginAttempts(0);
            }}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Reset Lock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-2xl mx-auto rounded-lg shadow-lg p-8 transition-colors duration-300 ${
      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
    }`}>
      <div className="flex items-center gap-3 mb-6">
        <LogIn className={`w-8 h-8 ${
          theme === 'dark' ? 'text-green-400' : 'text-green-600'
        }`} />
        <h2 className={`text-2xl font-bold ${
          theme === 'dark' ? 'text-white' : 'text-gray-800'
        }`}>
          Face Recognition Login
        </h2>
      </div>

      <div className="space-y-6">
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
          
          {/* Scanning Overlay */}
          {isScanning && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-64 border-4 border-green-500 rounded-lg animate-pulse"></div>
            </div>
          )}
        </div>

        {/* Status Message */}
        {status && (
          <div className={`border px-4 py-3 rounded-lg ${
            theme === 'dark'
              ? 'bg-green-900/20 border-green-800 text-green-300'
              : 'bg-green-50 border-green-200 text-green-700'
          }`}>
            <div className="flex items-center gap-2">
              {isScanning && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>{status}</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className={`border px-4 py-3 rounded-lg ${
            theme === 'dark'
              ? 'bg-red-900/20 border-red-800 text-red-300'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {error}
          </div>
        )}

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={isScanning}
          className={`w-full py-3 px-6 rounded-lg text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
            isScanning 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-green-600 hover:bg-green-700 hover:scale-105'
          }`}
        >
          <LogIn className="w-5 h-5" />
          {isScanning ? 'Verifying...' : 'Login with Face'}
        </button>
      </div>
    </div>
  );
}