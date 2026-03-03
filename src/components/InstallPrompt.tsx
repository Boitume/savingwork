import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
      return;
    }

    // Check if iOS
    const ua = window.navigator.userAgent;
    const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
    const webkit = !!ua.match(/WebKit/i);
    const iOSStandalone = !!(iOS && webkit && !ua.match(/CriOS/i));
    
    if (iOSStandalone) {
      setIsIOS(true);
      setShowPrompt(true);
      return;
    }

    // Handle beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
      <div className={`rounded-lg shadow-xl p-4 ${
        theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
      }`}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <Download className={`w-5 h-5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
            <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
              Install App
            </h3>
          </div>
          <button
            onClick={handleDismiss}
            className={`p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors`}
          >
            <X className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
          </button>
        </div>
        
        {isIOS ? (
          <div>
            <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Install this app on your iPhone:
            </p>
            <ol className={`text-sm list-decimal list-inside space-y-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              <li>Tap the Share button <span className="text-xl">⎙</span></li>
              <li>Scroll down and tap "Add to Home Screen"</li>
              <li>Tap "Add" in the top right</li>
            </ol>
          </div>
        ) : (
          <div>
            <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Install this app on your device for quick access like a native app.
            </p>
            <button
              onClick={handleInstallClick}
              className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Install App</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}