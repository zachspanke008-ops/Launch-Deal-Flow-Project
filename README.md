# VC Deal Flow Tracker

An AI-powered dashboard that tracks VC firm investment activity and industry interests by aggregating public content and using Claude to extract investment signals, deal themes, and market trends.

**Currently tracks:** a16z (Andreessen Horowitz) — Sequoia and YC coming soon.

---

## Setup

### 1. Install dependencies

```bash
cd vc-deal-tracker
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
```

Get an API key at [console.anthropic.com](https://console.anthropic.com).

### 3. Start the server

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

For development with auto-reload:

```bash
npm run dev
```

---

## What it does

- **Aggregates** a16z RSS feeds (main newsletter + growth newsletter) and scrapes a16z.com/news-content/ and a16z.com/newsletters/
- **Deduplicates and sorts** all content by date
- **Sends the latest 20 articles** to Claude Sonnet for AI analysis
- **Displays** four AI-generated insight panels:
  - Investment Themes — what a16z is actively betting on
  - Key Sectors — industries getting attention
  - Notable Deals & Companies — specific investments mentioned
  - Industry Trends & News — broader market and technology narratives
- **Tags each article** as Deal, Industry News, Trend, or Opinion

---

## Data sources (a16z)

| Source | Type |
|--------|------|
| `https://www.a16z.news/feed` | RSS — main Substack newsletter |
| `https://a16zgrowth.substack.com/feed` | RSS — Growth newsletter |
| `https://a16z.com/news-content/` | Scraped — articles, titles, authors |
| `https://a16z.com/newsletters/` | Scraped — newsletter publications |

---

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/firms` | Returns list of tracked firms with metadata |
| `GET /api/feed?firm=a16z` | Returns combined article feed (deduped, sorted) |
| `GET /api/insights?firm=a16z` | Returns Claude-generated investment insights |

Responses are cached for 5 minutes to avoid rate limits.

---

## Adding Sequoia or YC

1. Open `server.js`
2. Find the firm with `id: 'sequoia'` (or `'yc'`)
3. Set `coming_soon: false`
4. Add `rssFeeds` and `scrapeTargets` arrays following the a16z pattern

The aggregation, deduplication, Claude analysis, and UI rendering all work automatically for any firm in the config.

---

## Tech stack

- **Backend:** Node.js + Express
- **RSS parsing:** rss-parser
- **Web scraping:** cheerio + axios
- **AI analysis:** Anthropic SDK (Claude Sonnet)
- **Frontend:** Plain HTML/CSS/JS (no build step)
