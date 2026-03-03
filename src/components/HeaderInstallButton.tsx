import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function HeaderInstallButton() {
  const [isStandalone, setIsStandalone] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    const checkStandalone = () => {
      return window.matchMedia('(display-mode: standalone)').matches || 
             window.matchMedia('(display-mode: fullscreen)').matches ||
             (window.navigator as any).standalone === true;
    };
    setIsStandalone(checkStandalone());
  }, []);

  if (isStandalone) return null;

  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent('show-install-prompt'))}
      className={`p-2 rounded-lg transition-colors ${
        theme === 'dark' 
          ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' 
          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
      }`}
      title="Install App"
    >
      <Download className="w-5 h-5" />
    </button>
  );
}