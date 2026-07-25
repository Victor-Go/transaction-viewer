import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { CSSProperties, ReactNode } from 'react';

import type { OverlayLayer } from './overlay-types';
import styles from './ResponsiveOverlay.module.scss';

interface OverlayDepthStyle extends CSSProperties {
  '--overlay-depth': number;
}

interface ResponsiveOverlayProps {
  readonly kind: 'dialog' | 'alertdialog';
  readonly open?: boolean;
  readonly layer: OverlayLayer;
  readonly dismissible: boolean;
  readonly labelledBy: string;
  readonly describedBy?: string;
  readonly onClose: () => void;
  readonly onExited?: () => void;
  readonly onOpenAutoFocus?: (event: Event) => void;
  readonly onCloseAutoFocus?: (event: Event) => void;
  readonly children: ReactNode;
}

export const ResponsiveOverlay = ({
  kind,
  open = true,
  layer,
  dismissible,
  labelledBy,
  describedBy,
  onClose,
  onExited,
  onOpenAutoFocus,
  onCloseAutoFocus,
  children,
}: ResponsiveOverlayProps) => {
  const canDismiss = dismissible && layer.isTopmost;
  const depthStyle: OverlayDepthStyle = { '--overlay-depth': layer.depth };
  const portalRoot = document.querySelector<HTMLElement>('#overlay-root');
  if (!portalRoot) throw new Error('Overlay portal root was not found');

  const preventDismiss = (event: Event) => {
    if (!canDismiss) event.preventDefault();
  };
  const finishExit = (event?: React.AnimationEvent) => {
    if (
      !open &&
      (event === undefined ||
        (event.target === event.currentTarget &&
          event.currentTarget.getAttribute('data-state') === 'closed'))
    ) {
      onExited?.();
    }
  };
  const finishExitWhenAnimationsAreUnavailable = (event: Event) => {
    onCloseAutoFocus?.(event);
    if (open) return;
    const target = event.currentTarget;
    if (!(target instanceof Element)) {
      onExited?.();
      return;
    }
    const animationName = window.getComputedStyle(target).animationName;
    if (animationName === '' || animationName === 'none') {
      onExited?.();
    }
  };

  if (kind === 'alertdialog') {
    return (
      <AlertDialogPrimitive.Root
        open={open}
        onOpenChange={(open) => {
          if (!open && canDismiss) onClose();
        }}
      >
        <AlertDialogPrimitive.Portal container={portalRoot}>
          <AlertDialogPrimitive.Overlay
            className={styles.backdrop}
            style={depthStyle}
            data-overlay-depth={layer.depth}
          />
          <AlertDialogPrimitive.Content
            className={styles.panel}
            style={depthStyle}
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            onEscapeKeyDown={preventDismiss}
            onOpenAutoFocus={onOpenAutoFocus}
            onCloseAutoFocus={finishExitWhenAnimationsAreUnavailable}
            onAnimationEnd={finishExit}
            data-presentation="responsive"
            data-overlay-depth={layer.depth}
          >
            {children}
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>
    );
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(open) => {
        if (!open && canDismiss) onClose();
      }}
    >
      <DialogPrimitive.Portal container={portalRoot}>
        <DialogPrimitive.Overlay
          className={styles.backdrop}
          style={depthStyle}
          data-overlay-depth={layer.depth}
        />
        <DialogPrimitive.Content
          className={styles.panel}
          style={depthStyle}
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          onEscapeKeyDown={preventDismiss}
          onPointerDownOutside={preventDismiss}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={finishExitWhenAnimationsAreUnavailable}
          onAnimationEnd={finishExit}
          data-presentation="responsive"
          data-overlay-depth={layer.depth}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
