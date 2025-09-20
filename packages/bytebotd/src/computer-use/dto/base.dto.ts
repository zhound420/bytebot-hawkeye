import { IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CoordinatesDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

export enum ButtonType {
  LEFT = 'left',
  RIGHT = 'right',
  MIDDLE = 'middle',
}

export enum PressType {
  UP = 'up',
  DOWN = 'down',
}

export enum ScrollDirection {
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',
}

export enum ApplicationName {
  FIREFOX = 'firefox',
  ONEPASSWORD = '1password',
  THUNDERBIRD = 'thunderbird',
  VSCODE = 'vscode',
  TERMINAL = 'terminal',
  DESKTOP = 'desktop',
  DIRECTORY = 'directory',
}

export enum ClickSourceType {
  MANUAL = 'manual',
  SMART_FOCUS = 'smart_focus',
  PROGRESSIVE_ZOOM = 'progressive_zoom',
  BINARY_SEARCH = 'binary_search',
}

export class RegionDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;
}

export class ClickContextDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => RegionDto)
  region?: RegionDto;

  @IsOptional()
  @IsNumber()
  zoomLevel?: number;

  @IsOptional()
  @IsString()
  targetDescription?: string;

  @IsOptional()
  @IsIn(Object.values(ClickSourceType))
  source?: ClickSourceType;
}
