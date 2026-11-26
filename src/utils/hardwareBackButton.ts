import { App as CapacitorApp } from '@capacitor/app';
import { isNativePlatform } from './mobileAuthService';

export interface HardwareBackContext {
  activeModal: string | null;
  isDrawerOpen: boolean;
  activeTab: string;
  onCloseModal: (modalName: string) => void;
  onCloseDrawer: () => void;
  onNavigateHome: () => void;
  onExitApp: () => void;
}

let lastBackPressTime = 0;

/**
 * Pure evaluation function that determines and executes the priority back action.
 * Priority order:
 * 1. Close active modal if open
 * 2. Close navigation drawer if open
 * 3. Navigate to 'home' tab if on any sub-tab/view
 * 4. Exit application if already on root 'home' tab
 */
export function handleHardwareBackAction(ctx: HardwareBackContext): boolean {
  if (ctx.activeModal) {
    ctx.onCloseModal(ctx.activeModal);
    return true;
  }

  if (ctx.isDrawerOpen) {
    ctx.onCloseDrawer();
    return true;
  }

  if (ctx.activeTab !== 'home') {
    ctx.onNavigateHome();
    return true;
  }

  ctx.onExitApp();
  return true;
}

/**
 * Registers native Capacitor hardware back button listener with 2-second double-tap exit safeguard.
 */
export function registerCapacitorBackListener(
  getContext: () => HardwareBackContext,
  showExitToast?: (message: string) => void
): () => void {
  if (!isNativePlatform()) {
    return () => {};
  }

  let removeListener: (() => void) | null = null;

  try {
    const handle = CapacitorApp.addListener('backButton', () => {
      const ctx = getContext();

      // If we are on root home tab with no open overlays, enforce double-tap within 2000ms
      if (!ctx.activeModal && !ctx.isDrawerOpen && ctx.activeTab === 'home') {
        const now = Date.now();
        if (now - lastBackPressTime < 2000) {
          CapacitorApp.exitApp();
        } else {
          lastBackPressTime = now;
          if (showExitToast) {
            showExitToast('बाहर निकलने के लिए दोबारा बैक बटन दबाएं');
          }
        }
        return;
      }

      handleHardwareBackAction(ctx);
    });

    handle.then((sub) => {
      removeListener = () => sub.remove();
    }).catch(() => {});
  } catch (err) {
    console.warn('Capacitor backButton listener registration skipped:', err);
  }

  return () => {
    if (removeListener) removeListener();
  };
}
