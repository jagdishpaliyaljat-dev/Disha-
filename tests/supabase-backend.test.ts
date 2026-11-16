import { describe, test, expect } from 'vitest';
import { isSupabaseConfigured, supabase } from '../src/lib/supabase';
import fs from 'fs';
import path from 'path';

describe('Supabase Backend Integration Suite', () => {
  test('Supabase client provides safe unconfigured fallback without throwing', async () => {
    // When environment variables are not set or during tests
    expect(typeof isSupabaseConfigured).toBe('function');
    expect(supabase).toBeDefined();

    // Querying should resolve gracefully to empty/mock data instead of throwing runtime exceptions
    const { data, error } = await supabase.from('subjects').select('*');
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Supabase schema.sql exists and defines all core tables and RLS', () => {
    const schemaPath = path.resolve(process.cwd(), 'supabase/schema.sql');
    expect(fs.existsSync(schemaPath)).toBe(true);

    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.subjects');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.chapters');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.topics');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.questions');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.profiles');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.attempts');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS public.bookmarks');

    // Verify Row Level Security is enabled
    expect(schemaContent).toContain('ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY');
    expect(schemaContent).toContain('ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY');
    expect(schemaContent).toContain('jagdishpaliyaljat@gmail.com');
  });

  test('Seed dataset is valid and contains full curriculum with 1280 MCQs', () => {
    const seedPath = path.resolve(process.cwd(), 'supabase/seed_data.json');
    expect(fs.existsSync(seedPath)).toBe(true);

    const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    expect(seed.subjects.length).toBe(5);
    expect(seed.chapters.length).toBe(11);
    expect(seed.topics.length).toBe(19);
    expect(seed.mcqs.length).toBe(1280);

    // Verify Art & Culture subject is properly populated
    const artCulture = seed.subjects.find((s: any) => s.id === 'subj-1793126281086-96tzj');
    expect(artCulture).toBeDefined();
    expect(artCulture.name).toBe('राजस्थान कला एवं संस्कृति');

    const artQuestions = seed.mcqs.filter((q: any) => q.subjectId === 'subj-1793126281086-96tzj');
    expect(artQuestions.length).toBe(67);
  });
});
