import { Controller, Get, Redirect } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // When a client makes a GET request to /vnc,
  // this method will automatically redirect them to the noVNC URL.
  @Get('vnc')
  @Redirect('/novnc/vnc.html?path=websockify&resize=scale', 302)
  redirectToVnc(): void {
    // This method is intentionally left empty.
    // The @Redirect decorator will automatically redirect the client.
  }
}
