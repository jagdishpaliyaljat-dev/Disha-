import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PHASE 3: Medium & Low Severity Audit Bugs Verification (SUPA-08 to SUPA-12)', () => {

  // --------------------------------------------------------------------------
  // SUPA-08: Admin Diagnostics Minimal Projection
  // --------------------------------------------------------------------------
  describe('SUPA-08: Admin Diagnostics Lightweight Querying', () => {
    it('AdminDiagnosticsSection.tsx queries only minimal fields to protect browser memory', () => {
      const diagPath = path.resolve(__dirname, '../src/components/admin/AdminDiagnosticsSection.tsx');
      const content = fs.readFileSync(diagPath, 'utf8');

      // Verifies questions query projects only hierarchy linkage fields
      expect(content).toContain('.from("questions").select("id, subject_id, chapter_id, topic_id")');
      // Must not query heavy content fields like full explanations or large JSON
      expect(content).not.toContain('.from("questions").select("*")');
    });
  });

  // --------------------------------------------------------------------------
  // SUPA-09: Storage Buckets Definition and Size/MIME Limits
  // --------------------------------------------------------------------------
  describe('SUPA-09: Storage Buckets Architecture & Quota Enforcement', () => {
    it('migration and schema define banners and materials buckets with strict size and MIME constraints', () => {
      const schemaPath = path.resolve(__dirname, '../supabase/schema.sql');
      const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261118_security_fixes.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      const migration = fs.readFileSync(migrationPath, 'utf8');

      for (const text of [schema, migration]) {
        expect(text).toContain("'banners'");
        expect(text).toContain("'materials'");
        // 2MB size limit for banners
        expect(text).toContain('2097152');
        // 10MB size limit for materials
        expect(text).toContain('10485760');
        // Allowed MIME types
        expect(text).toContain('image/webp');
        expect(text).toContain('application/pdf');
      }
    });
  });

  // --------------------------------------------------------------------------
  // SUPA-10: Hardened is_admin() Function
  // --------------------------------------------------------------------------
  describe('SUPA-10: Strict Server-Controlled Admin Function', () => {
    it('is_admin() checks strictly app_metadata.role = admin and ignores client-writable user_metadata', () => {
      const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261118_security_fixes.sql');
      const content = fs.readFileSync(migrationPath, 'utf8');

      expect(content).toContain("auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'");
      expect(content).not.toContain("auth.jwt() -> 'user_metadata'");
    });
  });

  // --------------------------------------------------------------------------
  // SUPA-11: Student Grievance Visibility
  // --------------------------------------------------------------------------
  describe('SUPA-11: Student Report Self-Visibility', () => {
    it('exports fetchStudentReports to query student-owned reports', async () => {
      const { fetchStudentReports } = await import('../src/utils/questionReportService');
      expect(typeof fetchStudentReports).toBe('function');

      const reports = await fetchStudentReports('dummy-uid');
      expect(Array.isArray(reports)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // SUPA-12: Anti-Spam Bot Guard & Payload Length Limits
  // --------------------------------------------------------------------------
  describe('SUPA-12: Bot Guard & Abuse Protection', () => {
    it('submitContactMessage drops bot spam silently when honeypot is populated', async () => {
      const { submitContactMessage } = await import('../src/utils/contactStorage');

      const botPayload = {
        name: 'Spam Bot',
        email: 'bot@spam.com',
        subject: 'Buy cheap watches',
        message: 'Click this link immediately for spam content http://spam.com',
        honeypot: 'http://trap.com', // Hidden field filled by bots
      };

      const res = await submitContactMessage(botPayload);
      expect(res.success).toBe(true);
      expect(res.id).toContain('msg_trap_');
    });

    it('submitContactMessage rejects oversized payloads (> 5,000 characters)', async () => {
      const { submitContactMessage } = await import('../src/utils/contactStorage');

      const oversizedPayload = {
        name: 'Flooder',
        email: 'flood@example.com',
        subject: 'Huge text',
        message: 'A'.repeat(5001),
      };

      const res = await submitContactMessage(oversizedPayload);
      expect(res.success).toBe(false);
      expect(res.message).toContain('too long');
    });

    it('submitQuestionReport rejects oversized comments (> 3,000 characters)', async () => {
      const { submitQuestionReport } = await import('../src/utils/questionReportService');

      const oversizedReport = {
        questionId: 'q_test_1',
        questionText: 'What is 2+2?',
        issueType: 'typo' as const,
        studentComment: 'X'.repeat(3001),
      };

      const res = await submitQuestionReport(oversizedReport);
      expect(res.success).toBe(false);
      expect(res.error).toContain('3,000');
    });
  });
});
