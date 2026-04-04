# Sudden Death Index — Cloudflare Worker

Anonymous analytics backend using Cloudflare Workers + D1 (free tier).

## Setup (takes ~10 minutes)

### 1. Install Wrangler
```bash
npm install -g wrangler
wrangler login
```

### 2. Create the D1 database
```bash
wrangler d1 create sdi-db
```
Copy the `database_id` from the output into `worker/wrangler.toml`.

### 3. Run the schema
```bash
wrangler d1 execute sdi-db --file=worker/schema.sql
```

### 4. Deploy the worker
```bash
wrangler deploy
```
Copy the worker URL (e.g. `https://sdi-worker.yourname.workers.dev`).

### 5. Enable tracking in the HTML files
In both `index.html` and `en.html`, update this line near the top of the `<script>` tag:
```js
const WORKER_URL=''; // Change to your worker URL
```
→
```js
const WORKER_URL='https://sdi-worker.yourname.workers.dev';
```

Then redeploy to Vercel.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/submit` | Record a quiz result (called automatically after each quiz) |
| GET | `/api/stats` | Aggregate stats (total count, avg score, grade distribution, top archetypes) |

## Data collected (all anonymous)
- Final score + grade
- 7 dimension scores
- Archetype matched
- Locale (zh/en)
- Age bucket (18-24, 25-34, etc.)
- Device type (mobile/desktop)
- Referrer domain
- Completion time in seconds
- Challenge score (if challenge mode)

No PII is ever collected.

## Viewing your data
```bash
# Total completions
wrangler d1 execute sdi-db --command="SELECT COUNT(*) FROM results"

# Average score by locale
wrangler d1 execute sdi-db --command="SELECT locale, ROUND(AVG(score),1) as avg, COUNT(*) as n FROM results GROUP BY locale"

# Top archetypes
wrangler d1 execute sdi-db --command="SELECT archetype, COUNT(*) as n FROM results GROUP BY archetype ORDER BY n DESC LIMIT 10"

# Score distribution
wrangler d1 execute sdi-db --command="SELECT grade, COUNT(*) as n FROM results GROUP BY grade ORDER BY n DESC"

# Referrer breakdown
wrangler d1 execute sdi-db --command="SELECT referrer, COUNT(*) as n FROM results GROUP BY referrer ORDER BY n DESC LIMIT 10"
```
