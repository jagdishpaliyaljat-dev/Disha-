/**
 * Adaptive Performance & Battery Optimization Engine
 *
 * Provides real-time hardware detection, battery status monitoring,
 * and adaptive optimization tiers (HIGH, BALANCED, ULTRA_POWER_SAVER)
 * for low-end 2GB/4GB Android devices and battery longevity.
 */

export type PerformanceTier = 'high' | 'balanced' | 'power_saver';

export interface HardwareProfile {
  deviceMemoryGB: number;
  hardwareConcurrency: number;
  isLowEndDevice: boolean;
  saveDataEnabled: boolean;
  effectiveConnectionType?: string;
  supportsTouch: boolean;
}

export interface BatteryProfile {
  isSupported: boolean;
  level: number; // 0.0 to 1.0
  charging: boolean;
  dischargingTime: number;
}

export interface PerformanceSettings {
  tier: PerformanceTier;
  disableHeavyAnimations: boolean;
  reduceBlurAndShadows: boolean;
  enableVirtualization: boolean;
  maxBackgroundTasks: number;
  syncIntervalMs: number;
  prefetchImages: boolean;
  soundEffectsEnabled: boolean;
  hapticFeedbackEnabled: boolean;
  autoPowerSaveOnLowBattery: boolean;
}

const STORAGE_KEY = 'disha_adaptive_perf_settings_v1';

class PerformanceOptimizerEngine {
  private static instance: PerformanceOptimizerEngine;
  private hardware: HardwareProfile;
  private battery: BatteryProfile = {
    isSupported: false,
    level: 1.0,
    charging: true,
    dischargingTime: Infinity,
  };
  private settings: PerformanceSettings;
  private listeners: Set<(settings: PerformanceSettings) => void> = new Set();

  private constructor() {
    this.hardware = this.detectHardware();
    this.settings = this.loadInitialSettings();
    this.initBatteryMonitoring();
    this.initVisibilityListener();
  }

  public static getInstance(): PerformanceOptimizerEngine {
    if (!PerformanceOptimizerEngine.instance) {
      PerformanceOptimizerEngine.instance = new PerformanceOptimizerEngine();
    }
    return PerformanceOptimizerEngine.instance;
  }

  private detectHardware(): HardwareProfile {
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    const deviceMemory = nav && nav.deviceMemory ? Number(nav.deviceMemory) : 4;
    const hardwareConcurrency = nav && nav.hardwareConcurrency ? Number(nav.hardwareConcurrency) : 4;
    const connection = nav && (nav.connection || nav.mozConnection || nav.webkitConnection);
    const saveData = Boolean(connection && connection.saveData);
    const effectiveConnectionType = connection ? connection.effectiveType : '4g';
    const supportsTouch = typeof window !== 'undefined' && ('ontouchstart' in window || (nav && nav.maxTouchPoints > 0));

    // Devices with <= 4GB RAM or <= 4 CPU cores qualify as resource constrained
    const isLowEndDevice = deviceMemory <= 4 || hardwareConcurrency <= 4 || saveData;

    return {
      deviceMemoryGB: deviceMemory,
      hardwareConcurrency,
      isLowEndDevice,
      saveDataEnabled: saveData,
      effectiveConnectionType,
      supportsTouch,
    };
  }

  private loadInitialSettings(): PerformanceSettings {
    const defaultTier: PerformanceTier = this.hardware.isLowEndDevice ? 'power_saver' : 'balanced';

    const defaults: PerformanceSettings = {
      tier: defaultTier,
      disableHeavyAnimations: this.hardware.isLowEndDevice,
      reduceBlurAndShadows: this.hardware.isLowEndDevice,
      enableVirtualization: true,
      maxBackgroundTasks: this.hardware.isLowEndDevice ? 2 : 5,
      syncIntervalMs: this.hardware.isLowEndDevice ? 60000 : 30000,
      prefetchImages: !this.hardware.isLowEndDevice,
      soundEffectsEnabled: true,
      hapticFeedbackEnabled: true,
      autoPowerSaveOnLowBattery: true,
    };

    if (typeof localStorage === 'undefined') return defaults;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaults, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to parse stored performance settings', e);
    }

    return defaults;
  }

  private async initBatteryMonitoring() {
    if (typeof navigator === 'undefined' || !('getBattery' in navigator)) return;

    try {
      const batteryManager = await (navigator as any).getBattery();
      this.battery = {
        isSupported: true,
        level: batteryManager.level,
        charging: batteryManager.charging,
        dischargingTime: batteryManager.dischargingTime,
      };

      const handleBatteryChange = () => {
        this.battery = {
          isSupported: true,
          level: batteryManager.level,
          charging: batteryManager.charging,
          dischargingTime: batteryManager.dischargingTime,
        };

        // If battery drops below 20% and not charging, switch to power_saver if auto enabled
        if (
          this.settings.autoPowerSaveOnLowBattery &&
          !this.battery.charging &&
          this.battery.level <= 0.2 &&
          this.settings.tier !== 'power_saver'
        ) {
          this.setTier('power_saver');
        }
      };

      batteryManager.addEventListener('levelchange', handleBatteryChange);
      batteryManager.addEventListener('chargingchange', handleBatteryChange);
    } catch {
      // Battery API not available or permission denied
    }
  }

  private initVisibilityListener() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // App is in background: suspend intensive timers or transitions
        document.body.classList.add('app-battery-suspended');
      } else {
        document.body.classList.remove('app-battery-suspended');
      }
    });
  }

  public getHardwareProfile(): HardwareProfile {
    return { ...this.hardware };
  }

  public getBatteryProfile(): BatteryProfile {
    return { ...this.battery };
  }

  public getSettings(): PerformanceSettings {
    return { ...this.settings };
  }

  public setTier(tier: PerformanceTier) {
    let updates: Partial<PerformanceSettings> = { tier };

    if (tier === 'power_saver') {
      updates = {
        tier: 'power_saver',
        disableHeavyAnimations: true,
        reduceBlurAndShadows: true,
        enableVirtualization: true,
        maxBackgroundTasks: 1,
        syncIntervalMs: 90000,
        prefetchImages: false,
        soundEffectsEnabled: false,
        hapticFeedbackEnabled: false,
      };
    } else if (tier === 'balanced') {
      updates = {
        tier: 'balanced',
        disableHeavyAnimations: false,
        reduceBlurAndShadows: false,
        enableVirtualization: true,
        maxBackgroundTasks: 3,
        syncIntervalMs: 45000,
        prefetchImages: true,
        soundEffectsEnabled: true,
        hapticFeedbackEnabled: true,
      };
    } else if (tier === 'high') {
      updates = {
        tier: 'high',
        disableHeavyAnimations: false,
        reduceBlurAndShadows: false,
        enableVirtualization: true,
        maxBackgroundTasks: 8,
        syncIntervalMs: 20000,
        prefetchImages: true,
        soundEffectsEnabled: true,
        hapticFeedbackEnabled: true,
      };
    }

    this.updateSettings(updates);
  }

  public updateSettings(partial: Partial<PerformanceSettings>) {
    this.settings = { ...this.settings, ...partial };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      }
    } catch (e) {
      console.warn('Failed to persist performance settings', e);
    }

    this.applyDomOptimizations();
    this.notify();
  }

  public applyDomOptimizations() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    if (this.settings.disableHeavyAnimations) {
      root.classList.add('disable-animations');
    } else {
      root.classList.remove('disable-animations');
    }

    if (this.settings.reduceBlurAndShadows) {
      root.classList.add('reduce-graphics');
    } else {
      root.classList.remove('reduce-graphics');
    }
  }

  public subscribe(listener: (settings: PerformanceSettings) => void): () => void {
    this.listeners.add(listener);
    listener(this.settings);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.settings);
      } catch (e) {
        console.error('Error in performance settings listener', e);
      }
    }
  }
}

export const performanceOptimizer = PerformanceOptimizerEngine.getInstance();
