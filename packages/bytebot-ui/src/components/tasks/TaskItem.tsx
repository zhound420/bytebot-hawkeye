import React from 'react';
import { Task, TaskStatus } from '@/types';
import { format } from 'date-fns';
import { CheckCircle } from 'lucide-react';
import { capitalizeFirstChar } from '@/utils/stringUtils';

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

  // Determine if task is successful (completed)
  const isSuccess = task.status === TaskStatus.COMPLETED;

  return (
    <div className="py-4 px-5 shadow-[0px_0px_0px_1.5px_#FFF_inset] bg-bytebot-bronze-light-2 border-[0.5px] rounded-lg border-bytebot-bronze-light-5 flex items-start min-h-24">
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
        {isSuccess && (
          <div className="py-0.5 px-1.5 space-x-1 inline-flex w-fit items-center bg-bytebot-green-3 border border-bytebot-green-a5 rounded-full">
            <CheckCircle className="h-4 w-4 text-bytebot-green-9 mr-1" />
            <span className="text-[11px] text-bytebot-green-11">Success</span>
          </div>
        )}
      </div>
    </div>
  );
};
