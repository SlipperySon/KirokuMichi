export type TtsProviderId = 'sarashina' | 'elevenlabs' | 'none'

export interface TtsSynthesizeRequest {
  text: string
  /** Optional voice / speaker hint (provider-specific). */
  voice?: string
  language?: string
}

export interface TtsSynthesizeResult {
  audio: Buffer
  contentType: string
  provider: TtsProviderId
  cached: boolean
}

export interface TtsProvider {
  id: TtsProviderId
  /** True when env/config is present enough to attempt synthesis. */
  isConfigured(): boolean
  synthesize(request: TtsSynthesizeRequest): Promise<Omit<TtsSynthesizeResult, 'cached' | 'provider'>>
}

export interface TtsStatus {
  provider: TtsProviderId
  configured: boolean
  ready: boolean
  message: string
}
