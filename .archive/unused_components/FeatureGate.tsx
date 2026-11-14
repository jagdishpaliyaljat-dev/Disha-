import React, { useState, useEffect, useCallback } from "react";
import { 
  checkFeatureAccess, 
  consumeFeatureUsage, 
  FeatureAccessCheckResult
} from '../utils/featureAccessService';
import { loadUserProfile } from '../utils/userProfileStorage';

interface FeatureGateProps {
  featureKey: string;
  contentId?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showPaywallBanner?: boolean;
  onOpenLogin?: () => void;
  onOpenUpgrade?: () => void;
}

/**
 * Hook for feature access - simplified for unrestricted access.
 */
export function useFeatureAccess(featureKey: string, contentId?: string) {
  const [access, setAccess] = useState<FeatureAccessCheckResult>({
    allowed: true,
    limit: null,
    used: 0,
    remaining: null,
    period: "lifetime"
  });
  const [loading, setLoading] = useState(true);

  const evaluate = useCallback(async () => {
    try {
      const profile = loadUserProfile();
      const res = await checkFeatureAccess(featureKey, profile, contentId);
      setAccess(res);
    } catch {
      setAccess({ allowed: true, limit: null, used: 0, remaining: null, period: "lifetime" });
    } finally {
      setLoading(false);
    }
  }, [featureKey, contentId]);

  useEffect(() => {
    evaluate();
  }, [evaluate]);

  const consume = useCallback(async (amount = 1) => {
    const success = await consumeFeatureUsage(featureKey, undefined, amount);
    evaluate();
    return success;
  }, [featureKey, evaluate]);

  return { ...access, rule: null, loading, refresh: evaluate, consume };
}

/**
 * FeatureGate component - always renders children as all features are now unlocked.
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({
  children,
}) => {
  return <>{children}</>;
};
