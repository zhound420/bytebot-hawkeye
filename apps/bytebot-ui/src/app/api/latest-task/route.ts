import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TaskStatus } from '@prisma/client';

export async function GET() {
  try {
    // Find the latest in-progress task
    const latestTask = await prisma.task.findFirst({
      where: {
        // Consider tasks that are either in progress or need help/review as active
        status: {
          in: [
            TaskStatus.IN_PROGRESS,
            TaskStatus.NEEDS_HELP,
            TaskStatus.NEEDS_REVIEW
          ]
        }
      },
      orderBy: {
        updatedAt: 'desc' // Get the most recently updated task
      },
      include: {
        // Include the first message to show in the chat
        messages: {
          take: 1,
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    // If no in-progress task is found, try to find the latest completed task
    if (!latestTask) {
      // const latestCompletedTask = await prisma.task.findFirst({
      //   where: {
      //     status: TaskStatus.COMPLETED
      //   },
      //   orderBy: {
      //     updatedAt: 'desc'
      //   },
      //   include: {
      //     messages: {
      //       take: 1,
      //       orderBy: {
      //         createdAt: 'asc'
      //       }
      //     }
      //   }
      // });

      // if (latestCompletedTask) {
      //   return NextResponse.json({ task: latestCompletedTask });
      // }
      
      // No tasks found at all
      return NextResponse.json({ task: null });
    }

    return NextResponse.json({ task: latestTask });
  } catch (error) {
    console.error('Error fetching latest task:', error);
    return NextResponse.json({ error: 'Failed to fetch latest task' }, { status: 500 });
  }
}
