import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeRangeInput, suggestions } from './TimeRangeInput';
import moment from 'moment-timezone';

describe('TimeRangeInput Component', () => {
  let mockOnChange;

  beforeEach(() => {
    mockOnChange = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders with default value', () => {
    render(<TimeRangeInput value="3d" onChange={mockOnChange} />);
    
    const input = screen.getByLabelText('Time Range');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('3d');
  });

  test('renders with custom value', () => {
    render(<TimeRangeInput value="1w" onChange={mockOnChange} />);
    
    const input = screen.getByLabelText('Time Range');
    expect(input).toHaveValue('1w');
  });

  test('clears input on focus and restores on blur if empty', async () => {
    render(<TimeRangeInput value="3d" onChange={mockOnChange} />);
    
    const input = screen.getByLabelText('Time Range');
    
    // Focus the input
    fireEvent.focus(input);
    expect(input).toHaveValue('');
    
    // Blur without typing anything
    fireEvent.blur(input);
    expect(input).toHaveValue('3d');
  });

  test('keeps new value on blur if input is not empty', async () => {
    const user = userEvent.setup();
    render(<TimeRangeInput value="3d" onChange={mockOnChange} />);
    
    const input = screen.getByLabelText('Time Range');
    
    // Focus and type new value
    await user.click(input);
    await user.type(input, '5h');
    
    // Blur the input
    fireEvent.blur(input);
    expect(input).toHaveValue('5h');
  });

  test('shows dropdown on focus', async () => {
    render(<TimeRangeInput value="3d" onChange={mockOnChange} />);
    
    const input = screen.getByLabelText('Time Range');
    fireEvent.focus(input);
    
    // Check if dropdown is visible
    expect(screen.getByText('Type custom relative times like:')).toBeInTheDocument();
    
    // Check if all suggestions are displayed
    suggestions[0].items.forEach(suggestion => {
      expect(screen.getByText(suggestion)).toBeInTheDocument();
    });
  });

  test('calls onChange with correct data when selecting from dropdown', async () => {
    render(<TimeRangeInput value="3d" onChange={mockOnChange} />);
    
    const input = screen.getByLabelText('Time Range');
    fireEvent.focus(input);
    
    // Click on a suggestion
    const suggestion = screen.getByText('1w');
    fireEvent.click(suggestion);
    
    expect(mockOnChange).toHaveBeenCalledWith({
      startTime: expect.any(moment),
      endTime: expect.any(moment),
      displayValue: '1w'
    });
    
    const call = mockOnChange.mock.calls[0][0];
    expect(call.endTime.diff(call.startTime, 'days')).toBe(7);
  });

  test('handles Enter key to submit current value', async () => {
    const user = userEvent.setup();
    render(<TimeRangeInput value="3d" onChange={mockOnChange} />);
    
    const input = screen.getByLabelText('Time Range');
    await user.click(input);
    await user.type(input, '2h');
    
    // Press Enter
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    expect(mockOnChange).toHaveBeenCalledWith({
      startTime: expect.any(moment),
      endTime: expect.any(moment),
      displayValue: '2h'
    });
    
    const call = mockOnChange.mock.calls[0][0];
    expect(call.endTime.diff(call.startTime, 'hours')).toBe(2);
  });

  test('handles Enter key with empty input (uses previous value)', async () => {
    render(<TimeRangeInput value="3d" onChange={mockOnChange} />);
    
    const input = screen.getByLabelText('Time Range');
    fireEvent.focus(input);
    
    // Input is cleared on focus, press Enter immediately
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    expect(mockOnChange).toHaveBeenCalledWith({
      startTime: expect.any(moment),
      endTime: expect.any(moment),
      displayValue: '3d'
    });
  });

  test('parses various duration formats correctly', () => {
    const testCases = [
      { input: '1h', expectedDiff: 1, unit: 'hours' },
      { input: '5h', expectedDiff: 5, unit: 'hours' },
      { input: '2d', expectedDiff: 2, unit: 'days' },
      { input: '3w', expectedDiff: 3, unit: 'weeks' },
      { input: '1y', expectedDiff: 1, unit: 'years' }
    ];

    testCases.forEach(({ input, expectedDiff, unit }) => {
      render(
        <TimeRangeInput 
          key={input}
          value="3d" 
          onChange={mockOnChange} 
        />
      );
      
      const inputElement = screen.getByLabelText('Time Range');
      fireEvent.focus(inputElement);
      fireEvent.change(inputElement, { target: { value: input } });
      fireEvent.keyDown(inputElement, { key: 'Enter', code: 'Enter' });
      
      const call = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      expect(call.endTime.diff(call.startTime, unit)).toBe(expectedDiff);
    });
  });

  test('does not call onChange for invalid input', async () => {
    const user = userEvent.setup();
    render(<TimeRangeInput value="3d" onChange={mockOnChange} />);
    
    const input = screen.getByLabelText('Time Range');
    await user.click(input);
    await user.type(input, 'invalid');
    
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  test('dropdown opens when typing', async () => {
    const user = userEvent.setup();
    render(<TimeRangeInput value="3d" onChange={mockOnChange} />);
    
    const input = screen.getByLabelText('Time Range');
    
    // Initially dropdown should not be visible
    expect(screen.queryByText('Type custom relative times like:')).not.toBeInTheDocument();
    
    // Type in the input
    await user.click(input);
    await user.type(input, '1');
    
    // Dropdown should be visible
    expect(screen.getByText('Type custom relative times like:')).toBeInTheDocument();
  });

  test('displays helper text in dropdown', () => {
    render(<TimeRangeInput value="3d" onChange={mockOnChange} />);
    
    const input = screen.getByLabelText('Time Range');
    fireEvent.focus(input);
    
    expect(screen.getByText('* Data available from 9/1/2024 onward')).toBeInTheDocument();
  });

  test('suggestion items have correct styling attributes', () => {
    render(<TimeRangeInput value="3d" onChange={mockOnChange} />);
    
    const input = screen.getByLabelText('Time Range');
    fireEvent.focus(input);
    
    const firstSuggestion = screen.getByText('1h');
    expect(firstSuggestion).toHaveStyle({
      padding: '6px 12px',
      borderRadius: '4px',
      fontSize: '14px',
      cursor: 'pointer'
    });
  });

  test('handles case insensitive duration units', async () => {
    const testCases = ['1H', '1h', '2D', '2d', '1W', '1w', '1Y', '1y'];
    
    for (const testCase of testCases) {
      render(
        <TimeRangeInput 
          key={testCase}
          value="3d" 
          onChange={mockOnChange} 
        />
      );
      
      const input = screen.getByLabelText('Time Range');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: testCase } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
      
      expect(mockOnChange).toHaveBeenCalled();
      mockOnChange.mockClear();
    }
  });

  test('updates input value when prop changes', () => {
    const { rerender } = render(<TimeRangeInput value="3d" onChange={mockOnChange} />);
    
    const input = screen.getByLabelText('Time Range');
    expect(input).toHaveValue('3d');
    
    rerender(<TimeRangeInput value="1w" onChange={mockOnChange} />);
    expect(input).toHaveValue('1w');
  });

  test('parseTimeRange returns null for invalid formats', () => {
    // Access the parseTimeRange function indirectly through component behavior
    render(<TimeRangeInput value="3d" onChange={mockOnChange} />);
    
    const input = screen.getByLabelText('Time Range');
    
    const invalidInputs = ['abc', '123', 'h1', 'd', ''];
    
    invalidInputs.forEach(invalidInput => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: invalidInput } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });
    
    // onChange should not be called for any invalid inputs
    expect(mockOnChange).not.toHaveBeenCalled();
  });
});

describe('TimeRangeInput Integration', () => {
  test('integrates with parent component state management', async () => {
    const user = userEvent.setup();
    let currentValue = '3d';
    
    const handleChange = jest.fn(({ displayValue }) => {
      currentValue = displayValue;
    });
    
    const { rerender } = render(
      <TimeRangeInput value={currentValue} onChange={handleChange} />
    );
    
    const input = screen.getByLabelText('Time Range');
    
    // Change the value
    await user.click(input);
    await user.type(input, '1w');
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    expect(handleChange).toHaveBeenCalledWith({
      startTime: expect.any(moment),
      endTime: expect.any(moment),
      displayValue: '1w'
    });
    
    // Simulate parent component updating its state
    rerender(<TimeRangeInput value="1w" onChange={handleChange} />);
    expect(input).toHaveValue('1w');
  });

  test('maintains timezone consistency', () => {
    render(<TimeRangeInput value="1d" onChange={mockOnChange} />);
    
    const input = screen.getByLabelText('Time Range');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1h' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    const call = mockOnChange.mock.calls[0][0];
    
    // Both times should be moment objects
    expect(moment.isMoment(call.startTime)).toBe(true);
    expect(moment.isMoment(call.endTime)).toBe(true);
    
    // End time should be approximately now
    const now = moment();
    expect(Math.abs(call.endTime.diff(now, 'seconds'))).toBeLessThan(2);
    
    // Start time should be 1 hour before end time
    expect(call.endTime.diff(call.startTime, 'hours')).toBe(1);
  });
});