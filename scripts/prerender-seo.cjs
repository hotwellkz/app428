/**
 * Пост-билд пререндер SEO-страниц: запускать после vite build.
 * Генерирует статический HTML с контентом и meta для маршрутов из PRERENDER_ROUTES.
 * Требуется: Node, собранный dist/, и Chrome/Chromium (или PUPPETEER_EXECUTABLE_PATH).
 *
 * Запуск: npm run build && node scripts/prerender-seo.cjs
 * Или: npm run build:prerender
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = 37542;
const WAIT_MS = 4500;

const PRERENDER_ROUTES = [
  '/',
  '/crm-dlya-biznesa',
  '/crm-dlya-malogo-biznesa',
  '/crm-dlya-prodazh',
  '/whatsapp-crm',
  '/vozmozhnosti',
  '/ceny',
  '/faq',
];

function serveDist(req, res) {
  let urlPath = (req.url || '/').split('?')[0] || '/';
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(path.join(DIST, 'index.html')).pipe(res);
      return;
    }
    res.writeHead(200);
    fs.createReadStream(filePath).pipe(res);
  });
}

function runServer() {
  return new Promise((resolve) => {
    const server = http.createServer(serveDist);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function prerender() {
  let Puppeteer;
  try {
    Puppeteer = require('puppeteer');
  } catch (e) {
    console.error('puppeteer не найден. Установите: npm i -D puppeteer');
    console.error('Для пропуска загрузки Chromium: PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 npm i -D puppeteer');
    process.exit(1);
  }

  const server = await runServer();
  const baseUrl = `http://127.0.0.1:${PORT}`;

  let browser;
  try {
    browser = await Puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  } catch (e) {
    server.close();
    console.error('Не удалось запустить браузер. Убедитесь, что установлен Chromium или задан PUPPETEER_EXECUTABLE_PATH.');
    console.error(e.message);
    process.exit(1);
  }

  for (const route of PRERENDER_ROUTES) {
    const url = route === '/' ? baseUrl + '/' : baseUrl + route;
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise((r) => setTimeout(r, WAIT_MS));
      const html = await page.content();
      const outDir = route === '/' ? DIST : path.join(DIST, route);
      const outFile = path.join(outDir, 'index.html');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(outFile, html, 'utf8');
      console.log('OK', route || '/');
    } catch (err) {
      console.error('FAIL', route || '/', err.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  server.close();
  console.log('Prerender done.');
}

prerender().catch((e) => {
  console.error(e);
  process.exit(1);
});
