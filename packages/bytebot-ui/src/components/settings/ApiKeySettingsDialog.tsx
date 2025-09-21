"use client"

import { useEffect, useMemo, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { HugeiconsIcon } from "@hugeicons/react"
import { CloseCircleIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  type ApiKeyMetadataMap,
  type ApiKeyName,
  fetchApiKeyMetadata,
  updateApiKeys,
} from "@/utils/settingsUtils"

const API_KEY_FIELDS: { name: ApiKeyName; label: string; description: string }[] = [
  {
    name: "ANTHROPIC_API_KEY",
    label: "Anthropic API Key",
    description: "Used for Claude-based Bytebot agents.",
  },
  {
    name: "OPENAI_API_KEY",
    label: "OpenAI API Key",
    description: "Enables GPT models inside Bytebot.",
  },
  {
    name: "GEMINI_API_KEY",
    label: "Gemini API Key",
    description: "Needed for Google Gemini integrations.",
  },
  {
    name: "OPENROUTER_API_KEY",
    label: "OpenRouter API Key",
    description: "Allows routing requests through OpenRouter.",
  },
]

export interface ApiKeySettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ApiKeySettingsDialog({
  open,
  onOpenChange,
}: ApiKeySettingsDialogProps) {
  const [metadata, setMetadata] = useState<ApiKeyMetadataMap | null>(null)
  const [formValues, setFormValues] = useState<Record<ApiKeyName, string>>({
    ANTHROPIC_API_KEY: "",
    OPENAI_API_KEY: "",
    GEMINI_API_KEY: "",
    OPENROUTER_API_KEY: "",
  })
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    let isMounted = true

    async function loadMetadata() {
      setFetching(true)
      setError(null)
      setSuccess(null)

      const data = await fetchApiKeyMetadata()

      if (isMounted) {
        setMetadata(data)
        setFetching(false)
        setFormValues({
          ANTHROPIC_API_KEY: "",
          OPENAI_API_KEY: "",
          GEMINI_API_KEY: "",
          OPENROUTER_API_KEY: "",
        })
      }
    }

    void loadMetadata()

    return () => {
      isMounted = false
    }
  }, [open])

  const placeholderByKey = useMemo(() => {
    if (!metadata) return {}

    return Object.fromEntries(
      API_KEY_FIELDS.map(({ name }) => {
        const meta = metadata[name]

        if (!meta?.configured) {
          return [name, ""]
        }

        const lengthText = meta.length ? `${meta.length} chars` : "Configured"
        const suffix = meta.lastFour ? `••••${meta.lastFour}` : null
        return [name, suffix ? `${lengthText} (${suffix})` : lengthText]
      })
    ) as Partial<Record<ApiKeyName, string>>
  }, [metadata])

  function handleChange(key: ApiKeyName, value: string) {
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError(null)
    setSuccess(null)

    const payloadEntries = Object.entries(formValues).filter(([, value]) => value.trim().length > 0) as [
      ApiKeyName,
      string,
    ][]

    if (payloadEntries.length === 0) {
      setError("Enter at least one API key to update.")
      return
    }

    setLoading(true)

    const payload = Object.fromEntries(payloadEntries)
    const ok = await updateApiKeys(payload)

    if (!ok) {
      setError("Unable to save API keys. Please try again.")
      setLoading(false)
      return
    }

    setSuccess("API keys saved successfully.")
    setLoading(false)
    setFormValues({
      ANTHROPIC_API_KEY: "",
      OPENAI_API_KEY: "",
      GEMINI_API_KEY: "",
      OPENROUTER_API_KEY: "",
    })

    const data = await fetchApiKeyMetadata()
    setMetadata(data)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-bytebot-bronze-light-7 bg-background p-6 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=open]:zoom-in-95 data-[state=closed]:fade-out data-[state=closed]:zoom-out-95",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">API Keys</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                Securely store provider keys. Leave fields blank to keep existing values.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="text-muted-foreground transition hover:text-foreground"
              >
                <HugeiconsIcon icon={CloseCircleIcon} className="h-6 w-6" />
              </button>
            </Dialog.Close>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {API_KEY_FIELDS.map(({ name, label, description }) => (
              <div key={name} className="space-y-2">
                <Label htmlFor={name}>{label}</Label>
                <Input
                  id={name}
                  type="password"
                  placeholder={placeholderByKey[name] ?? ""}
                  autoComplete="off"
                  value={formValues[name] ?? ""}
                  onChange={(event) => handleChange(name, event.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  {description}
                  {metadata?.[name]?.configured && !formValues[name] && !fetching && (
                    <span className="ml-1 text-foreground">
                      Configured
                      {metadata?.[name]?.length
                        ? ` • ${metadata?.[name]?.length} characters`
                        : ""}
                    </span>
                  )}
                </p>
              </div>
            ))}

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{success}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" disabled={loading}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save keys"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
