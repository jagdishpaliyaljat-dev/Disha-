-- Migration: 20261120_app_settings_feature_flags.sql
-- Description: Create app_settings table for Admin-controlled feature flags and application toggles

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_by text
);

-- Enable Row Level Security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Policy 1: Any user (student or guest) can read app settings
DROP POLICY IF EXISTS "Public can view app_settings" ON public.app_settings;
CREATE POLICY "Public can view app_settings"
  ON public.app_settings
  FOR SELECT
  USING (true);

-- Policy 2: Only verified Admins can insert, update, or delete app settings
DROP POLICY IF EXISTS "Admins can manage app_settings" ON public.app_settings;
CREATE POLICY "Admins can manage app_settings"
  ON public.app_settings
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed default feature flags
INSERT INTO public.app_settings (key, value, description, updated_by)
VALUES (
  'feature_flags',
  '{
    "disha_ai": { "enabled": true, "name": "दिशा AI साथी (AI Tutor)", "description": "फ्लोटिंग AI बटन, वॉइस चैटबॉट और व्याख्या जनरेटर" },
    "live_battle": { "enabled": true, "name": "1v1 लाइव क्विज़ बैटल", "description": "छात्रों के बीच रियल-टाइम मल्टीप्लेयर मुकाबला" },
    "video_classes": { "enabled": true, "name": "वीडियो कक्षाएं एवं स्टडी डेस्क", "description": "कोचिंग वीडियो लेक्चर्स और इन-ऐप पीडीएफ नोट्स" },
    "live_tests": { "enabled": true, "name": "लाइव टेस्ट एवं ऑल-राजस्थान रैंक", "description": "निर्धारित समय पर लाइव मॉक टेस्ट और राज्यस्तरीय मेरिट लिस्ट" },
    "pyq_vault": { "enabled": true, "name": "गत वर्षों के प्रश्न पत्र (PYQ Vault)", "description": "RPSC व RSMSSB के पिछले वर्षों के आधिकारिक पेपर्स" },
    "custom_test": { "enabled": true, "name": "20-20 स्मार्ट कस्टम टेस्ट", "description": "विषय और प्रश्नों की संख्या चुनकर स्वयं का टेस्ट बनाएं" },
    "news_articles": { "enabled": true, "name": "समसामयिकी एवं समाचार", "description": "नवीनतम परीक्षा सूचनाएं, सरकारी विज्ञप्तियां व करंट अफेयर्स" },
    "omr_scanner": { "enabled": true, "name": "पेपर व OMR स्कैनर", "description": "कैमरे या गैलरी से प्रश्न पत्र और OMR शीट स्कैन व विश्लेषण" },
    "pdf_export": { "enabled": true, "name": "PDF डाउनलोड व एक्सपोर्ट", "description": "प्रश्न बैंक और टेस्ट का प्रिंट-फ्रेंडली PDF डाउनलोड" },
    "guest_mode": { "enabled": true, "name": "अतिथि अभ्यास मोड (Guest Mode)", "description": "बिना लॉगिन तुरंत अभ्यास शुरू करने की अनुमति" }
  }'::jsonb,
  'Application feature toggles and access control',
  'system_admin'
)
ON CONFLICT (key) DO NOTHING;
