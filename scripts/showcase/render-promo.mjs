import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { chromium } from 'playwright';

const folder = '.artifacts/promo';
await mkdir(folder, { recursive: true });
const plan = JSON.parse(await readFile('scripts/showcase/promo-plan.json', 'utf8'));
const localVoice = process.argv.includes('--local-voice');
const run = (bin, args) => execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'inherit'] });
const durationOf = path => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).toString().trim());
const data = async name => `data:image/jpeg;base64,${(await readFile(`docs/media/${name}`)).toString('base64')}`;
const htmlEscape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
let total = 0;
for (const [i, s] of plan.segments.entries()) {
  // A failed provider request never silently becomes a fake model success.
  if (!await stat(`${folder}/voice-${i}.wav`).catch(() => null)) {
    if (!localVoice) throw new Error('Missing narration. Run promo-speech.mjs or explicitly select --local-voice (macOS).');
    run('say', ['-v', 'Tingting', '-r', '190', '-o', `${folder}/voice-${i}.aiff`, s.voice]);
    run('ffmpeg', ['-y', '-v', 'error', '-i', `${folder}/voice-${i}.aiff`, '-ar', '48000', '-ac', '2', `${folder}/voice-${i}.wav`]);
  }
  s.duration = Math.ceil((durationOf(`${folder}/voice-${i}.wav`) + .45) * 25) / 25;
  s.start = total;
  total += s.duration;
}
const crops = {
  character: [270, 85, 905, 730], setup: [0, 0, 1440, 900],
  timeline: [490, 110, 760, 460], control: [455, 725, 850, 155],
  scene: [490, 95, 760, 560], export: [1030, 10, 390, 58],
};
const browser = await chromium.launch();
try {
  for (const vertical of [false, true]) {
    const name = vertical ? 'vertical' : 'horizontal';
    const w = vertical ? 1080 : 1920, h = vertical ? 1920 : 1080;
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    for (const [i, s] of plan.segments.entries()) {
      const art = await data('observatory.jpg');
      const src = await data(s.asset);
      const cinematic = ['hero', 'stack', 'end'].includes(s.kind);
      const crop = crops[s.kind] ?? [0, 0, 1440, 900];
      const mediaW = vertical ? 960 : 1700;
      const mediaH = vertical ? 1000 : 610;
      const scale = Math.min(mediaW / crop[2], mediaH / crop[3]);
      const displayedW = crop[2] * scale, displayedH = crop[3] * scale;
      const mediaTop = vertical ? 450 : 255;
      const visual = cinematic ? `<img class="background" src="${art}"><div class="shade"></div>` :
        `<div class="screen" style="width:${displayedW}px;height:${displayedH}px;left:${(w-displayedW)/2}px;top:${mediaTop + (mediaH-displayedH)/2}px"><img style="position:absolute;width:${1440*scale}px;max-width:none;left:${-crop[0]*scale}px;top:${-crop[1]*scale}px" src="${src}"></div>`;
      const detail = s.kind === 'control' ? '<div class="detail">你决定节奏<br><span>自动推演 · 暂停 / 继续 · 导演指令</span></div>' :
        s.kind === 'export' ? '<div class="detail">PNG / MD / WAV<br><span>从剧情时间线，到可继续创作的作品</span></div>' :
        s.kind === 'stack' ? '<div class="stack">React + TypeScript<br>Go + MongoDB<br><em>Qwen / Wan · 百炼</em></div>' :
        s.kind === 'end' ? '<div class="stack">Apache-2.0<br><em>OPEN SOURCE · ALPHA</em><p>代码 / 文档 / 本地演示</p></div>' : '';
      await page.setContent(`<html lang="zh-CN"><style>
        *{box-sizing:border-box} body{margin:0;background:#0a0c0e;color:#fff;font-family:'PingFang SC',sans-serif;overflow:hidden}
        .background{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.72),rgba(0,0,0,.2) 60%,rgba(0,0,0,.9))}
        header{position:absolute;top:${vertical?95:35}px;left:60px;right:60px;display:flex;justify-content:space-between;align-items:center;font-size:${vertical?30:25}px;font-weight:650} header b{color:#ffb21a} header small{font-size:${vertical?21:20}px;color:#b7c9c7}
        h1{position:absolute;top:${vertical?205:85}px;left:60px;right:60px;font-size:${vertical?68:64}px;line-height:1.2;margin:0;font-weight:700;letter-spacing:0}
        .sub{position:absolute;top:${vertical?325:175}px;left:64px;right:60px;color:#ffc34c;font-size:${vertical?34:30}px;line-height:1.4}
        .screen{position:absolute;overflow:hidden;box-shadow:0 10px 50px #0008}
        .detail{position:absolute;top:${vertical?550:270}px;left:60px;right:60px;font-size:${vertical?60:55}px;line-height:1.7;text-align:center;color:#ffbb35}.detail span{font-size:${vertical?34:32}px;color:#c8d1d3}
        .stack{position:absolute;left:${vertical?70:110}px;top:${vertical?620:365}px;font-size:${vertical?64:66}px;line-height:1.6;font-weight:600}.stack em{color:#ffbd43;font-style:normal;font-size:${vertical?46:48}px}.stack p{font-size:34px;color:#e0e8e8}
        footer{position:absolute;bottom:${vertical?120:105}px;left:60px;right:60px;font-size:${vertical?23:20}px;color:#a6b6b8}
        .bar{position:absolute;bottom:0;left:0;width:${(i+1)/plan.segments.length*100}%;height:7px;background:#ffb21a}
      </style>${visual}<header><b>随流剧场 / EmboPlot</b><small>${String(i+1).padStart(2,'0')} / 09</small></header><h1>${htmlEscape(s.title)}</h1><div class="sub">${htmlEscape(s.subtitle)}</div>${detail}<footer>${plan.disclosure}</footer><div class="bar"></div></html>`);
      await page.screenshot({ path: `${folder}/${name}-${i}.png` });
      if (i === 0) await page.screenshot({ path: `${folder}/cover-${name}.jpg`, type: 'jpeg', quality: 93 });
      // Short subtitle phrases remain legible on mobile; each phrase stays within its speech segment.
      const chunks = s.voice.match(/[^，。！？]+[，。！？]?/g) ?? [s.voice];
      const capHeight = vertical ? 150 : 110;
      const cp = await browser.newPage({ viewport: { width: w, height: capHeight } });
      for (const [j, phrase] of chunks.entries()) {
        await cp.setContent(`<style>body{margin:0;background:#0a0c0e;color:white;font-family:'PingFang SC',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;padding:16px 60px;text-align:center;font-size:${vertical?41:40}px;line-height:1.45;font-weight:600}</style>${htmlEscape(phrase)}`);
        await cp.screenshot({ path: `${folder}/${name}-cap-${i}-${j}.png` });
      }
      await cp.close();
      const inputs = chunks.flatMap((_, j) => ['-i', `${folder}/${name}-cap-${i}-${j}.png`]);
      let filter = `[0:v]scale=${w+40}:${h+40},crop=${w}:${h}:x='20+8*sin(t*.35)':y='20+8*sin(t*.23)',setsar=1[v0];`;
      let at = 0;
      chunks.forEach((phrase, j) => {
        const end = j === chunks.length-1 ? s.duration : at + phrase.length/s.voice.length*(s.duration-.45);
        filter += `[v${j}][${j+2}:v]overlay=0:${h-capHeight}:enable='between(t,${at},${end})'[v${j+1}];`;
        at = end;
      });
      filter += `[1:a]apad,loudnorm=I=-16:TP=-1.5:LRA=9[a]`;
      run('ffmpeg', ['-y','-v','error','-loop','1','-framerate','25','-i',`${folder}/${name}-${i}.png`,'-i',`${folder}/voice-${i}.wav`,...inputs,
        '-filter_complex',filter,'-map',`[v${chunks.length}]`,'-map','[a]','-t',String(s.duration),'-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-r','25','-c:a','aac','-b:a','160k','-ar','48000','-ac','2',`${folder}/${name}-${i}.mp4`]);
      console.log(`${name}: ${i+1}/${plan.segments.length}`);
    }
    await page.close();
    await writeFile(`${folder}/${name}-concat.txt`, plan.segments.map((_, i) => `file '${name}-${i}.mp4'`).join('\n'));
    run('ffmpeg', ['-y','-v','error','-f','concat','-safe','0','-i',`${folder}/${name}-concat.txt`,'-c','copy','-movflags','+faststart',`${folder}/EmboPlot-intro-${name}-1080p.mp4`]);
  }
} finally { await browser.close(); }
await writeFile(`${folder}/edit-plan.json`, JSON.stringify({ ...plan, total, narration: localVoice ? 'macOS Tingting synthetic voice' : 'Pre-generated narration; see source audio provenance' }, null, 2));
console.log(`Finished two ${total.toFixed(1)}s films.`);
