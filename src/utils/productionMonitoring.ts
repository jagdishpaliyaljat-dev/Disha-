/**
 * DISHA 20-20 — Production Monitoring & Post-Launch Quality Control
 * 
 * Enterprise-grade client & runtime telemetry engine:
 * 1. Application availability & uptime tracking
 * 2. Safe error diagnostics (Zero-Secret scrubbing: passwords, keys, tokens stripped)
 * 3. React component error boundary reporting
 * 4. Database read/write and network failure detection
 * 5. Performance baselines (TTI, MCQ render, dashboard render, navigation latency)
 * 6. User experience monitoring (failed logins, abandoned test sessions)
 * 7. Automated health thresholds (CRITICAL, HIGH, MEDIUM, LOW)
 */

export type MonitoringCategory =
  | "RUNTIME_ERROR"
  | "UNHANDLED_PROMISE"
  | "REACT_ERROR"
  | "DATABASE_ERROR"
  | "AUTH_ERROR"
  | "NETWORK_FAILURE"
  | "PERFORMANCE_MARK"
  | "SYNC_EVENT";

export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface TelemetryLogEntry {
  id: string;
  timestamp: string;
  category: MonitoringCategory;
  severity: AlertSeverity;
  message: string;
  stack?: string;
  component?: string;
  durationMs?: number;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  initialLoadMs: number;
  dashboardRenderMs: number;
  mcqRenderAvgMs: number;
  navigationLatencyAvgMs: number;
  mcqRenderSamples: number;
  navigationSamples: number;
}

export interface UserJourneyMetrics {
  loginAttempts: number;
  loginSuccesses: number;
  loginFailures: number;
  testSessionsStarted: number;
  testSessionsCompleted: number;
  testSessionsAbandoned: number;
}

export interface AlertThresholdStatus {
  level: AlertSeverity;
  triggered: boolean;
  reason?: string;
}

export interface ProductionMonitoringSummary {
  status: "OPTIMAL" | "DEGRADED" | "CRITICAL";
  availabilityScore: number; // 0 - 100%
  totalOperations: number;
  totalErrors: number;
  errorRatePercentage: number;
  activeAlertLevel: AlertSeverity;
  alerts: AlertThresholdStatus[];
  performance: PerformanceMetrics;
  journeys: UserJourneyMetrics;
  recentLogs: TelemetryLogEntry[];
  isOnline: boolean;
  lastUpdated: string;
}

const MAX_LOG_BUFFER = 100;
const STORAGE_KEY = "disha_production_monitoring_v1";

// Sensitive data scrubbing patterns
const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/g,                     // Google API keys
  /bearer\s+[a-zA-Z0-9_\-\.]+/gi,               // Bearer tokens
  /password["':\s]+["']?([^"',\s]+)["']?/gi,     // Passwords
  /secret["':\s]+["']?([^"',\s]+)["']?/gi,       // Secrets
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // PII Emails (anonymized in logs)
];

function sanitizeMessage(input: string): string {
  if (!input || typeof input !== "string") return "";
  let sanitized = input;
  sanitized = sanitized.replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_API_KEY]");
  sanitized = sanitized.replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED_TOKEN]");
  sanitized = sanitized.replace(/(password|secret|pass|credential)["':\s]+["']?([^"',\s]+)["']?/gi, "$1: [REDACTED]");
  // Anonymize user emails to protect student privacy in production logs
  sanitized = sanitized.replace(/([a-zA-Z0-9._%+-]{2})[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "$1***$2");
  return sanitized;
}

function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes("password") || lowerKey.includes("token") || lowerKey.includes("secret") || lowerKey.includes("key")) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "string") {
      sanitized[key] = sanitizeMessage(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class ProductionMonitoringService {
  private logBuffer: TelemetryLogEntry[] = [];
  private totalOps = 0;
  private totalErrors = 0;
  private performance: PerformanceMetrics = {
    initialLoadMs: 0,
    dashboardRenderMs: 0,
    mcqRenderAvgMs: 0,
    navigationLatencyAvgMs: 0,
    mcqRenderSamples: 0,
    navigationSamples: 0,
  };
  private journeys: UserJourneyMetrics = {
    loginAttempts: 0,
    loginSuccesses: 0,
    loginFailures: 0,
    testSessionsStarted: 0,
    testSessionsCompleted: 0,
    testSessionsAbandoned: 0,
  };
  private listeners: Array<(summary: ProductionMonitoringSummary) => void> = [];
  private isInitialized = false;

  constructor() {
    this.restoreFromStorage();
    if (typeof window !== "undefined") {
      this.initBrowserListeners();
    }
  }

  private initBrowserListeners(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Measure initial page load timing via standard Navigation Timing API
    if (typeof window !== "undefined" && window.performance) {
      const measureLoad = () => {
        try {
          const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
          if (navEntries && navEntries.length > 0) {
            const nav = navEntries[0];
            const loadTime = Math.round(nav.loadEventEnd > 0 ? nav.loadEventEnd : performance.now());
            this.performance.initialLoadMs = loadTime;
          } else {
            this.performance.initialLoadMs = Math.round(performance.now());
          }
        } catch {
          this.performance.initialLoadMs = Math.round(performance.now());
        }
      };

      if (document.readyState === "complete") {
        measureLoad();
      } else {
        window.addEventListener("load", measureLoad, { once: true });
      }
    }

    // Global runtime uncaught error listener
    window.addEventListener("error", (event: ErrorEvent) => {
      // Ignore transient browser extension noise
      if (event.filename && (event.filename.includes("chrome-extension://") || event.filename.includes("moz-extension://"))) {
        return;
      }
      this.captureException(
        event.error || event.message,
        "RUNTIME_ERROR",
        "HIGH",
        {
          filename: event.filename ? sanitizeMessage(event.filename) : undefined,
          lineno: event.lineno,
          colno: event.colno,
        }
      );
    });

    // Unhandled Promise Rejections
    window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason instanceof Error ? reason.message : String(reason || "");
      
      // Ignore known benign Firestore offline warnings
      if (
        msg.includes("INTERNAL ASSERTION FAILED") ||
        msg.includes("Could not reach Cloud Firestore backend") ||
        msg.includes("the client is offline")
      ) {
        return;
      }

      this.captureException(reason, "UNHANDLED_PROMISE", "HIGH");
    });

    // Online / Offline state changes
    window.addEventListener("online", () => {
      this.captureEvent("SYNC_EVENT", "INFO", "Network status transitioned to ONLINE");
    });

    window.addEventListener("offline", () => {
      this.captureEvent("NETWORK_FAILURE", "LOW", "Network connection lost — client operating in offline mode");
    });
  }

  private restoreFromStorage(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.performance) this.performance = { ...this.performance, ...parsed.performance };
        if (parsed.journeys) this.journeys = { ...this.journeys, ...parsed.journeys };
        if (Array.isArray(parsed.recentLogs)) this.logBuffer = parsed.recentLogs.slice(-MAX_LOG_BUFFER);
        if (typeof parsed.totalOps === "number") this.totalOps = parsed.totalOps;
        if (typeof parsed.totalErrors === "number") this.totalErrors = parsed.totalErrors;
      }
    } catch {
      // Storage unavailable or corrupted; clean slate
    }
  }

  private persistToStorage(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const payload = {
        totalOps: this.totalOps,
        totalErrors: this.totalErrors,
        performance: this.performance,
        journeys: this.journeys,
        recentLogs: this.logBuffer.slice(-50), // Store last 50 for storage brevity
        lastSaved: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // LocalStorage full or quota restricted
    }
  }

  private notifyListeners(): void {
    const summary = this.getMonitoringSummary();
    for (const listener of this.listeners) {
      try {
        listener(summary);
      } catch (err) {
        console.error("[ProductionMonitoring] Listener error:", err);
      }
    }
  }

  public captureEvent(
    category: MonitoringCategory,
    severity: AlertSeverity,
    message: string,
    metadata?: Record<string, any>
  ): TelemetryLogEntry {
    this.totalOps++;
    const entry: TelemetryLogEntry = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      category,
      severity,
      message: sanitizeMessage(message),
      metadata: metadata ? sanitizeObject(metadata) : undefined,
    };

    this.logBuffer.push(entry);
    if (this.logBuffer.length > MAX_LOG_BUFFER) {
      this.logBuffer.shift();
    }

    this.persistToStorage();
    this.notifyListeners();
    return entry;
  }

  public captureException(
    error: unknown,
    category: MonitoringCategory = "RUNTIME_ERROR",
    severity: AlertSeverity = "HIGH",
    context?: Record<string, any>
  ): TelemetryLogEntry {
    this.totalOps++;
    this.totalErrors++;

    const rawMessage = error instanceof Error ? error.message : String(error || "Unknown Error");
    const rawStack = error instanceof Error ? error.stack : undefined;

    const entry: TelemetryLogEntry = {
      id: "err_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      category,
      severity,
      message: sanitizeMessage(rawMessage),
      stack: rawStack ? sanitizeMessage(rawStack.slice(0, 1000)) : undefined,
      metadata: context ? sanitizeObject(context) : undefined,
    };

    this.logBuffer.push(entry);
    if (this.logBuffer.length > MAX_LOG_BUFFER) {
      this.logBuffer.shift();
    }

    this.persistToStorage();
    this.notifyListeners();
    return entry;
  }

  public captureReactError(error: Error, errorInfo: any, componentName?: string): TelemetryLogEntry {
    return this.captureException(error, "REACT_ERROR", "CRITICAL", {
      component: componentName || "UnknownComponent",
      componentStack: errorInfo?.componentStack ? sanitizeMessage(errorInfo.componentStack.slice(0, 800)) : undefined,
    });
  }

  public recordPerformanceMetric(name: "dashboard_render" | "mcq_render" | "navigation_latency", durationMs: number): void {
    if (durationMs <= 0) return;
    
    if (name === "dashboard_render") {
      this.performance.dashboardRenderMs = Math.round(durationMs);
    } else if (name === "mcq_render") {
      const prevTotal = this.performance.mcqRenderAvgMs * this.performance.mcqRenderSamples;
      this.performance.mcqRenderSamples++;
      this.performance.mcqRenderAvgMs = Math.round((prevTotal + durationMs) / this.performance.mcqRenderSamples);
    } else if (name === "navigation_latency") {
      const prevTotal = this.performance.navigationLatencyAvgMs * this.performance.navigationSamples;
      this.performance.navigationSamples++;
      this.performance.navigationLatencyAvgMs = Math.round((prevTotal + durationMs) / this.performance.navigationSamples);
    }

    this.persistToStorage();
    this.notifyListeners();
  }

  public recordUserJourney(
    journey: "login" | "test_session",
    action: "start" | "success" | "failure" | "abandon",
    metadata?: Record<string, any>
  ): void {
    if (journey === "login") {
      if (action === "start") this.journeys.loginAttempts++;
      else if (action === "success") this.journeys.loginSuccesses++;
      else if (action === "failure") {
        this.journeys.loginFailures++;
        this.captureEvent("AUTH_ERROR", "MEDIUM", "Failed user login attempt", metadata);
      }
    } else if (journey === "test_session") {
      if (action === "start") this.journeys.testSessionsStarted++;
      else if (action === "success") this.journeys.testSessionsCompleted++;
      else if (action === "abandon") {
        this.journeys.testSessionsAbandoned++;
        this.captureEvent("PERFORMANCE_MARK", "LOW", "Test session abandoned prior to completion", metadata);
      }
    }

    this.persistToStorage();
    this.notifyListeners();
  }

  public evaluateAlertThresholds(): { activeLevel: AlertSeverity; alerts: AlertThresholdStatus[] } {
    const errorRate = this.totalOps > 0 ? (this.totalErrors / this.totalOps) * 100 : 0;
    const loginFailRate = this.journeys.loginAttempts > 0 
      ? (this.journeys.loginFailures / this.journeys.loginAttempts) * 100 
      : 0;

    const alerts: AlertThresholdStatus[] = [
      {
        level: "CRITICAL",
        triggered: errorRate > 5.0 || loginFailRate > 25.0,
        reason: errorRate > 5.0 
          ? `CRITICAL Alert: Error rate (${errorRate.toFixed(1)}%) exceeded 5.0% threshold.`
          : loginFailRate > 25.0
          ? `CRITICAL Alert: Auth failure rate (${loginFailRate.toFixed(1)}%) exceeded 25% threshold.`
          : undefined,
      },
      {
        level: "HIGH",
        triggered: (errorRate >= 2.0 && errorRate <= 5.0) || this.performance.navigationLatencyAvgMs > 1200,
        reason: errorRate >= 2.0
          ? `HIGH Alert: Error rate elevated at ${errorRate.toFixed(1)}%.`
          : this.performance.navigationLatencyAvgMs > 1200
          ? `HIGH Alert: Navigation latency (${this.performance.navigationLatencyAvgMs}ms) exceeded 1200ms.`
          : undefined,
      },
      {
        level: "MEDIUM",
        triggered: (errorRate >= 0.5 && errorRate < 2.0) || this.performance.mcqRenderAvgMs > 500,
        reason: errorRate >= 0.5
          ? `MEDIUM Notice: Minor error activity detected (${errorRate.toFixed(1)}%).`
          : this.performance.mcqRenderAvgMs > 500
          ? `MEDIUM Notice: MCQ render latency (${this.performance.mcqRenderAvgMs}ms) elevated.`
          : undefined,
      },
      {
        level: "LOW",
        triggered: this.journeys.testSessionsAbandoned > 0,
        reason: this.journeys.testSessionsAbandoned > 0
          ? `LOW: ${this.journeys.testSessionsAbandoned} abandoned test sessions registered.`
          : undefined,
      },
    ];

    let activeLevel: AlertSeverity = "INFO";
    if (alerts[0].triggered) activeLevel = "CRITICAL";
    else if (alerts[1].triggered) activeLevel = "HIGH";
    else if (alerts[2].triggered) activeLevel = "MEDIUM";
    else if (alerts[3].triggered) activeLevel = "LOW";

    return { activeLevel, alerts };
  }

  public getMonitoringSummary(): ProductionMonitoringSummary {
    const errorRate = this.totalOps > 0 ? (this.totalErrors / this.totalOps) * 100 : 0;
    const availabilityScore = Math.max(0, Math.min(100, Math.round(100 - errorRate * 2)));
    const { activeLevel, alerts } = this.evaluateAlertThresholds();

    let status: "OPTIMAL" | "DEGRADED" | "CRITICAL" = "OPTIMAL";
    if (activeLevel === "CRITICAL") status = "CRITICAL";
    else if (activeLevel === "HIGH" || activeLevel === "MEDIUM") status = "DEGRADED";

    return {
      status,
      availabilityScore,
      totalOperations: this.totalOps,
      totalErrors: this.totalErrors,
      errorRatePercentage: Number(errorRate.toFixed(2)),
      activeAlertLevel: activeLevel,
      alerts,
      performance: { ...this.performance },
      journeys: { ...this.journeys },
      recentLogs: [...this.logBuffer],
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      lastUpdated: new Date().toISOString(),
    };
  }

  public subscribe(listener: (summary: ProductionMonitoringSummary) => void): () => void {
    this.listeners.push(listener);
    listener(this.getMonitoringSummary());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public clearBuffer(): void {
    this.logBuffer = [];
    this.totalOps = 0;
    this.totalErrors = 0;
    this.persistToStorage();
    this.notifyListeners();
  }
}

// Global Singleton Export
export const productionMonitor = new ProductionMonitoringService();
