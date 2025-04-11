/**
 * Computer Actions Utility
 *
 * This file implements tool call functions for controlling the computer,
 * based on the ToolCall action types defined in agentTask.ts.
 */
const COMPUTER_USE_URL =
  process.env.COMPUTER_USE_URL || "http://localhost:9990";

// Types for parameters
type Coordinates = { x: number; y: number };
export type ScrollDirection = "up" | "down" | "left" | "right";

/**
 * Press a keyboard key
 * @param key The key to press
 */
export async function key(key: string): Promise<void> {
  console.log(`Typing key: ${key}`);

  try {
    // Using the unified computer API
    await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "type_keys",
        keys: key.split("+"),
      }),
    });
  } catch (error) {
    console.error("Error in key action:", error);
    throw error;
  }
}

/**
 * Hold down a keyboard key
 * @param key The key to hold down
 * @param duration Duration in milliseconds to hold the key
 * @param options Additional key modifiers (alt, ctrl, shift, meta)
 */
export async function hold_key(
  key: string,
  duration: number = 500
): Promise<void> {
  console.log(`Holding key: ${key} for ${duration}ms`);

  try {
    // Using the unified computer API - press key
    await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "press_keys",
        keys: [key],
        press: "down",
      }),
    });

    // Wait for specified duration
    await wait(duration);

    // Release key
    await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "press_keys",
        keys: [key],
        press: "up",
      }),
    });
  } catch (error) {
    console.error("Error in hold_key action:", error);
    throw error;
  }
}

/**
 * Type text
 * @param text The text to type
 */
export async function type(text: string): Promise<void> {
  console.log(`Typing text: ${text}`);

  try {
    await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "type_text",
        text,
      }),
    });
  } catch (error) {
    console.error("Error in type action:", error);
    throw error;
  }
}

/**
 * Get the current cursor position
 * @returns The coordinates of the cursor
 */
export async function cursor_position(): Promise<Coordinates> {
  console.log("Getting cursor position");

  try {
    const response = await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "get_cursor_position",
      }),
    });

    const data = await response.json();
    return { x: data.x, y: data.y };
  } catch (error) {
    console.error("Error in cursor_position action:", error);
    throw error;
  }
}

/**
 * Move the mouse to specified coordinates
 * @param coordinate The [x, y] coordinates to move the mouse to
 */
export async function mouse_move(coordinates: Coordinates): Promise<void> {
  console.log(
    `Moving mouse to coordinates: [${coordinates.x}, ${coordinates.y}]`
  );

  try {
    await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "move_mouse",
        coordinates,
      }),
    });
  } catch (error) {
    console.error("Error in mouse_move action:", error);
    throw error;
  }
}

/**
 * Press and hold the left mouse button
 */
export async function left_mouse_down(): Promise<void> {
  console.log(`Left mouse down`);

  try {
    await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "press_mouse",
        button: "left",
        press: "down",
      }),
    });
  } catch (error) {
    console.error("Error in left_mouse_down action:", error);
    throw error;
  }
}

/**
 * Release the left mouse button
 */
export async function left_mouse_up(): Promise<void> {
  console.log(`Left mouse up`);

  try {
    await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "press_mouse",
        button: "left",
        press: "up",
      }),
    });
  } catch (error) {
    console.error("Error in left_mouse_up action:", error);
    throw error;
  }
}

/**
 * Click the left mouse button
 * @param coordinates The [x, y] coordinates to click at
 */
export async function left_click(
  coordinates: Coordinates,
  holdKeys: string[] = []
): Promise<void> {
  console.log(
    `Left clicking at coordinates: [${coordinates.x}, ${coordinates.y}]`
  );

  try {
    await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "click_mouse",
        coordinates,
        button: "left",
        holdKeys,
      }),
    });
  } catch (error) {
    console.error("Error in left_click action:", error);
    throw error;
  }
}

/**
 * Drag the mouse with left button pressed
 * @param startCoordinates The starting [x, y] coordinates
 * @param endCoordinates The ending [x, y] coordinates
 */
export async function left_click_drag(
  startCoordinates: Coordinates,
  endCoordinates: Coordinates,
  holdKeys: string[] = []
): Promise<void> {
  console.log(
    `Left click dragging from [${startCoordinates.x}, ${startCoordinates.y}] to [${endCoordinates.x}, ${endCoordinates.y}]`
  );

  try {
    await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "drag_mouse",
        path: [startCoordinates, endCoordinates],
        button: "left",
        holdKeys,
      }),
    });
  } catch (error) {
    console.error("Error in left_click_drag action:", error);
    throw error;
  }
}

/**
 * Click the right mouse button
 * @param coordinates The [x, y] coordinates to right-click at
 */
export async function right_click(
  coordinates: Coordinates,
  holdKeys: string[] = []
): Promise<void> {
  console.log(
    `Right clicking at coordinates: [${coordinates.x}, ${coordinates.y}]`
  );

  try {
    await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "click_mouse",
        coordinates,
        button: "right",
        holdKeys,
      }),
    });
  } catch (error) {
    console.error("Error in right_click action:", error);
    throw error;
  }
}

/**
 * Click the middle mouse button
 * @param coordinates The [x, y] coordinates to middle-click at
 */
export async function middle_click(
  coordinates: Coordinates,
  holdKeys: string[] = []
): Promise<void> {
  console.log(
    `Middle clicking at coordinates: [${coordinates.x}, ${coordinates.y}]`
  );

  try {
    await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "click_mouse",
        coordinates,
        button: "middle",
        holdKeys,
      }),
    });
  } catch (error) {
    console.error("Error in middle_click action:", error);
    throw error;
  }
}

/**
 * Double-click the left mouse button
 * @param coordinates The [x, y] coordinates to double-click at
 */
export async function double_click(
  coordinates: Coordinates,
  holdKeys: string[] = []
): Promise<void> {
  console.log(
    `Double clicking at coordinates: [${coordinates.x}, ${coordinates.y}]`
  );

  try {
    await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "click_mouse",
        coordinates,
        button: "left",
        numClicks: 2,
        holdKeys,
      }),
    });
  } catch (error) {
    console.error("Error in double_click action:", error);
    throw error;
  }
}

/**
 * Triple-click the left mouse button
 * @param coordinates The [x, y] coordinates to triple-click at
 */
export async function triple_click(
  coordinates: Coordinates,
  holdKeys: string[] = []
): Promise<void> {
  console.log(
    `Triple clicking at coordinates: [${coordinates.x}, ${coordinates.y}]`
  );

  try {
    await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "click_mouse",
        coordinates,
        button: "left",
        numClicks: 3,
        holdKeys,
      }),
    });
  } catch (error) {
    console.error("Error in trip_click action:", error);
    throw error;
  }
}

/**
 * Scroll the mouse wheel
 * @param coordinates The [x, y] coordinates to scroll at
 * @param deltaX Horizontal scroll amount (positive = right, negative = left)
 * @param deltaY Vertical scroll amount (positive = down, negative = up)
 */
export async function scroll(
  coordinates: Coordinates,
  scrollDirection: ScrollDirection,
  scrollAmount: number,
  holdKeys: string[] = []
): Promise<void> {
  console.log(
    `Scrolling at coordinates: [${coordinates.x}, ${coordinates.y}], direction: ${scrollDirection}, amount: ${scrollAmount}`
  );

  try {
    await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "scroll",
        coordinates,
        direction: scrollDirection,
        amount: scrollAmount,
        holdKeys,
      }),
    });
  } catch (error) {
    console.error("Error in scroll action:", error);
    throw error;
  }
}

/**
 * Wait for a specified amount of time
 * @param duration Duration in milliseconds to wait
 */
export async function wait(duration: number = 1000): Promise<void> {
  console.log(`Waiting for ${duration}ms`);

  try {
    await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "wait",
        duration,
      }),
    });
  } catch (error) {
    console.error("Error in wait action:", error);
    throw error;
  }
}

/**
 * Take a screenshot
 * @returns Base64 encoded image data
 */
export async function screenshot(): Promise<string> {
  console.log("Taking screenshot");

  try {
    const requestBody = {
      action: "screenshot",
    };

    const response = await fetch(`${COMPUTER_USE_URL}/computer-use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed to take screenshot: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.image) {
      throw new Error("Failed to take screenshot: No image data received");
    }

    return data.image; // Base64 encoded image
  } catch (error) {
    console.error("Error in screenshot action:", error);
    throw error;
  }
}
