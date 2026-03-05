interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

class InstallHandler {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private listeners: ((canInstall: boolean) => void)[] = [];

  constructor() {
    this.init();
  }

  private init() {
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.notifyListeners(true);
    });

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      console.log('✅ PWA was installed');
      this.deferredPrompt = null;
      this.notifyListeners(false);
    });

    // Check if already installed
    this.checkIfInstalled();
  }

  private checkIfInstalled() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        window.matchMedia('(display-mode: fullscreen)').matches ||
                        (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      this.notifyListeners(false);
    }
  }

  private notifyListeners(canInstall: boolean) {
    this.listeners.forEach(listener => listener(canInstall));
  }

  public canInstall(): boolean {
    return this.deferredPrompt !== null;
  }

  public async install(): Promise<boolean> {
    // Method 1: Use beforeinstallprompt if available
    if (this.deferredPrompt) {
      try {
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        this.deferredPrompt = null;
        this.notifyListeners(false);
        return outcome === 'accepted';
      } catch (error) {
        console.error('Install prompt failed:', error);
      }
    }

    // Method 2: Try to use navigator.install (some browsers support this)
    if ((navigator as any).install) {
      try {
        await (navigator as any).install();
        return true;
      } catch (error) {
        console.error('navigator.install failed:', error);
      }
    }

    // Method 3: Try to trigger beforeinstallprompt again
    try {
      const event = new Event('beforeinstallprompt');
      window.dispatchEvent(event);
      
      // Wait a bit to see if the prompt appears
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (this.deferredPrompt) {
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        this.deferredPrompt = null;
        this.notifyListeners(false);
        return outcome === 'accepted';
      }
    } catch (error) {
      console.error('Retry install failed:', error);
    }

    return false;
  }

  public async installWithFallback(): Promise<{ success: boolean; method: string }> {
    // Try primary install method
    const installed = await this.install();
    if (installed) {
      return { success: true, method: 'native' };
    }

    // Check if it's a Samsung device
    const ua = navigator.userAgent;
    const isSamsung = /SamsungBrowser|SM-|GT-|SAMSUNG/i.test(ua);
    
    if (isSamsung) {
      return { 
        success: false, 
        method: 'samsung_fallback' 
      };
    }

    // Check if it's Xiaomi
    const isXiaomi = /MiuiBrowser|Xiaomi|Redmi|POCO/i.test(ua);
    if (isXiaomi) {
      return { 
        success: false, 
        method: 'xiaomi_fallback' 
      };
    }

    // Check if it's Huawei
    const isHuawei = /Huawei|Honor|EmotionUI/i.test(ua);
    if (isHuawei) {
      return { 
        success: false, 
        method: 'huawei_fallback' 
      };
    }

    return { success: false, method: 'none' };
  }

  public getDeviceInfo() {
    const ua = navigator.userAgent;
    return {
      isIOS: /iPad|iPhone|iPod/.test(ua),
      isSamsung: /SamsungBrowser|SM-|GT-|SAMSUNG/i.test(ua),
      isXiaomi: /MiuiBrowser|Xiaomi|Redmi|POCO/i.test(ua),
      isHuawei: /Huawei|Honor|EmotionUI/i.test(ua),
      isAndroid: /Android/.test(ua),
      browser: this.getBrowserName(ua),
      isStandalone: window.matchMedia('(display-mode: standalone)').matches ||
                   window.matchMedia('(display-mode: fullscreen)').matches ||
                   (window.navigator as any).standalone === true
    };
  }

  private getBrowserName(ua: string): string {
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('SamsungBrowser')) return 'Samsung Internet';
    if (ua.includes('MiuiBrowser')) return 'Mi Browser';
    return 'Unknown';
  }

  public subscribe(callback: (canInstall: boolean) => void) {
    this.listeners.push(callback);
    callback(this.canInstall());
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }
}

export const installHandler = new InstallHandler();