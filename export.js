const _ = require('lodash');
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');
const PDFMerger = require('pdf-merger-js');

const readFile = (file) => new Promise((resolve, reject) => {
  fs.readFile(file, 'utf-8', (err, res) => {
    if (err) {
      reject(err);
    } else {
      resolve(res);
    }
  });
});

const cachePath = (() => {
  if (process.env.XDG_CACHE_HOME)
    return path.join(process.env.XDG_CACHE_HOME, 'draw.io-export');
  if (process.env.HOME)
    return path.join(process.env.HOME, '.cache', 'draw.io-export');
  return path.join(__dirname, '.cache');
})();

const cacheExists = (t) => new Promise((resolve) => {
  fs.exists(path.join(cachePath, t), resolve);
});

const cacheDict = {
  'https://app.diagrams.net/export3.html': 'export3.html',
  'https://app.diagrams.net/js/app.min.js': 'app.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.5/MathJax.js?config=TeX-MML-AM_HTMLorMML': 'MathJax.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.5/config/TeX-MML-AM_HTMLorMML.js?V=2.7.5': 'TeX-MML-AM_HTMLorMML.js',
  'https://cdn.mathjax.org/mathjax/contrib/a11y/accessibility-menu.js?V=2.7.5': 'accessibility-menu.js',
};

const cache = async (f, t) => {
  if (await cacheExists(t)) {
    return;
  }
  const response = await axios.get(f, {
    responseType: 'stream',
  });
  shelljs.mkdir('-p', path.join(cachePath, path.dirname(t)));
  response.data.pipe(fs.createWriteStream(path.join(cachePath, t)));
  return new Promise((resolve, reject) => {
    response.data.on('end', () => {
      resolve();
    });
    response.data.on('error', () => {
      reject();
    });
  });
};

module.exports = async ({ file, format, path: p }) => {
  await Promise.all(_.toPairs(cacheDict).map(([f, t]) => cache(f, t)));
  const fullXml = await readFile(file);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (interceptedRequest) => {
      const t = cacheDict[interceptedRequest.url()];
      if (t) {
        fs.readFile(path.join(cachePath, t), (err, res) => {
          if (err) {
            interceptedRequest.abort();
          } else {
            interceptedRequest.respond({
              status: 200,
              body: res,
            });
          }
        });
      } else {
        interceptedRequest.continue();
      }
    });

    await page.goto('https://www.draw.io/export3.html', { waitUntil: 'networkidle0' });

    await page.evaluate((obj) => doc = mxUtils.parseXml(obj), fullXml);
    const pages = +await page.evaluate(() => doc.documentElement.getAttribute('pages') || 0);
    if (!pages) process.exit(1);

    const gen = async (fmt, path) => {

      await page.evaluate((obj) => {
        const dup = doc.documentElement.cloneNode(false);
        dup.appendChild(doc.documentElement.firstChild);
        obj.xml = dup.outerHTML;
        render(obj);
      }, {
        format: 'png',
        w: 0,
        h: 0,
        border: 0,
        bg: 'none',
        scale: 1,
      });

      await page.waitForSelector('#LoadingComplete');
      const boundsJson = await page.mainFrame().$eval('#LoadingComplete', (div) => div.getAttribute('bounds'));
      const bounds = JSON.parse(boundsJson);

      const fixingScale = 1; // 0.959;
      const w = Math.ceil(bounds.width * fixingScale);
      const h = Math.ceil(bounds.height * fixingScale);

      switch (fmt) {
        case 'png':
          await page.setViewport({ width: w, height: h });
          await page.screenshot({
            omitBackground: true,
            type: 'png',
            fullPage: true,
            path,
          });
          break;
        case 'pdf': {
          await page.setViewport({ width: w, height: h });
          await page.pdf({
            printBackground: false,
            width: `${w}px`,
            height: `${h + 1}px`, // the extra pixel to prevent adding an extra empty page
            margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' },
            path,
          });
          break;
        }
        default:
          throw new Error(`Format ${fmt} not allowed, valid options are: png, pdf`);
      }

    };

    const m = format.match(/^(?<prefix>.*-)?(?<core>png|pdf)$/);
    const { prefix, core } = m.groups;
    switch (prefix) {
      case undefined:
        await gen(core, p);
        break;
      case 'cat-':
        if (core != 'pdf')
          throw new Error('Format not allowed');
        if (pages === 1) {
          await gen(core, p);
        } else {
          const merger = new PDFMerger();
          for (let i = 0; i < pages; i++) {
            const fn = p + '__' + i + '.' + core;
            await gen(core, fn);
            merger.add(fn);
          }
          await merger.save(p);
          for (let i = 0; i < pages; i++)
            shelljs.rm(p + '__' + i + '.' + core);
        }
        break;
      case 'split-':
      case 'split-index-':
        for (let i = 0; i < pages; i++)
          await gen(core, p + i + core);
        break;
      case 'split-id-':
        for (let i = 0; i < pages; i++) {
          const id = await page.evaluate(() => doc.documentElement.firstChild.getAttribute('id'));
          await gen(core, p + id + '.' + core);
        }
        break;
      case 'split-name-':
        for (let i = 0; i < pages; i++) {
          const name = await page.evaluate(() => doc.documentElement.firstChild.getAttribute('name'));
          await gen(core, p + name + '.' + core);
        }
        break;
      default:
        throw new Error(`Format prefix ${prefix} not allowed, valid options are: cat-, split-, split-index-, split-id-, split-name-`);
    }

  } finally {
    await browser.close();
  }
};
