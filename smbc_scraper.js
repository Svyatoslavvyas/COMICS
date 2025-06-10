import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.join(__dirname, 'cache');
await fs.mkdir(CACHE_DIR, { recursive: true });

const BASE_URL = 'https://www.smbc-comics.com';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url, cacheFile) {
  const cachePath = path.join(CACHE_DIR, cacheFile);
  try {
    const cached = await fs.readFile(cachePath, 'utf-8');
    console.log(` - Loading from cache: ${cacheFile}`);
    return cached;
  } catch {
    console.log(` - Fetching from site: ${url}`);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.110 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': BASE_URL + '/',
      },
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const text = await res.text();
    await fs.writeFile(cachePath, text, 'utf-8');
    return text;
  }
}

function extractDatesFromOptions(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const options = doc.querySelectorAll('option');
  const dates = [];
  options.forEach(opt => {
    const value = opt.getAttribute('value'); 
    if (value && value.startsWith('comic/')) {
      const date = value.replace('comic/', ''); 
      dates.push(date);
    }
  });
  return dates;
}

async function scrapeComic(date) {
  const url = `${BASE_URL}/comic/${date}`;
  console.log(`📅 Fetching comic for date: ${date}`);
  const html = await fetchPage(url, `comic_${date}.html`);
  if (!html) return null;

  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const img = doc.querySelector('#comic img');
  if (!img) {
    console.log(' - ❌ No image found');
    return null;
  }

  const imgUrl = img.src.startsWith('http') ? img.src : BASE_URL + img.src;
  const imgExt = path.extname(imgUrl).split('?')[0] || '.png';
  const imgCachePath = path.join(CACHE_DIR, `comic_${date}${imgExt}`);

  try {
    await fs.access(imgCachePath);
    console.log(' - ✅ Image already cached');
  } catch {
    console.log(' - ⬇️ Downloading image');
    const res = await fetch(imgUrl);
    if (!res.ok) {
      console.log(' - ❌ Failed to download image');
      return null;
    }
    const buffer = await res.arrayBuffer();
    await fs.writeFile(imgCachePath, Buffer.from(buffer));
  }

  return imgUrl;
}

(async () => {
  console.log('🚀 Script started');


  const optionsHtml = `
    <option value="comic/2002-09-05">September 5, 2002 - 2002-09-05</option>
    <option value="comic/2002-09-07">September 7, 2002 - 2002-09-07</option>
    <option value="comic/2002-09-09">September 9, 2002 - 2002-09-09</option>
    <option value="comic/2002-09-16">September 16, 2002 - 2002-09-16</option>
    <option value="comic/2002-09-20">September 20, 2002 - 2002-09-20</option>
    <option value="comic/2002-09-21">September 21, 2002 - 2002-09-21</option>
    <option value="comic/2002-09-22">September 22, 2002 - 2002-09-22</option>
    <option value="comic/2002-09-27">September 27, 2002 - 2002-09-27</option>
    <option value="comic/2002-10-03">October 3, 2002 - 2002-10-03</option>
  `;
  const dates = extractDatesFromOptions(optionsHtml);

  const results = [];

  for (const date of dates) {
    const res = await scrapeComic(date);
    results.push({ date, url: res });
    await delay(1500);
  }

  console.log('\n📦 All downloaded comics:');
  results.forEach(({ date, url }) => {
    console.log(`${date}: ${url || '❌ Failed'}`);
  });
})();
