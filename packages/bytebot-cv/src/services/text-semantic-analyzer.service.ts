import { Injectable, Logger } from '@nestjs/common';

export type SemanticRole =
  | 'submit'
  | 'cancel'
  | 'search'
  | 'delete'
  | 'edit'
  | 'help'
  | 'unknown';

type BoundsLike = { x: number; y: number; width: number; height: number };

type DescribeElement = {
  type: string;
  text?: string;
  bounds: BoundsLike;
  semanticRole?: SemanticRole;
};

@Injectable()
export class TextSemanticAnalyzerService {
  private readonly logger = new Logger(TextSemanticAnalyzerService.name);

  analyzeSemanticRole(text: string | undefined | null): SemanticRole {
    if (!text) {
      return 'unknown';
    }

    const normalizedText = text.toLowerCase().trim();
    if (!normalizedText) {
      return 'unknown';
    }

    const patterns: Record<Exclude<SemanticRole, 'unknown'>, RegExp> = {
      submit: /\b(submit|ok|apply|save|confirm|continue|next|install|download|add|enable|get)\b/,
      cancel: /\b(cancel|close|dismiss|abort|back|previous|exit|quit)\b/,
      search: /\b(search|find|filter|lookup|go)\b/,
      delete: /\b(delete|remove|uninstall|clear|trash)\b/,
      edit: /\b(edit|modify|change|update|settings|preferences)\b/,
      help: /\b(help|about|info|documentation|support)\b/,
    };

    for (const [role, pattern] of Object.entries(patterns)) {
      if (pattern.test(normalizedText)) {
        return role as SemanticRole;
      }
    }

    return 'unknown';
  }

  generateDescription(element: DescribeElement): string {
    const { type, text, bounds, semanticRole } = element;
    const role = semanticRole ?? 'unknown';

    let description = type;

    if (text) {
      description += ` with text "${text}"`;
    }

    if (role !== 'unknown') {
      description += ` (${role} action)`;
    }

    description += ` at position (${bounds.x}, ${bounds.y})`;

    return description;
  }

  isClickableText(text: string | undefined | null): boolean {
    if (!text) {
      return false;
    }

    const clickablePatterns = /\b(click|press|select|choose|open|view|download|install|buy|order|submit|login|register|sign|join)\b/i;
    return clickablePatterns.test(text);
  }
}
