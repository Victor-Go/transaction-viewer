import type { ButtonHTMLAttributes } from 'react';

import { Button } from './Button';

interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label'
> {
  readonly label: string;
}

export const IconButton = ({ label, ...props }: IconButtonProps) => (
  <Button {...props} aria-label={label} tone="ghost">
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path
        d="M4.5 4.5 15.5 15.5M15.5 4.5 4.5 15.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  </Button>
);
