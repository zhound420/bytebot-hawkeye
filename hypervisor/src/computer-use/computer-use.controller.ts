import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ComputerUseService } from './computer-use.service';

@Controller('computer-use')
export class ComputerUseController {
  private readonly logger = new Logger(ComputerUseController.name);

  constructor(private readonly computerUseService: ComputerUseService) {}

  @Post('key')
  async key(@Body('key') key: string) {
    try {
      return await this.computerUseService.key(key);
    } catch (error) {
      this.logger.error(`Error sending key: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to send key',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('type')
  async type(@Body('text') text: string, @Body('delayMs') delayMs?: number) {
    try {
      return await this.computerUseService.type(text, delayMs);
    } catch (error) {
      this.logger.error(`Error typing text: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to type text',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('mouse-move')
  async mouseMove(@Body('x') x: number, @Body('y') y: number) {
    try {
      return await this.computerUseService.mouse_move(x, y);
    } catch (error) {
      this.logger.error(`Error moving mouse: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to move mouse',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('left-click')
  async leftClick() {
    try {
      return await this.computerUseService.left_click();
    } catch (error) {
      this.logger.error(
        `Error performing left click: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to perform left click',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('left-click-drag')
  async leftClickDrag(
    @Body('startX') startX: number,
    @Body('startY') startY: number,
    @Body('endX') endX: number,
    @Body('endY') endY: number,
    @Body('holdMs') holdMs?: number,
  ) {
    try {
      return await this.computerUseService.left_click_drag(
        startX,
        startY,
        endX,
        endY,
        holdMs,
      );
    } catch (error) {
      this.logger.error(
        `Error performing left click drag: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to perform left click drag',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('right-click')
  async rightClick() {
    try {
      return await this.computerUseService.right_click();
    } catch (error) {
      this.logger.error(
        `Error performing right click: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to perform right click',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('middle-click')
  async middleClick() {
    try {
      return await this.computerUseService.middle_click();
    } catch (error) {
      this.logger.error(
        `Error performing middle click: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to perform middle click',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('double-click')
  async doubleClick(@Body('delayMs') delayMs?: number) {
    try {
      return await this.computerUseService.double_click(delayMs);
    } catch (error) {
      this.logger.error(
        `Error performing double click: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to perform double click',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('scroll')
  async scroll(@Body('amount') amount: number, @Body('axis') axis?: 'v' | 'h') {
    try {
      return await this.computerUseService.scroll(amount, axis);
    } catch (error) {
      this.logger.error(
        `Error performing scroll: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to perform scroll',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('screenshot')
  async screenshot() {
    try {
      return await this.computerUseService.screenshot();
    } catch (error) {
      this.logger.error(
        `Error taking screenshot: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to take screenshot',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('cursor-position')
  async cursorPosition() {
    try {
      return await this.computerUseService.cursor_position();
    } catch (error) {
      this.logger.error(
        `Error getting cursor position: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to get cursor position',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
