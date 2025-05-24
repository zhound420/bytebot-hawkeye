import { Message } from "@/types";
import { MessageContentBlock, isToolResultContentBlock, isImageContentBlock } from "@bytebot/shared";

export interface ScreenshotData {
  id: string;
  base64Data: string;
  messageIndex: number;
  blockIndex: number;
}

/**
 * Extracts all screenshots from messages
 */
export function extractScreenshots(messages: Message[]): ScreenshotData[] {
  const screenshots: ScreenshotData[] = [];
  
  messages.forEach((message, messageIndex) => {
    message.content.forEach((block, blockIndex) => {
      // Check if this is a tool result block with an image
      if (isToolResultContentBlock(block) && block.content && block.content.length > 0) {
        const imageBlock = block.content[0];
        if (isImageContentBlock(imageBlock)) {
          screenshots.push({
            id: `${message.id}-${blockIndex}`,
            base64Data: imageBlock.source.data,
            messageIndex,
            blockIndex,
          });
        }
      }
    });
  });
  
  return screenshots;
}

/**
 * Gets the screenshot that should be displayed based on scroll position
 */
export function getScreenshotForScrollPosition(
  screenshots: ScreenshotData[],
  messages: Message[],
  scrollContainer: HTMLElement | null
): ScreenshotData | null {
  if (!scrollContainer || screenshots.length === 0) {
    return screenshots[screenshots.length - 1] || null; // Default to last screenshot
  }

  // Get all message elements in the scroll container
  const messageElements = scrollContainer.querySelectorAll('[data-message-index]');
  
  if (messageElements.length === 0) {
    return screenshots[screenshots.length - 1] || null;
  }

  const containerScrollTop = scrollContainer.scrollTop;
  const containerHeight = scrollContainer.clientHeight;

  // Find the message that's most visible at the top of the container
  let bestVisibleMessageIndex = 0;
  let bestVisibility = 0;
  let minDistanceFromTop = Infinity;

  messageElements.forEach((element) => {
    const messageIndex = parseInt((element as HTMLElement).dataset.messageIndex || '0');
    const elementTop = (element as HTMLElement).offsetTop;
    const elementHeight = (element as HTMLElement).offsetHeight;
    
    // Distance from top of container (accounting for scroll)
    const distanceFromViewportTop = elementTop - containerScrollTop;
    
    // Check if element is visible in viewport
    const isVisible = distanceFromViewportTop < containerHeight && 
                     distanceFromViewportTop + elementHeight > 0;
    
    if (isVisible) {
      // Prefer elements closer to the top of the viewport
      const visibility = Math.max(0, Math.min(elementHeight, containerHeight - Math.max(0, distanceFromViewportTop))) / elementHeight;
      
      // If this element is more visible, or if equally visible but closer to top
      if (visibility > bestVisibility || 
          (visibility === bestVisibility && Math.abs(distanceFromViewportTop) < minDistanceFromTop)) {
        bestVisibility = visibility;
        bestVisibleMessageIndex = messageIndex;
        minDistanceFromTop = Math.abs(distanceFromViewportTop);
      }
    }
  });

  // Find the most recent screenshot at or before this message index
  let bestScreenshot: ScreenshotData | null = null;
  for (const screenshot of screenshots) {
    if (screenshot.messageIndex <= bestVisibleMessageIndex) {
      bestScreenshot = screenshot;
    }
    // Don't break - we want to continue to find the best match
  }
  
  // If no screenshot found at or before this message, use the first screenshot
  if (!bestScreenshot && screenshots.length > 0) {
    bestScreenshot = screenshots[0];
  }
  
  return bestScreenshot || screenshots[0];
}