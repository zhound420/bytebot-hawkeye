"use client"

import { useState } from "react"
import {
  ChevronDown,
  Clipboard,
  Code,
  FileText,
  Globe,
  Lightbulb,
  Mic,
  PanelRight,
  PieChart,
  Plus,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
}

export function ChatGPTInterface() {
  const [messages, setMessages] = useState<Message[]>([])
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
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Clipboard className="h-5 w-5" />
          <span className="font-medium">ChatGPT</span>
          <ChevronDown className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="outline" size="sm" className="rounded-full">
              Back to Home
            </Button>
          </Link>
          <Button variant="outline" className="rounded-full">
            Log in
          </Button>
          <Button className="rounded-full bg-black text-white hover:bg-black/90">Sign up</Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center max-w-3xl mx-auto w-full">
            <h1 className="text-4xl font-bold mb-12">What can I help with?</h1>

            {/* Input area */}
            <div className="w-full mb-6">
              <div className="relative w-full">
                <Input
                  placeholder="Ask anything"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-full py-6 px-4 rounded-2xl shadow-sm border-gray-200 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Mic className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 mt-3">
                <Button variant="outline" size="sm" className="rounded-full">
                  <Plus className="h-4 w-4 mr-1" />
                  Attach
                </Button>
                <Button variant="outline" size="sm" className="rounded-full">
                  <Search className="h-4 w-4 mr-1" />
                  Search
                </Button>
                <Button variant="outline" size="sm" className="rounded-full">
                  <PanelRight className="h-4 w-4 mr-1" />
                  Reason
                </Button>
              </div>
            </div>

            {/* Suggestion buttons */}
            <div className="flex flex-wrap justify-center gap-2 max-w-3xl">
              <Button variant="outline" size="sm" className="rounded-full">
                <PieChart className="h-4 w-4 mr-1" />
                Analyze data
              </Button>
              <Button variant="outline" size="sm" className="rounded-full">
                <Lightbulb className="h-4 w-4 mr-1" />
                Get advice
              </Button>
              <Button variant="outline" size="sm" className="rounded-full">
                <Globe className="h-4 w-4 mr-1" />
                Make a plan
              </Button>
              <Button variant="outline" size="sm" className="rounded-full">
                <FileText className="h-4 w-4 mr-1" />
                Summarize text
              </Button>
              <Button variant="outline" size="sm" className="rounded-full">
                <Code className="h-4 w-4 mr-1" />
                Code
              </Button>
              <Button variant="outline" size="sm" className="rounded-full">
                More
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-3xl mx-auto">
            {messages.map((message) => (
              <div key={message.id} className={`mb-6 ${message.role === "assistant" ? "pl-10" : "pr-10"}`}>
                <div className="font-medium mb-1">{message.role === "assistant" ? "ChatGPT" : "You"}</div>
                <div className="text-gray-800">{message.content}</div>
              </div>
            ))}

            <div className="sticky bottom-6 w-full">
              <div className="relative w-full">
                <Input
                  placeholder="Message ChatGPT..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSend()
                    }
                  }}
                  className="w-full py-6 px-4 rounded-2xl shadow-sm border-gray-200 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Mic className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="p-4 text-center text-sm text-gray-500 border-t">
        <p>
          By messaging ChatGPT, you agree to our{" "}
          <a href="#" className="underline">
            Terms
          </a>{" "}
          and have read our{" "}
          <a href="#" className="underline">
            Privacy Policy
          </a>
          .
        </p>
      </footer>
    </div>
  )
}

