import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { UpdateApiKeysDto } from './dto/update-api-keys.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('keys')
  async getApiKeys() {
    const keys = await this.settingsService.getApiKeyMetadata();
    return { keys };
  }

  @Post('keys')
  @HttpCode(200)
  async updateApiKeys(@Body() payload: UpdateApiKeysDto) {
    const keys = await this.settingsService.updateApiKeys(payload);
    return { keys };
  }
}
