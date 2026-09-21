export type QualityTier = 'power_saving' | 'balanced' | 'high';
export type QualityMode = 'auto' | QualityTier;

export interface QualitySettings {
  tier: QualityTier;
  maxDpr: number;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  useFog: boolean;
  geometryLod: 'low' | 'medium' | 'high';
  antialias: boolean;
}

const TIER_SETTINGS: Record<QualityTier, QualitySettings> = {
  power_saving: {
    tier: 'power_saving',
    maxDpr: 1.0,
    shadowsEnabled: false,
    shadowMapSize: 512,
    useFog: false,
    geometryLod: 'low',
    antialias: false,
  },
  balanced: {
    tier: 'balanced',
    maxDpr: 1.5,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    useFog: true,
    geometryLod: 'medium',
    antialias: true,
  },
  high: {
    tier: 'high',
    maxDpr: 2.0,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    useFog: true,
    geometryLod: 'high',
    antialias: true,
  },
};

export class QualityManager {
  private currentMode: QualityMode = 'auto';
  private activeTier: QualityTier = 'balanced';
  private listeners = new Set<(settings: QualitySettings) => void>();

  // Performance monitoring
  private frameTimes: number[] = [];
  private readonly windowSize = 45; // ~0.75s at 60fps
  private lastTierChangeTime = 0;
  private readonly upgradeCooldownMs = 8000;
  private consecutiveSlowWindows = 0;

  constructor(initialMode: QualityMode = 'auto') {
    this.setMode(initialMode);
  }

  getMode(): QualityMode {
    return this.currentMode;
  }

  getActiveTier(): QualityTier {
    return this.activeTier;
  }

  getSettings(): QualitySettings {
    return { ...TIER_SETTINGS[this.activeTier] };
  }

  setMode(mode: QualityMode): void {
    this.currentMode = mode;
    if (mode === 'auto') {
      const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      const lowCores = typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
      if (isMobile || lowCores) {
        this.setTier('balanced');
      } else {
        this.setTier('high');
      }
    } else {
      this.setTier(mode);
    }
  }

  private setTier(tier: QualityTier): void {
    if (this.activeTier === tier && this.frameTimes.length > 0) return;
    this.activeTier = tier;
    this.lastTierChangeTime = performance.now();
    this.frameTimes = [];
    this.consecutiveSlowWindows = 0;
    this.notify();
  }

  recordFrame(deltaTimeMs: number): void {
    if (this.currentMode !== 'auto') return;

    this.frameTimes.push(deltaTimeMs);
    if (this.frameTimes.length < this.windowSize) return;

    const sum = this.frameTimes.reduce((acc, v) => acc + v, 0);
    const avg = sum / this.frameTimes.length;
    this.frameTimes = [];

    const now = performance.now();
    const timeSinceChange = now - this.lastTierChangeTime;

    // > 33.3ms means < 30 FPS
    if (avg > 33.3) {
      this.consecutiveSlowWindows++;
      if (this.consecutiveSlowWindows >= 2) {
        if (this.activeTier === 'high') {
          this.setTier('balanced');
        } else if (this.activeTier === 'balanced') {
          this.setTier('power_saving');
        }
      }
    } else {
      this.consecutiveSlowWindows = 0;
      // If performing very smoothly (avg < 18ms ~ 55+ FPS) and cooldown expired, try upgrading
      if (avg < 18.0 && timeSinceChange > this.upgradeCooldownMs) {
        if (this.activeTier === 'power_saving') {
          this.setTier('balanced');
        }
      }
    }
  }

  subscribe(callback: (settings: QualitySettings) => void): () => void {
    this.listeners.add(callback);
    callback(this.getSettings());
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    const s = this.getSettings();
    this.listeners.forEach(cb => {
      try {
        cb(s);
      } catch (e) {
        console.error('QualityManager notify error', e);
      }
    });
  }
}

