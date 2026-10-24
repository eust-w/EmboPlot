import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const folder = '.artifacts/showcase';
const { chapters, duration } = JSON.parse(await readFile(`${folder}/chapters.json`, 'utf8'));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 112 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #0c0c0e; color: #fafafa; font-family: 'PingFang SC', 'Noto Sans CJK SC', sans-serif; }
    main { height: 112px; border-top: 2px solid #f5a623; padding: 17px 36px; display: flex; align-items: center; justify-content: space-between; }
    h1 { font-size: 25px; line-height: 32px; margin: 0 0 6px; font-weight: 600; }
    p { font-size: 19px; line-height: 26px; margin: 0; color: #b7b7bf; }
    aside { text-align: right; font-size: 12px; line-height: 22px; color: #a1a1aa; }
    strong { color: #f5a623; font-size: 17px; }
  </style><main><section><h1></h1><p></p></section><aside><strong>EmboPlot</strong><br>LOCAL FIXTURE DEMO<br>NO LIVE MODEL CALLS</aside></main>`);
  for (const [index, chapter] of chapters.entries()) {
    await page.locator('h1').evaluate((el, text) => { el.textContent = text; }, chapter.en);
    await page.locator('p').evaluate((el, text) => { el.textContent = text; }, chapter.zh);
    await page.screenshot({ path: `${folder}/caption-${index}.png` });
  }
} finally {
  await browser.close();
}
const inputs = chapters.flatMap((_, i) => ['-i', `${folder}/caption-${i}.png`]);
let filter = '[0:v]pad=1440:1012:0:0:color=0x0c0c0e[v0];';
for (const [index, chapter] of chapters.entries()) {
  const end = chapters[index + 1]?.start ?? duration;
  filter += `[v${index}][${index + 1}:v]overlay=0:900:enable='between(t,${chapter.start},${end})'[v${index + 1}];`;
}
filter = filter.slice(0, -1);
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', `${folder}/walkthrough.webm`, ...inputs,
  '-filter_complex', filter, '-map', `[v${chapters.length}]`, '-an', '-t', String(duration), '-r', '25',
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  `${folder}/emboplot-walkthrough.mp4`], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', `${folder}/emboplot-walkthrough.mp4`,
  '-vf', 'fps=4,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5',
  '-loop', '0', 'docs/media/demo.gif'], { stdio: 'inherit' });

function stamp(seconds, separator) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}${separator}${String(ms % 1000).padStart(3, '0')}`;
}
const srt = chapters.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(chapters[i + 1]?.start ?? duration, ',')}\n${c.en}\n${c.zh}\n`).join('\n');
await writeFile(`${folder}/emboplot-walkthrough.srt`, srt);
console.log(`Rendered ${duration.toFixed(1)}s MP4, bilingual subtitles, and README GIF.`);
