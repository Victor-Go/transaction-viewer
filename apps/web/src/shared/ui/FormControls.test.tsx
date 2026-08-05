import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { CurrencyInput, FormField, Input } from './FormControls';
import { isValidCurrencyDraft } from './currency-input';

describe('Input', () => {
  it('forwards its ref and associates field errors', () => {
    const Harness = () => {
      const inputRef = useRef<HTMLInputElement>(null);
      return (
        <FormField id="merchant" label="Merchant" error="Required">
          <Input
            ref={inputRef}
            id="merchant"
            error="Required"
            onFocus={() =>
              expect(inputRef.current).toBe(document.activeElement)
            }
          />
        </FormField>
      );
    };
    render(<Harness />);

    const input = screen.getByRole('textbox', { name: 'Merchant' });
    input.focus();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'merchant-error');
  });
});

describe('CurrencyInput', () => {
  it.each([
    ['', true],
    ['25', true],
    ['25.', true],
    ['25,', true],
    ['25.9', true],
    ['25,99', true],
    ['abc', false],
    ['25a', false],
    ['-1', false],
    ['1e2', false],
    ['1.2.3', false],
    ['1,2.3', false],
    ['1.234', false],
    ['$25', false],
  ] as const)('classifies draft %j as %s', (draft, expected) => {
    expect(isValidCurrencyDraft(draft)).toBe(expected);
  });

  it('rejects invalid typing while preserving editable intermediate states', async () => {
    const Harness = () => {
      const [value, setValue] = useState('');
      return (
        <CurrencyInput
          aria-label="Amount"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      );
    };
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'Amount' });

    await userEvent.type(input, '25.');
    expect(input).toHaveValue('25.');
    await userEvent.type(input, 'a');
    expect(input).toHaveValue('25.');
    await userEvent.type(input, '99');
    expect(input).toHaveValue('25.99');
    await userEvent.type(input, '9');
    expect(input).toHaveValue('25.99');
  });

  it('rejects a draft above its configured maximum amount', () => {
    const Harness = () => {
      const [value, setValue] = useState('');
      return (
        <CurrencyInput
          aria-label="Amount"
          value={value}
          maxMinorUnits={99_999_999_999}
          onChange={(event) => setValue(event.target.value)}
        />
      );
    };
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'Amount' });

    fireEvent.change(input, { target: { value: '999999999.99' } });
    expect(input).toHaveValue('999999999.99');
    fireEvent.change(input, { target: { value: '1000000000.00' } });
    expect(input).toHaveValue('999999999.99');
  });
});
