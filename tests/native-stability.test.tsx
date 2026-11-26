// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { handleHardwareBackAction } from '../src/utils/hardwareBackButton';
import { createGuestUserProfile, isGuestSession } from '../src/utils/guestManager';
import fs from 'node:fs';
import path from 'node:path';

describe('Task 1: Native Android Stability', () => {
  describe('Hardware Back Button Handler', () => {
    it('closes active modal first if a modal is open', () => {
      const onCloseModal = vi.fn();
      const onCloseDrawer = vi.fn();
      const onNavigateHome = vi.fn();
      const onExitApp = vi.fn();

      const handled = handleHardwareBackAction({
        activeModal: 'session',
        isDrawerOpen: false,
        activeTab: 'topics',
        onCloseModal,
        onCloseDrawer,
        onNavigateHome,
        onExitApp,
      });

      expect(handled).toBe(true);
      expect(onCloseModal).toHaveBeenCalledWith('session');
      expect(onCloseDrawer).not.toHaveBeenCalled();
      expect(onNavigateHome).not.toHaveBeenCalled();
      expect(onExitApp).not.toHaveBeenCalled();
    });

    it('closes drawer if drawer is open and no modal is open', () => {
      const onCloseModal = vi.fn();
      const onCloseDrawer = vi.fn();
      const onNavigateHome = vi.fn();
      const onExitApp = vi.fn();

      const handled = handleHardwareBackAction({
        activeModal: null,
        isDrawerOpen: true,
        activeTab: 'topics',
        onCloseModal,
        onCloseDrawer,
        onNavigateHome,
        onExitApp,
      });

      expect(handled).toBe(true);
      expect(onCloseDrawer).toHaveBeenCalledTimes(1);
      expect(onCloseModal).not.toHaveBeenCalled();
      expect(onNavigateHome).not.toHaveBeenCalled();
    });

    it('navigates to home if on another tab and no modal/drawer is open', () => {
      const onCloseModal = vi.fn();
      const onCloseDrawer = vi.fn();
      const onNavigateHome = vi.fn();
      const onExitApp = vi.fn();

      const handled = handleHardwareBackAction({
        activeModal: null,
        isDrawerOpen: false,
        activeTab: 'topics',
        onCloseModal,
        onCloseDrawer,
        onNavigateHome,
        onExitApp,
      });

      expect(handled).toBe(true);
      expect(onNavigateHome).toHaveBeenCalledTimes(1);
      expect(onExitApp).not.toHaveBeenCalled();
    });

    it('triggers exit logic when already on home tab with no open overlays', () => {
      const onCloseModal = vi.fn();
      const onCloseDrawer = vi.fn();
      const onNavigateHome = vi.fn();
      const onExitApp = vi.fn();

      const handled = handleHardwareBackAction({
        activeModal: null,
        isDrawerOpen: false,
        activeTab: 'home',
        onCloseModal,
        onCloseDrawer,
        onNavigateHome,
        onExitApp,
      });

      expect(handled).toBe(true);
      expect(onExitApp).toHaveBeenCalledTimes(1);
    });
  });

  describe('Guest Onboarding profile generator', () => {
    it('creates a valid guest user profile that is identified by isGuestSession', () => {
      const guest = createGuestUserProfile();
      expect(guest.id).toBe('guest');
      expect(guest.name).toContain('अतिथि');
      expect(isGuestSession(guest)).toBe(true);
    });

    it('renders "बिना लॉगिन जारी रखें" button in LoginPage source code', () => {
      const loginPath = path.resolve(import.meta.dirname, '../src/components/LoginPage.tsx');
      const content = fs.readFileSync(loginPath, 'utf8');
      expect(content).toContain('बिना लॉगिन जारी रखें');
    });
  });

  describe('Deep Linking and Manifest Configuration', () => {
    it('includes disha2020.in in AndroidManifest.xml intent-filter', () => {
      const manifestPath = path.resolve(import.meta.dirname, '../android/app/src/main/AndroidManifest.xml');
      const manifest = fs.readFileSync(manifestPath, 'utf8');
      expect(manifest).toContain('android:host="disha2020.in"');
      expect(manifest).toContain('android:host="www.disha2020.in"');
    });

    it('includes disha2020.in in capacitor.config.ts allowNavigation', () => {
      const configPath = path.resolve(import.meta.dirname, '../capacitor.config.ts');
      const config = fs.readFileSync(configPath, 'utf8');
      expect(config).toContain('disha2020.in');
      expect(config).toContain('www.disha2020.in');
    });
  });
});
