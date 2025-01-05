import { useState, useEffect } from 'react';
import { Combobox, TextInput, useCombobox, Text, Box } from '@mantine/core';
import * as chrono from 'chrono-node';
import moment from 'moment-timezone';

export const suggestions = [
  { group: 'Duration', items: ['1h', '3h', '12h', '1d', '3d', '1w', '2w', '30d', '60d', '90d', '1y', '2y', '5y'] }
];

export function TimeRangeInput({ onChange, value = '3d' }) {
  const combobox = useCombobox();
  const [inputValue, setInputValue] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
    setPreviousValue(value);
  }, [value]);

  const handleFocus = () => {
    setPreviousValue(inputValue);
    setInputValue('');
    combobox.openDropdown();
  };

  const handleBlur = () => {
    if (!inputValue) {
      setInputValue(previousValue);
    }
  };

  const parseTimeRange = (input) => {
    // Handle duration formats (1h, 3h, 12h, 1d, etc.)
    const durationMatch = input.match(/^(\d+)([hdwy])$/i);
    if (durationMatch) {
      const [_, amount, unit] = durationMatch;
      const unitMapping = { h: 'hours', d: 'days', w: 'weeks', y: 'years' };
      return {
        start: moment().subtract(amount, unitMapping[unit.toLowerCase()]),
        end: moment()
      };
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
          placeholder="Type a time range (e.g., '1h', '3d', '1w')"
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.currentTarget.value);
            combobox.openDropdown();
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleInputSubmit(inputValue || previousValue);
            }
          }}
        />
      </Combobox.Target>

      <Combobox.Dropdown
        style={{
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          backgroundColor: 'white',
          marginTop: '4px'
        }}
      >
        <Box p="md">
          <Text size="sm" c="dimmed" mb="md">
            Type custom relative times like:
          </Text>
          <Box
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}
          >
            {suggestions[0].items.map((suggestion) => (
              <Combobox.Option 
                value={suggestion} 
                key={suggestion}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--mantine-color-blue-0)',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: 'var(--mantine-color-blue-9)',
                  '&:hover': {
                    backgroundColor: 'var(--mantine-color-blue-6)',
                    color: 'white'
                  },
                  '&[data-selected]': {
                    backgroundColor: 'var(--mantine-color-blue-6)',
                    color: 'white'
                  }
                }}
              >
                {suggestion}
              </Combobox.Option>
            ))}
          </Box>
        </Box>
      </Combobox.Dropdown>
    </Combobox>
  );
} 