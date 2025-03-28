import { NextResponse } from "next/server";
import { queue } from "../../../workers/worker";
import { z } from "zod";
import { TaskStatus, TaskPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const taskSchema = z.object({
  description: z.string().min(1),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
});

export async function POST(request: Request) {
  try {
    const requestData = await request.json();

    // Validate with Zod, leveraging Prisma types directly
    const validatedData = taskSchema.parse(requestData);

    // Create the task in the database
    const task = await prisma.task.create({
      data: {
        description: validatedData.description,
        status: validatedData.status || TaskStatus.PENDING,
        priority: validatedData.priority || TaskPriority.MEDIUM,
      },
    });

    // Add job directly to the BullMQ queue with the task ID
    await queue.add("agentQueue", {
      ...validatedData,
      taskId: task.id,
    });

    return NextResponse.json({
      status: "Task queued successfully",
      task: task,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ errors: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal Server Error", details: String(error) },
      { status: 500 }
    );
  }
}
