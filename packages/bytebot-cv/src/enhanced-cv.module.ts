import { Module } from '@nestjs/common';
import { TemplateMatcherService } from './detectors/template/template-matcher.service';
import { FeatureMatcherService } from './detectors/feature/feature-matcher.service';
import { ContourDetectorService } from './detectors/contour/contour-detector.service';
import { EnhancedVisualDetectorService } from './services/enhanced-visual-detector.service';
import { CVActivityIndicatorService } from './services/cv-activity-indicator.service';

@Module({
  providers: [
    CVActivityIndicatorService,
    TemplateMatcherService,
    FeatureMatcherService,
    ContourDetectorService,
    EnhancedVisualDetectorService,
  ],
  exports: [
    CVActivityIndicatorService,
    TemplateMatcherService,
    FeatureMatcherService,
    ContourDetectorService,
    EnhancedVisualDetectorService,
  ],
})
export class EnhancedCVModule {}