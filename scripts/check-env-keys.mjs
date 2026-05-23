import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('no .env.local');
  process.exit(1);
}
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  if (!/^(GROQ|GOOGLE|GEMMA24|HYBRID)/.test(line) || line.startsWith('#')) continue;
  const k = line.split('=')[0];
  const v = line.slice(line.indexOf('=') + 1).trim();
  console.log(k, v ? `set (${v.length} chars)` : 'EMPTY');
}
