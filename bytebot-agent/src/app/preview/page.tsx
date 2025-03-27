"use client"

import { useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Code,
  Expand,
  Home,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  RefreshCw,
  Settings,
  User,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
}

export default function PreviewPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "New chat started from template",
      role: "assistant",
    },
    {
      id: "2",
      content: "Components",
      role: "assistant",
    },
  ])
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (!input.trim()) return

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")

    // Simulate bot response
    setTimeout(() => {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `I'll help you with "${input}". What specific details would you like me to include?`,
        role: "assistant",
      }
      setMessages((prev) => [...prev, botMessage])
    }, 1000)
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-2">
          <span className="font-medium">Glow menu component</span>
          <Lock className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div className="flex items-center border rounded-md">
            <Button variant="ghost" className="rounded-r-none border-r">
              Preview
            </Button>
            <Button variant="ghost" className="rounded-l-none">
              <Code className="h-4 w-4 mr-1" />
              Code
            </Button>
          </div>
          <Button className="bg-black text-white hover:bg-black/90">Deploy</Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left side - iframe */}
        <div className="w-3/5 border-r relative">
          <div className="flex items-center justify-between p-2 border-b">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Separator orientation="vertical" className="h-4" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Expand className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="h-full p-4 bg-gray-50 flex flex-col items-center justify-center">
            {/* Sample content for the iframe */}
            <div className="flex items-center justify-center gap-4 p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center space-x-2">
                <Switch id="theme-mode" />
                <span className="text-sm text-gray-500">Dark mode</span>
              </div>
            </div>

            <div className="mt-8 bg-white p-6 rounded-lg shadow-md w-full max-w-md">
              <div className="flex justify-center mb-6">
                <div className="flex items-center gap-4">
                  <Button variant="outline" className="rounded-full">
                    <Home className="h-5 w-5" />
                  </Button>
                  <Button variant="outline" className="rounded-full">
                    <MessageSquare className="h-5 w-5" />
                  </Button>
                  <Button variant="outline" className="rounded-full">
                    <Settings className="h-5 w-5" />
                  </Button>
                  <Button variant="outline" className="rounded-full">
                    <User className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <div className="text-center text-sm text-gray-500">Preview of the glow menu component</div>
            </div>
          </div>
        </div>

        {/* Right side - chat */}
        <div className="w-2/5 flex flex-col">
          <div className="flex items-center p-2 border-b">
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm">v0</span>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {messages.map((message, index) => (
              <div key={message.id} className="mb-4">
                {message.role === "assistant" && (
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-black flex items-center justify-center">
                      <span className="text-white text-xs">v0</span>
                    </div>
                    <div className="text-sm">{message.content}</div>
                  </div>
                )}
                {message.role === "user" && (
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="h-3 w-3" />
                    </div>
                    <div className="text-sm">{message.content}</div>
                  </div>
                )}

                {index === 1 && (
                  <div className="ml-8 mt-2 border rounded-md p-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1">
                        <ChevronDown className="h-4 w-4" />
                        <span className="text-sm font-medium">Version 1</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Latest</span>
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Viewing</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {[
                        "components/menu-button.tsx",
                        "app/page.tsx",
                        "app/globals.css",
                        "app/layout.tsx",
                        "components/theme-provider.tsx",
                        "components/theme-toggle.tsx",
                      ].map((file) => (
                        <div key={file} className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-gray-500 text-xs">✓</span>
                          </div>
                          <span className="text-xs">{file}</span>
                          <span className="text-xs text-gray-500 ml-auto">Generated</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="relative"
            >
              <Input
                placeholder="Ask a follow up..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="pr-20 py-6"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button type="submit" variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
            <div className="mt-2 text-xs text-gray-500">v0 may make mistakes. Please use with discretion.</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t p-2 bg-white">
        <div className="flex items-center justify-center gap-8">
          <Button variant="ghost" className="text-gray-500">
            <Home className="h-5 w-5 mr-2" />
            Home
          </Button>
          <Button variant="ghost" className="text-gray-500">
            <MessageSquare className="h-5 w-5 mr-2" />
            Notifications
          </Button>
          <Button variant="ghost" className="text-gray-500">
            <Settings className="h-5 w-5 mr-2" />
            Settings
          </Button>
          <Button variant="ghost" className="text-gray-500">
            <User className="h-5 w-5 mr-2" />
            Profile
          </Button>
        </div>
      </footer>
    </div>
  )
}

