import { AIProvider } from "../types";
import { executeAICompletion } from "./aiProviderService";

export type AIRotationPolicy = "priority_failover" | "round_robin";

export type AIKeyHealthStatus = 
  | "available" 
  | "rate_limited" 
  | "quota_exhausted" 
  | "temporarily_unavailable" 
  | "auth_failed" 
  | "disabled";

export interface AIKeyEntry {
  id: string;
  name: string;
  provider: AIProvider;
  apiKey: string; // Plain decrypted key held strictly in-memory on server
  model: string;
  enabled: boolean;
  priority: number; // 1 = Highest, 2, 3...
  status: AIKeyHealthStatus;
  isSystem: boolean;
  requestsTotal: number;
  requestsToday: number;
  successTotal: number;
  errorsTotal: number;
  lastUsedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  cooldownUntil: number; // timestamp in ms
  consecutiveErrors: number;
  createdAt: string;
}

export interface FailoverEvent {
  id: string;
  timestamp: string;
  eventType: "failover" | "rotation" | "cooldown_recovery" | "status_reset" | "all_exhausted";
  fromKeyId?: string;
  fromKeyName?: string;
  toKeyId?: string;
  toKeyName?: string;
  provider?: string;
  model?: string;
  reason?: string;
  errorStatus?: string;
}

export interface ExecuteWithFailoverOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  jsonMode?: boolean;
  reqOverride?: {
    apiKey?: string;
    provider?: AIProvider;
    model?: string;
  };
  maxAttempts?: number;
}

export interface FailoverExecutionResult {
  text: string;
  usedConfig: {
    id: string;
    name: string;
    provider: AIProvider;
    model: string;
  };
  attemptsCount: number;
  failoversOccurred: number;
}

class AIRotationManager {
  private keys: Map<string, AIKeyEntry> = new Map();
  private policy: AIRotationPolicy = "priority_failover";
  private roundRobinPointer = 0;
  private failoverHistory: FailoverEvent[] = [];
  private readonly MAX_HISTORY_EVENTS = 50;

  constructor() {
    // History initialization
  }

  /**
   * Sets the rotation strategy policy
   */
  public setPolicy(policy: AIRotationPolicy) {
    this.policy = policy;
  }

  public getPolicy(): AIRotationPolicy {
    return this.policy;
  }

  /**
   * Register or update a key in the in-memory pool.
   * If key already exists, updates properties while preserving stats.
   */
  public registerKey(config: {
    id: string;
    name: string;
    provider: AIProvider;
    apiKey: string;
    model: string;
    enabled?: boolean;
    priority?: number;
    isSystem?: boolean;
    createdAt?: string;
  }) {
    if (!config.apiKey || !config.apiKey.trim()) return;

    const existing = this.keys.get(config.id);
    const now = new Date().toISOString();

    const entry: AIKeyEntry = {
      id: config.id,
      name: config.name || `${config.provider.toUpperCase()} Key`,
      provider: config.provider,
      apiKey: config.apiKey.trim(),
      model: config.model || "gemini-3.1-flash-lite",
      enabled: config.enabled ?? (existing ? existing.enabled : true),
      priority: config.priority ?? (existing ? existing.priority : this.keys.size + 1),
      status: (config.enabled === false) ? "disabled" : (existing?.status && existing.status !== "disabled" ? existing.status : "available"),
      isSystem: config.isSystem ?? (config.id === "system-gemini"),
      requestsTotal: existing?.requestsTotal || 0,
      requestsToday: existing?.requestsToday || 0,
      successTotal: existing?.successTotal || 0,
      errorsTotal: existing?.errorsTotal || 0,
      lastUsedAt: existing?.lastUsedAt || null,
      lastSuccessAt: existing?.lastSuccessAt || null,
      lastErrorAt: existing?.lastErrorAt || null,
      lastError: existing?.lastError || null,
      cooldownUntil: existing?.cooldownUntil || 0,
      consecutiveErrors: existing?.consecutiveErrors || 0,
      createdAt: config.createdAt || existing?.createdAt || now,
    };

    this.keys.set(config.id, entry);
  }

  /**
   * Remove a key from the pool
   */
  public removeKey(id: string) {
    this.keys.delete(id);
  }

  /**
   * Toggle key enabled/disabled status
   */
  public toggleKey(id: string, enabled: boolean) {
    const entry = this.keys.get(id);
    if (!entry) return;
    entry.enabled = enabled;
    entry.status = enabled ? "available" : "disabled";
    if (enabled) {
      entry.cooldownUntil = 0;
      entry.consecutiveErrors = 0;
    }
  }

  /**
   * Manually reset key cooldown & error status to available
   */
  public resetKeyStatus(id: string): boolean {
    const entry = this.keys.get(id);
    if (!entry) return false;
    entry.status = entry.enabled ? "available" : "disabled";
    entry.cooldownUntil = 0;
    entry.consecutiveErrors = 0;
    entry.lastError = null;

    this.recordEvent({
      eventType: "status_reset",
      toKeyId: entry.id,
      toKeyName: entry.name,
      provider: entry.provider,
      model: entry.model,
      reason: "Admin manually reset cooldown & restored status to Available.",
    });

    return true;
  }

  /**
   * Update key priority orders in batch
   */
  public updatePriorities(priorityMap: Record<string, number>) {
    for (const [id, priority] of Object.entries(priorityMap)) {
      const entry = this.keys.get(id);
      if (entry) {
        entry.priority = priority;
      }
    }
  }

  /**
   * Evaluate cooldown expirations and return all available eligible candidates
   */
  private getEligibleKeys(): AIKeyEntry[] {
    const now = Date.now();
    const result: AIKeyEntry[] = [];

    for (const key of this.keys.values()) {
      if (!key.enabled) {
        key.status = "disabled";
        continue;
      }

      // Check if cooldown has expired for rate limited or temporarily unavailable keys
      if (
        (key.status === "rate_limited" || key.status === "temporarily_unavailable") &&
        key.cooldownUntil > 0 &&
        now >= key.cooldownUntil
      ) {
        const oldStatus = key.status;
        key.status = "available";
        key.cooldownUntil = 0;
        key.consecutiveErrors = 0;

        this.recordEvent({
          eventType: "cooldown_recovery",
          toKeyId: key.id,
          toKeyName: key.name,
          provider: key.provider,
          model: key.model,
          reason: `Automatic cooldown elapsed. Recovered from ${oldStatus} to Available.`,
        });
      }

      if (key.status === "available") {
        result.push(key);
      }
    }

    return result;
  }

  /**
   * Selects an ordered list of keys to attempt for the current execution
   */
  private getCandidateSequence(excludedIds: Set<string>): AIKeyEntry[] {
    const eligible = this.getEligibleKeys().filter(k => !excludedIds.has(k.id));
    if (eligible.length === 0) return [];

    if (this.policy === "priority_failover") {
      // Sort primarily by priority (1 is highest), secondarily by least errors, third by least requests today
      return [...eligible].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.errorsTotal !== b.errorsTotal) return a.errorsTotal - b.errorsTotal;
        return a.requestsToday - b.requestsToday;
      });
    } else {
      // Round-robin rotation across available keys
      // Sort consistently by priority/id first
      const sorted = [...eligible].sort((a, b) => (a.priority - b.priority) || a.id.localeCompare(b.id));
      const n = sorted.length;
      const startIdx = Math.abs(this.roundRobinPointer++) % n;
      const reordered: AIKeyEntry[] = [];
      for (let i = 0; i < n; i++) {
        reordered.push(sorted[(startIdx + i) % n]);
      }
      return reordered;
    }
  }

  /**
   * Classify error into a health status, cooldown duration (ms), and descriptive message
   */
  public classifyError(error: any): {
    status: AIKeyHealthStatus;
    cooldownMs: number;
    description: string;
    isQuotaExhausted: boolean;
    isAuthError: boolean;
  } {
    const msg = String(error?.message || error || "").toLowerCase();

    // 1. Auth / Invalid Key (HTTP 401, 403, invalid key)
    if (
      msg.includes("401") ||
      msg.includes("403") ||
      msg.includes("api key not valid") ||
      msg.includes("api_key_invalid") ||
      msg.includes("invalid api key") ||
      msg.includes("unauthorized") ||
      msg.includes("forbidden") ||
      msg.includes("permission_denied")
    ) {
      return {
        status: "auth_failed",
        cooldownMs: 86400000, // 24 hours until manually reconfigured
        description: "Authentication Failed: API Key is invalid or missing required permissions.",
        isQuotaExhausted: false,
        isAuthError: true,
      };
    }

    // 2. Rate Limit vs Quota Exhausted (HTTP 429, RESOURCE_EXHAUSTED)
    if (
      msg.includes("429") ||
      msg.includes("resource_exhausted") ||
      msg.includes("rate limit") ||
      msg.includes("rate_limit") ||
      msg.includes("too many requests") ||
      msg.includes("quota")
    ) {
      // Check if it's permanent/daily quota exhaustion vs temporary per-minute rate limit
      const isDailyOrHardQuota =
        msg.includes("quota exceeded") ||
        msg.includes("insufficient quota") ||
        msg.includes("billing") ||
        msg.includes("credits") ||
        msg.includes("daily limit");

      if (isDailyOrHardQuota) {
        return {
          status: "quota_exhausted",
          cooldownMs: 3600000, // 1 hour cooldown for hard quota
          description: "Quota Exhausted: Account credit or daily limit reached on provider.",
          isQuotaExhausted: true,
          isAuthError: false,
        };
      }

      // Per-minute rate limit: try to parse retry-after, else default 60s
      let waitSeconds = 60;
      const retryMatch = msg.match(/retry(?:-after|\s+in)?\s*:?\s*(\d+)/i);
      if (retryMatch && Number(retryMatch[1]) > 0 && Number(retryMatch[1]) < 3600) {
        waitSeconds = Number(retryMatch[1]);
      }

      return {
        status: "rate_limited",
        cooldownMs: waitSeconds * 1000,
        description: `Rate Limit (429) hit. Cooldown active for ${waitSeconds} seconds.`,
        isQuotaExhausted: false,
        isAuthError: false,
      };
    }

    // 3. Transient Server or Network Error (500, 502, 503, 504, timeout, disconnect)
    if (
      msg.includes("500") ||
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("504") ||
      msg.includes("overloaded") ||
      msg.includes("timed out") ||
      msg.includes("timeout") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("fetch failed") ||
      msg.includes("network error")
    ) {
      return {
        status: "temporarily_unavailable",
        cooldownMs: 30000, // 30 seconds transient cooldown
        description: `Provider temporarily unavailable or timed out: ${error?.message || "Transient server error"}`,
        isQuotaExhausted: false,
        isAuthError: false,
      };
    }

    // Generic error: short 20s cooldown so other keys can be tried
    return {
      status: "temporarily_unavailable",
      cooldownMs: 20000,
      description: `Execution error: ${error?.message || "Unknown error"}`,
      isQuotaExhausted: false,
      isAuthError: false,
    };
  }

  /**
   * Main Dispatch: Executes AI completion with automatic multi-key rotation and instant failover.
   * If a key encounters rate limit (429), quota exhaustion, or server error (5xx/timeout),
   * the manager marks the key with cooldown, records the failover event,
   * switches to the next available key immediately, and retries.
   */
  public async executeWithFailover(options: ExecuteWithFailoverOptions): Promise<FailoverExecutionResult> {
    const { prompt, systemPrompt, temperature, jsonMode, reqOverride } = options;

    // 1. If explicit header/request override with fresh key was provided
    if (reqOverride?.apiKey && reqOverride.apiKey.trim().length > 0 && !reqOverride.apiKey.includes("••••")) {
      const customProvider = reqOverride.provider || "gemini";
      const customModel = reqOverride.model || (customProvider === "openai" ? "gpt-4o-mini" : customProvider === "claude" ? "claude-3-5-haiku-20241022" : customProvider === "groq" ? "llama-3.3-70b-specdec" : "gemini-3.1-flash-lite");
      
      const responseText = await executeAICompletion({
        provider: customProvider,
        apiKey: reqOverride.apiKey.trim(),
        model: customModel,
        prompt,
        systemPrompt,
        temperature,
        jsonMode,
      });

      return {
        text: responseText,
        usedConfig: {
          id: "request_override",
          name: "Client Header Override",
          provider: customProvider,
          model: customModel,
        },
        attemptsCount: 1,
        failoversOccurred: 0,
      };
    }

    // 2. Multi-Key Rotation and Failover Loop
    const excludedIds = new Set<string>();
    const sequence = this.getCandidateSequence(excludedIds);

    if (sequence.length === 0) {
      // Check if all keys are in cooldown
      const allEnabled = Array.from(this.keys.values()).filter(k => k.enabled);
      if (allEnabled.length === 0) {
        throw new Error("No active AI API keys configured. Please configure at least one enabled AI API Key in Admin Settings.");
      }

      // Check nearest cooldown expiry
      const now = Date.now();
      const inCooldown = allEnabled.filter(k => k.cooldownUntil > now);
      if (inCooldown.length > 0) {
        inCooldown.sort((a, b) => a.cooldownUntil - b.cooldownUntil);
        const earliest = inCooldown[0];
        const waitSec = Math.max(1, Math.ceil((earliest.cooldownUntil - now) / 1000));
        throw new Error(
          `All ${allEnabled.length} configured AI API keys are currently in cooldown or rate-limited. Next key (${earliest.name}) recovers in ${waitSec} seconds. You can also click 'Reset Cooldown' in Admin Panel.`
        );
      }

      throw new Error("All configured AI API keys are currently disabled or unavailable. Please review keys in Admin Settings.");
    }

    let attemptsCount = 0;
    let failoversOccurred = 0;
    const errorsEncountered: { keyName: string; provider: string; error: string }[] = [];

    // Attempt candidates in sequence
    for (let i = 0; i < sequence.length; i++) {
      const currentKey = sequence[i];
      attemptsCount++;
      const nowIso = new Date().toISOString();

      currentKey.requestsTotal++;
      currentKey.requestsToday++;
      currentKey.lastUsedAt = nowIso;

      try {
        console.log(`[AIRotationManager] Dispatching to key: "${currentKey.name}" (${currentKey.provider} / ${currentKey.model}) [Priority: ${currentKey.priority}, Attempt: ${attemptsCount}]`);

        const responseText = await executeAICompletion({
          provider: currentKey.provider,
          apiKey: currentKey.apiKey,
          model: currentKey.model,
          prompt,
          systemPrompt,
          temperature,
          jsonMode,
        });

        if (!responseText || !responseText.trim()) {
          throw new Error("Received empty completion from provider.");
        }

        // Success! Update metrics
        currentKey.successTotal++;
        currentKey.lastSuccessAt = new Date().toISOString();
        currentKey.consecutiveErrors = 0;
        currentKey.status = "available";

        return {
          text: responseText,
          usedConfig: {
            id: currentKey.id,
            name: currentKey.name,
            provider: currentKey.provider,
            model: currentKey.model,
          },
          attemptsCount,
          failoversOccurred,
        };
      } catch (err: any) {
        const classified = this.classifyError(err);
        const errMessage = err?.message || String(err);

        // Update key metrics & apply cooldown
        currentKey.errorsTotal++;
        currentKey.lastErrorAt = new Date().toISOString();
        currentKey.lastError = classified.description;
        currentKey.consecutiveErrors++;
        currentKey.status = classified.status;
        currentKey.cooldownUntil = Date.now() + classified.cooldownMs;

        errorsEncountered.push({
          keyName: currentKey.name,
          provider: currentKey.provider,
          error: classified.description,
        });

        // Determine next key for logging
        const nextKey = (i + 1 < sequence.length) ? sequence[i + 1] : null;

        this.recordEvent({
          eventType: nextKey ? "failover" : "all_exhausted",
          fromKeyId: currentKey.id,
          fromKeyName: currentKey.name,
          toKeyId: nextKey?.id,
          toKeyName: nextKey?.name,
          provider: currentKey.provider,
          model: currentKey.model,
          reason: classified.description,
          errorStatus: classified.status,
        });

        if (nextKey) {
          failoversOccurred++;
          console.warn(`[AIRotationManager] Key "${currentKey.name}" failed (${classified.status}): ${errMessage}. Failing over to "${nextKey.name}"...`);
        } else {
          console.error(`[AIRotationManager] Key "${currentKey.name}" failed and no more available candidates in sequence.`);
        }
      }
    }

    // If loop finishes without returning, all tried keys failed
    const errorSummary = errorsEncountered
      .map(e => `• ${e.keyName} (${e.provider}): ${e.error}`)
      .join("\n");

    throw new Error(
      `AI completion failed across all ${attemptsCount} attempted API key(s):\n${errorSummary}`
    );
  }

  /**
   * Return snapshot of all configs for Admin UI inspection
   */
  public getConfigsSnapshot(): Array<Omit<AIKeyEntry, "apiKey"> & { apiKey: string }> {
    const now = Date.now();
    return Array.from(this.keys.values())
      .map(k => {
        // Dynamic status check for UI
        let displayStatus = k.status;
        if (
          (displayStatus === "rate_limited" || displayStatus === "temporarily_unavailable") &&
          k.cooldownUntil > 0 &&
          now >= k.cooldownUntil
        ) {
          displayStatus = "available";
        }

        const remainingCooldownSec = k.cooldownUntil > now ? Math.ceil((k.cooldownUntil - now) / 1000) : 0;

        return {
          id: k.id,
          name: k.name,
          provider: k.provider,
          apiKey: "•••••••••••••",
          model: k.model,
          enabled: k.enabled,
          priority: k.priority,
          status: displayStatus,
          isSystem: k.isSystem,
          requestsTotal: k.requestsTotal,
          requestsToday: k.requestsToday,
          successTotal: k.successTotal,
          errorsTotal: k.errorsTotal,
          lastUsedAt: k.lastUsedAt,
          lastSuccessAt: k.lastSuccessAt,
          lastErrorAt: k.lastErrorAt,
          lastError: k.lastError,
          cooldownUntil: k.cooldownUntil,
          remainingCooldownSec,
          consecutiveErrors: k.consecutiveErrors,
          createdAt: k.createdAt,
        };
      })
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Return rotation system telemetry for Admin Dashboard
   */
  public getHealthTelemetry() {
    const now = Date.now();
    const configs = this.getConfigsSnapshot();
    const total = configs.length;
    const available = configs.filter(c => c.enabled && c.status === "available").length;
    const rateLimited = configs.filter(c => c.status === "rate_limited").length;
    const quotaExhausted = configs.filter(c => c.status === "quota_exhausted").length;
    const temporarilyUnavailable = configs.filter(c => c.status === "temporarily_unavailable").length;
    const authFailed = configs.filter(c => c.status === "auth_failed").length;
    const disabled = configs.filter(c => !c.enabled || c.status === "disabled").length;

    const totalRequests = configs.reduce((acc, c) => acc + (c.requestsTotal || 0), 0);
    const totalSuccess = configs.reduce((acc, c) => acc + (c.successTotal || 0), 0);
    const totalErrors = configs.reduce((acc, c) => acc + (c.errorsTotal || 0), 0);
    const successRate = totalRequests > 0 ? Math.round((totalSuccess / totalRequests) * 100) : 100;

    return {
      policy: this.policy,
      totalKeys: total,
      availableKeys: available,
      rateLimitedKeys: rateLimited,
      quotaExhaustedKeys: quotaExhausted,
      temporarilyUnavailableKeys: temporarilyUnavailable,
      authFailedKeys: authFailed,
      disabledKeys: disabled,
      totalRequests,
      totalSuccess,
      totalErrors,
      successRate,
      recentFailovers: this.failoverHistory.slice(0, 15),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Record a failover or rotation event to history
   */
  private recordEvent(event: Omit<FailoverEvent, "id" | "timestamp">) {
    const entry: FailoverEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.failoverHistory.unshift(entry);
    if (this.failoverHistory.length > this.MAX_HISTORY_EVENTS) {
      this.failoverHistory.pop();
    }
  }

  /**
   * Returns internal key by ID for testing (includes plain key)
   */
  public getKeyById(id: string): AIKeyEntry | undefined {
    return this.keys.get(id);
  }
}

// Global Singleton Instance
export const aiRotationManager = new AIRotationManager();
