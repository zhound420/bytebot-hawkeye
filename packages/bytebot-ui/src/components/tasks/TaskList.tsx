"use client";

import React, { useEffect, useState } from "react";
import { TaskItem } from "@/components/tasks/TaskItem";
import { fetchTasks } from "@/utils/taskUtils";
import { Task } from "@/types";

interface TaskListProps {
  limit?: number;
  className?: string;
  title?: string;
  showTitle?: boolean;
}

export const TaskList: React.FC<TaskListProps> = ({ 
  limit = 5, 
  className = "", 
  title = "Latest Tasks",
  showTitle = true
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTasks = async () => {
      setIsLoading(true);
      try {
        const fetchedTasks = await fetchTasks();
        setTasks(fetchedTasks.slice(0, limit));
      } catch (error) {
        console.error("Failed to load tasks:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTasks();
  }, [limit]);

  return (
    <div className={className}>
      {showTitle && title && <h2 className="text-lg font-medium mb-4">{title}</h2>}
      
      {isLoading ? (
        <div className="p-4 text-center">
          <div className="animate-spin h-6 w-6 border-4 border-bytebot-bronze-light-5 border-t-bytebot-bronze rounded-full mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Loading tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-4 text-center border border-dashed border-bytebot-bronze-light-5 rounded-lg">
          <p className="text-gray-500 text-sm">No tasks available</p>
          <p className="text-gray-400 text-xs mt-1">Your completed tasks will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
};
