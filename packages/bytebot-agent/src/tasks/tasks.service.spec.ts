import { TasksService } from './tasks.service';
import { TaskStatus } from '@prisma/client';

describe('TasksService', () => {
  const matchesWhere = (task: any, where: any): boolean => {
    if (!where) {
      return true;
    }

    if (where.status?.in && !where.status.in.includes(task.status)) {
      return false;
    }

    if (where.OR) {
      const orMatches = where.OR.some((condition: any) =>
        matchesWhere(task, condition),
      );

      if (!orMatches) {
        return false;
      }
    }

    if (Object.prototype.hasOwnProperty.call(where, 'queuedAt')) {
      const queuedCondition = where.queuedAt;

      if (queuedCondition === null) {
        if (task.queuedAt !== null) {
          return false;
        }
      } else if (
        queuedCondition?.not !== undefined &&
        queuedCondition.not === null &&
        task.queuedAt === null
      ) {
        return false;
      }
    }

    if (Object.prototype.hasOwnProperty.call(where, 'scheduledFor')) {
      const scheduledCondition = where.scheduledFor;

      if (scheduledCondition === null) {
        if (task.scheduledFor !== null) {
          return false;
        }
      } else if (
        scheduledCondition?.lte &&
        (!task.scheduledFor || task.scheduledFor > scheduledCondition.lte)
      ) {
        return false;
      }
    }

    return true;
  };

  const createService = (findFirstImpl: (args: any) => any) => {
    const prisma = {
      task: {
        findFirst: jest.fn(findFirstImpl),
      },
    };

    const tasksGateway = {};
    const configService = {};
    const eventEmitter = { emit: jest.fn() };

    const fileStorageService = {
      saveTaskFile: jest.fn().mockResolvedValue({
        storagePath: '/tmp/file.txt',
        storageProvider: 'test',
      }),
    };

    const service = new TasksService(
      prisma as any,
      tasksGateway as any,
      configService as any,
      eventEmitter as any,
      fileStorageService as any,
    );

    return { service, prisma };
  };

  describe('findNextTask', () => {
    it('skips scheduled tasks that are not ready to run', async () => {
      jest.useFakeTimers();

      const now = new Date('2024-01-01T00:00:00.000Z');
      jest.setSystemTime(now);

      const futureTask: any = {
        id: 'future-task',
        status: TaskStatus.PENDING,
        scheduledFor: new Date(now.getTime() + 60_000),
        queuedAt: null,
      };

      const { service, prisma } = createService(({ where }) => {
        if (matchesWhere(futureTask, where)) {
          return { ...futureTask, files: [] };
        }

        return null;
      });

      try {
        await expect(service.findNextTask()).resolves.toBeNull();
        expect(prisma.task.findFirst).toHaveBeenCalledTimes(1);

        futureTask.queuedAt = new Date(now.getTime() + 30_000);

        await expect(service.findNextTask()).resolves.toMatchObject({
          id: 'future-task',
        });
        expect(prisma.task.findFirst).toHaveBeenCalledTimes(2);

        futureTask.queuedAt = null;
        jest.setSystemTime(new Date(now.getTime() + 120_000));

        await expect(service.findNextTask()).resolves.toMatchObject({
          id: 'future-task',
        });
        expect(prisma.task.findFirst).toHaveBeenCalledTimes(3);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
