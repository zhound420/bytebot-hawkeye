declare module '@modelcontextprotocol/sdk' {
  export interface MCPServerOptions {
    name: string;
    description: string;
    version?: string;
  }

  export interface AttachOptions {
    path: string;
  }

  export class MCPServer {
    constructor(options: MCPServerOptions);
    addTool(tool: any): void;
    addResource(resource: any): void;
    listen(port: number): Promise<void>;
    attachToHttpServer(server: any, options: AttachOptions): Promise<void>;
    close(): Promise<void>;
  }

  export interface ToolConfig {
    name: string;
    description: string;
    inputSchema: any;
    handler: (input: any) => Promise<any>;
  }

  export function createTool(config: ToolConfig): any;

  export interface ResourceConfig {
    uri: string;
    schema: any;
    handler: () => Promise<any>;
  }
}
