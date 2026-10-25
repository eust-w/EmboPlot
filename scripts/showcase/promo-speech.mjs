import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';

const folder = '.artifacts/promo';
await mkdir(folder, { recursive: true });
const { segments } = JSON.parse(await readFile('scripts/showcase/promo-plan.json', 'utf8'));
const key = process.env.DASHSCOPE_API_KEY;
if (!key) throw new Error('DASHSCOPE_API_KEY is required; load it from the private environment.');
for (const [i, segment] of segments.entries()) {
  const path = `${folder}/voice-${i}.wav`;
  if (await stat(path).catch(() => null)) continue;
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'qwen3-tts-flash', input: { text: segment.voice, voice: 'Cherry', language_type: 'Chinese' } }),
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) throw new Error(`TTS failed (${response.status}); no provider response or credentials logged.`);
  const result = await response.json();
  const audioURL = result.output?.audio?.url;
  if (!audioURL) throw new Error('TTS returned no audio; refusing placeholder speech.');
  const url = new URL(audioURL);
  if (url.protocol === 'http:') url.protocol = 'https:';
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.aliyuncs.com')) throw new Error('Unexpected audio host');
  const audio = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!audio.ok) throw new Error(`Audio download failed (${audio.status})`);
  await writeFile(path, Buffer.from(await audio.arrayBuffer()));
  console.log(`Saved narration ${i + 1}/${segments.length}`);
}
