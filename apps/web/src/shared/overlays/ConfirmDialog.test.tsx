import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog cancellation', () => {
  it('turns one Radix Cancel activation into one close request', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Confirm action"
        description="Confirm the requested action."
        confirmLabel="Confirm"
        layer={{ depth: 0, isTopmost: true }}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
