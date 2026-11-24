/**
 * Enterprise Admin Navigation Hierarchy & Categories Definition
 *
 * Implements the 21-category enterprise administrative hierarchy for
 * educational institution management.
 */

import {
  LayoutDashboard,
  Users,
  Database,
  HelpCircle,
  FileSpreadsheet,
  Layers,
  Trophy,
  Radio,
  Award,
  BarChart2,
  Crown,
  Bell,
  Image,
  CreditCard,
  Tag,
  Settings,
  AlertTriangle,
  ShieldCheck,
  History,
  Activity,
  MessageSquare,
  LucideIcon,
} from 'lucide-react';
import { AdminGroupSection } from '../components/AdminTab';

export type EnterpriseCategoryKey =
  | 'overview'
  | 'students'
  | 'questions'
  | 'objections'
  | 'imports'
  | 'curriculum'
  | 'tests'
  | 'live_tests'
  | 'leaderboard'
  | 'analytics'
  | 'vip'
  | 'notifications'
  | 'banners'
  | 'revenue'
  | 'coupons'
  | 'config'
  | 'maintenance'
  | 'rbac'
  | 'audit'
  | 'system_health'
  | 'support';

export interface EnterpriseCategory {
  id: EnterpriseCategoryKey;
  numericIndex: number;
  title: string;
  hindiTitle: string;
  description: string;
  icon: LucideIcon;
  targetGroup: AdminGroupSection;
  badge?: string;
  pillColor: string;
}

export const ENTERPRISE_21_CATEGORIES: EnterpriseCategory[] = [
  {
    id: 'overview',
    numericIndex: 1,
    title: 'Dashboard & Overview',
    hindiTitle: 'डैशबोर्ड और अवलोकन',
    description: 'Central executive dashboard with core performance metrics and live stats',
    icon: LayoutDashboard,
    targetGroup: 'dashboard',
    pillColor: 'amber',
  },
  {
    id: 'students',
    numericIndex: 2,
    title: 'Student Management',
    hindiTitle: 'छात्र प्रबंधन',
    description: 'Student profiles, registration, study activity and doubt engagement',
    icon: Users,
    targetGroup: 'users',
    badge: 'Directory',
    pillColor: 'blue',
  },
  {
    id: 'questions',
    numericIndex: 3,
    title: 'Question Bank Management',
    hindiTitle: 'प्रश्न बैंक प्रबंधन',
    description: '5,800+ authoritative Rajasthan exam questions, search, filters and editor',
    icon: Database,
    targetGroup: 'questions',
    badge: '5.8k Qs',
    pillColor: 'emerald',
  },
  {
    id: 'objections',
    numericIndex: 4,
    title: 'Question Reports & Objection Desk',
    hindiTitle: 'आपत्ति डेस्क और रिपोर्ट',
    description: 'Student question challenges, doubt resolution and automated notifications',
    icon: HelpCircle,
    targetGroup: 'users',
    badge: 'Objections',
    pillColor: 'rose',
  },
  {
    id: 'imports',
    numericIndex: 5,
    title: 'Question Import & Bulk Management',
    hindiTitle: 'थोक प्रश्न आयात प्रबंधन',
    description: 'Excel, CSV, HTML and OCR batch import processing engine',
    icon: FileSpreadsheet,
    targetGroup: 'questions',
    badge: 'Bulk',
    pillColor: 'teal',
  },
  {
    id: 'curriculum',
    numericIndex: 6,
    title: 'Subject, Chapter & Topic Management',
    hindiTitle: 'विषय और अध्याय संरचना',
    description: 'Curriculum tree, syllabus hierarchy, and Rajasthan exam category mappings',
    icon: Layers,
    targetGroup: 'syllabus',
    badge: 'Syllabus',
    pillColor: 'indigo',
  },
  {
    id: 'tests',
    numericIndex: 7,
    title: 'Test & Examination Management',
    hindiTitle: 'परीक्षा एवं टेस्ट प्रबंधन',
    description: 'Mock tests, chapter quizzes, custom exams and question weightages',
    icon: Trophy,
    targetGroup: 'tests',
    pillColor: 'purple',
  },
  {
    id: 'live_tests',
    numericIndex: 8,
    title: 'Live Test Management',
    hindiTitle: 'लाइव टेस्ट प्रबंधन',
    description: 'Timed live examination windows, 1v1 battle quizzes and state merit ranks',
    icon: Radio,
    targetGroup: 'tests',
    badge: 'Live',
    pillColor: 'rose',
  },
  {
    id: 'leaderboard',
    numericIndex: 9,
    title: 'Leaderboard Management',
    hindiTitle: 'लीडरबोर्ड प्रबंधन',
    description: 'Weekly and all-time rankings, anti-cheat moderation, bans and resets',
    icon: Award,
    targetGroup: 'settings',
    badge: 'Ranks',
    pillColor: 'amber',
  },
  {
    id: 'analytics',
    numericIndex: 10,
    title: 'Results & Performance Analytics',
    hindiTitle: 'परिणाम और प्रदर्शन विश्लेषण',
    description: 'Student score distributions, subject accuracy breakdowns and district stats',
    icon: BarChart2,
    targetGroup: 'dashboard',
    badge: 'Stats',
    pillColor: 'cyan',
  },
  {
    id: 'vip',
    numericIndex: 11,
    title: 'VIP, Premium & Subscription Management',
    hindiTitle: 'वीआईपी और सब्सक्रिप्शन',
    description: 'Student plans, access tiers, feature unlocks and grant management',
    icon: Crown,
    targetGroup: 'users',
    badge: 'VIP',
    pillColor: 'yellow',
  },
  {
    id: 'notifications',
    numericIndex: 12,
    title: 'Notifications & Announcements',
    hindiTitle: 'सूचनाएं और घोषणाएं',
    description: 'Push notifications, exam alerts, daily motivations and system messages',
    icon: Bell,
    targetGroup: 'users',
    pillColor: 'sky',
  },
  {
    id: 'banners',
    numericIndex: 13,
    title: 'Banner & Content Management',
    hindiTitle: 'बैनर और संपादकीय सामग्री',
    description: 'Promotional banners, educational articles, exam news and updates',
    icon: Image,
    targetGroup: 'content',
    badge: 'Content',
    pillColor: 'pink',
  },
  {
    id: 'revenue',
    numericIndex: 14,
    title: 'Revenue & Payment Management',
    hindiTitle: 'राजस्व और भुगतान प्रणाली',
    description: 'Financial ledger, payment transactions, refunds and audit receipts',
    icon: CreditCard,
    targetGroup: 'settings',
    pillColor: 'emerald',
  },
  {
    id: 'coupons',
    numericIndex: 15,
    title: 'Coupon & Referral Management',
    hindiTitle: 'कूपन और रेफरल प्रोग्राम',
    description: 'Promotional discount codes, institutional fee waivers and referral rewards',
    icon: Tag,
    targetGroup: 'settings',
    pillColor: 'orange',
  },
  {
    id: 'config',
    numericIndex: 16,
    title: 'App Configuration Center',
    hindiTitle: 'ऐप कॉन्फ़िगरेशन केंद्र',
    description: 'Global app parameters, feature switches, API endpoints and version controls',
    icon: Settings,
    targetGroup: 'settings',
    badge: 'Config',
    pillColor: 'slate',
  },
  {
    id: 'maintenance',
    numericIndex: 17,
    title: 'Maintenance Mode Management',
    hindiTitle: 'रखरखाव मोड प्रबंधन',
    description: 'Emergency lockdown switch, maintenance screens, and admin whitelist bypass',
    icon: AlertTriangle,
    targetGroup: 'settings',
    badge: 'Critical',
    pillColor: 'rose',
  },
  {
    id: 'rbac',
    numericIndex: 18,
    title: 'Admin Roles & Permissions (RBAC)',
    hindiTitle: 'स्टाफ भूमिकाएं और अनुमतियां',
    description: 'Super Admin, SME/Teacher, Content Reviewer and Support role delegation',
    icon: ShieldCheck,
    targetGroup: 'staff',
    badge: 'RBAC',
    pillColor: 'emerald',
  },
  {
    id: 'audit',
    numericIndex: 19,
    title: 'Activity Logs & Audit History',
    hindiTitle: 'गतिविधि लॉग और ऑडिट इतिहास',
    description: 'Immutable administrative audit trail, question edits, deletions and logins',
    icon: History,
    targetGroup: 'settings',
    pillColor: 'slate',
  },
  {
    id: 'system_health',
    numericIndex: 20,
    title: 'System Health & Monitoring',
    hindiTitle: 'सिस्टम स्वास्थ्य और निगरानी',
    description: 'Supabase cloud latency, database connection health, sync status and crash reports',
    icon: Activity,
    targetGroup: 'supabase',
    badge: 'Telemetry',
    pillColor: 'teal',
  },
  {
    id: 'support',
    numericIndex: 21,
    title: 'Support & Feedback Management',
    hindiTitle: 'छात्र सहायता और फीडबैक',
    description: 'Student support tickets, user feedback, inquiry responses and help desk',
    icon: MessageSquare,
    targetGroup: 'users',
    badge: 'Support',
    pillColor: 'blue',
  },
];
