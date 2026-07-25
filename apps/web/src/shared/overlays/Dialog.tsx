import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useId, type ReactNode, type RefObject } from 'react';

import { IconButton } from '../ui/IconButton';
import type { OverlayLayer } from './overlay-types';
import { ResponsiveOverlay } from './ResponsiveOverlay';
import styles from './ResponsiveOverlay.module.scss';

interface DialogProps {
  readonly title: string;
  readonly description?: string;
  readonly closeLabel: string;
  readonly layer: OverlayLayer;
  readonly dismissible?: boolean;
  readonly open?: boolean;
  readonly onClose: () => void;
  readonly onExited?: () => void;
  readonly initialFocusRef?: RefObject<HTMLElement | null>;
  readonly onCloseAutoFocus?: (event: Event) => void;
  readonly titleRef?: RefObject<HTMLHeadingElement | null>;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
}

export const Dialog = ({
  title,
  description,
  closeLabel,
  layer,
  dismissible = true,
  open = true,
  onClose,
  onExited,
  initialFocusRef,
  onCloseAutoFocus,
  titleRef,
  children,
  actions,
}: DialogProps) => {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <ResponsiveOverlay
      kind="dialog"
      open={open}
      layer={layer}
      dismissible={dismissible}
      labelledBy={titleId}
      {...(description === undefined ? {} : { describedBy: descriptionId })}
      onClose={onClose}
      {...(onExited === undefined ? {} : { onExited })}
      {...(initialFocusRef === undefined
        ? {}
        : {
            onOpenAutoFocus: (event: Event) => {
              event.preventDefault();
              initialFocusRef.current?.focus();
            },
          })}
      {...(onCloseAutoFocus === undefined ? {} : { onCloseAutoFocus })}
    >
      <IconButton
        className={styles.closeButton}
        label={closeLabel}
        onClick={onClose}
        disabled={!dismissible}
      />
      <header className={styles.header}>
        <DialogPrimitive.Title
          className={styles.title}
          id={titleId}
          ref={titleRef}
          {...(titleRef === undefined ? {} : { tabIndex: -1 })}
        >
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description
            className={styles.description}
            id={descriptionId}
          >
            {description}
          </DialogPrimitive.Description>
        ) : null}
      </header>
      <div className={styles.body}>{children}</div>
      {actions ? <footer className={styles.actions}>{actions}</footer> : null}
    </ResponsiveOverlay>
  );
};
