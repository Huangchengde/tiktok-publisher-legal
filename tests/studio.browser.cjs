// Offline fixtures only. No platform requests or credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
(async () => {
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({viewport: {width, height: 900}});
      let posts = 0, statusCalls = 0, platformStatus = width === 390 ? 'FAILED' : 'PROCESSING_DOWNLOAD';
      await page.addInitScript(() => { const timer = window.setTimeout; window.setTimeout = (fn, ms, ...args) => timer(fn, ms === 3000 ? 1 : ms, ...args); });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', async route => {
        const url = new URL(route.request().url()), p = url.pathname;
        if (p === '/tiktok/account') return route.fulfill({json: {scopes: ['user.info.basic', 'video.publish', 'video.upload']}});
        if (p === '/tiktok/creator-info') return route.fulfill({json: {data: {creator_nickname: 'Offline Test Creator', privacy_level_options: ['SELF_ONLY', 'PUBLIC_TO_EVERYONE'], max_video_post_duration_sec: 60, comment_disabled: true, duet_disabled: false, stitch_disabled: false}, error: {code: 'ok'}}});
        if (p === '/tiktok/publish/video/init') {
          posts++; const body = route.request().postDataJSON();
          assert.equal(body.consent, true); assert.equal(body.post_info.brand_content_toggle, true);
          assert.equal(body.post_info.disable_comment, true); assert.equal(body.post_info.privacy_level, 'PUBLIC_TO_EVERYONE');
          return route.fulfill({json: {data: {publish_id: 'offline-publish', upload_url: 'https://fixture.test/upload'}, error: {code: 'ok'}}});
        }
        if (p === '/upload') return route.fulfill({status: 201});
        if (p === '/tiktok/publish/status/fetch') {statusCalls++; return route.fulfill({json: {data: {status: platformStatus, fail_reason: 'offline-test-failure'}, error: {code: 'ok'}}});}
        const local = p === '/app/' ? 'app/index.html' : p.slice(1);
        const filename = path.resolve(__dirname, '..', local);
        if (fs.existsSync(filename)) return route.fulfill({path: filename, contentType: p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : 'text/html'});
        throw Error('Unexpected request ' + url.href);
      });
      await page.goto('https://fixture.test/app/');
      await page.getByText('Offline Test Creator', {exact: true}).waitFor();
      assert.equal(await page.locator('#privacyLevel').inputValue(), '');
      assert.equal(await page.locator('#allowComment').isDisabled(), true);
      assert.equal(await page.locator('#allowDuet').isChecked(), false);
      assert.equal(await page.locator('#commercial').isChecked(), false);
      assert.equal(await page.locator('#brandOptions').isHidden(), true);
      // Simulate local media metadata, not a real recording or platform receipt.
      await page.locator('#videoFile').setInputFiles({name: 'offline.mp4', mimeType: 'video/mp4', buffer: Buffer.from('offline')});
      await page.evaluate(() => { const v = document.querySelector('video'); v.removeAttribute('src'); v.load(); Object.defineProperty(v, 'duration', {get: () => 12, configurable: true}); v.dispatchEvent(new Event('loadedmetadata')); });
      await page.locator('#caption').fill('Offline fixture');
      await page.locator('#privacyLevel').selectOption('SELF_ONLY');
      await page.locator('#commercial').check();
      assert.equal(await page.locator('#branded').isDisabled(), true);
      assert.equal(await page.locator('#validateButton').isDisabled(), true);
      await page.locator('#ownBrand').check();
      await page.locator('#privacyLevel').selectOption('PUBLIC_TO_EVERYONE');
      await page.locator('#branded').check();
      assert.equal(await page.locator('#privacyLevel option[value=SELF_ONLY]').evaluate(el => el.disabled), true);
      assert.match(await page.locator('#policyDeclaration').innerText(), /Branded Content Policy/);
      await page.locator('#validateButton').click();
      await page.getByText('Publication check passed', {exact: true}).waitFor();
      assert.equal(await page.locator('#publishButton').isDisabled(), true);
      await page.locator('#consent').check();
      assert.equal(await page.locator('#publishButton').isEnabled(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({path: `/tmp/knowgrow-web-${width}.png`, fullPage: true});
      await page.locator('#publishButton').click();
      if (width === 390) await page.getByText('TikTok reported a failure', {exact: true}).waitFor();
      else { await page.getByText('Posting result pending', {exact: true}).waitFor(); await page.waitForFunction(() => !document.querySelector('#refreshStatus').disabled); assert.equal(statusCalls, 8); }
      assert.equal(posts, 1); assert.equal(await page.locator('#publishButton').isDisabled(), true);
      platformStatus = 'PUBLISH_COMPLETE';
      await page.locator('#refreshStatus').click();
      await page.waitForFunction(() => !document.querySelector('#refreshStatus').disabled);
      assert.equal(posts, 1); assert.equal(statusCalls, width === 390 ? 2 : 9);
      await page.getByText('TikTok confirmed publication', {exact: true}).waitFor();
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS: mobile/desktop account, disclosure, privacy, consent, failure status and duplicate prevention');
  } finally { await browser.close(); }
})().catch(e => {console.error(e); process.exitCode = 1;});
