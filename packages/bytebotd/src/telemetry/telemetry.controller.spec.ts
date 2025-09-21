import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

describe('TelemetryController', () => {
  it('passes trimmed session from request body to resetAll', async () => {
    const resetAll = jest.fn().mockResolvedValue(undefined);
    const telemetry = {
      resetAll,
    } as unknown as TelemetryService;

    const controller = new TelemetryController(telemetry);

    await controller.reset(undefined, '  session-from-body  ');

    expect(resetAll).toHaveBeenCalledWith('session-from-body');
  });
});
