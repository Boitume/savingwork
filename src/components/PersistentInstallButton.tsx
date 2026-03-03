import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function PersistentInstallButton() {
  const [isStandalone, setIsStandalone] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    const checkStandalone = () => {
      return window.matchMedia('(display-mode: standalone)').matches || 
             window.matchMedia('(display-mode: fullscreen)').matches ||
             (window.navigator as any).standalone === true;
    };

    setIsStandalone(checkStandalone());

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handler = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  if (isStandalone) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('show-install-prompt'))}
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
    </div>
  );
}