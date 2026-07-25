import { useContext, useEffect } from 'react';

import { OverlayContext } from './OverlayContext';
import type { OverlayLayer } from './overlay-types';

const useOverlayContext = () => {
  const value = useContext(OverlayContext);
  if (!value) {
    throw new Error('Overlay hooks must be used inside OverlayProvider');
  }
  return value;
};

export const useOverlayController = () => {
  const { openOverlay, closeOverlay, removeOverlay } = useOverlayContext();
  return { openOverlay, closeOverlay, removeOverlay };
};

export const useOverlayEntries = () => useOverlayContext().entries;

export const useOverlayLayer = (
  id: string,
  controlled = false,
): OverlayLayer => {
  const context = useOverlayContext();
  const registerControlledOverlay = context.registerControlledOverlay;
  useEffect(() => {
    if (!controlled) return undefined;
    return registerControlledOverlay(id);
  }, [controlled, id, registerControlledOverlay]);
  return context.getLayer(id);
};
