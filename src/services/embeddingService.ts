import OpenAI from 'openai';
import { env } from '../config/env';

const client = new OpenAI({ apiKey: env.openai.apiKey });

const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_INPUT_CHARS = 32_000; // well under the token limit for short skill text

export const embeddingService = {
  async embed(text: string): Promise<number[]> {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, MAX_INPUT_CHARS),
    });
    return response.data[0].embedding;
  },

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts.map(t => t.slice(0, MAX_INPUT_CHARS)),
    });
    return response.data.map(d => d.embedding);
  },
};
