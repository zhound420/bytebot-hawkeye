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

## Computer Use REST API

The Bytebot API provides a comprehensive set of endpoints for controlling the virtual desktop environment. All endpoints are available at `http://localhost:3000/computer-use`.

### Keyboard Control

| Endpoint | Method | Parameters                                | Description                                                        |
| -------- | ------ | ----------------------------------------- | ------------------------------------------------------------------ |
| `/key`   | POST   | `{ "key": "string" }`                     | Sends a single key event (e.g., "a", "enter", "ctrl")              |
| `/type`  | POST   | `{ "text": "string", "delayMs": number }` | Types the specified text with an optional delay between keystrokes |

### Mouse Control

| Endpoint           | Method | Parameters                                                                                 | Description                                                        |
| ------------------ | ------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `/mouse-move`      | POST   | `{ "x": number, "y": number }`                                                             | Moves the mouse cursor to the specified coordinates                |
| `/left-click`      | POST   | None                                                                                       | Performs a left mouse click at the current cursor position         |
| `/right-click`     | POST   | None                                                                                       | Performs a right mouse click at the current cursor position        |
| `/middle-click`    | POST   | None                                                                                       | Performs a middle mouse click at the current cursor position       |
| `/double-click`    | POST   | `{ "delayMs": number }`                                                                    | Performs a double-click with optional delay between clicks         |
| `/left-click-drag` | POST   | `{ "startX": number, "startY": number, "endX": number, "endY": number, "holdMs": number }` | Performs a drag operation from start to end coordinates            |
| `/scroll`          | POST   | `{ "amount": number, "axis": "v" or "h" }`                                                 | Scrolls vertically (v) or horizontally (h) by the specified amount |

### System Information

| Endpoint           | Method | Parameters | Description                                                                                                                  |
| ------------------ | ------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `/screenshot`      | GET    | None       | Captures a screenshot of the current desktop state, returns a base64 encoded string as `{ "image": "base64-encoded-image" }` |
| `/cursor-position` | GET    | None       | Returns the current cursor position as `{ x, y }`                                                                            |

### Example Usage

```bash
# Move the mouse to coordinates (100, 200)
curl -X POST http://localhost:3000/computer-use/mouse-move \
  -H "Content-Type: application/json" \
  -d '{"x": 100, "y": 200}'

# Type text
curl -X POST http://localhost:3000/computer-use/type \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, Bytebot!", "delayMs": 50}'

# Take a screenshot
curl -X GET http://localhost:3000/computer-use/screenshot > screenshot.png
```

## MCP Protocol (WebSocket)

In addition to the REST API, Bytebot provides an MCP (Machine Context Protocol) server through WebSockets. This allows for real-time control and feedback for agents interacting with the virtual environment.

### Connection

Connect to the MCP server using a standard MCP client at:

```
mcp://localhost:3000/mcp
```

### Using with Claude Desktop

To connect Claude desktop client to your Bytebot MCP server, add the following configuration to your Claude desktop settings.json file:

```json
{
  "tools": [
    {
      "name": "Bytebot",
      "url": "mcp://localhost:3000/mcp",
      "description": "Control the virtual computer through keyboard, mouse, and screen interactions",
      "icon": "🖥️"
    }
  ]
}
```

### Standard MCP Implementation

Our MCP server follows the official [Model Context Protocol](https://modelcontextprotocol.io/) specification, providing a standardized way for LLMs and agents to interact with the computer-use API. The implementation uses the official TypeScript MCP SDK to ensure best practices and compatibility with MCP clients.

The server exposes:

- **Tools**: Action-oriented functions for controlling mouse and keyboard
- **Resources**: Data that can be accessed, such as screenshots and cursor position

### Supported Tools

The MCP server exposes all the functionality of the computer-use API as tools:

| Tool Name         | Description                        | Inputs                                                                                                   |
| ----------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `key`             | Sends a single key event           | `key`: String representing the key (e.g., "enter", "a")                                                  |
| `type`            | Types text with optional delay     | `text`: String to type<br>`delayMs`: Optional delay between keys                                         |
| `mouse_move`      | Moves mouse cursor to coordinates  | `x`: X coordinate<br>`y`: Y coordinate                                                                   |
| `left_click`      | Performs a left mouse click        | None                                                                                                     |
| `right_click`     | Performs a right mouse click       | None                                                                                                     |
| `middle_click`    | Performs a middle mouse click      | None                                                                                                     |
| `double_click`    | Performs a double-click            | `delayMs`: Optional delay between clicks                                                                 |
| `left_click_drag` | Performs a drag operation          | `startX`, `startY`: Start coordinates<br>`endX`, `endY`: End coordinates<br>`holdMs`: Optional hold time |
| `scroll`          | Scrolls vertically or horizontally | `amount`: Scroll amount<br>`axis`: "v" (vertical) or "h" (horizontal)                                    |

### Available Resources

| Resource URI           | Description                      | Type              |
| ---------------------- | -------------------------------- | ----------------- |
| `screenshot://current` | Gets the current screenshot      | Base64 image data |
| `cursor://position`    | Gets the current cursor position | `{x, y}` object   |

### Using with MCP Clients

To interact with the MCP server, you can use any standard MCP client library. For example, with the official TypeScript SDK:

```javascript
import { MCPClient } from "@modelcontextprotocol/sdk";

// Connect to the MCP server
const client = new MCPClient("mcp://localhost:3000/mcp");

// Use a tool
const result = await client.useTool("mouse_move", {
  x: 100,
  y: 200,
});

// Access a resource
const screenshot = await client.getResource("screenshot://current");
```

### Benefits of Using the MCP Protocol

- **Standardized Interface**: MCP provides a consistent interface for AI agents to interact with applications
- **Secure**: Built with security in mind, following best practices for LLM interactions
- **Discoverable**: MCP clients can automatically discover available tools and resources
- **Extensible**: Easily extend with new tools and resources as needed

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

You can send key combinations by using the `/key` endpoint with special syntax:

```bash
# Send Ctrl+C
curl -X POST http://localhost:3000/computer-use/key \
  -H "Content-Type: application/json" \
  -d '{"key": "ctrl-c"}'

# Send Alt+Tab
curl -X POST http://localhost:3000/computer-use/key \
  -H "Content-Type: application/json" \
  -d '{"key": "alt-tab"}'
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

# Bytebot API base URL
BYTEBOT_API = "http://localhost:3000/computer-use"

# Get screenshot
response = requests.get(f"{BYTEBOT_API}/screenshot")
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
    requests.post(f"{BYTEBOT_API}/mouse-move", json={"x": x, "y": y})
    requests.post(f"{BYTEBOT_API}/left-click")
```

#### JavaScript/TypeScript Example

```typescript
import axios from "axios";
import { OpenAI } from "openai";

const BYTEBOT_API = "http://localhost:3000/computer-use";
const openai = new OpenAI();

async function runAgent() {
  // Get screenshot
  const screenshotResponse = await axios.get(`${BYTEBOT_API}/screenshot`, {
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
  await axios.post(`${BYTEBOT_API}/type`, {
    text: "Hello from my JavaScript agent!",
    delayMs: 50,
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
