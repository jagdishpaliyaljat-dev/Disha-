import React, { useEffect } from "react";
import { ActiveTab } from '../types';

interface MonetagAdScriptProps {
  isAuthReady?: boolean;
  activeTab?: ActiveTab;
  selectedChapterId?: string | null;
}

/**
 * Monetag Ads have been completely removed and disabled.
 * This component runs passive DOM cleanup to ensure no orphaned ad scripts or meta tags persist.
 */
export function MonetagAdScript(_props?: MonetagAdScriptProps) {
  useEffect(() => {
    // Purge any lingering ad scripts and verification tags from DOM
    const adSelectors = [
      'script[src*="nap5k.com"]',
      'script[src*="n6wxm.com"]',
      'script[src*="quge5.com"]',
      'script[src*="al5sm.com"]',
      'meta[name="monetag"]'
    ];
    
    adSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.remove());
    });

    if (typeof window !== 'undefined' && (window as any).__monetag_initialized_urls) {
      (window as any).__monetag_initialized_urls = {};
    }
  }, []);

  return null;
}

declare global {
  interface Window {
    __monetag_initialized_urls?: Record<string, boolean>;
  }
}
