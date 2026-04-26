import { Portkey } from 'portkey-ai';
import { config } from '../config/index.js';

const PROVIDERS = [
  { key: config.PORTKEY_GROQ_VIRTUAL_KEY,      model: 'llama-3.3-70b-versatile' },
  { key: config.PORTKEY_ANTHROPIC_VIRTUAL_KEY, model: 'claude-sonnet-4-6' },
  { key: config.PORTKEY_OPENAI_VIRTUAL_KEY,    model: 'gpt-4o' },
  { key: config.PORTKEY_GOOGLE_VIRTUAL_KEY,    model: 'gemini-1.5-flash' },
].filter(p => p.key);

export async function callAI(messages, metadata = {}) {
  for (const provider of PROVIDERS) {
    try {
      const portkey = new Portkey({
        apiKey:     config.PORTKEY_API_KEY,
        virtualKey: provider.key,
        metadata:   JSON.stringify(metadata),
      });
      const response = await portkey.chat.completions.create({
        messages,
        model: provider.model,
      });
      return response;
    } catch (err) {
      if (PROVIDERS.indexOf(provider) === PROVIDERS.length - 1) throw err;
    }
  }
  throw new Error('No AI providers configured');
}

export function extractProvider(response) {
  const model = response.model ?? '';
  if (model.startsWith('claude'))                                           return 'anthropic';
  if (model.startsWith('gpt'))                                              return 'openai';
  if (model.startsWith('gemini'))                                           return 'google';
  if (model.startsWith('llama') || model.startsWith('mixtral') || model.startsWith('gemma')) return 'groq';
  return 'unknown';
}
