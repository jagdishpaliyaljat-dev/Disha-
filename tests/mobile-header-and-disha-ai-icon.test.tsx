import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DishaAIIcon } from '../src/components/DishaAIIcon';
import { FloatingAIAssistant } from '../src/components/FloatingAIAssistant';
import { AppLogo } from '../src/components/AppLogo';
import fs from 'fs';
import path from 'path';

describe('DishaAIIcon & Mobile Header Polish', () => {
  it('renders DishaAIIcon with next-gen SVG geometry and gradients', () => {
    const html = renderToString(<DishaAIIcon size={28} glow={true} className="test-icon" />);
    expect(html).toContain('<svg');
    expect(html).toContain('width="28"');
    expect(html).toContain('height="28"');
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('test-icon');

    // Gradients and paths
    expect(html).toContain('id="dishaAiCoreGrad"');
    expect(html).toContain('id="dishaAiSatGrad"');
    expect(html).toContain('id="dishaAiCenterAura"');

    // Primary AI Star & Satellite paths
    expect(html).toContain('<path');
    expect(html).toContain('url(#dishaAiCoreGrad)');
    expect(html).toContain('url(#dishaAiSatGrad)');
  });

  it('renders FloatingAIAssistant with DishaAIIcon and proper accessibility attributes', () => {
    const html = renderToString(<FloatingAIAssistant onOpen={() => {}} isHidden={false} />);

    expect(html).toContain('aria-label="Open Disha AI Companion"');
    expect(html).toContain('title="Disha AI Companion');
    expect(html).toContain('Disha AI');

    // Verify SVG icon exists inside
    expect(html).toContain('id="dishaAiCoreGrad"');
    expect(html).toContain('url(#dishaAiCoreGrad)');
  });

  it('hides FloatingAIAssistant when isHidden is true', () => {
    const html = renderToString(<FloatingAIAssistant onOpen={() => {}} isHidden={true} />);
    expect(html).toBe('');
  });

  it('supports AppLogo with showIcon=false to display only app name without graphic mark', () => {
    const htmlWithIcon = renderToString(<AppLogo size="sm" variant="horizontal" showIcon={true} />);
    expect(htmlWithIcon).toContain('<img');
    expect(htmlWithIcon).toContain('DISHA');
    expect(htmlWithIcon).toContain('PYQ');

    const htmlWithoutIcon = renderToString(<AppLogo size="sm" variant="horizontal" showIcon={false} />);
    expect(htmlWithoutIcon).not.toContain('<img');
    expect(htmlWithoutIcon).toContain('DISHA');
    expect(htmlWithoutIcon).toContain('PYQ');
  });

  it('verifies HomeTab.tsx renders only app name without logo icon in mobile header', () => {
    const homeTabContent = fs.readFileSync(
      path.resolve(__dirname, '../src/components/HomeTab.tsx'),
      'utf-8'
    );

    // AppLogo must be configured with showIcon={false} in header
    expect(homeTabContent).toContain('showIcon={false}');

    // Drawer button and Sign In button must be present in header
    expect(homeTabContent).toContain('aria-label="Open menu drawer"');
    expect(homeTabContent).toContain('aria-label="Login to Disha PYQ"');
    expect(homeTabContent).toContain('<span>Sign In</span>');

    // View AI Diagnostic Report must be removed from HomeTab per user request
    expect(homeTabContent).not.toContain('View AI Diagnostic Report');
  });
});
