import * as path from 'node:path';

import { resolveConfigPath } from '@bytebot/shared/config/universalCoordinates';

describe('Universal coordinate config discovery', () => {
  const originalOverride = process.env.BYTEBOT_COORDINATE_CONFIG;

  beforeEach(() => {
    delete process.env.BYTEBOT_COORDINATE_CONFIG;
  });

  afterAll(() => {
    if (originalOverride === undefined) {
      delete process.env.BYTEBOT_COORDINATE_CONFIG;
    } else {
      process.env.BYTEBOT_COORDINATE_CONFIG = originalOverride;
    }
  });

  it('resolves the repository-level YAML without requiring BYTEBOT_COORDINATE_CONFIG', () => {
    const resolvedPath = resolveConfigPath();
    const expectedPath = path.resolve(
      __dirname,
      '../../../../config/universal-coordinates.yaml',
    );

    expect(resolvedPath).toBe(expectedPath);
  });
});
