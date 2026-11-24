import { describe, it, expect, beforeEach } from 'vitest';
import { performanceOptimizer } from '../src/utils/performanceOptimizer';

describe('PerformanceOptimizerEngine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with valid hardware and battery profiles', () => {
    const hardware = performanceOptimizer.getHardwareProfile();
    expect(hardware).toBeDefined();
    expect(typeof hardware.deviceMemoryGB).toBe('number');
    expect(typeof hardware.isLowEndDevice).toBe('boolean');

    const battery = performanceOptimizer.getBatteryProfile();
    expect(battery).toBeDefined();
    expect(typeof battery.level).toBe('number');
  });

  it('switches to power_saver tier and applies conservative settings', () => {
    performanceOptimizer.setTier('power_saver');
    const settings = performanceOptimizer.getSettings();
    expect(settings.tier).toBe('power_saver');
    expect(settings.disableHeavyAnimations).toBe(true);
    expect(settings.reduceBlurAndShadows).toBe(true);
    expect(settings.enableVirtualization).toBe(true);
    expect(settings.maxBackgroundTasks).toBe(1);
    expect(settings.syncIntervalMs).toBe(90000);
  });

  it('switches to high tier and enables maximum features', () => {
    performanceOptimizer.setTier('high');
    const settings = performanceOptimizer.getSettings();
    expect(settings.tier).toBe('high');
    expect(settings.disableHeavyAnimations).toBe(false);
    expect(settings.maxBackgroundTasks).toBe(8);
    expect(settings.syncIntervalMs).toBe(20000);
  });

  it('persists customized settings in localStorage', () => {
    performanceOptimizer.updateSettings({ autoPowerSaveOnLowBattery: false });
    const settings = performanceOptimizer.getSettings();
    expect(settings.autoPowerSaveOnLowBattery).toBe(false);
  });
});
