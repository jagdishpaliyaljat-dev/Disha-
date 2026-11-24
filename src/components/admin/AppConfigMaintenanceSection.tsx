import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Shield,
  Radio,
  Save,
  CheckCircle2,
  Clock,
  Send,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { appConfigService, GlobalAppConfig } from '../../utils/appConfigService';
import { triggerAdminToast } from '../../utils/adminToast';

export const AppConfigMaintenanceSection: React.FC = () => {
  const [config, setConfig] = useState<GlobalAppConfig>(() => appConfigService.getConfig());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = appConfigService.subscribe(setConfig);
    return unsub;
  }, []);

  const handleSave = () => {
    setSaving(true);
    appConfigService.updateConfig(config);
    setSaving(false);
    triggerAdminToast('System configuration & maintenance settings updated', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Maintenance Mode Card */}
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

      {/* Global Broadcast Announcement */}
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

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition"
        >
          <Save className="w-4 h-4" />
          <span>Save App Configuration</span>
        </button>
      </div>
    </div>
  );
};
