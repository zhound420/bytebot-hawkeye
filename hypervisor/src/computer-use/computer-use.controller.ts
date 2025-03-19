import {
  Controller,
  Post,
  Body,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ComputerUseService, ComputerAction } from './computer-use.service';

@Controller('computer-use')
export class ComputerUseController {
  private readonly logger = new Logger(ComputerUseController.name);

  constructor(private readonly computerUseService: ComputerUseService) {}

  @Post('action')
  async action(@Body() params: ComputerAction) {
    try {
      this.logger.log(`Computer action request: ${JSON.stringify(params)}`);
      return await this.computerUseService.action(params);
    } catch (error) {
      this.logger.error(
        `Error executing computer action: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to execute computer action: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
