"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = () => {
    if (!mounted) {
      return;
    }

    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  const isDark = resolvedTheme === "dark";
  const ariaLabel = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      aria-label={ariaLabel}
      aria-pressed={isDark}
      className="relative"
    >
      {mounted ? (
        <>
          <Sun
            aria-hidden="true"
            className={cn(
              "h-5 w-5 transition-transform duration-200",
              isDark ? "scale-0" : "scale-100"
            )}
          />
          <Moon
            aria-hidden="true"
            className={cn(
              "absolute h-5 w-5 transition-transform duration-200",
              isDark ? "scale-100" : "scale-0"
            )}
          />
        </>
      ) : (
        <span className="h-5 w-5" />
      )}
    </Button>
  );
}
