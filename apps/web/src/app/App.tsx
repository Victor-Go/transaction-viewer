import { AppProviders } from './providers';
import { AppRoutes } from './router';

export const App = () => (
  <AppProviders>
    <AppRoutes />
  </AppProviders>
);
