import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsArray,
  Min,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ButtonType,
  CoordinatesDto,
  PressType,
  ScrollDirection,
  ApplicationName,
  ClickContextDto,
} from './base.dto';

/**
 * Base class for action DTOs with common validation decorator
 */
abstract class BaseActionDto {
  abstract action: string;
}

export class MoveMouseActionDto extends BaseActionDto {
  @IsIn(['move_mouse'])
  action: 'move_mouse';

  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates: CoordinatesDto;
}

export class TraceMouseActionDto extends BaseActionDto {
  @IsIn(['trace_mouse'])
  action: 'trace_mouse';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoordinatesDto)
  path: CoordinatesDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  holdKeys?: string[];
}

export class ClickMouseActionDto extends BaseActionDto {
  @IsIn(['click_mouse'])
  action: 'click_mouse';

  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;

  @IsEnum(ButtonType)
  button: ButtonType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  holdKeys?: string[];

  @IsNumber()
  @Min(1)
  clickCount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ClickContextDto)
  context?: ClickContextDto;
}

export class PressMouseActionDto extends BaseActionDto {
  @IsIn(['press_mouse'])
  action: 'press_mouse';

  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;

  @IsEnum(ButtonType)
  button: ButtonType;

  @IsEnum(PressType)
  press: PressType;
}

export class DragMouseActionDto extends BaseActionDto {
  @IsIn(['drag_mouse'])
  action: 'drag_mouse';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoordinatesDto)
  path: CoordinatesDto[];

  @IsEnum(ButtonType)
  button: ButtonType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  holdKeys?: string[];
}

export class ScrollActionDto extends BaseActionDto {
  @IsIn(['scroll'])
  action: 'scroll';

  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;

  @IsEnum(ScrollDirection)
  direction: ScrollDirection;

  @IsNumber()
  @Min(1)
  scrollCount: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  holdKeys?: string[];
}

export class TypeKeysActionDto extends BaseActionDto {
  @IsIn(['type_keys'])
  action: 'type_keys';

  @IsArray()
  @IsString({ each: true })
  keys: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  delay?: number;
}

export class PressKeysActionDto extends BaseActionDto {
  @IsIn(['press_keys'])
  action: 'press_keys';

  @IsArray()
  @IsString({ each: true })
  keys: string[];

  @IsEnum(PressType)
  press: PressType;
}

export class TypeTextActionDto extends BaseActionDto {
  @IsIn(['type_text'])
  action: 'type_text';

  @IsString()
  text: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  delay?: number;
}

export class PasteTextActionDto extends BaseActionDto {
  @IsIn(['paste_text'])
  action: 'paste_text';

  @IsString()
  text: string;
}

export class WaitActionDto extends BaseActionDto {
  @IsIn(['wait'])
  action: 'wait';

  @IsNumber()
  @Min(0)
  duration: number;
}

export class MarkTargetDto {
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates: CoordinatesDto;

  @IsOptional()
  @IsString()
  label?: string;
}

export class ScreenshotActionDto extends BaseActionDto {
  @IsIn(['screenshot'])
  action: 'screenshot';

  @IsOptional()
  @IsBoolean()
  gridOverlay?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(5)
  gridSize?: number;

  @IsOptional()
  @IsBoolean()
  highlightRegions?: boolean;

  @IsOptional()
  @IsNumber()
  progressStep?: number;

  @IsOptional()
  @IsString()
  progressMessage?: string;

  @IsOptional()
  @IsString()
  progressTaskId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MarkTargetDto)
  markTarget?: MarkTargetDto;
}

const FocusRegionNames = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const;

type FocusRegionName = (typeof FocusRegionNames)[number];

export class ScreenshotRegionFocusActionDto extends BaseActionDto {
  @IsIn(['screenshot_region'])
  action: 'screenshot_region';

  @IsIn(FocusRegionNames)
  region: FocusRegionName;

  @IsOptional()
  @IsNumber()
  @Min(10)
  gridSize?: number;

  @IsOptional()
  @IsBoolean()
  enhance?: boolean;

  @IsOptional()
  @IsBoolean()
  includeOffset?: boolean;

  @IsOptional()
  @IsBoolean()
  addHighlight?: boolean;

  @IsOptional()
  @IsNumber()
  progressStep?: number;

  @IsOptional()
  @IsString()
  progressMessage?: string;

  @IsOptional()
  @IsString()
  progressTaskId?: string;
}

export class ScreenshotCustomRegionActionDto extends BaseActionDto {
  @IsIn(['screenshot_custom_region'])
  action: 'screenshot_custom_region';

  @IsNumber()
  @Min(0)
  x: number;

  @IsNumber()
  @Min(0)
  y: number;

  @IsNumber()
  @Min(1)
  width: number;

  @IsNumber()
  @Min(1)
  height: number;

  @IsOptional()
  @IsNumber()
  @Min(5)
  gridSize?: number;
}

export class CursorPositionActionDto extends BaseActionDto {
  @IsIn(['cursor_position'])
  action: 'cursor_position';
}

export class ScreenInfoActionDto extends BaseActionDto {
  @IsIn(['screen_info'])
  action: 'screen_info';
}

export class ApplicationActionDto extends BaseActionDto {
  @IsIn(['application'])
  action: 'application';

  @IsEnum(ApplicationName)
  application: ApplicationName;
}

export class WriteFileActionDto extends BaseActionDto {
  @IsIn(['write_file'])
  action: 'write_file';

  @IsString()
  path: string;

  @IsString()
  data: string; // Base64 encoded data
}

export class ReadFileActionDto extends BaseActionDto {
  @IsIn(['read_file'])
  action: 'read_file';

  @IsString()
  path: string;
}

// Union type for all computer actions
export type ComputerActionDto =
  | MoveMouseActionDto
  | TraceMouseActionDto
  | ClickMouseActionDto
  | PressMouseActionDto
  | DragMouseActionDto
  | ScrollActionDto
  | TypeKeysActionDto
  | PressKeysActionDto
  | TypeTextActionDto
  | PasteTextActionDto
  | WaitActionDto
  | ScreenshotActionDto
  | ScreenshotRegionFocusActionDto
  | ScreenshotCustomRegionActionDto
  | CursorPositionActionDto
  | ScreenInfoActionDto
  | ApplicationActionDto
  | WriteFileActionDto
  | ReadFileActionDto;
