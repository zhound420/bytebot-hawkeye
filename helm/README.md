# Bytebot Helm Charts

This directory contains Helm charts for deploying Bytebot on Kubernetes.

## Structure

```
helm/
├── Chart.yaml              # Main chart definition
├── values.yaml             # Default configuration values
├── templates/              # Kubernetes manifests templates
│   ├── NOTES.txt          # Post-installation notes
│   └── ingress.yaml       # Optional ingress configuration
└── charts/                 # Individual service charts
    ├── bytebot-desktop/    # Desktop VNC service
    ├── bytebot-agent/      # Backend API service
    ├── bytebot-ui/         # Frontend UI service
    └── postgresql/         # PostgreSQL database

```

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- PV provisioner support (for PostgreSQL persistence)

## Installation

1. **Add required Helm repositories** (for PostgreSQL dependency):
   ```bash
   helm repo add bitnami https://charts.bitnami.com/bitnami
   helm repo update
   ```

2. **Standard Installation** (API keys on agent):
   ```bash
   cd helm
   helm dependency update
   helm install bytebot . --namespace bytebot --create-namespace \
     --set bytebot-agent.env.ANTHROPIC_API_KEY="your-api-key" \
     --set bytebot-agent.env.OPENAI_API_KEY="your-api-key" \
     --set bytebot-agent.env.GEMINI_API_KEY="your-api-key"
   ```

3. **Installation with LiteLLM Proxy** (recommended for production):
   ```bash
   cd helm
   helm dependency update
   helm install bytebot . -f values-proxy.yaml \
     --namespace bytebot \
     --create-namespace \
     --set bytebot-llm-proxy.env.ANTHROPIC_API_KEY="your-api-key" \
     --set bytebot-llm-proxy.env.OPENAI_API_KEY="your-api-key" \
     --set bytebot-llm-proxy.env.GEMINI_API_KEY="your-api-key"
   ```

   The proxy setup provides:
   - Centralized API key management
   - Request routing and load balancing
   - Rate limiting and retry logic
   - Support for multiple LLM providers

## Configuration

### Key Configuration Options

| Parameter | Description | Default |
|-----------|-------------|---------|
| `postgresql.enabled` | Enable PostgreSQL subchart | `true` |
| `postgresql.auth.password` | PostgreSQL password | `postgres` |
| `postgresql.auth.database` | PostgreSQL database name | `bytebotdb` |
| `bytebot-desktop.image.tag` | Desktop service image tag | `edge` |
| `bytebot-agent.env.ANTHROPIC_API_KEY` | Anthropic API key (standard mode) | `""` |
| `bytebot-agent.env.OPENAI_API_KEY` | OpenAI API key (standard mode) | `""` |
| `bytebot-agent.env.GEMINI_API_KEY` | Gemini API key (standard mode) | `""` |
| `bytebot-llm-proxy.enabled` | Enable LiteLLM proxy | `false` |
| `bytebot-llm-proxy.env.ANTHROPIC_API_KEY` | Anthropic API key (proxy mode) | `""` |
| `bytebot-llm-proxy.env.OPENAI_API_KEY` | OpenAI API key (proxy mode) | `""` |
| `bytebot-llm-proxy.env.GEMINI_API_KEY` | Gemini API key (proxy mode) | `""` |
| `bytebot-ui.service.type` | UI service type | `ClusterIP` |
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.host` | Ingress hostname | `bytebot.example.com` |

### Using External PostgreSQL

To use an external PostgreSQL database instead of the included one:

```yaml
postgresql:
  enabled: false

bytebot-agent:
  externalDatabase:
    host: "your-postgres-host"
    port: 5432
    database: "bytebotdb"
    username: "postgres"
    password: "your-password"
```

### Exposing Services

#### Using LoadBalancer:
```yaml
bytebot-ui:
  service:
    type: LoadBalancer
```

#### Using Ingress:
```yaml
ingress:
  enabled: true
  className: "nginx"
  host: bytebot.yourdomain.com
  tls:
    enabled: true
    secretName: bytebot-tls
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
```

## Accessing Bytebot

After installation, follow the notes displayed by Helm or use:

```bash
helm status bytebot -n bytebot
```

### Port Forwarding (for local access):

```bash
# All services at once
kubectl port-forward -n bytebot svc/bytebot-ui 9992:9992 &
kubectl port-forward -n bytebot svc/bytebot-agent 9991:9991 &
kubectl port-forward -n bytebot svc/bytebot-desktop 9990:9990 &

# If using LiteLLM proxy, also forward:
kubectl port-forward -n bytebot svc/bytebot-llm-proxy 4000:4000 &
```

Then access:
- UI: http://localhost:9992
- Agent API: http://localhost:9991
- Desktop VNC: http://localhost:9990
- LiteLLM Proxy (if enabled): http://localhost:4000

## Upgrading

```bash
helm upgrade bytebot . -n bytebot
```

## Uninstalling

```bash
helm uninstall bytebot -n bytebot
```

## Troubleshooting

1. **Check pod status**:
   ```bash
   kubectl get pods -n bytebot
   ```

2. **View logs**:
   ```bash
   kubectl logs -n bytebot deployment/bytebot-agent
   ```

3. **Describe resources**:
   ```bash
   kubectl describe pod -n bytebot <pod-name>
   ```

## Deployment Modes

### Standard Mode
In standard mode, API keys are configured directly on the agent service. This is simpler but requires updating the agent deployment to change API keys.

### Proxy Mode (Recommended)
In proxy mode, the LiteLLM proxy handles all LLM API calls. Benefits include:
- Centralized API key management
- Easy switching between LLM providers
- Built-in rate limiting and retry logic
- Request logging and monitoring capabilities

To switch from standard to proxy mode:
```bash
helm upgrade bytebot . -f values-proxy.yaml -n bytebot \
  --set bytebot-llm-proxy.env.ANTHROPIC_API_KEY="your-key" \
  --set bytebot-llm-proxy.env.OPENAI_API_KEY="your-key" \
  --set bytebot-llm-proxy.env.GEMINI_API_KEY="your-key"
```

## Individual Chart Usage

Each service can also be deployed independently:

```bash
# Deploy only the desktop service
helm install bytebot-desktop ./charts/bytebot-desktop

# Deploy only the agent service
helm install bytebot-agent ./charts/bytebot-agent

# Deploy only the LiteLLM proxy
helm install bytebot-llm-proxy ./charts/bytebot-llm-proxy
```