export type ApiKeyName =
  | "ANTHROPIC_API_KEY"
  | "OPENAI_API_KEY"
  | "GEMINI_API_KEY"
  | "OPENROUTER_API_KEY"

export interface ApiKeyMetadata {
  name: ApiKeyName
  configured: boolean
  length?: number
  lastFour?: string
  updatedAt?: string
}

export type ApiKeyMetadataMap = Record<ApiKeyName, ApiKeyMetadata | undefined>

const API_CONFIG = {
  baseUrl: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  credentials: "include" as RequestCredentials,
}

type ApiKeyResponse = {
  keys: Record<
    ApiKeyName,
    {
      configured: boolean
      length?: number
      lastFour?: string
      updatedAt?: string
    }
  >
}

export async function fetchApiKeyMetadata(): Promise<ApiKeyMetadataMap | null> {
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}/settings/keys`, {
      method: "GET",
      headers: API_CONFIG.headers,
      credentials: API_CONFIG.credentials,
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch API keys: ${response.status}`)
    }

    const data: ApiKeyResponse = await response.json()

    return Object.entries(data.keys).reduce<ApiKeyMetadataMap>((acc, [key, value]) => {
      const name = key as ApiKeyName
      acc[name] = {
        name,
        configured: Boolean(value?.configured),
        length: value?.length,
        lastFour: value?.lastFour,
        updatedAt: value?.updatedAt,
      }
      return acc
    }, {
      ANTHROPIC_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      GEMINI_API_KEY: undefined,
      OPENROUTER_API_KEY: undefined,
    })
  } catch (error) {
    console.error("Error fetching API key metadata", error)
    return null
  }
}

type ApiKeyUpdatePayload = Partial<Record<ApiKeyName, string>>

export async function updateApiKeys(payload: ApiKeyUpdatePayload): Promise<boolean> {
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}/settings/keys`, {
      method: "POST",
      headers: API_CONFIG.headers,
      credentials: API_CONFIG.credentials,
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Failed to update API keys: ${response.status} ${errorBody}`)
    }

    return true
  } catch (error) {
    console.error("Error updating API keys", error)
    return false
  }
}
