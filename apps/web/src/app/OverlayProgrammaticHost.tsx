import { CreateTransactionDialog } from '../features/transactions/ui/CreateTransactionDialog';
import { ReversalConfirmDialog } from '../features/transactions/ui/ReversalConfirmDialog';
import { TransactionDateSearchDialog } from '../features/transactions/ui/TransactionDateSearchDialog';
import type { OverlayEntry } from '../shared/overlays/overlay-types';
import {
  useOverlayController,
  useOverlayEntries,
  useOverlayLayer,
} from '../shared/overlays/useOverlayController';

const ProgrammaticOverlay = ({ entry }: { readonly entry: OverlayEntry }) => {
  const controller = useOverlayController();
  const layer = useOverlayLayer(entry.id);
  const close = () => controller.closeOverlay(entry.id);
  const remove = () => controller.removeOverlay(entry.id);
  const open = entry.lifecycle === 'open';

  switch (entry.request.type) {
    case 'create-transaction':
      return (
        <CreateTransactionDialog
          request={entry.request}
          layer={layer}
          open={open}
          onClose={close}
          onExited={remove}
        />
      );
    case 'confirm-transaction-reversal':
      return (
        <ReversalConfirmDialog
          request={entry.request}
          layer={layer}
          open={open}
          onClose={close}
          onExited={remove}
        />
      );
    case 'transaction-date-search':
      return (
        <TransactionDateSearchDialog
          request={entry.request}
          layer={layer}
          open={open}
          onClose={close}
          onExited={remove}
        />
      );
  }
};

export const OverlayProgrammaticHost = () => {
  const entries = useOverlayEntries();
  return entries.map((entry) => (
    <ProgrammaticOverlay key={entry.id} entry={entry} />
  ));
};
