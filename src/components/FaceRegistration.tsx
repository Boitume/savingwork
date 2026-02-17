import { useEffect, useRef, useState } from 'react';
import { Camera, UserPlus, AlertCircle } from 'lucide-react';
import { loadModels, detectFace, calculateDistance } from '../lib/faceRecognition';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

interface FaceRegistrationProps {
  onSuccess: () => void;
}

const DUPLICATE_THRESHOLD = 0.6; // 60% match = duplicate

export default function FaceRegistration({ onSuccess }: FaceRegistrationProps) {
  const { theme } = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [username, setUsername] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<{
    show: boolean;
    existingUser?: string;
  }>({ show: false });
  
  const streamRef = useRef<MediaStream | null>(null);
  const [isChecking, setIsChecking] = useState(false);

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

  const checkForDuplicateFace = async (descriptor: Float32Array): Promise<{
    isDuplicate: boolean;
    existingUser?: string;
  }> => {
    try {
      // Get all users with their face descriptors
      const { data: users, error } = await supabase
        .from('users')
        .select('id, username, face_descriptor');

      if (error || !users) {
        console.error('Error fetching users:', error);
        return { isDuplicate: false };
      }

      let bestMatch = null;
      let bestSimilarity = 0;

      // Compare with each existing face
      for (const user of users) {
        if (!user.face_descriptor) continue;
        
        const distance = calculateDistance(
          descriptor, 
          new Float32Array(user.face_descriptor)
        );
        const similarity = 1 - (distance / 2); // Normalize to 0-1
        
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = user;
        }
      }

      // If similarity exceeds threshold, it's a duplicate
      if (bestMatch && bestSimilarity > DUPLICATE_THRESHOLD) {
        return {
          isDuplicate: true,
          existingUser: bestMatch.username
        };
      }

      return { isDuplicate: false };
    } catch (error) {
      console.error('Error checking duplicate:', error);
      return { isDuplicate: false };
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

    // Reset duplicate warning
    setDuplicateWarning({ show: false });
    setIsCapturing(true);
    setError('');
    setStatus('Checking username availability...');

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

      setStatus('Detecting face...');

      // Detect face
      const detection = await detectFace(videoRef.current);

      if (!detection) {
        setError('No face detected. Please ensure your face is visible and well-lit.');
        setIsCapturing(false);
        return;
      }

      setStatus('Checking if face already registered...');
      setIsChecking(true);

      // Check for duplicate face
      const duplicateCheck = await checkForDuplicateFace(detection.descriptor);

      if (duplicateCheck.isDuplicate) {
        setDuplicateWarning({
          show: true,
          existingUser: duplicateCheck.existingUser
        });
        setStatus('');
        setIsCapturing(false);
        setIsChecking(false);
        return;
      }

      setStatus('Face is unique! Saving...');

      // Save to database
      const faceDescriptor = Array.from(detection.descriptor);

      const { error: insertError } = await supabase
        .from('users')
        .insert({
          username: username.trim(),
          face_descriptor: faceDescriptor,
          registered_at: new Date().toISOString()
        });

      if (insertError) {
        setError('Registration failed: ' + insertError.message);
        setIsCapturing(false);
        setIsChecking(false);
        return;
      }

      setStatus('Registration successful!');
      
      setTimeout(() => {
        stopCamera();
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error('Registration error:', err);
      setError('Registration failed. Please try again.');
      setIsCapturing(false);
      setIsChecking(false);
    }
  };

  const handleForceRegister = async () => {
    if (!videoRef.current || !duplicateWarning.existingUser) return;

    setDuplicateWarning({ show: false });
    setIsCapturing(true);
    setStatus('Force registering...');

    try {
      const detection = await detectFace(videoRef.current);
      if (!detection) {
        setError('No face detected');
        setIsCapturing(false);
        return;
      }

      const faceDescriptor = Array.from(detection.descriptor);

      const { error: insertError } = await supabase
        .from('users')
        .insert({
          username: username.trim(),
          face_descriptor: faceDescriptor,
          registered_at: new Date().toISOString()
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
      setError('Registration failed');
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

      {duplicateWarning.show ? (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                Face Already Registered!
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3">
                This face looks very similar to user "{duplicateWarning.existingUser}".
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-4">
                One person should only have one account. Are you sure you want to continue?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDuplicateWarning({ show: false })}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm"
                >
                  Go Back
                </button>
                <button
                  onClick={handleForceRegister}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm"
                >
                  Register Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
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
              className={`w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
              placeholder="Enter your username"
              disabled={isCapturing || isChecking}
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
            <div className={`border px-4 py-3 rounded-lg ${
              theme === 'dark'
                ? 'bg-green-900/20 border-green-800 text-green-300'
                : 'bg-green-50 border-green-200 text-green-700'
            }`}>
              <div className="flex items-center gap-2">
                {(isCapturing || isChecking) && (
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

          {/* Register Button */}
          <button
            onClick={handleRegister}
            disabled={isCapturing || isChecking}
            className={`w-full py-3 px-6 rounded-lg text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              isCapturing || isChecking
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 hover:scale-105'
            }`}
          >
            <UserPlus className="w-5 h-5" />
            {isChecking ? 'Checking Face...' : isCapturing ? 'Processing...' : 'Register Face'}
          </button>
        </div>
      )}
    </div>
  );
}