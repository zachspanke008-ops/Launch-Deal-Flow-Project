require('dotenv').config();
console.log('Apify key loaded:', !!process.env.APIFY_API_KEY);
const express = require('express');
const cors = require('cors');
const RSSParser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const rssParser = new RSSParser({
  timeout: 12000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VCTracker/1.0; +https://github.com/vc-tracker)' },
  customFields: { item: ['author', 'dc:creator'] }
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ─── Firm Configurations ─────────────────────────────────────────────────────

const FIRMS = [
  {
    id: 'a16z',
    name: 'a16z',
    fullName: 'Andreessen Horowitz',
    coming_soon: false,
    color: '#6366f1',
    rssFeeds: [
      { url: 'https://www.a16z.news/feed', name: 'a16z Newsletter' },
      { url: 'https://a16zgrowth.substack.com/feed', name: 'a16z Growth' },
      { url: 'https://news.google.com/rss/search?q=a16z+investment&hl=en-US&gl=US&ceid=US:en', name: 'Google News — a16z' },
      { url: 'https://news.google.com/rss/search?q=Andreessen+Horowitz+funding&hl=en-US&gl=US&ceid=US:en', name: 'Google News — a16z Funding' }
    ],
    scrapeTargets: [
      { url: 'https://a16z.com/news-content/', type: 'news-content' },
      { url: 'https://a16z.com/newsletters/', type: 'newsletters' }
    ],
    portfolioFeeds: [
      { url: 'https://news.google.com/rss/search?q=Coinbase+news&hl=en-US&gl=US&ceid=US:en', company: 'Coinbase', sector: 'Crypto' },
      { url: 'https://news.google.com/rss/search?q=GitHub+news&hl=en-US&gl=US&ceid=US:en', company: 'GitHub', sector: 'Developer Tools' },
      { url: 'https://news.google.com/rss/search?q=Roblox+news&hl=en-US&gl=US&ceid=US:en', company: 'Roblox', sector: 'Gaming' },
      { url: 'https://news.google.com/rss/search?q=Lyft+news&hl=en-US&gl=US&ceid=US:en', company: 'Lyft', sector: 'Transportation' },
      { url: 'https://news.google.com/rss/search?q=Substack+news&hl=en-US&gl=US&ceid=US:en', company: 'Substack', sector: 'Media' }
    ]
  },
  {
    id: 'yc',
    name: 'Y Combinator',
    fullName: 'Y Combinator',
    coming_soon: false,
    color: '#ef4444',
    rssFeeds: [
      { url: 'https://news.google.com/rss/search?q=Y+Combinator+startup+2026&hl=en-US&gl=US&ceid=US:en', name: 'Google News — YC 2026' },
      { url: 'https://news.google.com/rss/search?q=YC+batch+2026+startup&hl=en-US&gl=US&ceid=US:en', name: 'Google News — YC Batch 2026' },
      { url: 'https://news.google.com/rss/search?q=%22Y+Combinator%22+funding+OR+investment+OR+batch&hl=en-US&gl=US&ceid=US:en', name: 'Google News — YC Funding' },
      { url: 'https://www.ycombinator.com/blog/rss.xml', name: 'YC Blog' },
      { url: 'https://techcrunch.com/tag/y-combinator/feed/', name: 'TechCrunch — Y Combinator' }
    ],
    portfolioFeeds: [
      { url: 'https://news.google.com/rss/search?q=Airbnb+news&hl=en-US&gl=US&ceid=US:en',    company: 'Airbnb',    sector: 'Travel' },
      { url: 'https://news.google.com/rss/search?q=Stripe+news&hl=en-US&gl=US&ceid=US:en',    company: 'Stripe',    sector: 'Fintech' },
      { url: 'https://news.google.com/rss/search?q=Dropbox+news&hl=en-US&gl=US&ceid=US:en',   company: 'Dropbox',   sector: 'Storage' },
      { url: 'https://news.google.com/rss/search?q=Doordash+news&hl=en-US&gl=US&ceid=US:en',  company: 'DoorDash',  sector: 'Delivery' },
      { url: 'https://news.google.com/rss/search?q=Reddit+news&hl=en-US&gl=US&ceid=US:en',    company: 'Reddit',    sector: 'Social Media' },
      { url: 'https://news.google.com/rss/search?q=Twitch+news&hl=en-US&gl=US&ceid=US:en',    company: 'Twitch',    sector: 'Streaming' },
      { url: 'https://news.google.com/rss/search?q=Instacart+news&hl=en-US&gl=US&ceid=US:en', company: 'Instacart', sector: 'Grocery' },
      { url: 'https://news.google.com/rss/search?q=Coinbase+news&hl=en-US&gl=US&ceid=US:en',  company: 'Coinbase',  sector: 'Crypto' },
      { url: 'https://news.google.com/rss/search?q=Brex+news&hl=en-US&gl=US&ceid=US:en',      company: 'Brex',      sector: 'Fintech' },
      { url: 'https://news.google.com/rss/search?q=Openai+news&hl=en-US&gl=US&ceid=US:en',    company: 'OpenAI',    sector: 'AI' }
    ]
  },
  {
    id: 'sequoia',
    name: 'Sequoia',
    fullName: 'Sequoia Capital',
    coming_soon: false,
    color: '#f59e0b',
    rssFeeds: [
      { url: 'https://news.google.com/rss/search?q=%22Sequoia+Capital%22+investment+OR+funding+OR+portfolio&hl=en-US&gl=US&ceid=US:en', name: 'Google News — Sequoia Investments' },
      { url: 'https://news.google.com/rss/search?q=%22Sequoia+Capital%22+startup+2026&hl=en-US&gl=US&ceid=US:en', name: 'Google News — Sequoia 2026' },
      { url: 'https://news.google.com/rss/search?q=%22Sequoia+Capital%22+deal+OR+raises+OR+leads&hl=en-US&gl=US&ceid=US:en', name: 'Google News — Sequoia Deals' },
      { url: 'https://techcrunch.com/tag/sequoia/feed/', name: 'TechCrunch — Sequoia' },
      { url: 'https://medium.com/feed/sequoia-capital', name: 'Sequoia Medium' }
    ],
    portfolioFeeds: [
      { url: 'https://news.google.com/rss/search?q=Stripe+funding+OR+Stripe+news&hl=en-US&gl=US&ceid=US:en', company: 'Stripe', sector: 'Fintech' },
      { url: 'https://news.google.com/rss/search?q=Airbnb+news&hl=en-US&gl=US&ceid=US:en', company: 'Airbnb', sector: 'Travel' },
      { url: 'https://news.google.com/rss/search?q=DoorDash+news&hl=en-US&gl=US&ceid=US:en', company: 'DoorDash', sector: 'Delivery' },
      { url: 'https://news.google.com/rss/search?q=Zoom+news&hl=en-US&gl=US&ceid=US:en', company: 'Zoom', sector: 'Communications' },
      { url: 'https://news.google.com/rss/search?q=ByteDance+news&hl=en-US&gl=US&ceid=US:en', company: 'ByteDance', sector: 'Social Media' }
    ]
  }
];

// ─── Cache ────────────────────────────────────────────────────────────────────

const cache = new Map();
const CACHE_TTL       = 5  * 60 * 1000;   // 5 min — articles / insights
const TWEET_CACHE_TTL = 30 * 60 * 1000;   // 30 min — Apify results (expensive to re-run)

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > (entry.ttl || CACHE_TTL)) { cache.delete(key); return null; }
  return entry.data;
}
function setCached(key, data, ttl = CACHE_TTL) { cache.set(key, { data, ts: Date.now(), ttl }); }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categorize(title, summary = '') {
  const text = (title + ' ' + summary).toLowerCase();
  const deal     = ['invest', 'portfolio', 'funding', 'raise', 'raised', 'series a', 'series b', 'series c', 'valuation', 'acquisition', 'acquires', 'backed', 'round'];
  const trend    = ['trend', 'future of', 'emerging', 'shift', 'growth', 'prediction', 'forecast', 'market', 'outlook', 'next wave'];
  const opinion  = ['why ', 'how to', 'should ', 'we think', 'perspective', 'opinion', 'case for', 'case against', 'believe', 'view on'];
  if (deal.some(k => text.includes(k)))    return 'Deal';
  if (opinion.some(k => text.includes(k))) return 'Opinion';
  if (trend.some(k => text.includes(k)))   return 'Trend';
  return 'Industry News';
}

function buildArticleList(items, limit = 20) {
  return items.slice(0, limit).map((item, i) =>
    `${i + 1}. "${item.title}"${item.author ? ` by ${item.author}` : ''} [${item.source}] (${item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'no date'})\n   ${item.summary ? item.summary.slice(0, 200) : ''}`
  ).join('\n\n');
}

// Try to parse a date string into ISO format. Returns null if unparseable.
function parseDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  // Reject obviously wrong years (1970 epoch artifacts, future dates > 5 years out)
  if (isNaN(d) || d.getFullYear() < 2000 || d.getFullYear() > new Date().getFullYear() + 5) return null;
  return d.toISOString();
}

// Extract a publish date from a cheerio element by checking time[datetime],
// date-related classes, and text content that looks like a date.
function extractDateFromEl($el) {
  // <time datetime="..."> is the most reliable
  const dt = $el.find('time[datetime]').first().attr('datetime');
  if (dt) return parseDate(dt);

  // <time> text (e.g. "May 20, 2026")
  const timeTxt = $el.find('time').first().text().trim();
  if (timeTxt) { const d = parseDate(timeTxt); if (d) return d; }

  // Common class patterns
  const dateSels = ['[class*="date"]','[class*="published"]','[class*="post-date"]','[class*="pub-date"]','[class*="timestamp"]','.meta'];
  for (const sel of dateSels) {
    const txt = $el.find(sel).first().text().trim();
    if (txt && txt.length < 40) { const d = parseDate(txt); if (d) return d; }
  }
  return null;
}

// Build a url→isoDate map from all JSON-LD <script> blocks on a page.
function extractJsonLdDates($) {
  const map = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const process = obj => {
        if (!obj) return;
        if (Array.isArray(obj)) { obj.forEach(process); return; }
        if (obj['@graph']) { obj['@graph'].forEach(process); return; }
        if (['Article','BlogPosting','NewsArticle'].includes(obj['@type'])) {
          const url  = obj.url || obj.mainEntityOfPage?.['@id'] || '';
          const date = obj.datePublished || obj.dateCreated || obj.dateModified || '';
          if (url && date) map[url] = date;
        }
      };
      process(JSON.parse($(el).html()));
    } catch { /* malformed JSON-LD — skip */ }
  });
  return map;
}

// resolveLinks includes date + source + summary so the frontend can display them
function resolveLinks(sources, items) {
  return (sources || [])
    .filter(n => Number.isInteger(n) && n >= 1 && n <= items.length)
    .map(n => ({
      title:   items[n - 1].title,
      link:    items[n - 1].link,
      date:    items[n - 1].date,
      source:  items[n - 1].source,
      summary: items[n - 1].summary || ''
    }))
    .filter(l => l.link);
}

// ─── RSS Feed Fetching ────────────────────────────────────────────────────────

async function fetchRSSFeed(feedConfig) {
  try {
    const parsed = await rssParser.parseURL(feedConfig.url);
    return (parsed.items || []).slice(0, 20).map(item => ({
      title:    item.title?.trim() || 'Untitled',
      link:     item.link || '',
      summary:  item.contentSnippet?.trim() || item.summary?.trim() || '',
      date:     parseDate(item.isoDate) || parseDate(item.pubDate) || null,
      source:   feedConfig.name,
      author:   item.author || item['dc:creator'] || '',
      category: categorize(item.title || '', item.contentSnippet || item.summary || '')
    }));
  } catch (err) {
    console.warn(`[RSS] Failed to fetch ${feedConfig.url}:`, err.message);
    return [];
  }
}

// ─── Web Scraping ─────────────────────────────────────────────────────────────

const SCRAPE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

async function scrapeNewsContent(url) {
  try {
    const { data } = await axios.get(url, { headers: SCRAPE_HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    const items = [];

    // Build a URL → date map from JSON-LD on the page (often present on Next.js sites)
    const ldDates = extractJsonLdDates($);

    const containerSelectors = ['article', '.post-card', '.article-card', '[class*="ArticleCard"]', '[class*="post-item"]', '.entry-summary'];
    let found = false;

    for (const sel of containerSelectors) {
      const els = $(sel);
      if (els.length < 2) continue;
      els.each((i, el) => {
        if (i >= 12) return false;
        const $el   = $(el);
        const title  = $el.find('h1, h2, h3').first().text().trim();
        const link   = $el.find('a[href]').first().attr('href') || '';
        const author = $el.find('[class*="author"], [class*="byline"], [rel="author"]').first().text().trim();
        const summary = $el.find('p').first().text().trim();
        const absLink = link.startsWith('http') ? link : `https://a16z.com${link}`;
        // Try element-level date, then JSON-LD lookup by URL
        const date = extractDateFromEl($el) || parseDate(ldDates[absLink]) || null;
        if (title.length > 10) {
          items.push({ title, link: absLink, summary: summary || (author ? `By ${author}` : ''), date, source: 'a16z.com', author, category: categorize(title, summary) });
          found = true;
        }
      });
      if (found) break;
    }

    if (items.length < 3) {
      $('a[href*="/"]').each((_, el) => {
        if (items.length >= 12) return false;
        const $el   = $(el);
        const title = $el.text().trim();
        const link  = $el.attr('href') || '';
        const isNavOrFooter = $el.closest('nav, footer, header').length > 0;
        if (title.length > 25 && !isNavOrFooter && !title.toLowerCase().includes('cookie') && !title.includes('©')) {
          const absLink = link.startsWith('http') ? link : `https://a16z.com${link}`;
          items.push({ title, link: absLink, summary: '', date: parseDate(ldDates[absLink]) || null, source: 'a16z.com', author: '', category: categorize(title, '') });
        }
      });
    }

    return items;
  } catch (err) {
    console.warn(`[Scrape] Failed to scrape ${url}:`, err.message);
    return [];
  }
}

async function scrapeNewsletters(url) {
  try {
    const { data } = await axios.get(url, { headers: SCRAPE_HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    const items = [];

    $('a').each((_, el) => {
      if (items.length >= 8) return false;
      const $el = $(el);
      const title = $el.text().trim();
      const link  = $el.attr('href') || '';
      const isSubstack   = link.includes('substack');
      const isNewsletter = link.includes('newsletter') || $el.closest('[class*="newsletter"]').length > 0;
      if ((isSubstack || isNewsletter) && title.length > 4 && !title.includes('©')) {
        items.push({
          title: `Newsletter: ${title}`,
          link: link.startsWith('http') ? link : `https://a16z.com${link}`,
          summary: 'a16z publication', date: null,
          source: 'a16z Newsletters', author: '', category: 'Industry News'
        });
      }
    });

    return items;
  } catch (err) {
    console.warn(`[Scrape] Failed to scrape newsletters ${url}:`, err.message);
    return [];
  }
}

// ─── Investments Page Scraper ─────────────────────────────────────────────────

async function scrapeA16zInvestmentsPage() {
  try {
    const { data } = await axios.get('https://a16z.com/investments/', {
      headers: SCRAPE_HEADERS, timeout: 15000
    });
    const $ = cheerio.load(data);
    const results = [];

    // Try to extract Next.js SSR data embedded in the page
    const nextDataRaw = $('script#__NEXT_DATA__').html();
    if (nextDataRaw) {
      try {
        const nextData = JSON.parse(nextDataRaw);
        // Recursively search for arrays of companies
        const findCompanies = (obj, depth = 0) => {
          if (depth > 6 || !obj || typeof obj !== 'object') return;
          if (Array.isArray(obj) && obj.length >= 3) {
            const first = obj[0];
            if (first && typeof first === 'object' && (first.name || first.title || first.companyName || first.company)) {
              obj.slice(0, 30).forEach(item => {
                const name   = item.name || item.title || item.companyName || item.company || '';
                const sector = item.category || item.sector || item.verticals?.[0] || item.type || '';
                const desc   = item.description || item.shortDescription || item.excerpt || '';
                const slug   = item.slug || item.id || '';
                const link   = item.url || (slug ? `https://a16z.com/portfolio/${slug}` : '');
                const round  = item.round || item.stage || null;
                const amount = item.amount || item.raised || null;
                const date   = item.announcedOn || item.fundedOn || item.date || null;
                if (name.length > 1 && name.length < 60 && results.length < 30 && !results.find(r => r.company === name)) {
                  results.push({ company: name, sector: String(sector).slice(0, 50), reason: String(desc).slice(0, 200), link, source: 'a16z.com/investments', date: parseDate(date), round, amount });
                }
              });
            }
          }
          if (typeof obj === 'object' && !Array.isArray(obj)) {
            Object.values(obj).forEach(v => findCompanies(v, depth + 1));
          }
        };
        findCompanies(nextData);
      } catch { /* fall through to HTML */ }
    }

    // HTML fallback — try common portfolio card patterns
    if (results.length < 3) {
      const sels = ['[class*="portfolio"]', '[class*="Portfolio"]', '[class*="investment"]', '.card', 'article'];
      for (const sel of sels) {
        $(sel).each((i, el) => {
          if (results.length >= 20 || i >= 40) return false;
          const $el   = $(el);
          const name  = $el.find('h2,h3,h4,[class*="name"],[class*="title"]').first().text().trim();
          const desc  = $el.find('p').first().text().trim();
          const link  = $el.find('a').first().attr('href') || '';
          const sector = $el.find('[class*="sector"],[class*="tag"],[class*="category"]').first().text().trim();
          if (name.length > 1 && name.length < 60 && !results.find(r => r.company === name)) {
            results.push({
              company: name, sector: sector || 'Technology',
              reason: desc.slice(0, 200),
              link: link.startsWith('http') ? link : (link ? `https://a16z.com${link}` : ''),
              source: 'a16z.com/investments', date: null, round: null, amount: null
            });
          }
        });
        if (results.length >= 5) break;
      }
    }

    console.log(`[Scrape] a16z investments: found ${results.length} companies`);
    return results;
  } catch (err) {
    console.warn('[Scrape] a16z investments page:', err.message);
    return [];
  }
}

// ─── Crunchbase Scraper (best-effort, will fail gracefully) ───────────────────

async function scrapeCrunchbaseInvestments() {
  try {
    const { data } = await axios.get(
      'https://www.crunchbase.com/organization/andreessen-horowitz/investments',
      { headers: { ...SCRAPE_HEADERS, 'Accept-Encoding': 'gzip, deflate' }, timeout: 10000 }
    );
    const $ = cheerio.load(data);
    const results = [];

    // Crunchbase dynamic — try to find any table/list rows with deal data
    $('tr, [class*="row"], [class*="investment-row"]').each((i, el) => {
      if (i >= 25 || results.length >= 20) return false;
      const $el   = $(el);
      const cells = $el.find('td, [class*="cell"]');
      if (cells.length >= 2) {
        const company = cells.eq(0).text().trim();
        const round   = cells.eq(1).text().trim();
        const amount  = cells.eq(2)?.text().trim();
        const date    = cells.eq(3)?.text().trim();
        if (company.length > 1 && company.length < 60) {
          results.push({
            company, round: round || null, amount: amount || null,
            date: parseDate(date),
            sector: 'Technology', reason: '',
            link: '', source: 'Crunchbase'
          });
        }
      }
    });

    console.log(`[Scrape] Crunchbase: found ${results.length} deals`);
    return results;
  } catch (err) {
    console.warn('[Scrape] Crunchbase (expected anti-bot):', err.message);
    return [];
  }
}

// ─── Sequoia Scrapers ─────────────────────────────────────────────────────────

async function scrapeSequoiaStories() {
  try {
    const { data } = await axios.get('https://sequoiacap.com/stories/', { headers: SCRAPE_HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    const items = [];
    const ldDates = extractJsonLdDates($);

    const containerSels = ['article', '.story-card', '[class*="Story"]', '[class*="story"]', '[class*="post-card"]', '.card', '[class*="Card"]'];
    let found = false;
    for (const sel of containerSels) {
      const els = $(sel);
      if (els.length < 2) continue;
      els.each((i, el) => {
        if (i >= 15) return false;
        const $el    = $(el);
        const title  = $el.find('h1,h2,h3').first().text().trim();
        const link   = $el.find('a[href]').first().attr('href') || '';
        const author = $el.find('[class*="author"],[class*="byline"],[rel="author"]').first().text().trim();
        const summary = $el.find('p').first().text().trim();
        const absLink = link.startsWith('http') ? link : `https://sequoiacap.com${link}`;
        const date = extractDateFromEl($el) || parseDate(ldDates[absLink]) || null;
        if (title.length > 10 && !items.find(x => x.title === title)) {
          items.push({ title, link: absLink, summary: summary.slice(0, 200), date, source: 'sequoiacap.com/stories', author, category: categorize(title, summary) });
          found = true;
        }
      });
      if (found && items.length >= 3) break;
    }

    if (items.length < 3) {
      $('a[href]').each((_, el) => {
        if (items.length >= 12) return false;
        const $el   = $(el);
        const title = $el.text().trim();
        const href  = $el.attr('href') || '';
        const isNav = $el.closest('nav,footer,header').length > 0;
        const absLink = href.startsWith('http') ? href : `https://sequoiacap.com${href}`;
        if (title.length > 20 && !isNav && !title.includes('©') && !items.find(x => x.title === title)) {
          items.push({ title, link: absLink, summary: '', date: parseDate(ldDates[absLink]) || null, source: 'sequoiacap.com/stories', author: '', category: categorize(title, '') });
        }
      });
    }

    console.log(`[Scrape] Sequoia stories: found ${items.length} articles`);
    return items;
  } catch (err) {
    console.warn('[Scrape] Sequoia stories:', err.message);
    return [];
  }
}

async function scrapeSequoiaWriting() {
  try {
    const { data } = await axios.get('https://sequoiacap.com/?media=text', { headers: SCRAPE_HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    const items = [];
    const ldDates = extractJsonLdDates($);

    const containerSels = ['article', '[class*="article"]', '[class*="Article"]', '[class*="post"]', '[class*="Post"]', '.card', '[class*="Card"]'];
    let found = false;
    for (const sel of containerSels) {
      const els = $(sel);
      if (els.length < 2) continue;
      els.each((i, el) => {
        if (i >= 15) return false;
        const $el    = $(el);
        const title  = $el.find('h1,h2,h3').first().text().trim();
        const link   = $el.find('a[href]').first().attr('href') || '';
        const author = $el.find('[class*="author"],[class*="byline"]').first().text().trim();
        const summary = $el.find('p').first().text().trim();
        const absLink = link.startsWith('http') ? link : `https://sequoiacap.com${link}`;
        const date = extractDateFromEl($el) || parseDate(ldDates[absLink]) || null;
        if (title.length > 10 && !items.find(x => x.title === title)) {
          items.push({ title, link: absLink, summary: summary.slice(0, 200), date, source: 'sequoiacap.com', author, category: categorize(title, summary) });
          found = true;
        }
      });
      if (found && items.length >= 3) break;
    }

    if (items.length < 3) {
      $('a[href]').each((_, el) => {
        if (items.length >= 12) return false;
        const $el   = $(el);
        const title = $el.text().trim();
        const href  = $el.attr('href') || '';
        const isNav = $el.closest('nav,footer,header').length > 0;
        const absLink = href.startsWith('http') ? href : `https://sequoiacap.com${href}`;
        if (title.length > 20 && !isNav && !title.includes('©') && !items.find(x => x.title === title)) {
          items.push({ title, link: absLink, summary: '', date: parseDate(ldDates[absLink]) || null, source: 'sequoiacap.com', author: '', category: categorize(title, '') });
        }
      });
    }

    console.log(`[Scrape] Sequoia writing: found ${items.length} articles`);
    return items;
  } catch (err) {
    console.warn('[Scrape] Sequoia writing:', err.message);
    return [];
  }
}

// ─── Feed Aggregation ─────────────────────────────────────────────────────────

async function aggregateFeed(firm) {
  const cacheKey = `feed:${firm.id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Fetch RSS feeds for all firms
  const rssResults = await Promise.all(firm.rssFeeds.map(fetchRSSFeed));
  let all = rssResults.flat();

  // a16z additionally scrapes its own website for articles and newsletters
  if (firm.id === 'a16z' && firm.scrapeTargets) {
    const [newsItems, newsletterItems] = await Promise.all([
      scrapeNewsContent(firm.scrapeTargets[0].url),
      scrapeNewsletters(firm.scrapeTargets[1].url)
    ]);
    all = [...all, ...newsItems, ...newsletterItems];
  }

  // Deduplicate by URL first, then by normalised title as fallback
  const seen = new Set();
  const deduped = all.filter(item => {
    const key = (item.link || '').trim().toLowerCase() || item.title.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const YC_KEYWORDS       = ['y combinator', 'yc', 'hacker news', 'startup accelerator'];
  const SEQUOIA_KEYWORDS  = ['sequoia', 'roelof', 'shaun maguire', 'pat grady'];
  const filtered = firm.id === 'yc'
    ? deduped.filter(item => {
        const title = (item.title || '').toLowerCase();
        return YC_KEYWORDS.some(kw => title.includes(kw));
      })
    : firm.id === 'sequoia'
    ? deduped.filter(item => {
        const title = (item.title || '').toLowerCase();
        return SEQUOIA_KEYWORDS.some(kw => title.includes(kw));
      })
    : deduped;

  filtered.sort((a, b) => {
    const da = new Date(a.date), db = new Date(b.date);
    return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
  });

  setCached(cacheKey, filtered);
  return filtered;
}

// ─── Tab Data Generators ──────────────────────────────────────────────────────

// Overview: just returns the raw aggregated feed (no Claude needed)
async function generateOverview(firm, items) {
  return { articles: items };
}

// Fetch the 5 most recent articles from a dedicated Google News search for a16z overview
async function fetchA16zOverviewNews() {
  const cacheKey = 'overview:news:a16z';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const feed = {
    url: 'https://news.google.com/rss/search?q=Andreessen+Horowitz&hl=en-US&gl=US&ceid=US:en',
    name: 'Google News'
  };
  const items = await fetchRSSFeed(feed);
  const top5 = items.slice(0, 5);
  setCached(cacheKey, top5);
  return top5;
}

async function fetchYCOverviewNews() {
  const cacheKey = 'overview:news:yc';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const feed = {
    url: 'https://news.google.com/rss/search?q=Y+Combinator&hl=en-US&gl=US&ceid=US:en',
    name: 'Google News'
  };
  const items = await fetchRSSFeed(feed);
  const top5 = items.slice(0, 5);
  setCached(cacheKey, top5);
  return top5;
}

async function generateInvestments(firm, items) {
  const cacheKey = `tab:investments:${firm.id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let result;

  if (firm.id === 'a16z') {
    // 1. Try Crunchbase
    const crunchbaseDeals = await scrapeCrunchbaseInvestments();
    if (crunchbaseDeals.length >= 5) {
      result = { investments: crunchbaseDeals };
    } else {
      // 2. Fall back to dedicated Google News investment RSS + Claude extraction
      const invFeed = {
        url: 'https://news.google.com/rss/search?q=Andreessen+Horowitz+invests+OR+a16z+leads+round+OR+a16z+investment&hl=en-US&gl=US&ceid=US:en',
        name: 'Google News — a16z Investments'
      };
      const rssItems = await fetchRSSFeed(invFeed);
      const top = rssItems.slice(0, 30);

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        system: `You are a deal analyst. Extract ALL investment deals, funding rounds, and portfolio company activity from these news articles about Andreessen Horowitz (a16z). Be thorough — aim for at least 10-15 items. For each deal: company (name), round ("Series B", "Seed", etc. or null), amount ("$50M" etc. or null), sector (e.g. "AI", "Fintech", "Healthcare", "SaaS"), date_hint (month+year if mentioned, else null), sources (1-based article numbers). Return JSON only: {"investments":[{company,round,amount,sector,date_hint,sources}]}`,
        messages: [{ role: 'user', content: `Extract ALL a16z investment deals from:\n\n${buildArticleList(top)}` }]
      });

      let investments = [];
      try {
        const text = response.content[0].text.trim();
        const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
        const raw = JSON.parse(match[1].trim());
        investments = (raw.investments || []).map(inv => {
          const links = resolveLinks(inv.sources, top);
          return {
            company:   inv.company   || '',
            round:     inv.round     || null,
            amount:    inv.amount    || null,
            sector:    inv.sector    || '',
            reason:    '',
            date:      links[0]?.date || null,
            date_hint: inv.date_hint || null,
            links,
            source: 'analysis'
          };
        });
      } catch { /* keep empty */ }

      result = { investments };
    }
  } else {
    // Non-a16z firms: Claude analysis on aggregated RSS feed
    const top = items.slice(0, 40);
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: `You are a deal analyst. Extract ALL investment deals, funding rounds, and portfolio company activity from these ${firm.fullName} articles. Be thorough — aim for at least 10-12 items. For each: company (name), round ("Series B", "Seed", etc. or null), amount ("$50M" etc. or null), sector, reason (one sentence), date_hint (month+year if mentioned, else null), sources (1-based article numbers). Return JSON only: {"investments":[{company,round,amount,sector,reason,date_hint,sources}]}`,
      messages: [{ role: 'user', content: `Extract ALL deal activity from:\n\n${buildArticleList(top)}` }]
    });

    let fromClaude = [];
    try {
      const text = response.content[0].text.trim();
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
      const raw = JSON.parse(match[1].trim());
      fromClaude = (raw.investments || []).map(inv => {
        const links = resolveLinks(inv.sources, top);
        return {
          company:   inv.company   || '',
          round:     inv.round     || null,
          amount:    inv.amount    || null,
          sector:    inv.sector    || '',
          reason:    inv.reason    || '',
          date:      links[0]?.date || null,
          date_hint: inv.date_hint || null,
          links,
          source: 'analysis'
        };
      });
    } catch { /* keep empty */ }

    result = { investments: fromClaude };
  }

  setCached(cacheKey, result);
  return result;
}

async function generateTrends(firm, items) {
  const cacheKey = `tab:trends:${firm.id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const top = items.slice(0, 25);

  const systemPrompt = firm.id === 'sequoia'
    ? `You are an investment analyst assistant. Analyze these recent articles from Sequoia Capital. Return JSON only: {"hot_topics":[{"text":"investment theme (3-8 words)","sources":[1]}],"sectors":[{"text":"sector name","sources":[1]}],"technologies":[{"text":"industry trend or AI topic (3-8 words)","sources":[1]}]} — 4-6 items each. hot_topics: top investment themes and signals. sectors: key sectors Sequoia is betting on. technologies: industry trends, AI topics, and notable company moves they cover. sources: 1-based article numbers from the input list.`
    : firm.id === 'yc'
    ? `You are an investment analyst assistant. Analyze these recent articles from Y Combinator and extract: 1) Top investment themes they are signaling, 2) Key sectors they are betting on, 3) Notable companies or deals mentioned, 4) Broader industry trends they are covering. Be concise and specific. Return JSON only: {"hot_topics":[{"text":"investment theme (3-8 words)","sources":[1]}],"sectors":[{"text":"sector name","sources":[1]}],"technologies":[{"text":"industry trend or notable company (3-8 words)","sources":[1]}]} — 4-6 items each. sources: 1-based article numbers from the input list.`
    : `You are a technology analyst. Analyze what ${firm.fullName} is actively writing about. Return JSON only: {"hot_topics":[{text,sources}],"sectors":[{text,sources}],"technologies":[{text,sources}]} — 4-6 items each. text: 3-8 words. sources: 1-based article numbers (include the BEST single source article for each item as the first element).`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Analyze these articles:\n\n${buildArticleList(top)}` }]
  });

  let trends = { hot_topics: [], sectors: [], technologies: [] };
  try {
    const text = response.content[0].text.trim();
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const raw = JSON.parse(match[1].trim());
    const mapArr = arr => (arr || []).map(i =>
      typeof i === 'string'
        ? { text: i, links: [] }
        : { text: i.text || '', links: resolveLinks(i.sources, top) }
    );
    trends = {
      hot_topics:   mapArr(raw.hot_topics),
      sectors:      mapArr(raw.sectors),
      technologies: mapArr(raw.technologies)
    };
  } catch { /* keep defaults */ }

  const result = { trends };
  setCached(cacheKey, result);
  return result;
}

async function generatePartners(firm, items) {
  const cacheKey = `tab:partners:${firm.id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const top = items.slice(0, 20);
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: `You are analyzing partner/executive activity at ${firm.fullName}. Based on article authors and topics, identify who is writing and what they focus on. Return JSON only: {"partners":[{name,role,topics:[string],article_count,sources:[number]}]} — up to 8 people. Use "Editorial Team" or "Growth Team" if names are unclear. topics: 3-5 strings. sources: 1-based article numbers.`,
    messages: [{ role: 'user', content: `Identify partner/author activity:\n\n${buildArticleList(top)}` }]
  });

  let partners = [];
  try {
    const text = response.content[0].text.trim();
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const raw = JSON.parse(match[1].trim());
    partners = (raw.partners || []).map(p => ({
      name:          p.name          || '',
      role:          p.role          || '',
      topics:        p.topics        || [],
      article_count: p.article_count || 1,
      links:         resolveLinks(p.sources, top)
    }));
  } catch { /* keep empty */ }

  const result = { partners };
  setCached(cacheKey, result);
  return result;
}

// Portfolio: fetch live news per portfolio company via dedicated RSS feeds
async function fetchPortfolioFeeds(firm) {
  if (!firm.portfolioFeeds || !firm.portfolioFeeds.length) return [];

  const results = await Promise.all(
    firm.portfolioFeeds.map(async feed => {
      try {
        const parsed = await rssParser.parseURL(feed.url);
        return (parsed.items || []).slice(0, 4).map(item => {
          let source = '';
          try { source = new URL(item.link || '').hostname.replace('www.', ''); } catch {}
          return {
            company:   feed.company,
            headline:  item.title?.trim() || '',
            sector:    feed.sector || 'Technology',
            news_type: 'Industry News',
            summary:   item.contentSnippet?.trim() || item.summary?.trim() || '',
            link:      item.link || '',
            date:      parseDate(item.isoDate) || parseDate(item.pubDate) || null,
            source:    source || 'News'
          };
        }).filter(n => n.headline && n.link);
      } catch (err) {
        console.warn(`[Portfolio RSS] ${feed.company}:`, err.message);
        return [];
      }
    })
  );

  return results.flat();
}

async function generatePortfolio(firm, _items) {
  const cacheKey = `tab:portfolio:${firm.id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const raw = await fetchPortfolioFeeds(firm);

  // Deduplicate by URL, sort most-recent first
  const seen = new Set();
  const news = raw
    .filter(n => { if (!n.link || seen.has(n.link)) return false; seen.add(n.link); return true; })
    .sort((a, b) => (new Date(b.date) || 0) - (new Date(a.date) || 0));

  const result = { portfolio: { news, total_sources: firm.portfolioFeeds?.length || 0, new_discovered: news.length } };
  setCached(cacheKey, result);
  return result;
}

// ─── API Routes ───────────────────────────────────────────────────────────────

app.get('/api/firms', (_req, res) => {
  res.json(FIRMS.map(({ id, name, fullName, coming_soon, color }) => ({ id, name, fullName, coming_soon, color })));
});

app.get('/api/feed', async (req, res) => {
  const firm = FIRMS.find(f => f.id === (req.query.firm || 'a16z'));
  if (!firm) return res.status(404).json({ error: 'Firm not found' });
  if (firm.coming_soon) return res.json({ items: [], coming_soon: true, firm: firm.id });

  try {
    const items = await aggregateFeed(firm);
    res.json({ items, firm: firm.id, count: items.length });
  } catch (err) {
    console.error('[/api/feed]', err.message);
    res.status(500).json({ error: 'Failed to fetch feed', details: err.message });
  }
});

const TAB_GENERATORS = {
  overview:    generateOverview,
  investments: generateInvestments,
  trends:      generateTrends,
  partners:    generatePartners
};

for (const [tab, generator] of Object.entries(TAB_GENERATORS)) {
  app.get(`/api/insights/${tab}`, async (req, res) => {
    const firm = FIRMS.find(f => f.id === (req.query.firm || 'a16z'));
    if (!firm) return res.status(404).json({ error: 'Firm not found' });
    if (firm.coming_soon) return res.json({ coming_soon: true, firm: firm.id });

    try {
      if (req.query.refresh === '1') {
        cache.delete(`tab:${tab}:${firm.id}`);
        cache.delete(`feed:${firm.id}`);
      }
      const items = await aggregateFeed(firm);
      const data  = await generator(firm, items);
      res.json({ ...data, firm: firm.id });
    } catch (err) {
      console.error(`[/api/insights/${tab}]`, err.message);
      res.status(500).json({ error: err.message });
    }
  });
}

app.get('/api/portfolio', async (req, res) => {
  const firm = FIRMS.find(f => f.id === (req.query.firm || 'a16z'));
  if (!firm) return res.status(404).json({ error: 'Firm not found' });
  if (firm.coming_soon) return res.json({ coming_soon: true, firm: firm.id });

  try {
    if (req.query.refresh === '1') {
      cache.delete(`tab:portfolio:${firm.id}`);
      cache.delete(`feed:${firm.id}`);
    }
    const items = await aggregateFeed(firm);
    const data  = await generatePortfolio(firm, items);
    res.json({ ...data, firm: firm.id });
  } catch (err) {
    console.error('[/api/portfolio]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── X API v2 / Twitter Integration ──────────────────────────────────────────

const FIRM_TWITTER_HANDLES = {
  a16z:    ['a16z', 'pmarca', 'bhorowitz'],
  sequoia: ['sequoia', 'shaunmmaguire', 'gradypb'],
  yc:      ['ycombinator', 'garrytan', 'paulg']
};

const PORTFOLIO_CEO_HANDLES = {
  a16z: [
    { handle: 'zoink',           ceoName: 'Dylan Field',       company: 'Figma' },
    { handle: 'alighodsi',       ceoName: 'Ali Ghodsi',        company: 'Databricks' },
    { handle: 'ashtom',          ceoName: 'Thomas Dohmke',     company: 'GitHub' },
    { handle: 'fidjissimo',      ceoName: 'Fidji Simo',        company: 'Instacart' },
    { handle: 'jasoncitron',     ceoName: 'Jason Citron',      company: 'Discord' }
  ],
  sequoia: [
    { handle: 'patrickc',        ceoName: 'Patrick Collison',  company: 'Stripe' },
    { handle: 'bchesky',         ceoName: 'Brian Chesky',      company: 'Airbnb' },
    { handle: 't_xu',            ceoName: 'Tony Xu',           company: 'DoorDash' },
    { handle: 'ivanhzhao',       ceoName: 'Ivan Zhao',         company: 'Notion' },
    { handle: 'ericsyuan',       ceoName: 'Eric Yuan',         company: 'Zoom' }
  ],
  yc: [
    { handle: 'sama',            ceoName: 'Sam Altman',        company: 'OpenAI' },
    { handle: 'djclancy999',     ceoName: 'Dan Clancy',        company: 'Twitch' },
    { handle: 'brian_armstrong', ceoName: 'Brian Armstrong',   company: 'Coinbase' },
    { handle: 'hdubugras',       ceoName: 'Henrique Dubugras', company: 'Brex' },
    { handle: 'bchesky',         ceoName: 'Brian Chesky',      company: 'Airbnb' }
  ]
};

async function fetchTweetsFromXAPI(handles) {
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) throw Object.assign(new Error('X_BEARER_TOKEN not configured in .env'), { missing_config: true });

  const results = await Promise.all(handles.map(async handle => {
    try {
      const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await axios.get(
        `https://api.twitter.com/2/tweets/search/recent?query=from:${handle}&max_results=10&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=name,username&start_time=${startTime}`,
        { headers: { 'Authorization': `Bearer ${bearerToken}` }, timeout: 15000 }
      );
      return (res.data.data || [])
        .filter(t => !t.text.startsWith('RT @'))
        .map(t => ({
          handle:       handle.toLowerCase(),
          text:         t.text,
          createdAt:    t.created_at    || null,
          likeCount:    t.public_metrics?.like_count    || 0,
          retweetCount: t.public_metrics?.retweet_count || 0,
          replyCount:   t.public_metrics?.reply_count   || 0,
          url:          `https://x.com/${handle}/status/${t.id}`,
          isRetweet:    false
        }));
    } catch (err) {
      console.warn(`[X API] @${handle}: ${err.response?.status || err.message}`);
      return [];
    }
  }));

  return results.flat();
}

async function fetchAndCacheTweets(firmId = 'a16z', forceRefresh = false) {
  const cacheKey = `partner:tweets:${firmId}`;
  if (!forceRefresh) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  const handles = FIRM_TWITTER_HANDLES[firmId] || [];
  const tweets  = await fetchTweetsFromXAPI(handles);
  const result  = { tweets, count: tweets.length };
  setCached(cacheKey, result, TWEET_CACHE_TTL);
  return result;
}

app.get('/api/partners/tweets', async (req, res) => {
  const firmId = req.query.firm || 'a16z';
  try {
    const data = await fetchAndCacheTweets(firmId, req.query.refresh === '1');
    res.json(data);
  } catch (err) {
    console.error('[/api/partners/tweets]', err.message);
    res.status(err.missing_config ? 400 : 500).json({ error: err.message, missing_config: !!err.missing_config });
  }
});

app.get('/api/partners/insights', async (req, res) => {
  const firmId = req.query.firm || 'a16z';
  const firm   = FIRMS.find(f => f.id === firmId);
  if (!firm) return res.status(404).json({ error: 'Firm not found' });

  const cacheKey     = `partner:insights:${firmId}`;
  const forceRefresh = req.query.refresh === '1';

  try {
    if (!forceRefresh) {
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);
    }

    const { tweets } = await fetchAndCacheTweets(firmId, forceRefresh);

    console.log(`[Claude] Analyzing ${tweets.length} tweets for ${firmId}`);
    const tweetText = tweets.slice(0, 20).map(t => `@${t.handle}: ${t.text}`).join('\n\n');

    const PARTNER_CONTEXT = {
      a16z: `You will be given tweets from these specific people:
- @pmarca (Marc Andreessen, Co-Founder of a16z) — known for strong opinions on technology, politics, and civilization
- @bhorowitz (Ben Horowitz, Co-Founder of a16z) — focused on culture, leadership, and enterprise
- @a16z (official account) — announces deals and shares firm thesis`,
      sequoia: `You will be given tweets from these specific people:
- @sequoia (official account) — announces deals and shares firm thesis
- @shaunmmaguire (Shaun Maguire, General Partner) — known for defense tech and deep tech investing
- @gradypb (Pat Grady, General Partner) — focused on enterprise software and AI`,
      yc: `You will be given tweets from these specific people:
- @ycombinator (official account) — announces batches and shares accelerator thesis
- @garrytan (Garry Tan, President and CEO) — focused on founder support and early stage
- @paulg (Paul Graham, Co-Founder) — known for contrarian essays and startup philosophy`
    };

    const partnerContext = PARTNER_CONTEXT[firmId] || `You will be given tweets from ${firm.fullName} partners and executives.`;

    const systemPrompt = `You are a senior investment analyst at a top-tier VC firm. Your job is to analyze recent tweets from VC partners and executives and extract genuine market sentiment, opinions, and investment signals — not just topics.

For each insight, go beyond summarizing — interpret what the person actually believes and why it matters for deal flow.

${partnerContext}

Extract the following and be SPECIFIC — always reference who said what and why it signals an investment interest:

1. MARKET SENTIMENT — What do these partners genuinely believe about the market right now? Are they bullish or bearish on specific sectors? Quote or paraphrase their actual stance. Format: "[Person] is [bullish/bearish] on [topic] because [reason from tweet]"

2. CONVICTION SIGNALS — What companies, technologies, or sectors are they expressing strong conviction about? This could be explicit (announcing a deal) or implicit (repeatedly writing about a topic). Format: "[Person] shows strong conviction in [company/sector] — [evidence from tweet]"

3. CONTRARIAN TAKES — What mainstream narratives are they pushing back on? What does the consensus believe that they disagree with? Format: "[Person] disagrees with [narrative] — instead believes [their view]"

4. FORWARD LOOKING BETS — Based on what they are writing about, where do you think they are likely to invest next? Be specific about sector, stage, and type of company. Format: "Based on [person]'s recent activity, likely next bet: [specific thesis]"

5. DEAL FLOW OPPORTUNITIES — What specific types of companies should you be pitching to this firm right now based on partner signals? Be actionable and specific.

Format your response as JSON with keys: market_sentiment (array of strings), conviction_signals (array of strings), contrarian_takes (array of strings), forward_looking_bets (array of strings), deal_flow_opportunities (array of strings). Each array should have 3-5 items. Return JSON only, no markdown.

Be extremely concise — maximum 2 sentences per bullet point, maximum 3 bullets per section. Total response must be under 500 tokens.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Analyze these tweets:\n\n${tweetText}` }]
    });

    let insights = { market_sentiment: [], conviction_signals: [], contrarian_takes: [], forward_looking_bets: [], deal_flow_opportunities: [] };
    try {
      const text  = response.content[0].text.trim();
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
      insights    = JSON.parse(match[1].trim());
    } catch { /* keep defaults */ }

    const result = { insights, tweets, count: tweets.length, firm: firmId };
    setCached(cacheKey, result, TWEET_CACHE_TTL);
    res.json(result);
  } catch (err) {
    console.error('[/api/partners/insights]', err.message);
    res.status(err.missing_config ? 400 : 500).json({ error: err.message, missing_config: !!err.missing_config });
  }
});

app.get('/api/portfolio-tweets', async (req, res) => {
  const firmId   = req.query.firm || 'a16z';
  const cacheKey = `portfolio:tweets:${firmId}`;

  try {
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const ceos    = PORTFOLIO_CEO_HANDLES[firmId] || [];
    const handles = ceos.map(c => c.handle);
    const tweets  = await fetchTweetsFromXAPI(handles);

    const byHandle = {};
    tweets.forEach(t => { (byHandle[t.handle] = byHandle[t.handle] || []).push(t); });

    const ceoData = ceos.map(ceo => ({
      company: ceo.company,
      ceoName: ceo.ceoName,
      handle:  ceo.handle,
      url:     `https://x.com/${ceo.handle}`,
      tweets:  (byHandle[ceo.handle.toLowerCase()] || [])
        .filter(t => !t.text.startsWith('@'))
        .slice(0, 5)
    }));

    const result = { ceos: ceoData, firm: firmId };
    setCached(cacheKey, result, TWEET_CACHE_TTL);
    res.json(result);
  } catch (err) {
    console.error('[/api/portfolio-tweets]', err.message);
    res.status(err.missing_config ? 400 : 500).json({ error: err.message, missing_config: !!err.missing_config });
  }
});

// ─── Overview Aggregation ─────────────────────────────────────────────────────

app.get('/api/overview', async (req, res) => {
  const firm = FIRMS.find(f => f.id === (req.query.firm || 'a16z'));
  if (!firm) return res.status(404).json({ error: 'Firm not found' });
  if (firm.coming_soon) return res.json({ coming_soon: true, firm: firm.id });

  const forceRefresh = req.query.refresh === '1';

  try {
    if (forceRefresh) {
      cache.delete(`feed:${firm.id}`);
      cache.delete(`tab:trends:${firm.id}`);
      cache.delete(`tab:investments:${firm.id}`);
      cache.delete(`tab:portfolio:${firm.id}`);
      cache.delete(`partner:tweets:${firm.id}`);
      if (firm.id === 'a16z') cache.delete('overview:news:a16z');
      if (firm.id === 'yc')   cache.delete('overview:news:yc');
    }

    const items = await aggregateFeed(firm);

    // Run all generators in parallel — each checks its own server cache first
    const overviewNewsFn = firm.id === 'a16z' ? fetchA16zOverviewNews()
                         : firm.id === 'yc'   ? fetchYCOverviewNews()
                         : Promise.resolve(items.slice(0, 5));
    const [trendsData, investmentsData, portfolioData, overviewNews, tweetsData] = await Promise.all([
      generateTrends(firm, items),
      generateInvestments(firm, items),
      generatePortfolio(firm, items),
      overviewNewsFn,
      fetchAndCacheTweets(firm.id)
    ]);

    const recentTweets = (tweetsData.tweets || [])
      .filter(t => t.createdAt && !t.text.startsWith('@'))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);

    res.json({
      firm:           firm.id,
      latestNews:     overviewNews,
      signals: {
        themes:  (trendsData.trends?.hot_topics || []).slice(0, 3).map(i => i.text),
        sectors: (trendsData.trends?.sectors    || []).slice(0, 3).map(i => i.text)
      },
      recentDeals:    (investmentsData.investments || []).slice(0, 3),
      portfolioPulse: (portfolioData.portfolio?.news || []).slice(0, 3),
      industryTrends: (trendsData.trends?.technologies || []).slice(0, 3),
      recentTweets
    });
  } catch (err) {
    console.error('[/api/overview]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
  console.log(`\n  VC Deal Flow Tracker\n  ─────────────────────\n  Running at http://localhost:${PORT}\n`);
});
