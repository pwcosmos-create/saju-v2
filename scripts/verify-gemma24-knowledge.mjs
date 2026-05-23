/**
 * 젬마24 지식 주입 검증 (node scripts/verify-gemma24-knowledge.mjs)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

process.chdir(root);
process.env.GEMMA24_SAJU_KNOWLEDGE_PATH =
  process.env.GEMMA24_SAJU_KNOWLEDGE_PATH
  || '/home/ubuntu/coupax-homepage/board/data/saju_learning/saju_knowledge_pack.json';

const mod = await import(pathToFileURL(path.join(root, 'core/gemma24/saju-knowledge.ts')).href);

const samplePrompt = `
일주: 甲子(甲子) / 월주: 丙寅(丙寅)
용신(用神) = 수(水)
기신(忌神) = 금(金)
▶ 신강·신약 판정: 신약(身弱)
오행 분포 십신 대운 세운
`.trim();

const block = mod.buildGemma24KnowledgeForSystem(samplePrompt);
const cards = mod.searchGemma24SajuKnowledge(samplePrompt);

console.log('=== Gemma24 Knowledge Verify ===');
console.log('path:', process.env.GEMMA24_SAJU_KNOWLEDGE_PATH);
console.log('exists:', fs.existsSync(process.env.GEMMA24_SAJU_KNOWLEDGE_PATH));
console.log('matched cards:', cards.length);
cards.forEach((c) => console.log(' -', c.id, c.title));
console.log('block chars:', block.length);
console.log('injected:', block.length > 0 ? 'YES' : 'NO');
if (block) console.log('preview:\n', block.slice(0, 400));
