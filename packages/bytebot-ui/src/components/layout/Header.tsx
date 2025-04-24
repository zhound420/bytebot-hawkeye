import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";

// Uncommenting interface if needed in the future
// interface HeaderProps {
//   currentTaskId?: string | null;
//   onNewConversation?: () => void;
// }

export function Header() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // After mounting, we can safely show the theme-dependent content
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="flex items-center justify-between p-4 border-b bg-background">
      <div className="flex items-center gap-2">
        <Link href="/">
          {mounted ? (
            <Image
              src={
                resolvedTheme === "dark"
                  ? "/bytebot_transparent_logo_white.svg"
                  : "/bytebot_transparent_logo_dark.svg"
              }
              alt="Bytebot Logo"
              width={100}
              height={30}
              className="h-8 w-auto"
            />
          ) : (
            <div className="h-10 w-[100px]" />
          )}
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
      </div>
    </header>
  );
}
