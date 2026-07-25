import { createContext } from 'react';

import type {
  OverlayEntry,
  OverlayHandle,
  OverlayLayer,
  OpenOverlayOptions,
  ProgrammaticOverlayRequest,
} from './overlay-types';

export interface OverlayContextValue {
  readonly entries: readonly OverlayEntry[];
  readonly openOverlay: (
    request: ProgrammaticOverlayRequest,
    options?: OpenOverlayOptions,
  ) => OverlayHandle;
  readonly closeOverlay: (handle: OverlayHandle | string) => void;
  readonly removeOverlay: (handle: OverlayHandle | string) => void;
  readonly registerControlledOverlay: (id: string) => () => void;
  readonly getLayer: (id: string) => OverlayLayer;
}

export const OverlayContext = createContext<OverlayContextValue | null>(null);
