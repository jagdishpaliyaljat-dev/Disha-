import { App as CapacitorApp } from '@capacitor/app';
import { isNativePlatform } from './mobileAuthService';

export interface HardwareBackContext {
  activeModal: string | null;
  isDrawerOpen: boolean;
  activeTab: string;
  hasSubView?: boolean;
  canGoBackTab?: boolean;
  onCloseModal: (modalName: string) => void;
  onCloseDrawer: () => void;
  onBackSubView?: () => boolean | void;
  onNavigateBackTab?: () => void;
  onNavigateHome: () => void;
  onExitApp: () => void;
}

let lastBackPressTime = 0;

/**
 * Resets the double-tap exit timer (useful for deterministic unit tests).
 */
export function _resetBackPressTimeForTests(): void {
  lastBackPressTime = 0;
}

/**
 * Pure evaluation function that determines and executes the priority back action.
 * Priority order:
 * 1. Close active modal overlay if open
 * 2. Close navigation drawer if open
 * 3. Step back in nested hierarchical subview (Topic -> Chapter -> Subject -> Root)
 * 4. Step back through tab navigation history (Profile -> Live Tests -> Home)
 * 5. Navigate to 'home' tab if currently on any other tab
 * 6. Exit application if already on root 'home' screen
 */
export function handleHardwareBackAction(ctx: HardwareBackContext): boolean {
  // 1. Close active modal if open
  if (ctx.activeModal) {
    ctx.onCloseModal(ctx.activeModal);
    return true;
  }

  // 2. Close navigation drawer if open
  if (ctx.isDrawerOpen) {
    ctx.onCloseDrawer();
    return true;
  }

  // 3. Hierarchical drill-down subview navigation
  if (ctx.hasSubView && ctx.onBackSubView) {
    const handled = ctx.onBackSubView();
    if (handled !== false) {
      return true;
    }
  }

  // 4. Tab navigation history stack
  if (ctx.canGoBackTab && ctx.onNavigateBackTab) {
    ctx.onNavigateBackTab();
    return true;
  }

  // 5. Navigate to root 'home' tab if on another tab
  if (ctx.activeTab !== 'home') {
    ctx.onNavigateHome();
    return true;
  }

  // 6. Already at root 'home' screen: trigger exit logic
  ctx.onExitApp();
  return true;
}

/**
 * Registers native Capacitor hardware back button listener with 2-second double-tap exit safeguard.
 * Double-tap exit triggers ONLY when at the root home view with no modals, drawers, subviews, or tab history.
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

      // Only prompt or exit when completely at root home (no overlays, no subviews, no tab history)
      const isAtRootHome =
        !ctx.activeModal &&
        !ctx.isDrawerOpen &&
        !ctx.hasSubView &&
        ctx.activeTab === 'home' &&
        !ctx.canGoBackTab;

      if (isAtRootHome) {
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
