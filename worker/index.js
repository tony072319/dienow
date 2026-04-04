/**
 * Sudden Death Index - Cloudflare Worker
 *
 * Deploy:
 *   1. npm install -g wrangler
 *   2. wrangler login
 *   3. wrangler d1 create sdi-db
 *   4. wrangler d1 execute sdi-db --file=worker/schema.sql
 *   5. Update wrangler.toml with your database_id
 *   6. wrangler deploy
 *
 * Then update WORKER_URL in index.html and en.html with your worker URL.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // POST /api/submit — record a quiz result
    if (request.method === 'POST' && url.pathname === '/api/submit') {
      return handleSubmit(request, env);
    }

    // GET /api/stats — aggregate stats for landing page
    if (request.method === 'GET' && url.pathname === '/api/stats') {
      return handleStats(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};

async function handleSubmit(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const {
    score, grade, dims, archetype,
    locale, age_bucket, completion_sec, challenge_score,
  } = body;

  // Basic validation
  if (typeof score !== 'number' || score < 0 || score > 100) {
    return json({ error: 'Invalid score' }, 400);
  }

  // Parse referrer
  let referrer = 'direct';
  const ref = request.headers.get('Referer') || request.headers.get('referrer') || '';
  if (ref) {
    try { referrer = new URL(ref).hostname.replace(/^www\./, ''); } catch {}
  }

  // Device type from User-Agent
  const ua = request.headers.get('User-Agent') || '';
  const device = /Mobile|Android|iPhone|iPad/.test(ua) ? 'mobile' : 'desktop';

  const d = dims || {};

  await env.DB.prepare(`
    INSERT INTO results
      (score, grade, dim_sleep, dim_work, dim_exercise, dim_diet,
       dim_stress, dim_habit, dim_emotion, archetype, locale,
       age_bucket, device, referrer, completion_sec, challenge_score)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    Math.round(score),
    String(grade || '').slice(0, 2),
    d.sleep ?? null, d.work ?? null, d.exercise ?? null, d.diet ?? null,
    d.stress ?? null, d.habit ?? null, d.emotion ?? null,
    String(archetype || '').slice(0, 32),
    String(locale || 'zh').slice(0, 4),
    String(age_bucket || '').slice(0, 8),
    device,
    String(referrer).slice(0, 128),
    typeof completion_sec === 'number' ? Math.round(completion_sec) : null,
    typeof challenge_score === 'number' ? Math.round(challenge_score) : null,
  ).run();

  return json({ ok: true });
}

async function handleStats(request, env) {
  // Cache for 5 minutes to avoid hammering DB on every page load
  const cacheKey = new Request('https://sdi-stats-cache/v1', request);
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const [total, avgScore, dist, archetypes] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as n FROM results').first(),
    env.DB.prepare('SELECT ROUND(AVG(score),1) as avg FROM results').first(),
    env.DB.prepare(`
      SELECT
        SUM(CASE WHEN score < 20 THEN 1 ELSE 0 END) as s,
        SUM(CASE WHEN score >= 20 AND score < 35 THEN 1 ELSE 0 END) as a,
        SUM(CASE WHEN score >= 35 AND score < 50 THEN 1 ELSE 0 END) as b,
        SUM(CASE WHEN score >= 50 AND score < 65 THEN 1 ELSE 0 END) as c,
        SUM(CASE WHEN score >= 65 AND score < 80 THEN 1 ELSE 0 END) as d,
        SUM(CASE WHEN score >= 80 THEN 1 ELSE 0 END) as f
      FROM results
    `).first(),
    env.DB.prepare(`
      SELECT archetype, COUNT(*) as n
      FROM results WHERE archetype != ''
      GROUP BY archetype ORDER BY n DESC LIMIT 5
    `).all(),
  ]);

  const body = JSON.stringify({
    total: total?.n ?? 0,
    avg_score: avgScore?.avg ?? 0,
    grade_dist: dist ?? {},
    top_archetypes: archetypes?.results ?? [],
  });

  const response = new Response(body, {
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
  });

  // Store in edge cache
  await cache.put(cacheKey, response.clone());
  return response;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
