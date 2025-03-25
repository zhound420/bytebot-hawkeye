import { NextResponse } from "next/server";
import { queue } from "../../../workers/worker";
import { z } from "zod";
import { TaskStatus, TaskPriority } from "@prisma/client";

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

    // Add job directly to the BullMQ queue
    await queue.add("agentQueue", validatedData);

    return NextResponse.json({
      status: "Task queued successfully",
      task: validatedData,
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
