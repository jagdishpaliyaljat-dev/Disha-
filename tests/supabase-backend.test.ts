import { describe, test, expect } from 'vitest';
import { isSupabaseConfigured, supabase } from '../src/lib/supabase';
import fs from 'fs';
import path from 'path';

describe('Supabase Clean Slate Backend Suite', () => {
  test('Supabase client provides safe unconfigured fallback without throwing', async () => {
    expect(typeof isSupabaseConfigured).toBe('function');
    expect(supabase).toBeDefined();

    const { data, error } = await supabase.from('subjects').select('*');
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Supabase schema.sql exists and creates 100% clean tables with 0 preloaded data', () => {
    const schemaPath = path.resolve(process.cwd(), 'supabase/schema.sql');
    expect(fs.existsSync(schemaPath)).toBe(true);

    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    // Ensure all tables are created
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.subjects');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.chapters');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.topics');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.questions');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.profiles');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.attempts');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.bookmarks');

    // Strict clean slate: Schema must NEVER contain default INSERT rows
    expect(schemaContent.toLowerCase()).not.toContain('insert into public.subjects');
    expect(schemaContent.toLowerCase()).not.toContain('insert into public.questions');

    // Verify Row Level Security is enabled
    expect(schemaContent).toContain('ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY');
    expect(schemaContent).toContain('ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY');
    expect(schemaContent).toContain('jagdishpaliyaljat@gmail.com');
  });

  test('Database is configured for fresh zero-data admin uploads', async () => {
    const { fetchSubjects, fetchChapters, fetchTopics } = await import('../src/utils/supabaseSyncService');
    expect(typeof fetchSubjects).toBe('function');
    expect(typeof fetchChapters).toBe('function');
    expect(typeof fetchTopics).toBe('function');

    const { saveSubjectToSupabase, saveChapterToSupabase, saveTopicToSupabase, upsertQuestionsToSupabase } = await import('../src/utils/supabaseSyncService');
    expect(typeof saveSubjectToSupabase).toBe('function');
    expect(typeof saveChapterToSupabase).toBe('function');
    expect(typeof saveTopicToSupabase).toBe('function');
    expect(typeof upsertQuestionsToSupabase).toBe('function');
  });
});
