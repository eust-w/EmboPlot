import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { story, characters, timeline } from './fixture.mjs';

const baseURL = process.env.SHOWCASE_URL || 'http://localhost:3197';
const url = new URL(baseURL);
if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
  throw new Error('Showcase recording is local-only. Never point it at a public server.');
}
const output = path.resolve('.artifacts/showcase');
const media = path.resolve('docs/media');
await mkdir(output, { recursive: true });
await mkdir(media, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  baseURL, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
  recordVideo: { dir: output, size: { width: 1440, height: 900 } },
});
const errors = [];
const chapters = [];
let started;

async function api(method, endpoint, data) {
  const response = await context.request.fetch(`/api${endpoint}`, { method, data });
  assert.ok(response.ok(), `${method} ${endpoint}: ${response.status()}`);
  return response.json();
}

try {
  const capabilities = await api('GET', '/models/capabilities');
  assert.equal(capabilities.mode, 'fallback', 'Use a dedicated backend with DASHSCOPE_API_KEY empty.');
  // A fresh account scopes every write and cleanup to this one recording.
  await api('POST', '/auth/register', {
    email: `showcase-${randomBytes(6).toString('hex')}@example.test`,
    password: randomBytes(24).toString('base64url'), nickname: '示例导演',
  });
  for (const route of ['/rooms', '/characters', '/stories']) {
    for (const item of await api('GET', route)) {
      if (!item.isPublic) await api('DELETE', `${route}/${item.id}`);
    }
  }
  const cast = [];
  for (const character of characters) cast.push(await api('POST', '/characters', character));
  const savedStory = await api('POST', '/stories', story);
  const room = await api('POST', '/rooms', {
    title: story.title, storyId: savedStory.id, characterIds: cast.map(c => c.id),
    gameSettings: { mood: '悬疑惊悚', pace: 'Balanced', complexity: 'Standard', language: 'Chinese (Simplified)' },
  });
  await api('PUT', `/rooms/${room.id}`, { ...room, scriptTimeline: timeline(cast) });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  started = Date.now();
  const chapter = (en, zh) => chapters.push({ start: (Date.now() - started) / 1000, en, zh });
  const hold = (ms = 3000) => page.waitForTimeout(ms);
  const screenshot = async (name) => {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(media, `${name}.jpg`), type: 'jpeg', quality: 88 });
  };
  chapter('EmboPlot / An open-source AI story theater', '随流剧场 / 本地工作流演示，预置原创剧本');
  await page.goto(baseURL);
  await page.getByRole('heading', { name: '剧场大厅' }).waitFor();
  await hold(2200);
  await screenshot('lobby');
  await page.getByRole('button', { name: '创作中心' }).click();
  chapter('01 / Give your cast a personality and a memory', '01 / 角色设定：背景、性格、记忆与音色');
  await page.getByRole('heading', { name: '沈星', exact: true }).click();
  await page.getByRole('button', { name: '编辑属性' }).click();
  await hold();
  await screenshot('character');
  await page.getByText('音色选择', { exact: true }).scrollIntoViewIfNeeded();
  await hold(1800);
  await screenshot('character-details');
  // Navigate away through the modal backdrop, without modifying application state.
  await page.mouse.click(20, 20);
  await page.getByRole('button', { name: '推演大厅' }).click();
  await page.getByRole('button', { name: '开启新剧场', exact: true }).click();
  chapter('02 / Choose a world, cast, viewpoint and pace', '02 / 编排剧场：选择世界观、阵容与推演节奏');
  await page.getByPlaceholder('例如：夕阳下的最后一次抉择...').fill('最后一段信号 · 第二幕');
  await page.getByText('陆川', { exact: true }).first().click();
  await hold();
  await screenshot('setup');
  await page.getByRole('button', { name: '返回大厅' }).click();
  await page.getByText('进入剧场', { exact: true }).first().click();
  await page.getByTestId('theater-scroll').waitFor();
  chapter('03 / Narration, dialogue and explicit speaking targets', '03 / 旁白、人物对白与明确的说话对象');
  await page.getByTestId('theater-scroll').evaluate(el => { el.scrollTop = 0; });
  await hold();
  await screenshot('theater');
  await page.getByRole('combobox', { name: '说话对象' }).selectOption('self');
  await hold(1300);
  await page.getByRole('combobox', { name: '说话对象' }).selectOption('everyone');
  await page.getByRole('button', { name: '召唤角色' }).click();
  await hold(1400);
  await page.getByRole('button', { name: '召唤角色' }).click();
  chapter('04 / Keep scene images alongside the script', '04 / 文字与场景图保存在同一条剧情时间线');
  await page.getByTestId('theater-scroll').evaluate(el => { el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); });
  await hold();
  await screenshot('scene');
  const persisted = await api('GET', `/rooms/${room.id}`);
  assert.equal(persisted.scriptTimeline.length, 4);
  assert.equal(persisted.scriptTimeline.at(-1).imageUrl, '/docs/media/observatory.jpg');
  chapter('05 / Export a Markdown script you can keep editing', '05 / 导出 Markdown，继续创作');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 Markdown 剧本' }).click();
  const download = await downloadPromise;
  const markdownPath = path.join(output, 'sample-script.md');
  await download.saveAs(markdownPath);
  assert.match(await readFile(markdownPath, 'utf8'), /沈星/);
  await hold(1500);
  await page.getByRole('button', { name: '返回大厅' }).click();
  await page.getByText('进入剧场', { exact: true }).first().click();
  await page.getByText('发射机已经关了', { exact: false }).waitFor();
  await hold(1800);
  const desktopEnd = (Date.now() - started) / 1000;
  const cookies = await context.cookies();
  await page.close();
  await context.close();
  await rename(await page.video().path(), path.join(output, 'walkthrough.webm'));

  const mobile = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  // Reauthenticate via this run's session, kept in memory and never written to disk.
  await mobile.addCookies(cookies);
  const phone = await mobile.newPage();
  phone.on('pageerror', error => errors.push(error.message));
  await phone.goto(baseURL);
  await phone.getByText('进入剧场', { exact: true }).first().click();
  await phone.getByTestId('theater-scroll').waitFor();
  const drawerButtons = phone.getByRole('button', { name: '关闭资产栏' });
  if (await drawerButtons.count() > 1) await drawerButtons.last().click();
  await phone.getByTestId('theater-scroll').evaluate(el => { el.scrollTop = 0; });
  await phone.waitForTimeout(1500);
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile has horizontal overflow');
  await phone.screenshot({ path: path.join(media, 'mobile.jpg'), type: 'jpeg', quality: 88 });
  await phone.getByRole('button', { name: '切换资产栏' }).click();
  await phone.getByRole('button', { name: '关闭资产栏' }).last().click();
  await mobile.close();
  assert.deepEqual(errors, [], 'Browser errors');
  await writeFile(path.join(output, 'chapters.json'), JSON.stringify({ duration: desktopEnd, chapters }, null, 2));
  console.log(JSON.stringify({ ok: true, chapters: chapters.length, duration: desktopEnd, markdownExport: true, persistence: true, browserErrors: errors }));
} finally {
  await context.close().catch(() => {});
  await browser.close();
}
