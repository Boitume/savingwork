import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
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
  const [isInstallable, setIsInstallable] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    // Check if already installed as PWA
    const checkStandalone = () => {
      return window.matchMedia('(display-mode: standalone)').matches || 
             window.matchMedia('(display-mode: fullscreen)').matches ||
             (window.navigator as any).standalone === true;
    };

    setIsStandalone(checkStandalone());

    // Check if iOS
    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua);
    
    if (iOS) {
      setIsIOS(true);
      // On iOS, always show the prompt after a short delay if not standalone
      if (!checkStandalone()) {
        setTimeout(() => setShowPrompt(true), 2000);
      }
      return;
    }

    // Handle beforeinstallprompt event for Android/Chrome
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for standalone mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const standaloneHandler = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    mediaQuery.addEventListener('change', standaloneHandler);

    // Listen for manual install trigger from buttons
    const showInstallHandler = () => {
      if (!checkStandalone()) {
        if (iOS) {
          // For iOS, just show the prompt with instructions
          setShowPrompt(true);
        } else {
          // For Android, if we have deferred prompt, use it
          if (deferredPrompt) {
            deferredPrompt.prompt();
          } else {
            // Otherwise just show the prompt
            setShowPrompt(true);
          }
        }
      }
    };

    window.addEventListener('show-install-prompt', showInstallHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('show-install-prompt', showInstallHandler);
      mediaQuery.removeEventListener('change', standaloneHandler);
    };
  }, [deferredPrompt, isIOS]);

  const handleInstallClick = async () => {
    if (isIOS) {
      // For iOS, we just show the instructions (already showing)
      return;
    }

    if (!deferredPrompt) {
      // If no deferred prompt, just show the instructions
      setShowPrompt(true);
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('✅ User accepted the install prompt');
      setShowPrompt(false);
    } else {
      console.log('❌ User dismissed the install prompt');
    }
    
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Store in localStorage that user dismissed
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  // Don't show if already installed
  if (isStandalone) {
    return null;
  }

  // Check if user dismissed in last 7 days
  const lastDismissed = localStorage.getItem('pwa-prompt-dismissed');
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  
  if (lastDismissed && parseInt(lastDismissed) > sevenDaysAgo) {
    return null;
  }

  // Don't show if not supposed to show
  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 animate-slide-up">
      <div className={`rounded-2xl shadow-2xl p-5 border ${
        theme === 'dark' 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${
              theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'
            }`}>
              <Smartphone className={`w-6 h-6 ${
                theme === 'dark' ? 'text-green-400' : 'text-green-600'
              }`} />
            </div>
            <div>
              <h3 className={`font-bold text-lg ${
                theme === 'dark' ? 'text-white' : 'text-gray-800'
              }`}>
                Install App
              </h3>
              <p className={`text-xs ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {isIOS ? 'Add to home screen' : 'Like a native banking app'}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className={`p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors`}
            aria-label="Close"
          >
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
          </button>
        </div>
        
        {isIOS ? (
          <div className="mt-2">
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Install this app on your iPhone for quick access:
            </p>
            <div className={`space-y-4 text-sm ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                }`}>1</div>
                <span>Tap the Share button <span className="text-xl inline-block ml-1">⎙</span></span>
              </div>
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                }`}>2</div>
                <span>Scroll down and tap <span className="font-semibold">"Add to Home Screen"</span></span>
              </div>
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                }`}>3</div>
                <span>Tap <span className="font-semibold">"Add"</span> in the top right</span>
              </div>
            </div>
            <div className={`mt-4 p-3 rounded-lg ${
              theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
            }`}>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                <span className="font-semibold">💡 Tip:</span> The app will appear on your home screen like any other app
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Install this app on your device for quick access like a native app.
            </p>
            <button
              onClick={handleInstallClick}
              className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-medium py-3 px-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg"
            >
              <Download className="w-5 h-5" />
              <span>{deferredPrompt ? 'Install Now' : 'How to Install'}</span>
            </button>
            <p className={`text-xs text-center mt-3 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`}>
              {deferredPrompt 
                ? 'Tap install and add to home screen' 
                : 'Use browser menu to add to home screen • Works offline'}
            </p>
          </div>
        )}
        
        {/* Small dismiss text */}
        <button
          onClick={handleDismiss}
          className={`text-xs text-center w-full mt-3 opacity-60 hover:opacity-100 transition-opacity ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Remind me later
        </button>
      </div>
    </div>
  );
}