import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

export function ChatInput({ input, isLoading, onInputChange, onSend }: ChatInputProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend();
  };

  return (
    <div className="p-2">
      <form onSubmit={handleSubmit} className="relative">
        <Input
          placeholder="Ask me to do something..."
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          className="w-full py-3 px-4 pr-10 rounded-md"
          disabled={isLoading}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
          ) : (
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="rounded-full"
              disabled={isLoading}
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
