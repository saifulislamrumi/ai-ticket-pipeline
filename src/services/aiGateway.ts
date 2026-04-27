// src/services/aiGateway.ts
import { Portkey } from 'portkey-ai';
import { config } from '../config/index.ts';
import type { AIMetadata, AIResponse, ChatMessage } from '../types/index.ts';

export interface AICallResult {
  response: AIResponse;
  provider: string;
}

class AIGateway {
  private readonly portkey: Portkey;

  constructor() {
    this.portkey = new Portkey({
      apiKey: config.PORTKEY_API_KEY,
      config: config.PORTKEY_CONFIG_ID,
    });
  }

  async call(messages: ChatMessage[], metadata: AIMetadata = { ticketId: '', phase: '' }): Promise<AICallResult> {
    const data = await this.portkey.chat.completions.create({
      messages,
      model:    'gemini-3.1-pro-preview',
      metadata: { ticketId: metadata.ticketId, phase: metadata.phase },
    });

    const response = data as unknown as AIResponse;
    const provider = this.extractProvider(response);
    return { response, provider };
  }

  private extractProvider(response: AIResponse): string {
    const model = response.model ?? '';
    if (model.includes('gemini'))  return 'gemini';
    if (model.includes('glm'))     return 'openrouter';
    if (model.includes('llama'))   return 'groq';
    return 'unknown';
  }
}

export const aiGateway = new AIGateway();
