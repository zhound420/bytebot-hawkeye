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
    <div>
      <form onSubmit={handleSubmit} className="relative">
        <Input
          placeholder="Ask me to do something..."
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          className="w-full py-1.5 pl-3 pr-10 rounded-md placeholder:text-bytebot-bronze-dark-10 placeholder:text-[13px]"
          disabled={isLoading}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-bytebot-bronze-light-7 border-t-primary" />
          ) : (
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="rounded-sm bg-bytebot-bronze-dark-7 w-6 h-6 hover:bg-bytebot-bronze-dark-6 cursor-pointer"
              disabled={isLoading}
            >
              <ArrowRight className="h-5 w-5 text-white" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
