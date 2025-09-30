declare module '@nestjs/common' {
  export class Logger {
    constructor(context?: string);
    log(message: string, context?: string): void;
    warn(message: string, context?: string): void;
    error(message: string, trace?: string, context?: string): void;
    debug(message: string, context?: string): void;
  }

  export interface ModuleMetadata {
    providers?: unknown[];
    exports?: unknown[];
    imports?: unknown[];
    controllers?: unknown[];
  }

  export interface OnModuleInit {
    onModuleInit(): unknown;
  }

  export function Injectable(): ClassDecorator;
  export function Optional(): ParameterDecorator & PropertyDecorator;
  export function Module(metadata?: ModuleMetadata): ClassDecorator;
  export function Controller(prefix?: string): ClassDecorator;
  export function Global(): ClassDecorator;
  export function Get(path?: string): MethodDecorator;
  export function Post(path?: string): MethodDecorator;
  export function Delete(path?: string): MethodDecorator;
  export function HttpCode(status: number): MethodDecorator;
  export function Body(property?: string): ParameterDecorator;
  export function Query(property?: string): ParameterDecorator;
  export function Param(property?: string): ParameterDecorator;
  export function Inject(token: unknown): ParameterDecorator & PropertyDecorator;
  export function forwardRef(fn: () => unknown): { forwardRef: true; module: unknown };
  export const HttpStatus: Record<string, number>;

  export class HttpException extends Error {
    constructor(response: unknown, status?: number);
    getStatus(): number;
  }
  export class NotFoundException extends HttpException {}
  export class BadRequestException extends HttpException {}
  export class InternalServerErrorException extends HttpException {}
  export class UnauthorizedException extends HttpException {}

}
