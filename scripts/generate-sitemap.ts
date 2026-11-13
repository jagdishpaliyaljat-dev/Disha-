import fs from 'fs';
import path from 'path';

const FIREBASE_PROJECT_ID = 'gen-lang-client-0811306192';
const FIRESTORE_DATABASE_ID = 'ai-studio-quizproshopx-3bfab5fe-4412-4a74-8471-935f57b6f194';
const FIREBASE_API_KEY = 'AIzaSyDSJtdRRNMSYnt4960wCkuyE14Yxgt_am4';
const SITE_URL = 'https://quizpro.shop';

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseFirestoreFields(fields: any): Record<string, any> {
  const result: Record<string, any> = {};
  if (!fields) return result;
  for (const key of Object.keys(fields)) {
    const valObj = fields[key];
    if (valObj.stringValue !== undefined) result[key] = valObj.stringValue;
    else if (valObj.integerValue !== undefined) result[key] = parseInt(valObj.integerValue, 10);
    else if (valObj.doubleValue !== undefined) result[key] = parseFloat(valObj.doubleValue);
    else if (valObj.booleanValue !== undefined) result[key] = valObj.booleanValue;
    else if (valObj.timestampValue !== undefined) result[key] = valObj.timestampValue;
    else if (valObj.nullValue !== undefined) result[key] = null;
  }
  return result;
}

async function run() {
  console.log('----------------------------------------------------');
  console.log('🤖 QuizPro XML Sitemap Generator Utility');
  console.log(`🌐 Target Domain: ${SITE_URL}`);
  console.log(`🗄️ Database: ${FIRESTORE_DATABASE_ID}`);
  console.log('----------------------------------------------------');

  const queryUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents:runQuery?key=${FIREBASE_API_KEY}`;
  
  // 1. Fetch all articles from the database to report both published and excluded drafts
  const res = await fetch(queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'articles' }],
        limit: 500
      }
    })
  });

  if (!res.ok) {
    console.error(`❌ Failed to query Firestore: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const rawDocs = await res.json();
  const today = new Date().toISOString().split('T')[0];

  let totalArticlesFound = 0;
  let draftsExcluded = 0;
  let invalidExcluded = 0;
  const validArticleEntries: { loc: string; lastmod: string; changefreq: string; priority: number; title: string }[] = [];
  const processedSlugs = new Set<string>();

  if (Array.isArray(rawDocs)) {
    for (const item of rawDocs) {
      if (!item.document?.fields) continue;
      totalArticlesFound++;
      const fields = parseFirestoreFields(item.document.fields);
      const id = item.document.name.split('/').pop() || '';
      const status = (fields.status || 'published').toLowerCase().trim();

      // STRICT FILTER: Exclude anything that is not explicitly published
      if (status !== 'published') {
        draftsExcluded++;
        continue;
      }

      let slug = (fields.slug || id || '').toLowerCase().trim();
      slug = slug.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      if (!slug || slug.length < 2 || slug === 'undefined' || slug === 'null') {
        invalidExcluded++;
        continue;
      }

      if (processedSlugs.has(slug)) {
        continue;
      }
      processedSlugs.add(slug);

      const rawDate = fields.updatedAt || fields.publishedAt || fields.createdAt || today;
      const lastmod = rawDate.split('T')[0];
      const title = fields.title || slug;

      validArticleEntries.push({
        loc: `${SITE_URL}/news/${encodeURI(slug)}`,
        lastmod,
        changefreq: 'weekly',
        priority: 0.8,
        title
      });
    }
  }

  // Sort articles by lastmod descending
  validArticleEntries.sort((a, b) => b.lastmod.localeCompare(a.lastmod));

  const staticEntries = [
    { loc: `${SITE_URL}/`, lastmod: today, changefreq: 'daily', priority: 1.0 },
    { loc: `${SITE_URL}/news`, lastmod: today, changefreq: 'daily', priority: 0.9 },
    { loc: `${SITE_URL}/topics`, lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { loc: `${SITE_URL}/pyq_vault`, lastmod: today, changefreq: 'weekly', priority: 0.8 },
    { loc: `${SITE_URL}/live_tests`, lastmod: today, changefreq: 'weekly', priority: 0.8 },
  ];

  const xmlUrlNodes = [
    ...staticEntries.map(e => `  <url>
    <loc>${escapeXml(e.loc)}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority.toFixed(1)}</priority>
  </url>`),
    ...validArticleEntries.map(e => `  <url>
    <loc>${escapeXml(e.loc)}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority.toFixed(1)}</priority>
  </url>`)
  ];

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrlNodes.join('\n')}
</urlset>
`;

  // Write to public/sitemap.xml
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const publicSitemapPath = path.join(publicDir, 'sitemap.xml');
  fs.writeFileSync(publicSitemapPath, xmlContent, 'utf-8');
  console.log(`✅ Saved sitemap to: ${publicSitemapPath}`);

  // Write to dist/sitemap.xml if dist exists
  const distDir = path.join(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    const distSitemapPath = path.join(distDir, 'sitemap.xml');
    fs.writeFileSync(distSitemapPath, xmlContent, 'utf-8');
    console.log(`✅ Synced sitemap to: ${distSitemapPath}`);
  }

  console.log('\n📊 SITEMAP GENERATION SUMMARY:');
  console.log(`   • Total Article Records Inspected: ${totalArticlesFound}`);
  console.log(`   • Valid Published Articles Included: ${validArticleEntries.length}`);
  console.log(`   • Drafts Excluded: ${draftsExcluded}`);
  console.log(`   • Invalid / Malformed Slugs Excluded: ${invalidExcluded}`);
  console.log(`   • Total XML Sitemap URLs: ${staticEntries.length + validArticleEntries.length}`);
  console.log('\n📝 INCLUDED ARTICLE URLS:');
  validArticleEntries.forEach((art, i) => {
    console.log(`   ${i + 1}. [${art.lastmod}] ${art.loc}`);
  });
  console.log('\n🚀 READY FOR GOOGLE SEARCH CONSOLE:');
  console.log(`   URL: ${SITE_URL}/sitemap.xml`);
  console.log('----------------------------------------------------');
}

run().catch((err) => {
  console.error('Fatal error in sitemap generator script:', err);
  process.exit(1);
});
