import React from 'react';
import Link from 'next/link';
// import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

// interface HeaderProps {
//   currentTaskId?: string | null;
//   onNewConversation?: () => void;
// }

export function Header() {
  return (
    <header className="flex items-center justify-between p-4 border-b bg-background">
      <div className="flex items-center gap-2">
        <Link href="/">
          <span className="font-medium">Bytebot</span>
        </Link>
      </div>
      <div className="flex items-center gap-3">
        {/* {currentTaskId && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={onNewConversation}
            className="mr-2"
          >
            New Conversation
          </Button>
        )} */}
        <ThemeToggle />
      </div>
    </header>
  );
}
