jest.mock('@nut-tree-fork/nut-js', () => {
  const pressKeyMock = jest.fn().mockResolvedValue(undefined);
  const releaseKeyMock = jest.fn().mockResolvedValue(undefined);

  return {
    keyboard: {
      config: { autoDelayMs: 0 },
      pressKey: pressKeyMock,
      releaseKey: releaseKeyMock,
    },
    mouse: {
      config: { autoDelayMs: 0 },
      click: jest.fn(),
      setPosition: jest.fn(),
    },
    screen: {},
    Point: class {},
    Key: {
      Enter: 'Enter',
      LeftShift: 'LeftShift',
    },
    Button: {},
    FileType: {},
  };
});

import { NutService } from './nut.service';
import { Key, keyboard } from '@nut-tree-fork/nut-js';

type MockedKeyboard = {
  config: { autoDelayMs: number };
  pressKey: jest.Mock<Promise<void>, any>;
  releaseKey: jest.Mock<Promise<void>, any>;
};

const keyboardMock = keyboard as unknown as MockedKeyboard;

describe('NutService', () => {
  let service: NutService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NutService();
  });

  it("maps a newline character to the Enter key", () => {
    const keyInfo = (service as any).charToKeyInfo('\n');
    expect(keyInfo).toEqual({ keyCode: Key.Enter, withShift: false });
  });

  it('maps a carriage return character to the Enter key', () => {
    const keyInfo = (service as any).charToKeyInfo('\r');
    expect(keyInfo).toEqual({ keyCode: Key.Enter, withShift: false });
  });

  it('presses Enter when typing a newline', async () => {
    await service.typeText('\n');

    expect(keyboardMock.pressKey).toHaveBeenCalledTimes(1);
    expect(keyboardMock.pressKey).toHaveBeenCalledWith(Key.Enter);
    expect(keyboardMock.releaseKey).toHaveBeenCalledTimes(1);
    expect(keyboardMock.releaseKey).toHaveBeenCalledWith(Key.Enter);
  });

  it('types Windows-style newlines only once', async () => {
    await service.typeText('\r\n');

    expect(keyboardMock.pressKey).toHaveBeenCalledTimes(1);
    expect(keyboardMock.pressKey).toHaveBeenCalledWith(Key.Enter);
    expect(keyboardMock.releaseKey).toHaveBeenCalledTimes(1);
    expect(keyboardMock.releaseKey).toHaveBeenCalledWith(Key.Enter);
  });
});
