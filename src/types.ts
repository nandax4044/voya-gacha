/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Prize {
  id: string;
  name: string;
  image: string; // Base64 or Data URL
  color: string;
  weight?: number; // Optional probability weight
  isPlaceholder?: boolean;
}

export interface SpinSettings {
  speed: 'slow' | 'normal' | 'fast' | 'turbo';
  duration: number; // in seconds
  autoRemove: boolean;
  soundEnabled: boolean;
}

export interface SpinHistory {
  id: string;
  prizeId: string;
  prizeName: string;
  prizeImage: string;
  timestamp: string;
}
