import { All, Controller, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { auth } from './auth';

@Controller('auth')
export class AuthController {
  @All('*')
  async handleAuth(@Req() request: Request, @Res() response: Response) {
    return auth.handler(request, response);
  }
}
