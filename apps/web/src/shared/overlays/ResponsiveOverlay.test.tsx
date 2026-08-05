import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ResponsiveOverlay } from './ResponsiveOverlay';

const layer = { depth: 0, isTopmost: true };

const getBackdrop = (selector: string): HTMLElement => {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null)
    throw new Error(`Backdrop ${selector} was not rendered`);
  return element;
};

const LifecycleHarness = ({ onExited }: { readonly onExited: () => void }) => {
  const [open, setOpen] = useState(true);
  return (
    <ResponsiveOverlay
      kind="dialog"
      open={open}
      layer={layer}
      dismissible
      labelledBy="lifecycle-title"
      onClose={() => setOpen(false)}
      onExited={onExited}
    >
      <h2 id="lifecycle-title">Lifecycle test</h2>
      <button type="button" onClick={() => setOpen(false)}>
        Close lifecycle test
      </button>
    </ResponsiveOverlay>
  );
};

describe('ResponsiveOverlay', () => {
  it('waits for the controlled closed animation event before exiting', async () => {
    const onExited = vi.fn();
    const nativeGetComputedStyle = window.getComputedStyle;
    const styleSpy = vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation((element) => {
        const style = nativeGetComputedStyle(element);
        return new Proxy(style, {
          get(target, property) {
            if (property === 'animationName') {
              return element.getAttribute('data-state') === 'closed'
                ? 'modalOut'
                : 'modalIn';
            }
            return Reflect.get(target, property, target);
          },
        });
      });

    try {
      render(<LifecycleHarness onExited={onExited} />);
      await fireEvent.click(
        screen.getByRole('button', { name: 'Close lifecycle test' }),
      );

      const closedDialog = screen.getByRole('dialog', {
        name: 'Lifecycle test',
        hidden: true,
      });
      expect(closedDialog).toHaveAttribute('data-state', 'closed');
      expect(onExited).not.toHaveBeenCalled();

      fireEvent.animationEnd(closedDialog);
      expect(onExited).toHaveBeenCalledTimes(1);
    } finally {
      styleSpy.mockRestore();
    }
  });

  it('leaves alert-dialog backdrop dismissal to Radix', () => {
    const onClose = vi.fn();
    render(
      <ResponsiveOverlay
        kind="alertdialog"
        layer={layer}
        dismissible
        labelledBy="alert-title"
        onClose={onClose}
      >
        <h2 id="alert-title">Alert test</h2>
      </ResponsiveOverlay>,
    );

    const backdrop = getBackdrop('#overlay-root > [data-state="open"]');
    fireEvent.pointerDown(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('turns one dialog backdrop pointer action into one close request', async () => {
    const onClose = vi.fn();
    render(
      <ResponsiveOverlay
        kind="dialog"
        layer={layer}
        dismissible
        labelledBy="dialog-title"
        onClose={onClose}
      >
        <h2 id="dialog-title">Dialog test</h2>
      </ResponsiveOverlay>,
    );

    const backdrop = getBackdrop(
      '#overlay-root > [data-state="open"]:not([role])',
    );
    await userEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('turns one Escape action into one dialog close request', () => {
    const onClose = vi.fn();
    render(
      <ResponsiveOverlay
        kind="dialog"
        layer={layer}
        dismissible
        labelledBy="escape-title"
        onClose={onClose}
      >
        <h2 id="escape-title">Escape test</h2>
      </ResponsiveOverlay>,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('prevents backdrop and Escape dismissal when disabled', () => {
    const onClose = vi.fn();
    render(
      <ResponsiveOverlay
        kind="dialog"
        layer={layer}
        dismissible={false}
        labelledBy="locked-title"
        onClose={onClose}
      >
        <h2 id="locked-title">Locked test</h2>
      </ResponsiveOverlay>,
    );
    const backdrop = getBackdrop(
      '#overlay-root > [data-state="open"]:not([role])',
    );

    fireEvent.pointerDown(backdrop);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });
});
