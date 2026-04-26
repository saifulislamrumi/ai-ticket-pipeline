// src/services/aiGateway.ts
import { Portkey } from 'portkey-ai';
import { config } from '../config/index.js';
import type { AIProvider, AIMetadata, AIResponse, ChatMessage } from '../types/index.js';

class AIGateway {
  private readonly providers: AIProvider[];

  constructor() {
    const candidates: Array<{ key: string | undefined; model: string }> = [
      { key: config.PORTKEY_GROQ_VIRTUAL_KEY,      model: 'llama-3.3-70b-versatile' },
      { key: config.PORTKEY_ANTHROPIC_VIRTUAL_KEY, model: 'claude-sonnet-4-6' },
      { key: config.PORTKEY_OPENAI_VIRTUAL_KEY,    model: 'gpt-4o' },
      { key: config.PORTKEY_GOOGLE_VIRTUAL_KEY,    model: 'gemini-1.5-flash' },
    ];
    this.providers = candidates.filter((p): p is AIProvider => p.key !== undefined);
  }

  async call(messages: ChatMessage[], metadata: AIMetadata = { ticketId: '', phase: '' }): Promise<AIResponse> {
    for (const provider of this.providers) {
      try {
        const portkey = new Portkey({
          apiKey:     config.PORTKEY_API_KEY,
          virtualKey: provider.key,
          // portkey-ai types expect Record but also accepts a JSON string at runtime
          metadata:   JSON.stringify(metadata) as unknown as Record<string, unknown>,
        });
        const response = await portkey.chat.completions.create({
          messages,
          model: provider.model,
        });
        return response as unknown as AIResponse;
      } catch (err) {
        if (this.providers.indexOf(provider) === this.providers.length - 1) throw err;
      }
    }
    throw new Error('No AI providers configured');
  }

  extractProvider(response: AIResponse): string {
    const model = response.model ?? '';
    if (model.startsWith('claude'))                                                              return 'anthropic';
    if (model.startsWith('gpt'))                                                                 return 'openai';
    if (model.startsWith('gemini'))                                                              return 'google';
    if (model.startsWith('llama') || model.startsWith('mixtral') || model.startsWith('gemma')) return 'groq';
    return 'unknown';
  }
}

export const aiGateway = new AIGateway();
