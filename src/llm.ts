import type { LLMConfig } from './types'

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: 'sk-60295e92afc34b0585ebcac08c28d0a8',
  model: 'qwen-plus',
}

let _llmConfig: LLMConfig = { ...DEFAULT_LLM_CONFIG }

export function setActiveLLMConfig(cfg: LLMConfig): void {
  _llmConfig = cfg
}

export async function llmCall(systemPrompt: string, userText: string, maxTokens = 512): Promise<string> {
  const cfg = _llmConfig
  const res = await fetch(`${cfg.baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model, seed: null, stop: null,
      temperature: 0.7, top_p: 1, max_tokens: maxTokens,
      frequency_penalty: 0, presence_penalty: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}
