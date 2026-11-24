import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Radio,
  Save,
  CheckCircle2,
  Sparkles,
  Rocket,
  ShieldAlert,
  ArrowRight,
  Download,
  Eye,
  RefreshCw,
  Sliders,
  Check,
} from 'lucide-react';
import { appConfigService, GlobalAppConfig, VersionControlConfig } from '../../utils/appConfigService';
import { triggerAdminToast } from '../../utils/adminToast';
import { CURRENT_APP_VERSION, checkAppUpdateStatus } from '../../utils/versionUtils';
import { AppUpdateModal } from '../AppUpdateModal';

export const AppConfigMaintenanceSection: React.FC = () => {
  const [config, setConfig] = useState<GlobalAppConfig>(() => appConfigService.getConfig());
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const unsub = appConfigService.subscribe(setConfig);
    // Also fetch latest authoritative config from Supabase cloud on mount
    appConfigService.fetchFromCloud().then(setConfig).catch(() => {});
    return unsub;
  }, []);

  const vc: VersionControlConfig = config.versionControl || {
    latestVersion: CURRENT_APP_VERSION,
    minSupportedVersion: '1.0.51',
    forceUpdate: false,
    downloadUrl: 'https://github.com/jagdishpaliyaljat-dev/disha-20-20-app/releases/latest',
    releaseNotes: '• Fixed English vocabulary audio pronunciation in MCQs\n• High performance native Speech Synthesis engine\n• Offline stability and crash safeguards',
    title: 'New Update Available!',
    message: 'A newer, faster version of Disha 20-20 is available with new exam features and bug fixes.',
  };

  const updateVersionControl = (partial: Partial<VersionControlConfig>) => {
    setConfig({
      ...config,
      versionControl: {
        ...vc,
        ...partial,
      },
    });
  };

  const handleSave = () => {
    setSaving(true);
    appConfigService.updateConfig(config);
    setSaving(false);
    triggerAdminToast('Remote version control & system configuration synced to cloud!', 'success');
  };

  // Generate preview update result
  const previewUpdateResult = checkAppUpdateStatus(
    '1.0.50', // Simulate an older version running
    {
      ...config,
      versionControl: vc,
    }
  );

  return (
    <div className="space-y-6">
      {/* SECTION 1: REMOTE FORCE UPDATE & VERSION CONTROL DESK */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/30 shadow-xl shadow-amber-950/10 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Rocket className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white font-hindi">
                  Remote "Force Update" & Version Control Desk
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-black border border-amber-500/30">
                  LIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Remotely enforce APK updates, broadcast release notes, and deprecate older versions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">App Installed:</span>
            <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-emerald-400 font-mono font-bold text-xs border border-emerald-500/30">
              v{CURRENT_APP_VERSION}
            </span>
          </div>
        </div>

        {/* Version Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Latest Public Version */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Latest Published Version
            </label>
            <p className="text-[11px] text-slate-400 mb-2">
              The newest release on GitHub or Play Store
            </p>
            <input
              type="text"
              value={vc.latestVersion}
              onChange={(e) => updateVersionControl({ latestVersion: e.target.value.trim() })}
              placeholder="e.g. 1.0.52"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white font-mono font-bold focus:border-amber-400 outline-none"
            />
          </div>

          {/* Minimum Supported Version */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Minimum Supported Version
            </label>
            <p className="text-[11px] text-slate-400 mb-2">
              Versions below this are HARD-LOCKED immediately
            </p>
            <input
              type="text"
              value={vc.minSupportedVersion}
              onChange={(e) => updateVersionControl({ minSupportedVersion: e.target.value.trim() })}
              placeholder="e.g. 1.0.51"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white font-mono font-bold focus:border-amber-400 outline-none"
            />
          </div>

          {/* Strict Force Update Toggle */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-300">
                  Global Force Update Mode
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vc.forceUpdate}
                    onChange={(e) => updateVersionControl({ forceUpdate: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
              <p className="text-[11px] text-slate-400">
                {vc.forceUpdate
                  ? '⚠️ ALL older versions will be non-dismissibly blocked until updated.'
                  : 'Soft update enabled (users can dismiss or update).'}
              </p>
            </div>
            <div className="mt-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                vc.forceUpdate ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {vc.forceUpdate ? 'Hard Lock Active' : 'Flexible Soft Update'}
              </span>
            </div>
          </div>
        </div>

        {/* Download URL & Message Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Direct APK Download / Play Store URL
            </label>
            <input
              type="url"
              value={vc.downloadUrl}
              onChange={(e) => updateVersionControl({ downloadUrl: e.target.value.trim() })}
              placeholder="https://github.com/.../releases/latest"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-amber-400 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Update Modal Title
            </label>
            <input
              type="text"
              value={vc.title}
              onChange={(e) => updateVersionControl({ title: e.target.value })}
              placeholder="e.g. नया अपडेट उपलब्ध है!"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-amber-400 outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Student Announcement Message
            </label>
            <input
              type="text"
              value={vc.message}
              onChange={(e) => updateVersionControl({ message: e.target.value })}
              placeholder="e.g. A newer, faster version of Disha 20-20 is available with new exam features."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-amber-400 outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-300">
                Release Notes / What's New (One bullet point per line)
              </label>
              <span className="text-[11px] text-slate-400">Lines starting with • or - are formatted</span>
            </div>
            <textarea
              rows={4}
              value={vc.releaseNotes}
              onChange={(e) => updateVersionControl({ releaseNotes: e.target.value })}
              placeholder="• Fixed English vocabulary audio pronunciation in MCQs&#10;• Improved Android Speech Synthesis reliability&#10;• Offline stability and crash safeguards"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-hindi placeholder-slate-500 focus:border-amber-400 outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* Version Control Actions */}
        <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 border border-slate-700 transition cursor-pointer"
          >
            <Eye className="w-4 h-4 text-amber-400" />
            <span>Preview Student Update Screen</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save & Broadcast Version Policy</span>
          </button>
        </div>
      </div>

      {/* SECTION 2: EMERGENCY MAINTENANCE MODE */}
      <div className={`p-5 rounded-2xl border transition-all ${
        config.maintenance.enabled
          ? 'bg-rose-950/20 border-rose-600/50 shadow-lg shadow-rose-950/20'
          : 'bg-slate-900/60 border-slate-800'
      }`}>
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              config.maintenance.enabled ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Emergency Maintenance Mode
                {config.maintenance.enabled && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-extrabold uppercase animate-pulse">
                    ACTIVE NOW
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Gracefully blocks student app access and displays a custom announcement screen
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.maintenance.enabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  maintenance: { ...config.maintenance, enabled: e.target.checked },
                })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Maintenance Screen Title
            </label>
            <input
              type="text"
              value={config.maintenance.title}
              onChange={(e) =>
                setConfig({
                  ...config,
                  maintenance: { ...config.maintenance, title: e.target.value },
                })
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Whitelisted Admin Emails (Bypass Maintenance)
            </label>
            <input
              type="text"
              value={config.maintenance.allowedEmails.join(', ')}
              onChange={(e) =>
                setConfig({
                  ...config,
                  maintenance: {
                    ...config.maintenance,
                    allowedEmails: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  },
                })
              }
              placeholder="e.g. admin@disha.app, jagdishpaliyaljat@gmail.com"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Student Public Maintenance Message
            </label>
            <textarea
              rows={2}
              value={config.maintenance.message}
              onChange={(e) =>
                setConfig({
                  ...config,
                  maintenance: { ...config.maintenance, message: e.target.value },
                })
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: GLOBAL BROADCAST ANNOUNCEMENT */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Broadcast In-App Banner</h3>
              <p className="text-xs text-slate-400">Push immediate alert across all active student screens</p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.broadcast.enabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  broadcast: { ...config.broadcast, enabled: e.target.checked },
                })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-300 block mb-1">Banner Message</label>
            <input
              type="text"
              value={config.broadcast.message}
              onChange={(e) =>
                setConfig({
                  ...config,
                  broadcast: { ...config.broadcast, message: e.target.value },
                })
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Banner Type</label>
            <select
              value={config.broadcast.type}
              onChange={(e) =>
                setConfig({
                  ...config,
                  broadcast: {
                    ...config.broadcast,
                    type: e.target.value as any,
                  },
                })
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
            >
              <option value="info">Information (Blue)</option>
              <option value="warning">Warning (Amber)</option>
              <option value="critical">Critical Urgent (Rose)</option>
              <option value="success">Success / Celebration (Green)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Save Button Bar */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>Save All System Configurations</span>
        </button>
      </div>

      {/* Test Preview Modal */}
      {showPreview && (
        <AppUpdateModal
          isOpen={showPreview}
          updateInfo={previewUpdateResult}
          onDismiss={() => setShowPreview(false)}
          isPreview={true}
        />
      )}
    </div>
  );
};
