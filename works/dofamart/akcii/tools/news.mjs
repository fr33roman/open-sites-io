// News collector for the simulator: reads public RSS/Atom feeds and writes ../news.json.
// Node 18+, no dependencies.  Run:  node tools/news.mjs
// Feed content is DATA only: it is cut down to plain text, never executed, never interpreted.
import { writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'news.json');
const MAX_TOTAL = 120, PER_FEED = 8, PER_CAT = 32, TIMEOUT = 12000, MAX_BYTES = 3e6, MAX_AGE = 864e5 /* only the last 24 hours */;

// cat is one of: crypto | stocks | fintech | companies
const FEEDS = [
  { cat: 'crypto', src: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { cat: 'crypto', src: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
  { cat: 'crypto', src: 'The Block', url: 'https://www.theblock.co/rss.xml' },
  { cat: 'stocks', src: 'CNBC', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258' },
  { cat: 'stocks', src: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
  { cat: 'stocks', src: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss' },
  { cat: 'stocks', src: 'The Wall Street Journal', url: 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain' },
  { cat: 'stocks', src: 'Financial Times', url: 'https://www.ft.com/markets?format=rss' },
  { cat: 'fintech', src: 'The Economist', url: 'https://www.economist.com/finance-and-economics/rss.xml' },
  { cat: 'companies', src: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { cat: 'companies', src: 'The New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },
  { cat: 'companies', src: 'The Guardian', url: 'https://www.theguardian.com/business/rss' },
  { cat: 'fintech', src: 'Finextra', url: 'https://www.finextra.com/rss/headlines.aspx' },
  { cat: 'fintech', src: 'TechCrunch', url: 'https://techcrunch.com/category/fintech/feed/' },
  { cat: 'companies', src: 'CNBC Business', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147' },
  { cat: 'companies', src: 'Коммерсантъ', url: 'https://www.kommersant.ru/RSS/corp.xml' },
  { cat: 'companies', src: 'Ведомости', url: 'https://www.vedomosti.ru/rss/rubric/business' }
];

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 31 && n < 0x10ffff ? String.fromCodePoint(n) : ' ';
    }
    return Object.hasOwn(ENT, e.toLowerCase()) ? ENT[e.toLowerCase()] : ' ';
  });
}
// XML fragment -> plain text: CDATA unwrapped, entities decoded (twice: feeds double-escape), tags removed.
function text(x, max) {
  if (!x) return '';
  let s = x.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  s = decode(decode(s)).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ');
  s = s.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length > max) s = s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
  return s;
}
const tag = (b, names) => { for (const n of names) { const m = b.match(new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>', 'i')); if (m) return m[1]; } return ''; };
function link(b) {
  let m = b.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i), u = m ? text(m[1], 700) : '';
  if (!u) { m = b.match(/<link\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>/i); u = m ? decode(m[1]).trim() : ''; }
  if (!u) u = text(tag(b, ['guid', 'id']), 700);
  try { const p = new URL(u); return p.protocol === 'https:' && !p.username && !p.password ? p.href : ''; } catch { return ''; }
}
function parse(xml, feed) {
  const out = [], blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [], now = Date.now();
  for (const b of blocks) {
    const title = text(tag(b, ['title']), 200), url = link(b);
    if (!title || !url || url.length > 600) continue;
    let ts = Date.parse(text(tag(b, ['pubDate', 'published', 'updated', 'dc:date']), 60));
    if (!Number.isFinite(ts) || ts > now + 36e5) ts = 0;
    if (ts && now - ts > MAX_AGE) continue;
    let sum = text(tag(b, ['description', 'summary', 'content:encoded', 'content']), 600);
    if (sum === title) sum = '';
    out.push({ cat: feed.cat, src: feed.src, title, sum, url, ts });
    if (out.length >= PER_FEED) break;
  }
  return out;
}
async function grab(feed) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), TIMEOUT);
  try {
    const r = await fetch(feed.url, { signal: ac.signal, redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; dofamart-news/1.0)', accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = await r.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error('too big');
    const items = parse(new TextDecoder('utf-8').decode(buf), feed);
    if (!items.length) throw new Error('no items');
    return items;
  } finally { clearTimeout(to); }
}

const res = await Promise.allSettled(FEEDS.map(grab));
let all = [];
res.forEach((r, i) => {
  const f = FEEDS[i];
  if (r.status === 'fulfilled') { console.log('ok   ' + f.src.padEnd(15) + r.value.length); all = all.concat(r.value); }
  else console.log('FAIL ' + f.src.padEnd(15) + String(r.reason && r.reason.message || r.reason).slice(0, 80));
});
const seen = new Set(), perCat = {};
all.sort((a, b) => b.ts - a.ts);
const items = all.filter(n => {
  const k = n.url.split('?')[0];
  if (seen.has(k) || (perCat[n.cat] || 0) >= PER_CAT) return false;
  seen.add(k); perCat[n.cat] = (perCat[n.cat] || 0) + 1; return true;
}).slice(0, MAX_TOTAL);

if (!items.length) { console.error('No news collected: news.json left untouched.'); process.exit(1); }
const tmp = OUT + '.tmp';
await writeFile(tmp, JSON.stringify({ ts: Date.now(), items }, null, 1) + '\n', 'utf8');
await rename(tmp, OUT);
console.log('written ' + items.length + ' items: ' + JSON.stringify(perCat));
