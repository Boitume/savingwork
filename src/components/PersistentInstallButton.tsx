import { useState, useEffect } from 'react';
import { Download, AlertCircle, Smartphone, Chrome, Globe } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { installHandler } from '../utils/installHandler';

export function PersistentInstallButton() {
  const [canInstall, setCanInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    // Subscribe to install handler updates
    const unsubscribe = installHandler.subscribe(setCanInstall);
    
    // Get device info
    setDeviceInfo(installHandler.getDeviceInfo());
    setIsStandalone(installHandler.getDeviceInfo().isStandalone);

    return unsubscribe;
  }, []);

  const handleInstallClick = async () => {
    if (isStandalone) return;
    
    setIsInstalling(true);
    
    const result = await installHandler.installWithFallback();
    
    if (!result.success) {
      // Show fallback modal with device-specific instructions
      setShowFallbackModal(true);
    }
    
    setIsInstalling(false);
  };

  const getDeviceSpecificInstructions = () => {
    if (!deviceInfo) return null;

    if (deviceInfo.isSamsung) {
      return {
        title: 'Install on Samsung Internet',
        steps: [
          'Open in Samsung Internet browser (not Chrome)',
          'Tap the menu button (三) at the bottom',
          'Select "Add page to" → "Home screen"',
          'Tap "Add" to confirm'
        ],
        icon: <Smartphone className="w-12 h-12 text-blue-500" />
      };
    }

    if (deviceInfo.isXiaomi) {
      return {
        title: 'Install on Xiaomi/MIUI',
        steps: [
          'Open in Chrome browser',
          'Tap the menu button (⋮) at the top right',
          'Select "Add to Home screen"',
          'Tap "Add" in the popup',
          'If not working, try in Mi Browser instead'
        ],
        icon: <Smartphone className="w-12 h-12 text-orange-500" />
      };
    }

    if (deviceInfo.isHuawei) {
      return {
        title: 'Install on Huawei',
        steps: [
          'Open in Chrome browser',
          'Tap the menu button (⋮) at the top right',
          'Select "Add to Home screen"',
          'Tap "Add" to confirm',
          'If using EMUI, try in Huawei Browser'
        ],
        icon: <Smartphone className="w-12 h-12 text-red-500" />
      };
    }

    // Generic Android instructions
    return {
      title: 'Install on Android',
      steps: [
        'Open in Chrome browser',
        'Tap the menu button (⋮) at the top right',
        'Select "Add to Home screen"',
        'Tap "Add" in the popup',
        'The app will appear on your home screen'
      ],
      icon: <Chrome className="w-12 h-12 text-green-500" />
    };
  };

  if (isStandalone) return null;

  const instructions = getDeviceSpecificInstructions();

  return (
    <>
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={`flex items-center gap-2 px-6 py-3 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 ${
            isInstalling ? 'opacity-50 cursor-wait' : ''
          } ${
            theme === 'dark'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          <Download className="w-5 h-5" />
          <span className="font-medium">
            {isInstalling ? 'Preparing...' : 'Install App'}
          </span>
          <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Free</span>
        </button>
        
        {canInstall && !isInstalling && (
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
            <span className={`text-xs px-2 py-1 rounded-full animate-pulse ${
              theme === 'dark' 
                ? 'bg-green-900 text-green-300' 
                : 'bg-green-100 text-green-700'
            }`}>
              ⚡ Ready to install
            </span>
          </div>
        )}
      </div>

      {/* Fallback Modal with Device-Specific Instructions */}
      {showFallbackModal && instructions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-2xl p-6 max-w-md w-full ${
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="flex justify-center mb-4">
              {instructions.icon}
            </div>
            
            <h3 className={`text-xl font-bold text-center mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-800'
            }`}>
              {instructions.title}
            </h3>
            
            <p className={`text-sm text-center mb-4 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Automatic install didn't work. Follow these steps:
            </p>
            
            <ol className={`space-y-3 mb-6 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {instructions.steps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                  }`}>
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div className={`p-3 rounded-lg mb-4 ${
              theme === 'dark' ? 'bg-gray-700/50' : 'bg-yellow-50'
            }`}>
              <p className={`text-xs flex items-start gap-2 ${
                theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'
              }`}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  {deviceInfo?.isSamsung 
                    ? 'Use Samsung Internet browser for best results'
                    : 'Make sure you are using Chrome browser'}
                </span>
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowFallbackModal(false)}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                }`}
              >
                Close
              </button>
              <button
                onClick={async () => {
                  setShowFallbackModal(false);
                  // Try one more time with a different method
                  setTimeout(() => handleInstallClick(), 500);
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}