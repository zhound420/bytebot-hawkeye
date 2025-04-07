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

// New interface for transformed message content
interface TransformedContentBlock {
  type: 'text' | 'image';
  text?: string;
  image?: {
    media_type: string;
    data: string;
  };
}

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

    let messageRole = MessageType.USER ? 'user' : 'assistant'

    // Transform the messages to a format suitable for the frontend
    const transformedMessages = messages.map(message => {
      const parsedContent = message.content as unknown as ContentBlock[];
      const transformedContent: TransformedContentBlock[] = [];
      
      if (Array.isArray(parsedContent)) {
        for (const block of parsedContent) {
          if (!block || typeof block !== 'object') continue;
          
          // Handle text blocks
          if (block.type === 'text' && 'text' in block) {
            transformedContent.push({
              type: 'text',
              text: block.text
            });
          } 
          // Handle tool_result blocks that contain images or text
          else if (block.type === 'tool_result' && 'content' in block && Array.isArray(block.content)) {
            messageRole = MessageType.ASSISTANT // This is an overwrite so it shows as assistant
            for (const resultBlock of block.content) {
              if (!resultBlock || typeof resultBlock !== 'object') continue;
              
              if (resultBlock.type === 'text' && 'text' in resultBlock) {
                transformedContent.push({
                  type: 'text',
                  text: resultBlock.text
                });
              } 
              else if (resultBlock.type === 'image' && 'source' in resultBlock && resultBlock.source) {
                transformedContent.push({
                  type: 'image',
                  image: {
                    media_type: resultBlock.source.media_type,
                    data: resultBlock.source.data
                  }
                });
              }
            }
          }
        }
      }

      if (transformedContent.length === 0) {
        console.log('No content found for message', message);
        return null;
      }
      
      return {
        id: message.id,
        content: transformedContent,
        role: messageRole,
        createdAt: message.createdAt,
      };
    });

    const filteredMessages = transformedMessages.filter(Boolean)
    return NextResponse.json({ messages: filteredMessages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
