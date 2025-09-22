import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ComputerAction, ComputerActionResult } from '@bytebot/shared';
import { ComputerUseCommandQueue } from './computer-use.queue';

interface ComputerActionRequest {
  id?: string;
  action: ComputerAction;
}

@Injectable()
@WebSocketGateway({
  namespace: 'computer-use',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class ComputerUseGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ComputerUseGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly commandQueue: ComputerUseCommandQueue) {}

  handleConnection(client: Socket) {
    this.logger.log(`Computer use client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Computer use client disconnected: ${client.id}`);
    this.commandQueue.clearClient(client.id);
  }

  @SubscribeMessage('computerAction')
  async handleComputerAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ComputerActionRequest,
  ): Promise<void> {
    if (!payload || !payload.action) {
      client.emit('computerActionResult', {
        id: payload?.id ?? '',
        action: payload?.action?.action ?? 'unknown',
        status: 'error',
        error: {
          message: 'Invalid computer action payload',
        },
      } satisfies ComputerActionResult);
      return;
    }

    let requestId: string | undefined;

    try {
      const { id, result } = this.commandQueue.enqueue(payload.action, {
        clientId: client.id,
        requestId: payload.id,
      });
      requestId = id;

      const resolution = await result;

      if (client.disconnected) {
        this.logger.warn(
          `Dropping computer action result ${resolution.id} for disconnected client ${client.id}`,
        );
        return;
      }

      client.emit('computerActionResult', resolution);
    } catch (error) {
      if (!client.disconnected) {
        client.emit('computerActionResult', {
          id: payload?.id ?? requestId ?? '',
          action: payload?.action?.action ?? 'unknown',
          status: 'error',
          error: {
            message: (error as Error).message,
          },
        } satisfies ComputerActionResult);
      }
    }
  }
}
