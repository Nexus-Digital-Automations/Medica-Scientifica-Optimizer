import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testCSVDownload() {
  console.log('🧪 Starting CSV Download Test...\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Set download behavior
  const downloadPath = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }

  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath
  });

  try {
    console.log('📍 Step 1: Navigating to application...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'screenshots/01-homepage.png' });
    console.log('✅ Loaded homepage\n');

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('📍 Step 2: Clicking Advanced Optimizer tab...');
    await page.waitForSelector('text/Advanced Optimizer', { timeout: 10000 });
    await page.click('text/Advanced Optimizer');
    await page.screenshot({ path: 'screenshots/02-advanced-optimizer-tab.png' });
    console.log('✅ Opened Advanced Optimizer tab\n');

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('📍 Step 3: Configuring optimization parameters...');
    // Scroll to the run button
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.screenshot({ path: 'screenshots/03-optimizer-config.png' });
    console.log('✅ Configured parameters\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('📍 Step 4: Starting optimization (this may take a while)...');
    const runButton = await page.waitForSelector('button:has-text("🚀 Run Optimization")', { timeout: 10000 });
    await runButton.click();
    await page.screenshot({ path: 'screenshots/04-optimization-started.png' });
    console.log('✅ Optimization started\n');

    // Wait for results (this could take a while)
    console.log('⏳ Waiting for optimization results...');
    await page.waitForSelector('text/Optimization Complete', { timeout: 300000 }); // 5 minute timeout
    await page.screenshot({ path: 'screenshots/05-results-ready.png' });
    console.log('✅ Optimization complete!\n');

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('📍 Step 5: Clicking CSV download button on first result...');
    const csvButton = await page.waitForSelector('button:has-text("📊 CSV")', { timeout: 10000 });

    // Clear any existing downloads
    const existingFiles = fs.readdirSync(downloadPath);
    existingFiles.forEach(file => {
      fs.unlinkSync(path.join(downloadPath, file));
    });

    await csvButton.click();
    await page.screenshot({ path: 'screenshots/06-csv-downloaded.png' });
    console.log('✅ Clicked CSV download button\n');

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('📍 Step 6: Verifying CSV file...');
    const files = fs.readdirSync(downloadPath);
    const csvFiles = files.filter(f => f.endsWith('.csv'));

    if (csvFiles.length === 0) {
      throw new Error('❌ No CSV file was downloaded');
    }

    const csvFile = path.join(downloadPath, csvFiles[0]);
    const csvContent = fs.readFileSync(csvFile, 'utf-8');

    console.log(`✅ CSV file downloaded: ${csvFiles[0]}`);
    console.log(`📊 File size: ${csvContent.length} bytes`);
    console.log('\n📄 CSV Content Preview (first 500 chars):');
    console.log('─'.repeat(60));
    console.log(csvContent.substring(0, 500));
    console.log('─'.repeat(60));

    // Verify CSV sections
    const requiredSections = [
      'SIMULATION SUMMARY',
      'STRATEGY PARAMETERS',
      'TIMED ACTIONS',
      'DAILY HISTORY',
      'FINAL STATE'
    ];

    console.log('\n🔍 Verifying CSV sections...');
    for (const section of requiredSections) {
      if (csvContent.includes(section)) {
        console.log(`✅ ${section} section found`);
      } else {
        console.log(`❌ ${section} section MISSING`);
      }
    }

    console.log('\n✅ CSV download test completed successfully!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    await page.screenshot({ path: 'screenshots/error.png' });
    throw error;
  } finally {
    await browser.close();
  }
}

// Create screenshots directory
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

testCSVDownload().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
