import {
  forwardRef,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

import { isValidCurrencyDraft } from './currency-input';
import styles from './FormControls.module.scss';

interface FormFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly children: ReactNode;
}

export const FormField = ({
  id,
  label,
  hint,
  error,
  children,
}: FormFieldProps) => (
  <div className={styles.field}>
    <label className={styles.label} htmlFor={id}>
      {label}
    </label>
    {children}
    {error ? (
      <span className={styles.error} id={`${id}-error`}>
        {error}
      </span>
    ) : hint ? (
      <span className={styles.hint} id={`${id}-hint`}>
        {hint}
      </span>
    ) : null}
  </div>
);

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ id, error, hint, className, ...props }, ref) => (
    <input
      {...props}
      ref={ref}
      id={id}
      className={[styles.input, className].filter(Boolean).join(' ')}
      aria-invalid={error ? true : undefined}
      aria-describedby={
        id && error ? `${id}-error` : id && hint ? `${id}-hint` : undefined
      }
    />
  ),
);
Input.displayName = 'Input';

export const TextInput = forwardRef<HTMLInputElement, InputProps>(
  (props, ref) => <Input {...props} ref={ref} />,
);
TextInput.displayName = 'TextInput';

export const CurrencyInput = forwardRef<HTMLInputElement, InputProps>(
  ({ onChange, ...props }, ref) => {
    const acceptValidDraft = (event: ChangeEvent<HTMLInputElement>) => {
      if (isValidCurrencyDraft(event.target.value)) onChange?.(event);
    };
    return (
      <div className={styles.currency}>
        <Input
          {...props}
          ref={ref}
          onChange={acceptValidDraft}
          inputMode="decimal"
          autoComplete="off"
        />
      </div>
    );
  },
);
CurrencyInput.displayName = 'CurrencyInput';
