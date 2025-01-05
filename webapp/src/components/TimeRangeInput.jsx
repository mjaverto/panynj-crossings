import { useState, useEffect } from 'react';
import { Combobox, TextInput, useCombobox } from '@mantine/core';
import * as chrono from 'chrono-node';
import moment from 'moment-timezone';

export const suggestions = [
  '1h', '3h', '12h', '1d', '3d', '1w', '2w', '30d', '60d', '90d',
  '45m', '12 hours', '10d', '2 weeks',
  'last month', 'yesterday', 'today',
  'Jan 1', 'Jan 1 - Jan 2', '1/1',
  '1/1 - 1/2', '2:00 pm - 8:00 pm',
  'last year', 'this year'
];

export function TimeRangeInput({ onChange, value = '3d' }) {
  const combobox = useCombobox();
  const [inputValue, setInputValue] = useState(value);

  // Update input value when prop value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const parseTimeRange = (input) => {
    // Handle relative time shortcuts
    const relativeMappings = {
      'today': { start: moment().startOf('day'), end: moment() },
      'yesterday': { 
        start: moment().subtract(1, 'day').startOf('day'),
        end: moment().subtract(1, 'day').endOf('day')
      },
      'last month': {
        start: moment().subtract(1, 'month').startOf('month'),
        end: moment().subtract(1, 'month').endOf('month')
      },
      'last year': {
        start: moment().subtract(1, 'year').startOf('year'),
        end: moment().subtract(1, 'year').endOf('year')
      },
      'this year': {
        start: moment().startOf('year'),
        end: moment()
      }
    };

    if (relativeMappings[input.toLowerCase()]) {
      return relativeMappings[input.toLowerCase()];
    }

    // Handle duration formats (45m, 12h, 10d, etc.)
    const durationMatch = input.match(/^(\d+)([mhdw])$/i);
    if (durationMatch) {
      const [_, amount, unit] = durationMatch;
      const unitMapping = { m: 'minutes', h: 'hours', d: 'days', w: 'weeks' };
      return {
        start: moment().subtract(amount, unitMapping[unit.toLowerCase()]),
        end: moment()
      };
    }

    // Try parsing as a date range using chrono
    const parsed = chrono.parse(input);
    if (parsed.length > 0) {
      if (parsed.length === 2) {
        // Two separate dates detected (e.g., "Jan 1 - Jan 2")
        return {
          start: moment(parsed[0].start.date()).startOf('day'),
          end: moment(parsed[1].start.date()).endOf('day')
        };
      } else if (parsed[0].end) {
        // One date range detected (e.g., "2:00 pm - 8:00 pm")
        const today = moment().startOf('day');
        return {
          start: moment(parsed[0].start.date()).year(today.year()).month(today.month()).date(today.date()),
          end: moment(parsed[0].end.date()).year(today.year()).month(today.month()).date(today.date())
        };
      } else {
        // Single date detected
        return {
          start: moment(parsed[0].start.date()).startOf('day'),
          end: moment(parsed[0].start.date()).endOf('day')
        };
      }
    }

    return null;
  };

  const handleInputSubmit = (value) => {
    const range = parseTimeRange(value);
    if (range) {
      setInputValue(value); // Update the display
      onChange({
        startTime: range.start,
        endTime: range.end,
        displayValue: value // Pass the display value back
      });
      combobox.closeDropdown();
    }
  };

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={handleInputSubmit}
    >
      <Combobox.Target>
        <TextInput
          label="Time Range"
          placeholder="Type a time range (e.g., '45m', 'yesterday', '2:00 pm - 8:00 pm')"
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.currentTarget.value);
            combobox.openDropdown();
          }}
          onClick={() => combobox.openDropdown()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleInputSubmit(inputValue);
            }
          }}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          {suggestions
            .filter(item => 
              item.toLowerCase().includes(inputValue.toLowerCase())
            )
            .map((suggestion) => (
              <Combobox.Option value={suggestion} key={suggestion}>
                {suggestion}
              </Combobox.Option>
            ))}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
} 