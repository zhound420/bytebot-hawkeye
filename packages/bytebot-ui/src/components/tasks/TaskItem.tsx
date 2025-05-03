import React from 'react';
import { Task, TaskStatus } from '@/types';
import { format } from 'date-fns';
import { capitalizeFirstChar } from '@/utils/stringUtils';
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick02Icon, Cancel01Icon, Loading03Icon } from '@hugeicons/core-free-icons'
import Link from 'next/link';

interface TaskItemProps {
  task: Task & {
    imageData?: {
      data: string;
      type: string;
      media_type: string;
    };
  };
}

export const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  // Format date to match the screenshot (e.g., "Today 9:13am" or "April 13, 2025, 12:01pm")
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    
    // Check if the date is today
    if (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    ) {
      const todayFormat = `Today ${format(date, 'h:mma').toLowerCase()}`;
      return capitalizeFirstChar(todayFormat);
    }
    
    // Otherwise, return the full date
    const formattedDate = format(date, 'MMMM d, yyyy, h:mma').toLowerCase();
    return capitalizeFirstChar(formattedDate);
  };

  return (
    <Link href={`/tasks/${task.id}`} className="block">
      <div className="py-4 px-5 shadow-bytebot bg-bytebot-bronze-light-2 border-[0.5px] rounded-lg border-bytebot-bronze-light-5 flex items-start min-h-24 hover:bg-bytebot-bronze-light-3 transition-colors">
        {/* Task icon or image */}
        <div className="w-20 h-auto mr-4 flex-shrink-0 overflow-hidden rounded">
          {task.imageData ? (
            <img 
              src={`data:${task.imageData.media_type};${task.imageData.type},${task.imageData.data}`}
              alt="Task result"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="h-12 bg-bytebot-bronze-light-5 rounded"></div>
          )}
        </div>
        
        <div className="flex-1 space-y-1">
          <div className="text-byhtebot-bronze-dark-7 text-sm font-medium">{capitalizeFirstChar(task.description)}</div>
          <div className="text-byhtebot-bronze-dark-11 text-xs">{formatDate(task.createdAt)}</div>
          {task.status === TaskStatus.COMPLETED && (
            <div className="py-0.5 px-1.5 space-x-1 inline-flex w-fit items-center bg-bytebot-green-3 border border-bytebot-green-a5 rounded-full">
              <HugeiconsIcon icon={Tick02Icon} className="h-4 w-4 text-bytebot-green-9 mr-1" />
              <span className="text-[11px] text-bytebot-green-11">Success</span>
            </div>
          )}
          {task.status === TaskStatus.IN_PROGRESS && (
            <div className="py-0.5 px-1.5 space-x-1 inline-flex w-fit items-center bg-orange-100 border border-orange-700 rounded-full">
              <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 text-orange-900 mr-1 animate-[spin_3s_linear_infinite]" />
              <span className="text-[11px] text-orange-700">In Progress</span>
            </div>
          )}
          {task.status === TaskStatus.PENDING && (
            <div className="py-0.5 px-1.5 space-x-1 inline-flex w-fit items-center bg-yellow-100 border border-yellow-700 rounded-full">
              <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 text-yellow-900 mr-1 animate-[spin_3s_linear_infinite]" />
              <span className="text-[11px] text-yellow-700">Pending</span>
            </div>
          )}
          {task.status === TaskStatus.FAILED && (
            <div className="py-0.5 px-1.5 space-x-1 inline-flex w-fit items-center bg-bytebot-red-light-3 border border-bytebot-green-a5 rounded-full">
              <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4 text-bytebot-red-light-9 mr-1" />
              <span className="text-[11px] text-bytebot-red-light-9">Failed</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};
