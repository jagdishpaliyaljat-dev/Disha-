/**
 * App Configuration & System Maintenance Service
 *
 * Manages global app configuration, maintenance mode, system broadcast alerts,
 * feature kill switches, and cloud sync.
 */

import { supabase } from '../services/supabase';

export interface MaintenanceWindow {
  enabled: boolean;
  title: string;
  message: string;
  allowedEmails: string[];
  startTime?: string;
  estimatedEndTime?: string;
  allowAdminBypass: boolean;
  contactSupportUrl?: string;
}

export interface SystemBroadcast {
  id: string;
  enabled: boolean;
  type: 'info' | 'warning' | 'critical' | 'success';
  message: string;
  actionUrl?: string;
  actionText?: string;
  updatedAt: string;
}

export interface GlobalAppConfig {
  version: string;
  maintenance: MaintenanceWindow;
  broadcast: SystemBroadcast;
  features: {
    leaderboardEnabled: boolean;
    dailyStreakEnabled: boolean;
    liveBattleEnabled: boolean;
    omrScannerEnabled: boolean;
    doubtDeskEnabled: boolean;
    pyqVaultEnabled: boolean;
  };
  minSupportedVersion: string;
  forceUpdateUrl?: string;
  updatedAt: string;
  updatedBy: string;
}

const APP_CONFIG_STORAGE_KEY = 'disha_global_app_config_v1';

export const DEFAULT_APP_CONFIG: GlobalAppConfig = {
  version: '1.0.51',
  maintenance: {
    enabled: false,
    title: 'Platform Scheduled Maintenance',
    message: 'We are optimizing exam servers and question databases. Services will be restored shortly.',
    allowedEmails: ['jagdishpaliyaljat@gmail.com', 'admin@disha.app'],
    allowAdminBypass: true,
  },
  broadcast: {
    id: 'broadcast-welcome',
    enabled: false,
    type: 'info',
    message: 'Welcome to Disha 20-20 Exam Prep!',
    updatedAt: new Date().toISOString(),
  },
  features: {
    leaderboardEnabled: true,
    dailyStreakEnabled: true,
    liveBattleEnabled: true,
    omrScannerEnabled: true,
    doubtDeskEnabled: true,
    pyqVaultEnabled: true,
  },
  minSupportedVersion: '1.0.0',
  updatedAt: new Date().toISOString(),
  updatedBy: 'System',
};

class AppConfigService {
  private static instance: AppConfigService;
  private config: GlobalAppConfig = DEFAULT_APP_CONFIG;
  private listeners: Set<(cfg: GlobalAppConfig) => void> = new Set();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): AppConfigService {
    if (!AppConfigService.instance) {
      AppConfigService.instance = new AppConfigService();
    }
    return AppConfigService.instance;
  }

  private loadFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(APP_CONFIG_STORAGE_KEY);
      if (stored) {
        this.config = { ...DEFAULT_APP_CONFIG, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to parse stored app config', e);
    }
  }

  public getConfig(): GlobalAppConfig {
    return { ...this.config };
  }

  public isMaintenanceActive(userEmail?: string | null): boolean {
    if (!this.config.maintenance.enabled) return false;

    // Check admin bypass
    if (this.config.maintenance.allowAdminBypass && userEmail) {
      const normalized = userEmail.toLowerCase().trim();
      const isAllowed = this.config.maintenance.allowedEmails.some(
        (email) => email.toLowerCase().trim() === normalized
      );
      if (isAllowed) return false;
    }

    return true;
  }

  public updateConfig(partial: Partial<GlobalAppConfig>, adminEmail: string = 'Super Admin'): GlobalAppConfig {
    this.config = {
      ...this.config,
      ...partial,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail,
    };

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(APP_CONFIG_STORAGE_KEY, JSON.stringify(this.config));
      } catch (e) {
        console.warn('Failed to persist app config to localStorage', e);
      }
    }

    this.notify();
    this.syncToCloud(this.config).catch(() => {});
    return this.config;
  }

  public async fetchFromCloud(): Promise<GlobalAppConfig> {
    try {
      if (!supabase) return this.config;
      const { data, error } = await supabase
        .from('app_system_configs')
        .select('*')
        .eq('id', 'global')
        .single();

      if (!error && data && data.config) {
        this.config = { ...this.config, ...data.config };
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(APP_CONFIG_STORAGE_KEY, JSON.stringify(this.config));
        }
        this.notify();
      }
    } catch {
      // Fallback to local
    }
    return this.config;
  }

  private async syncToCloud(cfg: GlobalAppConfig): Promise<void> {
    try {
      if (!supabase) return;
      await supabase.from('app_system_configs').upsert({
        id: 'global',
        config: cfg,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Ignore cloud sync network failure
    }
  }

  public subscribe(listener: (cfg: GlobalAppConfig) => void): () => void {
    this.listeners.add(listener);
    listener(this.config);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.config);
      } catch (e) {
        console.error('Error in app config listener', e);
      }
    }
  }
}

export const appConfigService = AppConfigService.getInstance();
