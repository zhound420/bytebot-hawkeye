# Computer Vision UI Integration Guide

This document explains how to integrate the enhanced OpenCV capabilities with the ByteBot UI to show active CV methods as requested.

## Overview

The enhanced CV system includes:
- **TemplateMatcherService**: Multi-scale template matching for UI elements
- **FeatureMatcherService**: ORB/AKAZE feature matching for robust element detection
- **ContourDetectorService**: Shape-based UI element detection
- **EnhancedVisualDetectorService**: Orchestrates all CV methods
- **CVActivityIndicatorService**: Real-time tracking of CV method usage

## API Endpoints

The `CVActivityController` provides these endpoints for UI integration:

### GET `/cv-activity/status`
Returns current CV activity snapshot:
```json
{
  "activeMethods": ["template-matching", "contour-detection"],
  "totalActiveCount": 2,
  "methodDetails": {
    "template-matching_1234567_abc123": {
      "method": "template-matching",
      "active": true,
      "startTime": 1640995200000,
      "metadata": {
        "threshold": 0.8,
        "scaleFactors": [1.0, 0.8, 1.2]
      }
    }
  },
  "performance": {
    "averageProcessingTime": 125,
    "totalMethodsExecuted": 45,
    "successRate": 0.87
  }
}
```

### GET `/cv-activity/active`
Quick check for active methods:
```json
{
  "active": true,
  "activeCount": 2,
  "activeMethods": ["template-matching", "contour-detection"]
}
```

### SSE `/cv-activity/stream`
Real-time updates via Server-Sent Events:
```javascript
const eventSource = new EventSource('/cv-activity/stream');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateCVIndicator(data);
};
```

## UI Implementation Options

### Option 1: Activity Indicator Badge
Show a small badge in the UI corner when CV methods are active:

```tsx
interface CVIndicatorProps {
  activity: CVActivitySnapshot;
}

const CVActivityIndicator: React.FC<CVIndicatorProps> = ({ activity }) => {
  if (activity.totalActiveCount === 0) return null;

  return (
    <div className="fixed top-4 right-4 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg">
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        <span className="text-sm font-medium">
          CV Active ({activity.totalActiveCount})
        </span>
      </div>
      <div className="text-xs mt-1">
        {activity.activeMethods.join(', ')}
      </div>
    </div>
  );
};
```

### Option 2: Detailed CV Status Panel
Expandable panel showing method details:

```tsx
const CVStatusPanel: React.FC = () => {
  const [activity, setActivity] = useState<CVActivitySnapshot | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource('/cv-activity/stream');
    eventSource.onmessage = (event) => {
      setActivity(JSON.parse(event.data));
    };
    return () => eventSource.close();
  }, []);

  if (!activity || activity.totalActiveCount === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white border rounded-lg shadow-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center p-3 w-full text-left"
      >
        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-3" />
        <span className="font-medium">Computer Vision</span>
        <span className="ml-2 text-sm text-gray-500">
          ({activity.totalActiveCount} active)
        </span>
      </button>

      {isExpanded && (
        <div className="border-t p-3 space-y-2">
          {activity.activeMethods.map(method => (
            <div key={method} className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span className="text-sm capitalize">
                {method.replace('-', ' ')}
              </span>
            </div>
          ))}
          <div className="pt-2 border-t text-xs text-gray-500">
            Avg: {activity.performance.averageProcessingTime.toFixed(0)}ms
            • Success: {(activity.performance.successRate * 100).toFixed(0)}%
          </div>
        </div>
      )}
    </div>
  );
};
```

### Option 3: Progress Bar Integration
Show CV progress in existing UI progress bars:

```tsx
const TaskProgressWithCV: React.FC<{ taskProgress: number }> = ({ taskProgress }) => {
  const [cvActive, setCvActive] = useState(false);

  useEffect(() => {
    const checkCV = () => {
      fetch('/cv-activity/active')
        .then(res => res.json())
        .then(data => setCvActive(data.active));
    };

    const interval = setInterval(checkCV, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span>Task Progress</span>
        {cvActive && (
          <span className="text-xs text-blue-600 flex items-center">
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse mr-1" />
            CV Processing
          </span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-colors ${
            cvActive ? 'bg-blue-600' : 'bg-green-600'
          }`}
          style={{ width: `${taskProgress}%` }}
        />
      </div>
    </div>
  );
};
```

## Integration with ByteBot Agent

### 1. Import Enhanced CV Module
Add to your agent module:

```typescript
import { EnhancedCVModule } from '@bytebot/cv/enhanced-cv.module';
import { CVActivityController } from './computer-vision/cv-activity.controller';

@Module({
  imports: [EnhancedCVModule],
  controllers: [CVActivityController],
})
export class AgentModule {}
```

### 2. Use Enhanced Detection
Replace basic CV detection with enhanced methods:

```typescript
@Injectable()
export class ComputerUseService {
  constructor(
    private readonly enhancedDetector: EnhancedVisualDetectorService,
    private readonly cvActivity: CVActivityIndicatorService,
  ) {}

  async findUIElement(screenshot: Buffer, target: string) {
    // The enhanced detector automatically tracks activity
    const result = await this.enhancedDetector.detectElements(
      this.decodeScreenshot(screenshot),
      null, // No template for general detection
      {
        useContourDetection: true,
        useOCR: true,
        useTemplateMatching: false,
        useFeatureMatching: false,
        maxResults: 10
      }
    );

    return result.elements.find(el =>
      el.text?.toLowerCase().includes(target.toLowerCase())
    );
  }
}
```

### 3. Add WebSocket Events (Optional)
For real-time UI updates:

```typescript
@Injectable()
export class CVActivityGateway {
  constructor(private readonly cvActivity: CVActivityIndicatorService) {
    // Listen for CV activity events
    cvActivity.on('methodStarted', (event) => {
      this.broadcast('cv-method-started', event);
    });

    cvActivity.on('methodCompleted', (event) => {
      this.broadcast('cv-method-completed', event);
    });
  }

  private broadcast(event: string, data: any) {
    // Emit to WebSocket clients
    // Implementation depends on your WebSocket setup
  }
}
```

## Performance Considerations

1. **Polling Frequency**: Don't poll CV status too frequently (1-2 second intervals)
2. **UI Updates**: Debounce UI updates to avoid flickering
3. **Memory**: Clean up EventSource connections when components unmount
4. **Caching**: Cache CV performance data to reduce API calls

## Testing CV Integration

Use the CV activity service in development:

```typescript
// Start some CV activity for testing
const activityId = cvActivityService.startMethod('template-matching', {
  threshold: 0.8
});

// Simulate processing time
setTimeout(() => {
  cvActivityService.stopMethod(activityId, true, { matches: 3 });
}, 2000);
```

This integration provides users with clear visibility into when and which computer vision methods are actively processing their requests, meeting the requirement for "UI indicators for active CV methods."