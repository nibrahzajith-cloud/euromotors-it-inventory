const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.toString()));

  console.log('Navigating to app...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  
  console.log('Logging in...');
  await page.type('input[type="email"]', 'admin@euromotors.com');
  await page.type('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  console.log('Navigating to QR module...');
  await page.goto('http://localhost:5173/qr', { waitUntil: 'networkidle2' });

  console.log('Testing Single QR Download...');
  await page.waitForSelector('button:has-text("Download PNG")');
  await page.click('button:has-text("Download PNG")');
  
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('Done.');
  await browser.close();
})();
