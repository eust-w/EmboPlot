import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const art = `data:image/jpeg;base64,${(await readFile('docs/media/observatory.jpg')).toString('base64')}`;
const browser = await chromium.launch();
try {
  for (const [name, width, height] of [['portrait',1080,1440],['landscape',1440,1080]]) {
    const page = await browser.newPage({viewport:{width,height}});
    await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#090c0e;font-family:'PingFang SC',sans-serif;color:#fff}img{position:absolute;width:100%;height:100%;object-fit:cover}main{position:absolute;inset:0;padding:100px 70px;background:linear-gradient(180deg,#03070bf2 0%,#03070bb0 38%,transparent 78%)}b{font-size:32px;color:#ffc04a}h1{font-size:110px;line-height:1.2;margin:30px 0}h2{font-size:60px;margin:0 0 30px}p{font-size:32px;line-height:1.6;color:#dce5e7}footer{position:absolute;bottom:60px;left:70px;font-size:26px;text-shadow:0 2px 10px black;color:white}</style><img src="${art}"><main><b>EmboPlot · 开源 AI 互动剧场</b><h1>随流剧场</h1><h2>下一幕，由你导演</h2><p>角色 · 世界 · 多角色推演<br>场景图 · 语音 · 剧本导出</p></main><footer>Alpha 项目介绍 · AI 辅助示例素材</footer>`);
    await page.screenshot({path:`.artifacts/promo/cover-${name}.jpg`,type:'jpeg',quality:94});
    await page.close();
  }
} finally { await browser.close(); }
