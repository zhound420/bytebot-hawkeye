"use client";

import React, { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { TaskItem } from "@/components/tasks/TaskItem";
import { fetchTasks } from "@/utils/taskUtils";
import { Task } from "@/types";

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTasks = async () => {
      setIsLoading(true);
      try {
        const fetchedTasks = await fetchTasks();
        setTasks(fetchedTasks);
      } catch (error) {
        console.error("Failed to load tasks:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTasks();
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />

      <main className="flex-1 px-6 py-6 overflow-hidden">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-medium mb-6">Tasks</h1>
          
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-bytebot-bronze-light-5 border-t-bytebot-bronze rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">Loading tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No tasks available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

