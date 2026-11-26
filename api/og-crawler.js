const SITE_URL = "https://disha2020.in";
const DEFAULT_TITLE = "Disha PYQ — Previous Year Questions & Competitive Exam Preparation";
const DEFAULT_DESC = "Master Rajasthan & Indian competitive exams with authentic Previous Year Questions, Live Mock Tests, and smart analytics.";
const DEFAULT_IMAGE = `${SITE_URL}/og-preview.png`;

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug || typeof slug !== "string") {
    return res.redirect(302, "/");
  }

  const cleanSlug = slug.trim().toLowerCase();
  const canonicalUrl = `${SITE_URL}/news/${encodeURIComponent(cleanSlug)}`;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://eaidivceejkdqsshlraj.supabase.co";
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_HSl8o7bm-TQMIFbEnbp7TA_TfBfiv_0";

  let article = null;

  try {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/news_articles?select=title,summary,featured_image,author_name,published_at,category&slug=eq.${encodeURIComponent(cleanSlug)}&limit=1`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        article = data[0];
      }
    }
  } catch (err) {
    // Graceful fallback to default metadata
  }

  const title = article?.title ? `${article.title} — Disha PYQ` : DEFAULT_TITLE;
  const description = article?.summary || DEFAULT_DESC;
  const image = article?.featured_image || DEFAULT_IMAGE;

  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(canonicalUrl);

  const html = `<!doctype html>
<html lang="hi" xml:lang="hi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}" />
  <link rel="canonical" href="${safeUrl}" />
  <meta name="robots" content="index, follow" />
  
  <!-- OpenGraph Social Cards for WhatsApp, Telegram, Facebook -->
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="Disha PYQ" />
  <meta property="og:locale" content="hi_IN" />
  <meta property="og:locale:alternate" content="en_IN" />

  <!-- Twitter / X Cards -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${safeUrl}" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image" content="${safeImage}" />

  <!-- Instant Client Redirect for human browsers -->
  <script>
    window.location.replace("/news/" + encodeURIComponent(${JSON.stringify(cleanSlug)}));
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=/news/${encodeURIComponent(cleanSlug)}" />
  </noscript>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; max-width: 720px; margin: 40px auto; color: #1e293b;">
  <h1>${safeTitle}</h1>
  <p style="font-size: 16px; line-height: 1.6; color: #475569;">${safeDesc}</p>
  <p><a href="/news/${encodeURIComponent(cleanSlug)}" style="color: #7045d8; text-decoration: underline; font-weight: bold;">दिशा 20-20 पर पूरा आर्टिकल पढ़ें &rarr;</a></p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).send(html);
}
