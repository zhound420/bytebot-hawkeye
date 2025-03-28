import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MessageType, Prisma } from '@prisma/client';

// Define types for Anthropic message content blocks
interface TextBlock {
  type: 'text';
  text: string;
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ImageSource {
  type: 'base64';
  media_type: string;
  data: string;
}

interface ImageBlock {
  type: 'image';
  source: ImageSource;
}

interface ToolResultContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: ImageSource;
}

interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: ToolResultContentBlock[];
}

type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ImageBlock;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');
    const lastMessageId = searchParams.get('lastMessageId');
    
    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    // Build the query to get messages for the task
    const query: Prisma.MessageFindManyArgs = {
      where: {
        taskId: taskId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    };

    // If lastMessageId is provided, only get messages after that ID
    if (lastMessageId) {
      const lastMessage = await prisma.message.findUnique({
        where: { id: lastMessageId },
        select: { createdAt: true },
      });

      if (lastMessage) {
        query.where = {
          ...query.where,
          createdAt: {
            gt: lastMessage.createdAt,
          },
        };
      }
    }

    const messages = await prisma.message.findMany(query);
    console.log(`Found ${messages.length} new messages for task ${taskId}`);

    // Transform the messages to a format suitable for the frontend
    const transformedMessages = messages.map(message => {
      // Handle different content types based on the Anthropic message structure
      let displayContent = '';
      
      const content = message.content as unknown as ContentBlock[];
      
      if (Array.isArray(content)) {
        // Process content blocks
        for (const block of content) {
          if (block && typeof block === 'object') {
            if (block.type === 'text' && 'text' in block) {
              displayContent += block.text;
            } else if (block.type === 'tool_use' && 'name' in block) {
              displayContent += `[Using tool: ${block.name}]`;
            } else if (block.type === 'tool_result' && 'content' in block && Array.isArray(block.content)) {
              for (const resultBlock of block.content) {
                if (resultBlock && typeof resultBlock === 'object') {
                  if (resultBlock.type === 'text' && 'text' in resultBlock) {
                    displayContent += resultBlock.text;
                  } else if (resultBlock.type === 'image') {
                    displayContent += '[Image]';
                  }
                }
              }
            }
          }
        }
      } else if (typeof content === 'string') {
        displayContent = content;
      }

      return {
        id: message.id,
        content: displayContent,
        role: message.type === MessageType.USER ? 'user' : 'assistant',
        createdAt: message.createdAt,
      };
    });

    return NextResponse.json({ messages: transformedMessages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
