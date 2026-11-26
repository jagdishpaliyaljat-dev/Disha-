const SITE_URL = "https://disha2020.in";

const CORE_ROUTES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/news", changefreq: "daily", priority: "0.9" },
  { path: "/topics", changefreq: "weekly", priority: "0.9" },
  { path: "/pyq-vault", changefreq: "weekly", priority: "0.9" },
  { path: "/live-tests", changefreq: "weekly", priority: "0.8" },
  { path: "/test-series", changefreq: "weekly", priority: "0.8" },
  { path: "/about", changefreq: "monthly", priority: "0.6" },
  { path: "/contact", changefreq: "monthly", priority: "0.5" },
];

const FALLBACK_ARTICLE_SLUGS = [
  "how-to-study-efficiently-for-10-hours-daily",
  "rajasthan-cet-2026-exam-date-syllabus-admit-card",
  "about-disha-20-20",
];

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(input) {
  try {
    const d = input ? new Date(input) : new Date();
    return Number.isNaN(d.getTime())
      ? new Date().toISOString().split("T")[0]
      : d.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

export default async function handler(req, res) {
  const today = formatDate(new Date());
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL || "https://eaidivceejkdqsshlraj.supabase.co";
  const supabaseKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    "sb_publishable_HSl8o7bm-TQMIFbEnbp7TA_TfBfiv_0";

  const entries = CORE_ROUTES.map((r) => ({
    loc: `${SITE_URL}${r.path}`,
    lastmod: today,
    changefreq: r.changefreq,
    priority: r.priority,
  }));

  const seenUrls = new Set(entries.map((e) => e.loc));

  try {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/news_articles?select=slug,updated_at,published_at,status&status=eq.published&order=published_at.desc&limit=500`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: "application/json",
        },
      }
    );

    if (resp.ok) {
      const rows = await resp.json();
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const slug = typeof row.slug === "string" ? row.slug.trim() : "";
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) continue;
          const loc = `${SITE_URL}/news/${encodeURIComponent(slug)}`;
          if (seenUrls.has(loc)) continue;
          seenUrls.add(loc);
          entries.push({
            loc,
            lastmod: formatDate(row.updated_at || row.published_at),
            changefreq: "weekly",
            priority: "0.8",
          });
        }
      }
    }
  } catch {
    // Gracefully fall back to bundled slugs below
  }

  for (const slug of FALLBACK_ARTICLE_SLUGS) {
    const loc = `${SITE_URL}/news/${slug}`;
    if (!seenUrls.has(loc)) {
      seenUrls.add(loc);
      entries.push({
        loc,
        lastmod: today,
        changefreq: "weekly",
        priority: "0.8",
      });
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${escapeXml(e.loc)}</loc>
    <lastmod>${escapeXml(e.lastmod)}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(xml);
}
