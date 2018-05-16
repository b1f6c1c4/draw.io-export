const puppeteer = require('puppeteer');

const run = async () => {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();
  await page.goto('https://example.com');

  // await browser.close();
};

run();
