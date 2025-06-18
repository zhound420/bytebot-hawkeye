<div align="center">

<img src="static/bytebot-logo.png" width="500" alt="Bytebot Logo">

[🌐 Website](https://bytebot.ai) • [📚 Docs](https://docs.bytebot.ai) • [💬 Discord](https://discord.com/invite/zcb5wA2t4u) • [𝕏 Twitter](https://x.com/bytebot_ai)

## Bytebot – **The Easiest Way to Build Desktop Agents**

</div>

## ✨ Why Bytebot?

Bytebot spins up a containerized Linux desktop with a task-driven agent ready for automation. Chat with it through the web UI or control it programmatically for scraping, CI tasks and remote work.

## Examples



https://github.com/user-attachments/assets/32a76e83-ea3a-4d5e-b34b-3b57f3604948




https://github.com/user-attachments/assets/5f946df9-9161-4e7e-8262-9eda83ee7d22



## 🚀 Features

- 📦 **Containerized Desktop** – XFCE4 on Ubuntu 22.04 in a single Docker image
- 🌍 **Access Anywhere** – VNC & browser‑based **noVNC** built‑in
- 🛠️ **Unified API** – Script every click & keystroke with a clean REST interface
- ⚙️ **Ready‑to‑Go Tools** – Firefox & essentials pre‑installed
- 🤖 **Task-Driven Agent** – Manage tasks via REST or Chat UI and watch them run

## 🧠 Agent System

Bytebot's agent stack is orchestrated with `docker-compose`. It starts:

- `bytebot-desktop` – the Linux desktop and automation daemon
- `bytebot-agent` – NestJS service processing tasks with Anthropic's Claude
- `bytebot-ui` – Next.js chat interface
- `postgres` – stores tasks and conversation history

Open `http://localhost:9992` to give the agent a task and watch it work.

## 📖 Documentation

Dive deeper at [**docs.bytebot.ai**](https://docs.bytebot.ai).

## ⚡ Quick Start

### 🛠️ Prerequisites

- Docker ≥ 20.10

### 🐳 Run Bytebot

#### 🤖 Full Agent Stack (fastest way)

```bash
echo "ANTHROPIC_API_KEY=your_api_key_here" > infrastructure/docker/.env

docker-compose -f infrastructure/docker/docker-compose.yml \
  --env-file infrastructure/docker/.env up -d     # start desktop, agent & UI
```
Once running, open `http://localhost:9992` to chat with the agent.

Stop:

```bash
docker-compose -f infrastructure/docker/docker-compose.yml \
  --env-file infrastructure/docker/.env down
```

#### Core Container

```bash
docker-compose -f infrastructure/docker/docker-compose.core.yml pull # pull latest remote image

docker-compose -f infrastructure/docker/docker-compose.core.yml up -d --no-build # start container
```

Build locally instead:

```bash

docker-compose -f infrastructure/docker/docker-compose.core.yml up -d --build # build image and start container
```

Stop:

```bash
docker-compose -f infrastructure/docker/docker-compose.core.yml down
```

More details in the [**Quickstart Guide**](https://docs.bytebot.ai/quickstart).

### 🔑 Connect

| Interface     | URL / Port                  | Notes                    |
| ------------- | --------------------------- | ------------------------ |
| 💬 Chat UI    | `http://localhost:9992`     | Agent UI                 |
| 🤖 Agent API  | `http://localhost:9991`     | REST API                 |
| 🌐 noVNC      | `http://localhost:9990/vnc` | open in any browser      |




## 🤖 Automation API

Control Bytebot with a single endpoint. Read the [**REST reference**](https://docs.bytebot.ai/rest-api/computer-use). Supported actions:

| 🎮 Action         | Description                |
| ----------------- | -------------------------- |
| `move_mouse`      | Move cursor to coordinates |
| `trace_mouse`     | Draw a path                |
| `click_mouse`     | Click (left/right/middle)  |
| `press_mouse`     | Press / release button     |
| `drag_mouse`      | Drag along path            |
| `scroll`          | Scroll direction & amount  |
| `type_keys`       | Type sequence of keys      |
| `press_keys`      | Press / release keys       |
| `type_text`       | Type a string              |
| `wait`            | Wait milliseconds          |
| `screenshot`      | Capture screen             |
| `cursor_position` | Return cursor position     |

_(See docs for parameter details.)_

## 🙌 Contributing

1. 🍴 Fork & branch from `main`
2. 💡 Commit small, focused changes
3. 📩 Open a PR with details
4. 🔍 Address review feedback
5. 🎉 Merge & celebrate!

## 💬 Support

Questions or ideas? Join us on [**Discord**](https://discord.com/invite/zcb5wA2t4u).

## 🙏 Acknowledgments

Powered by [**nutjs**](https://github.com/nut-tree/nut.js) and inspired by Anthropic's [**computer‑use demo**](https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo).

## 📄 License

MIT © 2025 Tantl Labs, Inc.
