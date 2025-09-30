export interface SystemPromptContext {
  /**
   * Human-readable current date (e.g. 2025-09-27)
   */
  currentDate?: string;
  /**
   * Human-readable current time (e.g. 14:24:10)
   */
  currentTime?: string;
  /**
   * IANA timezone string (e.g. America/Los_Angeles)
   */
  timeZone?: string;
}

