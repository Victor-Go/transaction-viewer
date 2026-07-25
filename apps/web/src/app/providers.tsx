import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { OverlayProvider } from '../shared/overlays/OverlayProvider';
import { OverlayProgrammaticHost } from './OverlayProgrammaticHost';

export const AppProviders = ({
  children,
}: {
  readonly children: ReactNode;
}) => (
  <BrowserRouter>
    <OverlayProvider>
      {children}
      <OverlayProgrammaticHost />
    </OverlayProvider>
  </BrowserRouter>
);
