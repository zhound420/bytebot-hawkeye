"use client"

import { useState } from "react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"
import { useRouter } from "next/navigation"

interface ChatWelcomeProps {
  isHomePage?: boolean
}

export function ChatWelcome({ isHomePage = false }: ChatWelcomeProps) {
  const [input, setInput] = useState("")
  const router = useRouter()

  const handleSend = () => {
    if (!input.trim()) return

    if (isHomePage) {
      setTimeout(() => {
        router.push(`/chat?input=${input}`)
      }, 500)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <span className="font-medium">Bytebot</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center justify-center max-w-3xl mx-auto w-full">
          <h1 className="text-4xl font-bold mb-12">What can I help with?</h1>

          {/* Input area */}
          <div className="w-full mb-6">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="relative w-full"
            >
              <Input
                placeholder="Ask me to do something"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full py-6 px-4 rounded-2xl shadow-sm border-gray-200 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Button type="submit" variant="ghost" size="icon" className="rounded-full">
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 border-t">
        <p>Hello from Bytebot</p>
      </footer>
    </div>
  )
}

