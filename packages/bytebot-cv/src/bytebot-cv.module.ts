import { Module } from '@nestjs/common';
import { ElementDetectorService } from './services/element-detector.service';
import { UniversalDetectorService } from './services/universal-detector.service';
import { VisualPatternDetectorService } from './services/visual-pattern-detector.service';
import { TextSemanticAnalyzerService } from './services/text-semantic-analyzer.service';

@Module({
  providers: [
    VisualPatternDetectorService,
    TextSemanticAnalyzerService,
    UniversalDetectorService,
    ElementDetectorService,
  ],
  exports: [ElementDetectorService, UniversalDetectorService],
})
export class BytebotCvModule {}
