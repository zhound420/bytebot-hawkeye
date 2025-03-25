import { Worker, Queue, Job } from "bullmq";
import Redis from "ioredis";
import { triggerAgentWithMessage } from "../agent/agentTask";
const connection = new Redis({
  host: "localhost",
  port: 6379,
  maxRetriesPerRequest: null,
});

export const queue = new Queue("agentQueue", {
  connection,
  defaultJobOptions: {
    attempts: 1,
  },
});

const worker = new Worker(
  "agentQueue",
  async (
    job: Job<{
      description: string;
    }>
  ) => {
    const { description } = job.data;
    await triggerAgentWithMessage(description);
  },
  {
    connection,
    concurrency: 1,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
  }
);

export default worker;
