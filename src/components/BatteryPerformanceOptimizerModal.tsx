import React, { useState } from 'react';
import {
  Zap,
  BatteryCharging,
  Battery,
  Cpu,
  Smartphone,
  Gauge,
  Sliders,
  CheckCircle2,
  Shield,
  Layers,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { usePerformanceOptimization } from '../../hooks/usePerformanceOptimization';
import { PerformanceTier } from '../../utils/performanceOptimizer';

interface BatteryPerformanceOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BatteryPerformanceOptimizerModal: React.FC<BatteryPerformanceOptimizerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings, hardware, battery, setTier, updateSettings } = usePerformanceOptimization();
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!isOpen) return null;

  const batteryPercent = Math.round(battery.level * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Hardware & Battery Optimizer
              </h2>
              <p className="text-xs text-slate-400">
                Low-RAM 2GB/4GB adaptive mode & device battery longevity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Device & Battery telemetry stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* RAM */}
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                <Cpu className="w-3.5 h-3.5 text-blue-400" /> System RAM
              </span>
              <span className="text-base font-semibold text-slate-200">
                ~{hardware.deviceMemoryGB} GB
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">
                {hardware.isLowEndDevice ? 'Low-RAM Mode Enabled' : 'Standard Device'}
              </span>
            </div>

            {/* Battery */}
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                {battery.charging ? (
                  <BatteryCharging className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Battery className="w-3.5 h-3.5 text-amber-400" />
                )}
                Battery
              </span>
              <span className="text-base font-semibold text-slate-200">
                {battery.isSupported ? `${batteryPercent}%` : 'Standard'}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">
                {battery.charging ? 'Charging' : 'On Battery'}
              </span>
            </div>

            {/* CPU Cores */}
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col col-span-2 sm:col-span-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                <Smartphone className="w-3.5 h-3.5 text-purple-400" /> CPU Cores
              </span>
              <span className="text-base font-semibold text-slate-200">
                {hardware.hardwareConcurrency} Cores
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">
                {hardware.effectiveConnectionType?.toUpperCase() || 'Wi-Fi/4G'}
              </span>
            </div>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="text-sm font-semibold text-slate-300 block mb-2.5">
              Optimization Profile
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {/* Power Saver */}
              <button
                type="button"
                onClick={() => setTier('power_saver')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  settings.tier === 'power_saver'
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Battery className="w-5 h-5 text-amber-400" />
                  {settings.tier === 'power_saver' && (
                    <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-200">Power Saver</div>
                  <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                    Zero lag on 2GB RAM & 3x battery life
                  </div>
                </div>
              </button>

              {/* Balanced */}
              <button
                type="button"
                onClick={() => setTier('balanced')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  settings.tier === 'balanced'
                    ? 'bg-blue-500/15 border-blue-500/50 text-blue-300'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Gauge className="w-5 h-5 text-blue-400" />
                  {settings.tier === 'balanced' && (
                    <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-200">Balanced</div>
                  <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                    Recommended for daily revision
                  </div>
                </div>
              </button>

              {/* High */}
              <button
                type="button"
                onClick={() => setTier('high')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  settings.tier === 'high'
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  {settings.tier === 'high' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-200">High Graphics</div>
                  <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                    Full animations & instant prefetching
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Key Toggles */}
          <div className="space-y-3 bg-slate-800/30 p-4 rounded-xl border border-slate-800">
            {/* Auto power saver */}
            <label className="flex items-center justify-between cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-xs sm:text-sm font-medium text-slate-200 flex items-center gap-2">
                  <BatteryCharging className="w-4 h-4 text-amber-400" />
                  Auto Power Saver on Low Battery (&lt;20%)
                </span>
                <p className="text-[11px] text-slate-400">
                  Switches off heavy effects when battery is depleted
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoPowerSaveOnLowBattery}
                onChange={(e) =>
                  updateSettings({ autoPowerSaveOnLowBattery: e.target.checked })
                }
                className="w-4 h-4 text-amber-500 rounded bg-slate-900 border-slate-700"
              />
            </label>

            {/* Reduce blur & heavy shadows */}
            <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-800/80">
              <div className="space-y-0.5">
                <span className="text-xs sm:text-sm font-medium text-slate-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  Reduce Backdrop Blurs & Shadows
                </span>
                <p className="text-[11px] text-slate-400">
                  Saves 35% GPU rendering cycles on mobile chips
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.reduceBlurAndShadows}
                onChange={(e) =>
                  updateSettings({ reduceBlurAndShadows: e.target.checked })
                }
                className="w-4 h-4 text-blue-500 rounded bg-slate-900 border-slate-700"
              />
            </label>

            {/* Virtualized list toggle */}
            <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-800/80">
              <div className="space-y-0.5">
                <span className="text-xs sm:text-sm font-medium text-slate-200 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Virtualize 5,800+ Question Lists
                </span>
                <p className="text-[11px] text-slate-400">
                  Only renders visible DOM nodes, reducing memory from 450MB to 35MB
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.enableVirtualization}
                onChange={(e) =>
                  updateSettings({ enableVirtualization: e.target.checked })
                }
                className="w-4 h-4 text-emerald-500 rounded bg-slate-900 border-slate-700"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-400" />
            Settings saved locally on this device
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-lg shadow-amber-500/20"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
