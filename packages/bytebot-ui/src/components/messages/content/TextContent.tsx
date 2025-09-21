import React from "react";
import ReactMarkdown from "react-markdown";
import { TextContentBlock } from "@bytebot/shared";

interface TextContentProps {
  block: TextContentBlock;
}

export function TextContent({ block }: TextContentProps) {
  return (
    <div className="mb-3">
      <div className="prose prose-sm max-w-none text-sm text-card-foreground">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="mt-4 mb-2 text-base font-semibold text-card-foreground">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="mt-3 mb-2 text-sm font-semibold text-card-foreground">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="mt-3 mb-1 text-sm font-medium text-card-foreground">
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="mt-2 mb-1 text-sm font-medium text-card-foreground">
                {children}
              </h4>
            ),
            h5: ({ children }) => (
              <h5 className="mt-2 mb-1 text-xs font-medium text-card-foreground">
                {children}
              </h5>
            ),
            h6: ({ children }) => (
              <h6 className="mt-2 mb-1 text-xs font-medium text-card-foreground">
                {children}
              </h6>
            ),
            p: ({ children }) => (
              <p className="mb-2 leading-relaxed">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="mb-2 ml-4 list-disc">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-2 ml-4 list-decimal">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="mb-1 text-sm leading-relaxed">
                {children}
              </li>
            ),
            blockquote: ({ children }) => (
              <blockquote className="mb-2 border-l-4 border-border pl-4 italic text-muted-foreground">
                {children}
              </blockquote>
            ),
            code: ({ children, className }) => {
              const isInline = !className;
              return isInline ? (
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-card-foreground">
                  {children}
                </code>
              ) : (
                <code className="block overflow-x-auto rounded bg-muted p-3 font-mono text-xs text-card-foreground whitespace-pre-wrap">
                  {children}
                </code>
              );
            },
            pre: ({ children }) => (
              <pre className="mb-2 overflow-x-auto rounded border border-border bg-muted p-3">
                {children}
              </pre>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-card-foreground">
                {children}
              </strong>
            ),
            em: ({ children }) => (
              <em className="italic text-muted-foreground">
                {children}
              </em>
            ),
            a: ({ children, href }) => (
              <a
                href={href}
                className="text-primary underline hover:text-primary/80"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
          }}
        >
          {block.text}
        </ReactMarkdown>
      </div>
    </div>
  );
}