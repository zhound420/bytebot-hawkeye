import { WebSocketServer, WebSocket } from 'ws';

interface ProgressMessage {
  taskId: string;
  step: number;
  description: string;
  screenshot?: string;
  coordinates?: { x: number; y: number };
}

export class ProgressBroadcaster {
  private readonly wss: WebSocketServer;

  constructor(
    private readonly port: number = Number(
      process.env.BYTEBOT_PROGRESS_PORT ?? 8081,
    ),
  ) {
    this.wss = new WebSocketServer({ port: this.port });
    console.log(`Progress broadcaster running on ws://localhost:${this.port}`);
  }

  broadcastStep(data: ProgressMessage): void {
    const message = JSON.stringify({
      type: 'progress',
      timestamp: new Date().toISOString(),
      ...data,
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}
