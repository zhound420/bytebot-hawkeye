<div align="center">

<img src="docs/images/bytebot-logo.png" width="500" alt="Bytebot Logo">

# Bytebot: Open-Source AI Desktop Agent

**An AI that has its own computer to complete tasks for you**

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/bytebot?referralCode=L9lKXQ)
</div>

<details>
<summary><strong>Resources &amp; Translations</strong></summary>

<div align="center">

<a href="https://trendshift.io/repositories/14624" target="_blank"><img src="https://trendshift.io/api/badge/repositories/14624" alt="bytebot-ai%2Fbytebot | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://github.com/bytebot-ai/bytebot/tree/main/docker)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)
[![Discord](https://img.shields.io/discord/1232768900274585720?color=7289da&label=discord)](https://discord.com/invite/d9ewZkWPTP)

[🌐 Website](https://bytebot.ai) • [📚 Documentation](https://docs.bytebot.ai) • [💬 Discord](https://discord.com/invite/d9ewZkWPTP) • [𝕏 Twitter](https://x.com/bytebot_ai)

<!-- Keep these links. Translations will automatically update with the README. -->
[Deutsch](https://zdoc.app/de/bytebot-ai/bytebot) |
[Español](https://zdoc.app/es/bytebot-ai/bytebot) |
[français](https://zdoc.app/fr/bytebot-ai/bytebot) |
[日本語](https://zdoc.app/ja/bytebot-ai/bytebot) |
[한국어](https://zdoc.app/ko/bytebot-ai/bytebot) |
[Português](https://zdoc.app/pt/bytebot-ai/bytebot) |
[Русский](https://zdoc.app/ru/bytebot-ai/bytebot) |
[中文](https://zdoc.app/zh/bytebot-ai/bytebot)

</div>
</details>

---

## Hawkeye Fork Enhancements

The Hawkeye edition layers precision-oriented upgrades on top of upstream Bytebot so the agent can land clicks with far greater reliability:

- **Grid overlay guidance** draws the desktop with 100 px reference lines and labeled axes, giving the model a persistent map before every action, with debug controls exposed through `BYTEBOT_GRID_OVERLAY` and `BYTEBOT_GRID_DEBUG`.
- **Progressive zoom capture** lets the agent request focused screenshots with cyan micro-grids so it can translate local coordinates back into global positions with 100% verified accuracy.
- **Measured accuracy gains** combine the overlay, zoom pipeline, and calibration passes to reach ~70% coordinate precision in testing—check out the full breakdown in [Coordinate Accuracy Improvements](COORDINATE_ACCURACY_IMPROVEMENTS.md).
- **Feature toggles** let you dial these systems back when needed. Set `BYTEBOT_UNIVERSAL_TEACHING`, `BYTEBOT_ADAPTIVE_CALIBRATION`, `BYTEBOT_ZOOM_REFINEMENT`, or `BYTEBOT_COORDINATE_METRICS` to `false` (all default to `true`) to selectively disable overlays, calibration passes, zoom refinement, and telemetry capture. When you need deeper visibility, set `BYTEBOT_COORDINATE_DEBUG=true` to emit sanitized coordinate refinement logs.
- **Universal coordinate mapping** now ships with the repo and the shared workspace package. Services automatically walk up from their working directory (and the bundled copy in `@bytebot/shared`) to locate `config/universal-coordinates.yaml`, so you only need `BYTEBOT_COORDINATE_CONFIG` when pointing at a custom YAML.

### Smart Focus Targeting (Hawkeye Exclusive)

The fork’s Smart Focus workflow narrows attention in three deliberate passes—coarse region selection, focused capture, and final click—so the agent can reason about targets instead of guessing. Enable or tune it with `BYTEBOT_SMART_FOCUS`, `BYTEBOT_OVERVIEW_GRID`, `BYTEBOT_REGION_GRID`, `BYTEBOT_FOCUSED_GRID`, and related knobs documented in [docs/SMART_FOCUS_SYSTEM.md](docs/SMART_FOCUS_SYSTEM.md).

https://github.com/user-attachments/assets/f271282a-27a3-43f3-9b99-b34007fdd169

![Desktop accuracy overlay](docs/images/hawkeye-desktop.png)

## Quick Start: Proxy Compose Stack

The fastest way to try Hawkeye is the proxy-enabled Docker Compose stack—it starts the desktop, agent, UI, Postgres, and LiteLLM proxy with every precision upgrade flipped on. Populate `docker/.env` with your model keys **and** the Hawkeye-specific toggles before you launch:

- `BYTEBOT_GRID_OVERLAY=true` keeps the labeled coordinate grid on every capture.
- `BYTEBOT_PROGRESSIVE_ZOOM_USE_AI=true` enables the multi-zoom screenshot refinement.
- `BYTEBOT_SMART_FOCUS=true` and `BYTEBOT_SMART_FOCUS_MODEL=<litellm-alias>` route Smart Focus through the proxy model you configure in `packages/bytebot-llm-proxy/litellm-config.yaml`.
- `BYTEBOT_COORDINATE_METRICS=true` (plus optional `BYTEBOT_COORDINATE_DEBUG=true`) records the click accuracy telemetry that distinguishes the fork.

```bash
cat <<'EOF' > docker/.env
# Provider keys for LiteLLM
OPENAI_API_KEY=sk-your-key
ANTHROPIC_API_KEY=...

# Hawkeye precision defaults
BYTEBOT_GRID_OVERLAY=true
BYTEBOT_PROGRESSIVE_ZOOM_USE_AI=true
BYTEBOT_SMART_FOCUS=true
BYTEBOT_SMART_FOCUS_MODEL=gpt-4o-mini
BYTEBOT_COORDINATE_METRICS=true
EOF

docker compose -f docker/docker-compose.proxy.yml up -d
```

After editing `packages/bytebot-llm-proxy/litellm-config.yaml` to point at your preferred models, restart `bytebot-llm-proxy` so the new aliases are picked up.

## Alternative Deployments

Looking for a different hosting environment? Follow the upstream guides for the full walkthroughs:

- [Railway one-click template](https://docs.bytebot.ai/deployment/railway)
- [Helm charts for Kubernetes](https://docs.bytebot.ai/deployment/helm)
- [Custom Docker Compose topologies](https://docs.bytebot.ai/deployment/litellm)

## Stay in Sync with Upstream Bytebot

For a full tour of the core desktop agent, installation options, and API surface, follow the upstream README and docs. Hawkeye inherits everything there—virtual desktop orchestration, task APIs, and deployment guides—so this fork focuses documentation on the precision tooling and measurement upgrades described above.

## Further Reading

- [Bytebot upstream README](https://github.com/bytebot-ai/bytebot#readme)
- [Quickstart guide](https://docs.bytebot.ai/quickstart)
- [API reference](https://docs.bytebot.ai/api-reference/introduction)

## Operations & Tuning

### Smart Click Success Radius

Smart click telemetry now records the real cursor landing position. Tune the pass/fail threshold by setting an environment variable on the desktop daemon:

```bash
export BYTEBOT_SMART_CLICK_SUCCESS_RADIUS=12  # pixels of acceptable drift
```

Increase the value if the VNC stream or hardware introduces more cursor drift, or decrease it to tighten the definition of a successful AI-guided click.
