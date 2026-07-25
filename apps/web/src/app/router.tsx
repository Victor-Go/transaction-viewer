import { Navigate, Route, Routes, useParams } from 'react-router-dom';

import { TransactionDetailRouteOverlay } from '../features/transactions/ui/TransactionDetailRouteOverlay';
import { TransactionHistoryPage } from '../features/transactions/ui/TransactionHistoryPage';

const TransactionDetailRouteElement = () => {
  const { accountId = '', transactionId = '' } = useParams();
  return (
    <TransactionDetailRouteOverlay
      key={`${encodeURIComponent(accountId)}:${encodeURIComponent(transactionId)}`}
    />
  );
};

export const AppRoutes = () => (
  <Routes>
    <Route
      path="/"
      element={<Navigate to="/accounts/acc_demo/transactions" replace />}
    />
    <Route
      path="/accounts/:accountId/transactions"
      element={<TransactionHistoryPage />}
    >
      <Route
        path=":transactionId"
        element={<TransactionDetailRouteElement />}
      />
    </Route>
    <Route
      path="*"
      element={<Navigate to="/accounts/acc_demo/transactions" replace />}
    />
  </Routes>
);
