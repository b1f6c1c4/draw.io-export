const _ = require('lodash');
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');

const readFile = (file) => new Promise((resolve, reject) => {
  fs.readFile(file, 'utf-8', (err, res) => {
    if (err) {
      reject(err);
    } else {
      resolve(res);
    }
  });
});

const cachePath = path.join(__dirname, '.cache');

const cacheExists = (t) => new Promise((resolve) => {
  fs.exists(path.join(cachePath, t), resolve);
});

const cacheDict = {
  'https://www.draw.io/export3.html': 'export3.html',
  'https://www.draw.io/js/app.min.js': 'app.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.0/MathJax.js?config=TeX-MML-AM_HTMLorMML': 'MathJax.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.0/config/TeX-MML-AM_HTMLorMML.js?V=2.7.0': 'TeX-MML-AM_HTMLorMML.js',
  'https://cdn.mathjax.org/mathjax/contrib/a11y/accessibility-menu.js?V=2.7.0': 'accessibility-menu.js',
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
  const xml = await readFile(file);

  const browser = await puppeteer.launch({
    headless: true,
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

    await page.evaluate((obj) => render(obj), {
      xml,
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

    switch (format) {
      case 'png':
        await page.setViewport({ width: w, height: h });
        await page.screenshot({
          omitBackground: true,
          type: 'png',
          fullPage: true,
          path: p,
        });
        break;
      case 'pdf': {
        await page.setViewport({ width: w, height: h });
        await page.pdf({
          printBackground: false,
          width: `${w}px`,
          height: `${h + 1}px`, // the extra pixel to prevent adding an extra empty page
          margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' },
          path: p,
        });
        break;
      }
      default:
        throw new Error('Format not allowed');
    }
  } finally {
    await browser.close();
  }
};
