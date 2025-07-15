import { Message } from "@/types";
import { isToolResultContentBlock, isImageContentBlock } from "@bytebot/shared";

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

  // Get all screenshot marker elements in the scroll container
  const screenshotElements = scrollContainer.querySelectorAll('[data-message-index][data-block-index]');
  if (screenshotElements.length === 0) {
    return screenshots[screenshots.length - 1] || null;
  }

  const containerScrollTop = scrollContainer.scrollTop;
  const containerHeight = scrollContainer.clientHeight;

  // Find the screenshot marker that's most visible at 350px down from the top of the container
  const targetViewPosition = 350; // 350px down from top
  let bestVisibleMessageIndex = 0;
  let bestVisibleBlockIndex = 0;
  let bestVisibility = 0;
  let minDistanceFromTarget = Infinity;

  screenshotElements.forEach((element) => {
    const messageIndex = parseInt((element as HTMLElement).dataset.messageIndex || '0');
    const blockIndex = parseInt((element as HTMLElement).dataset.blockIndex || '0');
    const elementTop = (element as HTMLElement).offsetTop;
    const elementHeight = (element as HTMLElement).offsetHeight;
    const elementBottom = elementTop + elementHeight;
    
    // Distance from top of container (accounting for scroll)
    const distanceFromViewportTop = elementTop - containerScrollTop;
    const distanceFromViewportBottom = elementBottom - containerScrollTop;
    
    // Check if element is visible in viewport
    const isVisible = distanceFromViewportTop < containerHeight && 
                     distanceFromViewportBottom > 0;
    
    if (isVisible) {
      // Calculate how much of this element is visible
      const visibleTop = Math.max(0, distanceFromViewportTop);
      const visibleBottom = Math.min(containerHeight, distanceFromViewportBottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const visibility = elementHeight === 0 ? 1 : visibleHeight / elementHeight;
      
      // Calculate distance from our target position (150px down)
      const elementCenter = distanceFromViewportTop + (elementHeight / 2);
      const distanceFromTarget = Math.abs(elementCenter - targetViewPosition);
      
      // Prefer elements that are closer to our target position and more visible
      if (visibility > 0.1 && 
          (distanceFromTarget < minDistanceFromTarget || 
           (distanceFromTarget === minDistanceFromTarget && visibility > bestVisibility))) {
        bestVisibility = visibility;
        bestVisibleMessageIndex = messageIndex;
        bestVisibleBlockIndex = blockIndex;
        minDistanceFromTarget = distanceFromTarget;
      }
    }
  });

  // Find the most recent screenshot at or before this message and block index
  let bestScreenshot: ScreenshotData | null = null;
  for (const screenshot of screenshots) {
    if (
      screenshot.messageIndex < bestVisibleMessageIndex ||
      (screenshot.messageIndex === bestVisibleMessageIndex && screenshot.blockIndex <= bestVisibleBlockIndex)
    ) {
      bestScreenshot = screenshot;
    }
    // Don't break - we want to continue to find the best match
  }
  
  // If no screenshot found at or before this marker, use the first screenshot
  if (!bestScreenshot && screenshots.length > 0) {
    bestScreenshot = screenshots[0];
  }
  
  return bestScreenshot || screenshots[0];
}