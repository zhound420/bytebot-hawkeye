import { Message } from '@prisma/client';
import { MessageContentBlock } from '@bytebot/shared';

export interface BytebotAgentService {
  generateMessage(
    systemPrompt: string,
    messages: Message[],
    model: string,
    signal?: AbortSignal,
  ): Promise<MessageContentBlock[]>;
}

export interface BytebotAgentModel {
  provider: 'anthropic' | 'openai' | 'google';
  name: string;
  title: string;
}

export class BytebotAgentInterrupt extends Error {
  constructor() {
    super('BytebotAgentInterrupt');
    this.name = 'BytebotAgentInterrupt';
  }
}
