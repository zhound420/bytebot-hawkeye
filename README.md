<p align="center">
  <img src="bytebot-logo.png" width="300" alt="Bytebot Logo">
</p>

# Bytebot

A containerized framework for computer use agents with a virtual desktop environment.

## Overview

Bytebot provides a complete, self-contained environment for developing and deploying computer use agents. It encapsulates a lightweight Linux desktop environment with pre-installed tools inside a Docker container, making it easy to deploy across different platforms.

## Features

- **Containerized Desktop Environment**: Runs a lightweight Lubuntu 22.04 virtual machine with QEMU
- **VNC Access**: View and interact with the desktop through VNC or browser-based noVNC
- **Agent API**: Control the desktop environment programmatically through a NestJS-based hypervisor
- **Pre-installed Tools**: Comes with Chrome and other essential tools pre-installed
- **Cross-Platform**: Works on any system that supports Docker

## Computer Use Models and Agent Development

Bytebot provides the infrastructure for computer use agents, but the intelligence driving these agents can come from various sources. Developers have complete flexibility in how they build and deploy their agents.

![Bytebot Architecture Diagram](bytebot-diagram.png)

## Desktop Environment

### Default Desktop Image

Bytebot comes with a default Lubuntu 22.04 desktop image that includes:

- Pre-installed Google Chrome browser
- Default user account: `agent` with password `password`
- Lightweight LXDE desktop environment
- Basic utilities and tools

> **⚠️ Security Warning**: The default desktop image is intended for development and testing purposes only. It uses a known username and password combination and should **not** be used in production environments.

### Creating Custom Desktop Images

Developers are encouraged to create their own custom QEMU-compatible desktop images for production use. You can:

1. Build a custom QEMU disk image with your preferred:

   - Operating system (any Linux distribution, Windows, etc.)
   - Pre-installed software and tools
   - User accounts with secure credentials
   - System configurations and optimizations

2. Replace the default image by:
   - Hosting your custom image on your preferred storage (S3, GCS, etc.)
   - Modifying the Dockerfile to download your image instead of the default one
   - Or mounting your local image when running the container

#### Example: Using a Custom Image

```bash
# Modify the Dockerfile to use your custom image
# In docker/Dockerfile, change:
RUN wget https://your-storage-location.com/your-custom-image.qcow2 -P /opt/ && \
    chmod 777 /opt/your-custom-image.qcow2

# Or mount your local image when running the container
docker run -d --privileged \
  -p 3000:3000 \
  -p 5900:5900 \
  -p 6080:6080 \
  -p 6081:6081 \
  -v /path/to/your/custom-image.qcow2:/opt/bytebot-lubuntu-22.04.5.qcow2 \
  bytebot:latest
```

#### QEMU Image Compatibility

Your custom images must be:

- In QCOW2 format for optimal performance
- Compatible with QEMU/KVM virtualization
- Configured with appropriate drivers for virtual hardware
- Sized appropriately for your use case (recommended minimum: 10GB)

## Quick Start

### Prerequisites

- Docker installed on your system

### Building the Image

```bash
./build.sh
```

Or with custom options:

```bash
./build.sh --tag custom-tag --no-cache
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

### Using the Agent API

The hypervisor exposes a REST API on port 3000 that allows you to programmatically control the desktop environment.

## Computer Use API

Bytebot provides a unified computer action API that allows granular control over all aspects of the virtual desktop environment through a single endpoint, `http://localhost:3000/computer-use/action`.

### Unified Endpoint

| Endpoint  | Method | Description                                    |
| --------- | ------ | ---------------------------------------------- |
| `/action` | POST   | Unified endpoint for all computer interactions |

### Available Actions

The unified API supports the following actions:

| Action                | Description                                        | Parameters                                                |
| --------------------- | -------------------------------------------------- | --------------------------------------------------------- | --------------------------------- | ------------------------------- |
| `move_mouse`          | Move the mouse cursor to a specific position       | `coordinates: { x: number, y: number }`                   |
| `click_mouse`         | Perform a mouse click                              | `coordinates?: { x: number, y: number }`, `button: 'left' | 'right'                           | 'middle'`, `numClicks?: number` |
| `drag_mouse`          | Click and drag the mouse from one point to another | `path: { x: number, y: number }[]`, `button: 'left'       | 'right'                           | 'middle'`                       |
| `scroll`              | Scroll vertically or horizontally                  | `coordinates?: { x, y }`, `axis: 'vertical'               | 'horizontal'`, `distance: number` |
| `type_keys`           | Type one or more keyboard keys                     | `keys: string[]`, `delay?: number`                        |
| `press_keys`          | Press one or more keyboard keys                    | `keys: string[]`, `press: 'down'                          | 'up'                              | 'press'`                        |
| `type_text`           | Type a text string                                 | `text: string`, `delay?: number`                          |
| `wait`                | Wait for a specified duration                      | `duration: number` (milliseconds)                         |
| `screenshot`          | Capture a screenshot of the desktop                | None                                                      |
| `get_cursor_position` | Get the current cursor position                    | None                                                      |

### Example Usage

```bash
# Move the mouse to coordinates (100, 200)
curl -X POST http://localhost:3000/computer-use/action \
  -H "Content-Type: application/json" \
  -d '{"action": "move_mouse", "coordinates": {"x": 100, "y": 200}}'

# Click the mouse with the left button
curl -X POST http://localhost:3000/computer-use/action \
  -H "Content-Type: application/json" \
  -d '{"action": "click_mouse", "button": "left"}'

# Type text with a 50ms delay between keystrokes
curl -X POST http://localhost:3000/computer-use/action \
  -H "Content-Type: application/json" \
  -d '{"action": "type_text", "text": "Hello, Bytebot!", "delay": 50}'

# Take a screenshot
curl -X POST http://localhost:3000/computer-use/action \
  -H "Content-Type: application/json" \
  -d '{"action": "screenshot"}'

# Double-click at specific coordinates
curl -X POST http://localhost:3000/computer-use/action \
  -H "Content-Type: application/json" \
  -d '{"action": "click_mouse", "coordinates": {"x": 150, "y": 250}, "button": "left", "numClicks": 2}'

# Press and hold multiple keys simultaneously (e.g., Alt+Tab)
curl -X POST http://localhost:3000/computer-use/action \
  -H "Content-Type: application/json" \
  -d '{"action": "press_keys", "keys": ["alt", "tab"], "press": "down"}'

# Release the held keys
curl -X POST http://localhost:3000/computer-use/action \
  -H "Content-Type: application/json" \
  -d '{"action": "press_keys", "keys": ["alt", "tab"], "press": "up"}'

# Drag from one position to another
curl -X POST http://localhost:3000/computer-use/action \
  -H "Content-Type: application/json" \
  -d '{"action": "drag_mouse", "path": [{"x": 100, "y": 100}, {"x": 200, "y": 200}], "button": "left"}'

# Get the current cursor position
curl -X POST http://localhost:3000/computer-use/action \
  -H "Content-Type: application/json" \
  -d '{"action": "get_cursor_position"}'

# Wait for 2 seconds
curl -X POST http://localhost:3000/computer-use/action \
  -H "Content-Type: application/json" \
  -d '{"action": "wait", "duration": 2000}'
```

## Supported Keys

Bytebot supports a wide range of keyboard inputs through the QEMU key codes. Here are the supported key categories:

### Control Keys

| Key Name           | QEMU Code   |
| ------------------ | ----------- |
| Escape             | `esc`       |
| Backspace          | `backspace` |
| Tab                | `tab`       |
| Return/Enter       | `ret`       |
| Caps Lock          | `caps_lock` |
| Left Shift         | `shift`     |
| Right Shift        | `shift_r`   |
| Left Ctrl          | `ctrl`      |
| Right Ctrl         | `ctrl_r`    |
| Left Alt           | `alt`       |
| Right Alt          | `alt_r`     |
| Left Meta/Windows  | `meta_l`    |
| Right Meta/Windows | `meta_r`    |
| Space              | `spc`       |
| Insert             | `insert`    |
| Delete             | `delete`    |
| Home               | `home`      |
| End                | `end`       |
| Page Up            | `pgup`      |
| Page Down          | `pgdn`      |

### Arrow Keys

| Key Name    | QEMU Code |
| ----------- | --------- |
| Up Arrow    | `up`      |
| Down Arrow  | `down`    |
| Left Arrow  | `left`    |
| Right Arrow | `right`   |

### Function Keys

| Key Name | QEMU Code          |
| -------- | ------------------ |
| F1 - F12 | `f1` through `f12` |

### Key Combinations

You can send key combinations by using the `/action` endpoint with special syntax:

```bash
# Send Ctrl+C
curl -X POST http://localhost:3000/computer-use/action \
  -H "Content-Type: application/json" \
  -d '{"action": "type_keys", "keys": ["ctrl", "c"]}'

# Send Alt+Tab
curl -X POST http://localhost:3000/computer-use/action \
  -H "Content-Type: application/json" \
  -d '{"action": "type_keys", "keys": ["alt", "tab"]}'
```

## Architecture

Bytebot consists of three main components:

1. **QEMU Virtual Machine**: Runs a lightweight Lubuntu 22.04 desktop environment
2. **NestJS Hypervisor**: Provides an API for controlling the desktop environment
3. **noVNC Server**: Enables browser-based access to the desktop

All components are orchestrated using Supervisor within a single Docker container.

## Development

### Project Structure

```
bytebot/
├── build.sh                  # Build script for the Docker image
├── docker/                   # Docker configuration
│   ├── Dockerfile            # Main Dockerfile
│   └── supervisord.conf      # Supervisor configuration
└── hypervisor/               # NestJS-based agent API
    ├── src/                  # Source code
    ├── package.json          # Dependencies
    └── ...
```

### Extending the Hypervisor

The hypervisor is built with NestJS, making it easy to extend with additional functionality. See the hypervisor directory for more details.

### Local Development

Developers can use the Bytebot container as is for local development:

- Run the container with exposed ports as shown in the Quick Start section
- Connect to the desktop via VNC client at `localhost:5900` or web browser at `http://localhost:3000/vnc`
- Make API requests to `http://localhost:3000/computer-use` endpoints from your local agent code
- Iterate quickly by developing your agent logic separately from the Bytebot container

This separation of concerns allows for rapid development cycles where you can modify your agent's code without rebuilding the Bytebot container.

### Deployment

For production deployments, developers can:

- Bundle their agent code directly into the Bytebot container by modifying the Dockerfile
- Add authentication to secure the API endpoints
- Restrict port exposure to prevent unauthorized access
- Configure logging and monitoring for production use

#### Example: Bundling an Agent into the Container

```bash
# Example Dockerfile modifications to bundle a Python agent
...

# Install additional dependencies for your agent
RUN apk add --no-cache python3 py3-pip
WORKDIR /agent
COPY requirements.txt .
RUN pip3 install -r requirements.txt

# Copy your agent code
COPY agent/ /agent/

# Modify supervisord.conf to run your agent
COPY custom-supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Only expose VNC ports if needed, not the API
EXPOSE 5900 6080 6081
```

#### Example: Custom Supervisor Configuration

```ini
# custom-supervisord.conf
[supervisord]
nodaemon=true
logfile=/dev/stdout
logfile_maxbytes=0
loglevel=info
user=root

# Original Bytebot services
[program:desktop-vm]
command=sh -c '...' # Original QEMU command
autostart=true
autorestart=true
...

[program:hypervisor]
command=sh -c '...' # Original hypervisor command
directory=/hypervisor
autostart=true
autorestart=true
...

[program:novnc-http]
command=sh -c '...' # Original noVNC command
autostart=true
autorestart=true
...

# Add your custom agent
[program:my-agent]
command=python3 /agent/main.py
directory=/agent
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
redirect_stderr=true
```

### Leveraging AI Models for Computer Use

You can integrate Bytebot with various AI models to create intelligent computer use agents:

#### Large Language Models (LLMs)

- **Anthropic Claude**: Excellent for understanding complex visual contexts and reasoning about UI elements
- **OpenAI GPT-4V**: Strong capabilities for visual understanding and task planning
- **Google Gemini**: Offers multimodal understanding for complex desktop interactions
- **Mistral Large**: Provides efficient reasoning for task automation
- **DeepSeek**: Specialized in code understanding and generation for automation scripts

#### Computer Vision Models

- **OmniParser**: For extracting structured data from desktop UI elements
- **CLIP/ViT**: For identifying and classifying visual elements on screen
- **Segment Anything Model (SAM)**: For precise identification of UI components

### Integration Approaches

There are several ways to integrate AI models with Bytebot:

1. **API-based Integration**: Use the model provider's API to send screenshots and receive instructions
2. **Local Model Deployment**: Run smaller models locally alongside Bytebot
3. **Hybrid Approaches**: Combine local processing with cloud-based intelligence

### Flexible Development Options

Bytebot's REST API allows developers to build agents in any programming language or framework they prefer:

- **Python**: Ideal for data science and ML integration with libraries like requests, Pillow, and PyTorch
- **JavaScript/TypeScript**: Great for web-based agents using Node.js or browser environments
- **Java/Kotlin**: Robust options for enterprise applications
- **Go**: Excellent for high-performance, concurrent agents
- **Rust**: For memory-safe, high-performance implementations
- **C#/.NET**: Strong integration with Windows environments and enterprise systems

### Sample Agent Implementations

#### Python Example

```python
import requests
import base64
from PIL import Image
import io
import anthropic

# Bytebot API URL
BYTEBOT_API = "http://localhost:3000/computer-use/action"

# Get screenshot
response = requests.get(f"{BYTEBOT_API}", params={"action": "screenshot"})
screenshot = Image.open(io.BytesIO(response.content))

# Convert to base64 for Claude
buffered = io.BytesIO()
screenshot.save(buffered, format="PNG")
img_str = base64.b64encode(buffered.getvalue()).decode()

# Ask Claude what to do
client = anthropic.Anthropic()
message = client.messages.create(
    model="claude-3-opus-20240229",
    max_tokens=1000,
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What should I do with this desktop screenshot?"},
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img_str}}
            ]
        }
    ]
)

# Execute Claude's suggestion
action = message.content[0].text
if "click" in action.lower():
    # Extract coordinates from Claude's response
    # This is a simplified example
    x, y = 100, 200  # Replace with actual parsing
    requests.post(f"{BYTEBOT_API}/action", json={"action": "click_mouse", "coordinates": {"x": x, "y": y}})
```

#### JavaScript/TypeScript Example

```typescript
import axios from "axios";
import { OpenAI } from "openai";

const BYTEBOT_API = "http://localhost:3000/computer-use/action";
const openai = new OpenAI();

async function runAgent() {
  // Get screenshot
  const screenshotResponse = await axios.get(`${BYTEBOT_API}`, {
    params: { action: "screenshot" },
    responseType: "arraybuffer",
  });
  const base64Image = Buffer.from(screenshotResponse.data).toString("base64");

  // Ask GPT-4V for analysis
  const gptResponse = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "What should I do with this desktop?" },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${base64Image}` },
          },
        ],
      },
    ],
    max_tokens: 500,
  });

  // Process GPT's response and take action
  const action = gptResponse.choices[0].message.content;
  console.log(`GPT suggests: ${action}`);

  // Example action: Type text
  await axios.post(`${BYTEBOT_API}`, {
    action: "type_text",
    text: "Hello from my JavaScript agent!",
    delay: 50,
  });
}

runAgent();
```

## Use Cases

- **Automated Testing**: Run end-to-end tests in a consistent environment
- **Web Scraping**: Automate web browsing and data collection
- **UI Automation**: Create agents that interact with desktop applications
- **AI Training**: Generate training data for computer vision and UI interaction models

## License

See the [LICENSE](LICENSE) file for details.
