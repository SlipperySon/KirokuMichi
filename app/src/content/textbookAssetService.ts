export interface TextbookAsset {
  id: string
  textbookKey: string
  lessonId: string
  page: number
  kind: 'page' | 'photo' | 'diagram' | 'table' | 'exercise'
  src: string
  alt: string
  caption?: string
  sourceRect?: { x: number; y: number; width: number; height: number }
}

export interface TextbookAssetManifest {
  generatedAt: string
  assets: TextbookAsset[]
}

const MANIFEST_PATH = '/data/generated/assets/textbook-assets.json'

class TextbookAssetService {
  private cache: TextbookAssetManifest | null = null
  private loadAttempted = false

  async getManifest(): Promise<TextbookAssetManifest> {
    if (this.cache) return this.cache
    if (this.loadAttempted) return { generatedAt: '', assets: [] }

    this.loadAttempted = true
    try {
      const response = await fetch(MANIFEST_PATH)
      if (!response.ok) return { generatedAt: '', assets: [] }
      this.cache = (await response.json()) as TextbookAssetManifest
      return this.cache
    } catch {
      return { generatedAt: '', assets: [] }
    }
  }

  async getAssetsForLesson(textbookKey: string, lessonId: string): Promise<TextbookAsset[]> {
    const manifest = await this.getManifest()
    return manifest.assets
      .filter(asset => asset.textbookKey === textbookKey && asset.lessonId === lessonId)
      .sort((a, b) => a.page - b.page || a.kind.localeCompare(b.kind))
  }

  async getAssetsForPage(textbookKey: string, page: number): Promise<TextbookAsset[]> {
    const manifest = await this.getManifest()
    return manifest.assets
      .filter(asset => asset.textbookKey === textbookKey && asset.page === page)
      .sort((a, b) => a.lessonId.localeCompare(b.lessonId) || a.kind.localeCompare(b.kind))
  }

  clearCache(): void {
    this.cache = null
    this.loadAttempted = false
  }
}

export const textbookAssetService = new TextbookAssetService()
