import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarDate } from '@internationalized/date';
import { StrictMode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { CalendarDateDraft } from '../date/calendar-date-range';
import { DateRangePicker } from './DateRangePicker';

const labels = {
  range: 'Search transactions by date',
  start: 'Start date',
  end: 'End date',
  selectStart: 'Select a start date',
  selectEnd: 'Select an end date',
  previousYear: 'Previous year',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  nextYear: 'Next year',
  configurationError: 'Calendar configuration error',
};

const getDateButton = (date: string): HTMLButtonElement => {
  const element = document.querySelector<HTMLButtonElement>(
    `[data-date="${date}"]`,
  );
  if (element === null) throw new Error(`Date button ${date} was not rendered`);
  return element;
};

const PickerHarness = ({
  initialValue = null,
  initialMonth = new CalendarDate(2026, 2, 1),
  minDate = new CalendarDate(1970, 1, 1),
  maxDate = new CalendarDate(2026, 12, 31),
  onChange = vi.fn(),
}: {
  readonly initialValue?: CalendarDateDraft;
  readonly initialMonth?: CalendarDate;
  readonly minDate?: CalendarDate;
  readonly maxDate?: CalendarDate;
  readonly onChange?: (value: CalendarDateDraft) => void;
}) => {
  const [value, setValue] = useState(initialValue);
  return (
    <DateRangePicker
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      initialVisibleMonth={initialMonth}
      minDate={minDate}
      maxDate={maxDate}
      locale="en-CA"
      labels={labels}
    />
  );
};

describe('DateRangePicker six-week calendar', () => {
  it.each([
    ['four natural weeks', new CalendarDate(2026, 2, 1)],
    ['five natural weeks', new CalendarDate(2026, 4, 1)],
    ['six natural weeks', new CalendarDate(2026, 5, 1)],
  ])('renders 42 real date cells for a month with %s', (_name, month) => {
    render(<PickerHarness initialMonth={month} />);

    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
  });

  it('selects adjacent-month dates and emits one complete range', async () => {
    const onChange = vi.fn();
    render(
      <PickerHarness
        initialMonth={new CalendarDate(2026, 5, 1)}
        onChange={onChange}
      />,
    );

    fireEvent.click(getDateButton('2026-04-30'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({
      start: new CalendarDate(2026, 4, 30),
      end: null,
    });
    expect(document.querySelector('[data-date="2026-04-30"]')).toHaveAttribute(
      'data-selection-start',
    );
    fireEvent.click(getDateButton('2026-05-02'));

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith({
      start: new CalendarDate(2026, 4, 30),
      end: new CalendarDate(2026, 5, 2),
    });
  });

  it('shows read-only localized summaries and updates Start immediately', async () => {
    render(<PickerHarness initialMonth={new CalendarDate(2026, 5, 1)} />);

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Select a start date')).toBeInTheDocument();
    expect(screen.getByText('Select an end date')).toBeInTheDocument();

    await userEvent.click(getDateButton('2026-05-01'));

    expect(screen.getByText('May 1, 2026')).toBeInTheDocument();
    expect(screen.getByText('Select an end date')).toBeInTheDocument();
  });

  it('normalizes a reverse-order selection', async () => {
    const onChange = vi.fn();
    render(
      <PickerHarness
        initialMonth={new CalendarDate(2026, 5, 1)}
        onChange={onChange}
      />,
    );

    await userEvent.click(getDateButton('2026-05-05'));
    await userEvent.click(getDateButton('2026-05-02'));

    expect(onChange).toHaveBeenLastCalledWith({
      start: new CalendarDate(2026, 5, 2),
      end: new CalendarDate(2026, 5, 5),
    });
  });

  it('completes a valid single-day range on the second click', async () => {
    const onChange = vi.fn();
    render(
      <PickerHarness
        initialMonth={new CalendarDate(2026, 5, 1)}
        onChange={onChange}
      />,
    );
    const day = getDateButton('2026-05-03');

    await userEvent.click(day);
    await userEvent.click(getDateButton('2026-05-03'));

    expect(onChange).toHaveBeenLastCalledWith({
      start: new CalendarDate(2026, 5, 3),
      end: new CalendarDate(2026, 5, 3),
    });
    await waitFor(() => {
      const selectedDay = document.querySelector('[data-date="2026-05-03"]');
      expect(selectedDay).toHaveAttribute('data-selection-start');
      expect(selectedDay).toHaveAttribute('data-selection-end');
    });
  });

  it('starts a new partial range after clicking a complete range', async () => {
    const onChange = vi.fn();
    render(
      <PickerHarness
        initialMonth={new CalendarDate(2026, 5, 1)}
        initialValue={{
          start: new CalendarDate(2026, 5, 3),
          end: new CalendarDate(2026, 5, 6),
        }}
        onChange={onChange}
      />,
    );

    await userEvent.click(getDateButton('2026-05-10'));

    expect(onChange).toHaveBeenLastCalledWith({
      start: new CalendarDate(2026, 5, 10),
      end: null,
    });
    expect(screen.getByText('May 10, 2026')).toBeInTheDocument();
    expect(screen.getByText('Select an end date')).toBeInTheDocument();
    expect(document.querySelector('[data-date="2026-05-10"]')).toHaveAttribute(
      'data-selection-start',
    );
  });

  it('navigates by month and year without changing the draft', async () => {
    const onChange = vi.fn();
    render(
      <PickerHarness
        initialMonth={new CalendarDate(2026, 5, 1)}
        initialValue={{
          start: new CalendarDate(2026, 5, 3),
          end: new CalendarDate(2026, 5, 6),
        }}
        onChange={onChange}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Previous year' }),
    );
    expect(
      screen.getByRole('heading', { name: 'May 2025' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next year' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Previous month' }),
    );
    expect(
      screen.getByRole('heading', { name: 'April 2026' }),
    ).toBeInTheDocument();

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('May 3, 2026')).toBeInTheDocument();
    expect(screen.getByText('May 6, 2026')).toBeInTheDocument();
  });

  it('disables month and year navigation at supported boundaries', () => {
    render(
      <PickerHarness
        initialMonth={new CalendarDate(1970, 1, 1)}
        minDate={new CalendarDate(1970, 1, 1)}
        maxDate={new CalendarDate(2026, 7, 25)}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Previous month' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Previous year' }),
    ).toBeDisabled();
  });

  it('disables forward navigation in the maximum month', () => {
    render(
      <PickerHarness
        initialMonth={new CalendarDate(2026, 7, 1)}
        maxDate={new CalendarDate(2026, 7, 25)}
      />,
    );

    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next year' })).toBeDisabled();
  });

  it('keeps February valid across leap-year navigation', async () => {
    render(<PickerHarness initialMonth={new CalendarDate(2024, 2, 1)} />);

    await userEvent.click(screen.getByRole('button', { name: 'Next year' }));

    expect(
      screen.getByRole('heading', { name: 'February 2025' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
  });

  it('keeps the displayed month unchanged when an adjacent date is selected', async () => {
    render(<PickerHarness initialMonth={new CalendarDate(2026, 5, 1)} />);

    expect(
      screen.getByRole('heading', { name: 'May 2026' }),
    ).toBeInTheDocument();
    await userEvent.click(getDateButton('2026-04-30'));

    expect(
      screen.getByRole('heading', { name: 'May 2026' }),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-date="2026-04-30"]')).toHaveAttribute(
      'data-selection-start',
    );
  });

  it('disables adjacent dates only when they are outside min/max', () => {
    const onChange = vi.fn();
    render(
      <PickerHarness
        initialMonth={new CalendarDate(2026, 5, 1)}
        minDate={new CalendarDate(2026, 5, 1)}
        maxDate={new CalendarDate(2026, 5, 31)}
        onChange={onChange}
      />,
    );

    expect(document.querySelector('[data-date="2026-04-30"]')).toBeDisabled();
    expect(document.querySelector('[data-date="2026-05-01"]')).toBeEnabled();
    fireEvent.click(getDateButton('2026-04-30'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('exposes continuous range endpoints and middle state', () => {
    render(
      <PickerHarness
        initialMonth={new CalendarDate(2026, 5, 1)}
        initialValue={{
          start: new CalendarDate(2026, 4, 30),
          end: new CalendarDate(2026, 5, 2),
        }}
      />,
    );

    const grid = screen.getByRole('grid');
    expect(grid.querySelector('[data-date="2026-04-30"]')).toHaveAttribute(
      'data-selection-start',
    );
    expect(grid.querySelector('[data-date="2026-05-01"]')).toHaveAttribute(
      'data-selected',
    );
    expect(grid.querySelector('[data-date="2026-05-01"]')).toHaveAttribute(
      'data-range-middle',
    );
    expect(grid.querySelector('[data-date="2026-05-01"]')).not.toHaveAttribute(
      'data-selection-start',
    );
    expect(grid.querySelector('[data-date="2026-05-01"]')).not.toHaveAttribute(
      'data-selection-end',
    );
    expect(grid.querySelector('[data-date="2026-05-02"]')).toHaveAttribute(
      'data-selection-end',
    );
  });

  it('keeps a single-day range marked as both endpoints', () => {
    render(
      <PickerHarness
        initialMonth={new CalendarDate(2026, 5, 1)}
        initialValue={{
          start: new CalendarDate(2026, 5, 1),
          end: new CalendarDate(2026, 5, 1),
        }}
      />,
    );

    const day = document.querySelector('[data-date="2026-05-01"]');
    expect(day).toHaveAttribute('data-selection-start');
    expect(day).toHaveAttribute('data-selection-end');
  });

  it('navigates by keyboard through an adjacent-month date', async () => {
    render(<PickerHarness initialMonth={new CalendarDate(2026, 5, 1)} />);
    const mayFirst = getDateButton('2026-05-01');
    mayFirst.focus();

    await userEvent.keyboard('{ArrowLeft}');

    expect(document.querySelector('[data-date="2026-04-30"]')).toHaveFocus();
  });

  it('selects an adjacent-month range with the keyboard', async () => {
    const onChange = vi.fn();
    render(
      <PickerHarness
        initialMonth={new CalendarDate(2026, 5, 1)}
        onChange={onChange}
      />,
    );
    const mayFirst = getDateButton('2026-05-01');
    mayFirst.focus();

    await userEvent.keyboard(
      '{ArrowLeft}{Enter}{ArrowRight}{ArrowRight}{Enter}',
    );

    expect(onChange).toHaveBeenLastCalledWith({
      start: new CalendarDate(2026, 4, 30),
      end: new CalendarDate(2026, 5, 2),
    });
    expect(
      screen.getByRole('heading', { name: 'May 2026' }),
    ).toBeInTheDocument();
  });

  it('does not emit callbacks or warnings on rerender in StrictMode', async () => {
    const onChange = vi.fn();
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const view = render(
        <StrictMode>
          <PickerHarness onChange={onChange} />
        </StrictMode>,
      );

      view.rerender(
        <StrictMode>
          <PickerHarness onChange={onChange} />
        </StrictMode>,
      );

      expect(onChange).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('navigates calendar pages without emitting a selected range', async () => {
    const onChange = vi.fn();
    render(<PickerHarness onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
  });
});
