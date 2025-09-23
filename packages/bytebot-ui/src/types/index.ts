import { MessageContentBlock } from "@bytebot/shared";

export enum Role {
  USER = "USER",
  ASSISTANT = "ASSISTANT",
}

// Message interface
export interface Message {
  id: string;
  content: MessageContentBlock[];
  role: Role;
  taskId?: string;
  createdAt?: string;
  take_over?: boolean;
}

// Grouped messages interface for processed endpoint
export interface GroupedMessages {
  role: Role;
  messages: Message[];
  take_over?: boolean;
}

export interface Model {
  provider: string;
  name: string;
  title: string;
  supportsVision?: boolean;
}

// Task related enums and types
export enum TaskStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  NEEDS_HELP = "NEEDS_HELP",
  NEEDS_REVIEW = "NEEDS_REVIEW",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  FAILED = "FAILED",
}

export enum TaskPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum TaskType {
  IMMEDIATE = "IMMEDIATE",
  SCHEDULED = "SCHEDULED",
}

export interface FileWithBase64 {
  name: string;
  base64: string;
  type: string;
  size: number;
}

export interface File {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string;
  createdAt: string;
  updatedAt: string;
  taskId: string;
}

export interface Task {
  id: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  control: Role;
  createdBy: Role;
  createdAt: string;
  updatedAt: string;
  scheduledFor?: string;
  executedAt?: string;
  completedAt?: string;
  queuedAt?: string;
  error?: string;
  result?: unknown;
  model: Model;
  files?: File[];
}

export interface TelemetryLearningMetricsTrend {
  direction: 'improving' | 'steady' | 'regressing';
  delta: number | null;
  recentAverage: number | null;
  previousAverage: number | null;
}

export interface TelemetryRegionalHotspot {
  key: string;
  center: { x: number; y: number } | null;
  attempts: number;
  successRate: number | null;
  averageError: number | null;
  weightedOffset: { x: number; y: number } | null;
}

export interface TelemetryLearningMetrics {
  totalAttempts: number;
  successRate: number | null;
  averageError: number | null;
  currentWeightedOffset: { x: number; y: number } | null;
  convergenceTrend: TelemetryLearningMetricsTrend;
  regionalHotspots: TelemetryRegionalHotspot[];
}

export interface TelemetrySummary {
  targetedClicks: number;
  untargetedClicks: number;
  avgAbsDelta: number | null;
  avgDeltaX: number | null;
  avgDeltaY: number | null;
  calibrationSnapshots: number;
  recentAbsDeltas?: number[];
  actionCounts?: Record<string, number>;
  retryClicks?: number;
  hoverProbes?: { count: number; avgDiff: number | null };
  postClickDiff?: { count: number; avgDiff: number | null };
  smartClicks?: number; // Successful smart click completions
  progressiveZooms?: number;
  learningMetrics: TelemetryLearningMetrics;
  sessionStart?: string | null;
  sessionEnd?: string | null;
  sessionDurationMs?: number | null;
  events?: TelemetryEvent[];
}

export interface TelemetryApps {
  apps: Array<{ name: string; count: number }>;
}

export interface TelemetryEvent {
  type: string;
  timestamp: string;
  app?: string | null;
  [key: string]: unknown;
}

export interface TelemetrySessionInfo {
  id: string;
  label?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  lastEventAt?: string | null;
  eventCount?: number;
  sessionStart?: string | null;
  sessionEnd?: string | null;
  sessionDurationMs?: number | null;
}

export interface TelemetrySessions {
  current: TelemetrySessionInfo | null;
  sessions: TelemetrySessionInfo[];
}
