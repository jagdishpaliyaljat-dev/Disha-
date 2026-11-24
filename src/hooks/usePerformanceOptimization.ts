import { useState, useEffect } from 'react';
import {
  performanceOptimizer,
  PerformanceSettings,
  HardwareProfile,
  BatteryProfile,
  PerformanceTier,
} from '../utils/performanceOptimizer';

export interface UsePerformanceOptimizationReturn {
  settings: PerformanceSettings;
  hardware: HardwareProfile;
  battery: BatteryProfile;
  setTier: (tier: PerformanceTier) => void;
  updateSettings: (partial: Partial<PerformanceSettings>) => void;
  isPowerSaver: boolean;
  shouldReduceMotion: boolean;
}

export function usePerformanceOptimization(): UsePerformanceOptimizationReturn {
  const [settings, setSettings] = useState<PerformanceSettings>(() =>
    performanceOptimizer.getSettings()
  );
  const [hardware] = useState<HardwareProfile>(() =>
    performanceOptimizer.getHardwareProfile()
  );
  const [battery, setBattery] = useState<BatteryProfile>(() =>
    performanceOptimizer.getBatteryProfile()
  );

  useEffect(() => {
    const unsubscribe = performanceOptimizer.subscribe((updated) => {
      setSettings(updated);
      setBattery(performanceOptimizer.getBatteryProfile());
    });
    return unsubscribe;
  }, []);

  return {
    settings,
    hardware,
    battery,
    setTier: (tier) => performanceOptimizer.setTier(tier),
    updateSettings: (partial) => performanceOptimizer.updateSettings(partial),
    isPowerSaver: settings.tier === 'power_saver',
    shouldReduceMotion: settings.disableHeavyAnimations,
  };
}
