"use client"

import { useState, useEffect } from "react"
import { ArrowRight, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
}

export default function ChatPage() {
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")

  useEffect(() => {
    const inputParam = searchParams.get("input")
    
    if (inputParam) {
      const userMessage: Message = {
        id: Date.now().toString(),
        content: inputParam,
        role: "user",
      }
      
      setMessages([userMessage])
      
      // Simulate bot response
      setTimeout(() => {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `I'll help you with "${inputParam}". What specific details would you like me to include?`,
          role: "assistant",
        }
        setMessages((prev) => [...prev, botMessage])
      }, 1000)
    }
  }, [searchParams])

  const handleSend = async () => {
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
        content: `I'll help you with "${input}". Booting things up ...`,
        role: "assistant",
      }
      setMessages((prev) => [...prev, botMessage])
    }, 1000)
    
    // Send POST request to /api/start-task
    try {
      const response = await fetch('/api/start-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: input }),
      });
      
      if (!response.ok) {
        console.error('Failed to start task:', await response.text());
      }
    } catch (error) {
      console.error('Error starting task:', error);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <Link href="/">
            <span className="font-medium">Bytebot</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left side - iframe */}
        <div className="w-3/5 border-r relative">
          <div className="h-full p-4 bg-muted/30 flex flex-col items-center justify-center">
            
          </div>
        </div>

        {/* Right side - chat */}
        <div className="w-2/5 flex flex-col">

          <div className="flex-1 overflow-auto p-4">
            {messages.map((message) => (
              <div key={message.id} className="mb-4">
                {message.role === "assistant" && (
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-primary-foreground text-xs">B</span>
                    </div>
                    <div className="text-sm">{message.content}</div>
                  </div>
                )}
                {message.role === "user" && (
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-3 w-3" />
                    </div>
                    <div className="text-sm">{message.content}</div>
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
                <Button type="submit" variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
