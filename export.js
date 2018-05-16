const puppeteer = require('puppeteer');
const fs = require('fs');

const readFile = (file) => new Promise((resolve, reject) => {
  fs.readFile(file, 'utf-8', (err, res) => {
    if (err) {
      reject(err);
    } else {
      resolve(res);
    }
  });
});

module.exports = async ({ file, format, path }) => {
  const xml = await readFile(file);

  const browser = await puppeteer.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();

    await page.goto('https://www.draw.io/export3.html', { waitUntil: 'networkidle0' });

    const result = await page.evaluate((obj) => render(obj), {
      xml,
      format,
      w: 0,
      h: 0,
      border: 0,
      bg: 'none',
      scale: 1,
    });

    await page.waitForSelector('#LoadingComplete');

    switch (format) {
      case 'png':
        await page.screenshot({
          omitBackground: true,
          type: 'png',
          fullPage: true,
          path,
        });
        break;
      case 'pdf': {
        const boundsJson = await page.mainFrame().$eval('#LoadingComplete', (div) => div.getAttribute('bounds'));
        const bounds = JSON.parse(boundsJson);
        // Chrome generates Pdf files larger than requested pixels size and requires scaling
        const fixingScale = 0.959;

        const w = Math.ceil(bounds.width * fixingScale);
        const h = Math.ceil(bounds.height * fixingScale);

        page.setViewport({ width: w, height: h });

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
        throw new Error('Format not allowed');
    }
  } finally {
    await browser.close();
  }
};
