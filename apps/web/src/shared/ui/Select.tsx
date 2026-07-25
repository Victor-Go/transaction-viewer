import * as SelectPrimitive from '@radix-ui/react-select';

import styles from './Select.module.scss';

export interface SelectOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

export const Select = <Value extends string>({
  label,
  value,
  options,
  disabled = false,
  onChange,
}: {
  readonly label: string;
  readonly value: Value;
  readonly options: readonly SelectOption<Value>[];
  readonly disabled?: boolean;
  readonly onChange: (value: Value) => void;
}) => (
  <SelectPrimitive.Root
    value={value}
    disabled={disabled}
    onValueChange={(nextValue) => onChange(nextValue as Value)}
  >
    <SelectPrimitive.Trigger className={styles.trigger} aria-label={label}>
      <SelectPrimitive.Value />
      <SelectPrimitive.Icon className={styles.icon} aria-hidden="true">
        ▾
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={styles.content}
        position="popper"
        sideOffset={6}
      >
        <SelectPrimitive.Viewport className={styles.viewport}>
          {options.map((option) => (
            <SelectPrimitive.Item
              className={styles.item}
              value={option.value}
              key={option.value}
            >
              <SelectPrimitive.ItemText>
                {option.label}
              </SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator
                className={styles.indicator}
                aria-hidden="true"
              >
                ✓
              </SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>
          ))}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
);
