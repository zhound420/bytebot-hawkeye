<p align="center">
  <img src="static/bytebot-logo.png" width="300" alt="Bytebot Logo">
</p>

# Bytebot

A containerized computer use environment with an integrated XFCE4 desktop and automation daemon.

## Overview

Bytebot provides a complete, self-contained environment for computer use automation. It encapsulates a lightweight XFCE4 desktop environment inside a Docker container with the bytebotd daemon for programmatic control, making it easy to deploy across different platforms.

## Features

- **Containerized Desktop Environment**: Runs a lightweight XFCE4 desktop on Ubuntu 22.04
- **VNC Access**: View and interact with the desktop through VNC or browser-based noVNC
- **Computer Use API**: Control the desktop environment programmatically through bytebotd daemon
- **Pre-installed Tools**: Comes with Chrome and other essential tools pre-installed
- **Cross-Platform**: Works on any system that supports Docker

## Architecture

Bytebot is designed as a single, integrated container that provides both a desktop environment and the tools to control it:

![Bytebot Architecture Diagram](static/bytebot-diagram.png)

## Desktop Environment

### Container Components

The Bytebot container includes:

- **Ubuntu 22.04** base system
- **XFCE4** desktop environment (lightweight and customizable)
- **bytebotd daemon** with nutjs for desktop automation
- **Firefox** pre-installed and configured
- **VNC server** for remote desktop access
- **noVNC** for browser-based desktop access
- Default user account: `bytebot` with sudo privileges

> **⚠️ Security Warning**: The default container is intended for development and testing purposes only. It should **not** be used in production environments without security hardening.

## Quick Start

### Prerequisites

- Docker installed on your system

### Building the Image

```bash
./scripts/build.sh
```

Or with custom options:

```bash
./scripts/build.sh --tag custom-tag --no-cache
```

### Running the Container

```bash
docker run -d --privileged \
  -p 3000:3000 \
  -p 5900:5900 \
  -p 6080:6080 \
  -p 6081:6081 \
  bytebot:latest
```

### Accessing the Desktop

- **VNC Client**: Connect to `localhost:5900`
- **Web Browser**: Navigate to `http://localhost:3000/vnc`

### Using the Computer Use API

The bytebotd daemon exposes a REST API on port 3000 that allows you to programmatically control the desktop environment.

## Computer Use API

Bytebot provides a unified computer action API that allows granular control over all aspects of the virtual desktop environment through a single endpoint, `http://localhost:3000/computer-use`.

### Unified Endpoint

| Endpoint        | Method | Description                                    |
| --------------- | ------ | ---------------------------------------------- |
| `/computer-use` | POST   | Unified endpoint for all computer interactions |

### Available Actions

The unified API supports the following actions:

| Action                | Description                                        | Parameters                                                                                                                          |
| --------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `move_mouse`          | Move the mouse cursor to a specific position       | `coordinates: { x: number, y: number }`                                                                                             |
| `click_mouse`         | Perform a mouse click                              | `coordinates?: { x: number, y: number }`, `button: 'left' \| 'right' \| 'middle'`, `numClicks?: number`, `holdKeys?: string[]`      |
| `drag_mouse`          | Click and drag the mouse from one point to another | `path: { x: number, y: number }[]`, `button: 'left' \| 'right' \| 'middle'`, `holdKeys?: string[]`                                  |
| `scroll`              | Scroll up, down, left, or right                    | `coordinates?: { x: number, y: number }`, `direction: 'up' \| 'down' \| 'left' \| 'right'`, `amount: number`, `holdKeys?: string[]` |
| `press_key`           | Press a keyboard key                               | `key: string`, `modifiers?: string[]`                                                                                               |
| `type_text`           | Type a text string                                 | `text: string`, `delay?: number`                                                                                                    |
| `wait`                | Wait for a specified duration                      | `duration: number` (milliseconds)                                                                                                   |
| `screenshot`          | Capture a screenshot of the desktop                | None                                                                                                                                |
| `get_cursor_position` | Get the current cursor position                    | None                                                                                                                                |

### Example Usage

```bash
# Move the mouse to coordinates (100, 200)
curl -X POST http://localhost:3000/computer-use \
  -H "Content-Type: application/json" \
  -d '{"action": "move_mouse", "coordinates": {"x": 100, "y": 200}}'

# Click the mouse with the left button
curl -X POST http://localhost:3000/computer-use \
  -H "Content-Type: application/json" \
  -d '{"action": "click_mouse", "button": "left"}'

# Type text with a 50ms delay between keystrokes
curl -X POST http://localhost:3000/computer-use \
  -H "Content-Type: application/json" \
  -d '{"action": "type_text", "text": "Hello, Bytebot!", "delay": 50}'

# Take a screenshot
curl -X POST http://localhost:3000/computer-use \
  -H "Content-Type: application/json" \
  -d '{"action": "screenshot"}'

# Double-click at specific coordinates
curl -X POST http://localhost:3000/computer-use \
  -H "Content-Type: application/json" \
  -d '{"action": "click_mouse", "coordinates": {"x": 150, "y": 250}, "button": "left", "numClicks": 2}'

# Press a key with modifiers (e.g., Alt+Tab)
curl -X POST http://localhost:3000/computer-use \
  -H "Content-Type: application/json" \
  -d '{"action": "press_key", "key": "tab", "modifiers": ["alt"]}'

# Get the current cursor position
curl -X POST http://localhost:3000/computer-use \
  -H "Content-Type: application/json" \
  -d '{"action": "get_cursor_position"}'

# Wait for 2 seconds
curl -X POST http://localhost:3000/computer-use \
  -H "Content-Type: application/json" \
  -d '{"action": "wait", "duration": 2000}'
```

## Automation Integration

Bytebot's computer use API can be easily integrated with any automation framework:

### Python Example

```python
import requests
import json

def control_computer(action, **params):
    url = "http://localhost:3000/computer-use"
    data = {"action": action, **params}
    response = requests.post(url, json=data)
    return response.json()

# Move the mouse
control_computer("move_mouse", coordinates={"x": 100, "y": 100})

# Type text
control_computer("type_text", text="Hello from Python")

# Take a screenshot
screenshot = control_computer("screenshot")
```

### Node.js Example

```javascript
const axios = require("axios");

async function controlComputer(action, params = {}) {
  const url = "http://localhost:3000/computer-use";
  const data = { action, ...params };
  const response = await axios.post(url, data);
  return response.data;
}

// Example usage
async function runExample() {
  // Move mouse
  await controlComputer("move_mouse", { coordinates: { x: 100, y: 100 } });

  // Type text
  await controlComputer("type_text", { text: "Hello from Node.js" });

  // Take screenshot
  const screenshot = await controlComputer("take_screenshot");
  console.log("Screenshot taken:", screenshot);
}

runExample();
```

## Container Internals

### Service Architecture

The container runs several services managed by `supervisord`:

- **Xvfb**: Virtual framebuffer X server
- **X11VNC**: VNC server for the X display
- **noVNC**: HTML5 VNC client
- **XFCE4**: Desktop environment
- **bytebotd**: NestJS-based daemon for desktop control using nutjs

### Technical Details

- **Display**: Virtual display (:0) using Xvfb
- **Desktop Automation**: Uses nutjs for low-level input control
- **API Server**: NestJS application running on port 3000
- **VNC Access**: Direct VNC on port 5900, noVNC on ports 6080/6081
- **Window Manager**: XFCE4 with custom configuration

## Use Cases

- **UI Testing**: Automated testing of web and desktop applications
- **Process Automation**: Automate repetitive desktop tasks
- **Demo Environments**: Showcase applications in a consistent environment
- **Remote Work**: Access and control a standardized desktop from anywhere
- **AI Agent Environment**: Provide a controlled environment for AI computer use agents

## License

See the [LICENSE](LICENSE) file for details.
