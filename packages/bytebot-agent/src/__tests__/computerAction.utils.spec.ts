import {
  convertScreenshotRegionActionToToolUseBlock,
  convertScreenshotCustomRegionActionToToolUseBlock,
} from '../../../shared/src/utils/computerAction.utils';
import {
  ScreenshotRegionAction,
  ScreenshotCustomRegionAction,
} from '../../../shared/src/types/computerAction.types';

describe('screenshot action converters', () => {
  it('includes source when present for screenshot region actions', () => {
    const actionWithSource: ScreenshotRegionAction = {
      action: 'screenshot_region',
      region: 'middle-center',
      source: 'progressive_zoom',
    };

    const block = convertScreenshotRegionActionToToolUseBlock(
      actionWithSource,
      'test-id'
    );

    expect(block.input).toHaveProperty('source', 'progressive_zoom');

    const actionWithoutSource: ScreenshotRegionAction = {
      action: 'screenshot_region',
      region: 'middle-center',
    };

    const blockWithoutSource = convertScreenshotRegionActionToToolUseBlock(
      actionWithoutSource,
      'test-id-2'
    );

    expect(blockWithoutSource.input).not.toHaveProperty('source');
  });

  it('includes source when present for screenshot custom region actions', () => {
    const actionWithSource: ScreenshotCustomRegionAction = {
      action: 'screenshot_custom_region',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      source: 'smart_focus',
    };

    const block = convertScreenshotCustomRegionActionToToolUseBlock(
      actionWithSource,
      'custom-id'
    );

    expect(block.input).toHaveProperty('source', 'smart_focus');

    const actionWithoutSource: ScreenshotCustomRegionAction = {
      action: 'screenshot_custom_region',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    };

    const blockWithoutSource = convertScreenshotCustomRegionActionToToolUseBlock(
      actionWithoutSource,
      'custom-id-2'
    );

    expect(blockWithoutSource.input).not.toHaveProperty('source');
  });
});
