import { calculate, type SajuInput, type SajuResult } from '../core/pillar-calc/main-calculator';
import { buildChatContext } from '../app/counsel/build-saju-context';

export type AgentStep = {
  thought: string;
  action?: string;
  actionInput?: string;
  observation?: string;
};

export type AgentResponseChunk =
  | { type: 'thought'; text: string }
  | { type: 'tool_call'; name: string; args: string }
  | { type: 'tool_result'; result: string }
  | { type: 'result'; text: string }
  | { type: 'done' };

// Tools definition
const TOOLS = [
  {
    name: 'calculate_saju_pillars',
    description: 'Calculates the Saju pillars, four pillars, elements, and yongsin for a given birthdate.',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'number', description: 'Birth year (e.g., 1995)' },
        month: { type: 'number', description: 'Birth month (1-12)' },
        day: { type: 'number', description: 'Birth day (1-31)' },
        hour: { type: 'number', description: 'Birth hour (0-23, or -1 if unknown). Default is -1.' },
        gender: { type: 'string', enum: ['남', '여'], description: 'Gender: 남 (Male) or 여 (Female).' }
      },
      required: ['year', 'month', 'day', 'gender']
    }
  },
  {
    name: 'query_fortune_database',
    description: 'Queries general Saju interpretations, wealth tips, career paths, and remedies based on keywords.',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Keywords like wealth, marriage, health, career, yongsin, gyeok' }
      },
      required: ['keyword']
    }
  }
];

// Execution of tools
function executeTool(name: string, args: any): string {
  try {
    if (name === 'calculate_saju_pillars') {
      const { year, month, day, hour = -1, gender } = args;
      const res = calculate({
        year,
        month,
        day,
        hourTotalMin: hour,
        gender: gender as '남' | '여'
      });
      return JSON.stringify({
        status: 'success',
        pillars: buildChatContext(res)
      });
    }
    
    if (name === 'query_fortune_database') {
      const keyword = (args.keyword || '').toLowerCase();
      // Simple offline mock DB for Saju advice depending on keyword
      if (keyword.includes('wealth') || keyword.includes('재물') || keyword.includes('돈')) {
        return JSON.stringify({
          advice: '재성(財星)의 기운을 다룰 때는 신강함이 핵심입니다. 용신 색상(화: 빨강, 수: 검정 등)의 아이템을 지니고 동쪽/남쪽의 방위를 활용하면 재물 유입에 긍정적인 영향을 줍니다.'
        });
      }
      if (keyword.includes('career') || keyword.includes('직업') || keyword.includes('일')) {
        return JSON.stringify({
          advice: '관성(官星)과 식상(食傷)의 배치를 분석하십시오. 사주에 식상이 강하면 전문 자유직이나 창작업이 어울리며, 관성이 튼튼하다면 조직 및 기업체 내에서의 승진과 안정이 유리합니다.'
        });
      }
      return JSON.stringify({
        advice: '사주 오행의 균형을 위해 넘치는 오행은 설기(泄氣)시키고, 모자란 오행은 인성(印星)이나 비겁(比劫)으로 채워주는 삶의 태도가 행운을 부릅니다.'
      });
    }
    return JSON.stringify({ error: `Tool ${name} not found.` });
  } catch (e: any) {
    return JSON.stringify({ error: e.message || 'Tool execution error' });
  }
}

export async function* runAgenticCounsel(
  userMessage: string,
  history: { role: string; content: string }[],
  sajuContext: string,
  counselorName: string
): AsyncGenerator<AgentResponseChunk, void, unknown> {
  const geminiKey = process.env.GOOGLE_AI_API_KEY ?? '';
  if (!geminiKey) {
    yield { type: 'result', text: 'Error: GOOGLE_AI_API_KEY is not configured on the server.' };
    return;
  }

  const systemPrompt = `You are a highly professional Autonomous AI Saju Counselor named "${counselorName}".
Your goal is to solve the user's Saju/Fortune question using your tools.
You MUST output your reasoning in the following ReAct format:

Thought: Your reasoning about what to do. (Write thoughts in Korean)
Action: The tool name to call. Must be one of: calculate_saju_pillars, query_fortune_database
Action Input: The arguments to the tool in raw JSON format. (e.g., {"year": 1995, ...})

Observation: The tool output will be provided here by the system.
... (Repeat Thought -> Action -> Action Input -> Observation as needed)

Thought: I have gathered all necessary information and am ready to write the final answer.
Final Answer: Write a warm, detailed, and polished counseling response in Korean.

[Rules]
- ALWAYS start with "Thought:"
- Write your thoughts and final answer in Korean.
- Stick strictly to Saju and fortune-telling questions. If the user asks about unrelated topics, write "Thought: This question is unrelated to Saju." followed by "Final Answer: 저는 사주 명리 상담을 위한 AI입니다. 사주나 운세에 관한 질문을 해주시면 감사하겠습니다."
- Current User Saju Context:
${sajuContext}

Tools available:
${JSON.stringify(TOOLS, null, 2)}`;

  let messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage }
  ];

  let iterations = 0;
  const maxIterations = 4;

  while (iterations < maxIterations) {
    iterations++;

    // Call Gemini API (OpenAI compatibility endpoint)
    let rawText = '';
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${geminiKey}` },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages,
          temperature: 0.3
        })
      });

      if (!res.ok) {
        throw new Error(`Gemini API returned status ${res.status}`);
      }

      const data = await res.json();
      rawText = data.choices?.[0]?.message?.content ?? '';
    } catch (e: any) {
      yield { type: 'result', text: `죄송합니다. AI 추론 루프 중 오류가 발생했습니다: ${e.message}` };
      return;
    }

    // Parse the ReAct output
    const thoughtMatch = rawText.match(/Thought:([\s\S]*?)(Action:|$)/i);
    const actionMatch = rawText.match(/Action:\s*(\w+)/i);
    const actionInputMatch = rawText.match(/Action Input:\s*(\{[\s\S]*?\})/i);
    const finalAnswerMatch = rawText.match(/Final Answer:([\s\S]*?)$/i);

    if (thoughtMatch && thoughtMatch[1].trim()) {
      yield { type: 'thought', text: thoughtMatch[1].trim() };
    }

    if (actionMatch && actionInputMatch) {
      const toolName = actionMatch[1].trim();
      const toolArgsRaw = actionInputMatch[1].trim();
      
      yield { type: 'tool_call', name: toolName, args: toolArgsRaw };

      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(toolArgsRaw);
      } catch {
        parsedArgs = {};
      }

      const observation = executeTool(toolName, parsedArgs);
      yield { type: 'tool_result', result: observation };

      // Update history for next iteration
      messages.push({ role: 'assistant', content: rawText });
      messages.push({ role: 'user', content: `Observation: ${observation}` });
    } else if (finalAnswerMatch && finalAnswerMatch[1].trim()) {
      yield { type: 'result', text: finalAnswerMatch[1].trim() };
      break;
    } else {
      // Fallback if formatting was not exactly adhered to
      const cleanOutput = rawText.replace(/Thought:|Final Answer:/gi, '').trim();
      yield { type: 'result', text: cleanOutput };
      break;
    }
  }

  yield { type: 'done' };
}
