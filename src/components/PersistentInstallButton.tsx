import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PersistentInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
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
    setIsIOS(iOS);

    // Listen for beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      console.log('📦 Install prompt event received');
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for standalone mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const standaloneHandler = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    mediaQuery.addEventListener('change', standaloneHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      mediaQuery.removeEventListener('change', standaloneHandler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // On iOS, we can't trigger native prompt, so show instructions
      window.dispatchEvent(new CustomEvent('show-install-prompt'));
      return;
    }

    if (deferredPrompt) {
      // We have the prompt event, trigger it immediately
      console.log('🚀 Triggering install prompt');
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('✅ User accepted install');
      } else {
        console.log('❌ User dismissed install');
      }
      
      // Clear the prompt as it can only be used once
      setDeferredPrompt(null);
    } else {
      // No prompt event yet, show the instructions as fallback
      console.log('⚠️ No install prompt available, showing instructions');
      window.dispatchEvent(new CustomEvent('show-install-prompt'));
      
      // Also try to trigger the prompt by simulating user interaction
      // This helps in some browsers
      setTimeout(() => {
        const event = new Event('beforeinstallprompt');
        window.dispatchEvent(event);
      }, 100);
    }
  };

  if (isStandalone) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <button
        onClick={handleInstallClick}
        className={`flex items-center gap-2 px-6 py-3 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 ${
          theme === 'dark'
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-green-600 hover:bg-green-700 text-white'
        }`}
      >
        <Download className="w-5 h-5" />
        <span className="font-medium">Install App</span>
        <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Free</span>
      </button>
      
      {/* Small badge showing install availability */}
      {!deferredPrompt && !isIOS && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          <span className={`text-xs px-2 py-1 rounded-full ${
            theme === 'dark' 
              ? 'bg-yellow-900/50 text-yellow-300' 
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            ⚡ Tap to install
          </span>
        </div>
      )}
    </div>
  );
}