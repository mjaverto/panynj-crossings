import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import App from './App';
import { createClient } from '@supabase/supabase-js';
import moment from 'moment-timezone';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    rpc: jest.fn()
  }))
}));

// Mock LineChart component
jest.mock('@mantine/charts', () => ({
  LineChart: ({ data, series }) => (
    <div data-testid="line-chart">
      {JSON.stringify({ data, series })}
    </div>
  )
}));

// Mock useMediaQuery hook
jest.mock('@mantine/hooks', () => ({
  useMediaQuery: jest.fn(() => false)
}));

describe('App Component', () => {
  let mockSupabaseClient;

  beforeEach(() => {
    mockSupabaseClient = {
      rpc: jest.fn().mockResolvedValue({
        data: [
          {
            crossing_display_name: 'Holland Tunnel',
            bucket_time: '2024-01-01T12:00:00Z',
            avg_speed: 45.5,
            avg_travel_time: 12.3
          },
          {
            crossing_display_name: 'Holland Tunnel',
            bucket_time: '2024-01-01T13:00:00Z',
            avg_speed: 42.1,
            avg_travel_time: 14.2
          }
        ],
        error: null
      })
    };
    createClient.mockReturnValue(mockSupabaseClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText('NYC Crossings History')).toBeInTheDocument();
  });

  test('renders all control elements', () => {
    render(<App />);
    
    expect(screen.getByLabelText('Select Crossing')).toBeInTheDocument();
    expect(screen.getByLabelText('Time Range')).toBeInTheDocument();
    expect(screen.getByLabelText('Granularity')).toBeInTheDocument();
    expect(screen.getByText('Auto-Refresh')).toBeInTheDocument();
  });

  test('default values are set correctly', () => {
    render(<App />);
    
    const crossingSelect = screen.getByLabelText('Select Crossing');
    const granularitySelect = screen.getByLabelText('Granularity');
    
    expect(crossingSelect).toHaveValue('Holland Tunnel');
    expect(granularitySelect).toHaveValue('15 minutes');
  });

  test('crossing selection changes trigger data fetch', async () => {
    render(<App />);
    
    const crossingSelect = screen.getByLabelText('Select Crossing');
    
    await act(async () => {
      fireEvent.change(crossingSelect, { target: { value: 'Lincoln Tunnel' } });
    });

    await waitFor(() => {
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'get_crossing_data_aggregated',
        expect.objectContaining({
          in_crossing: 'Lincoln Tunnel'
        })
      );
    });
  });

  test('granularity changes trigger data fetch with correct interval', async () => {
    render(<App />);
    
    const granularitySelect = screen.getByLabelText('Granularity');
    
    await act(async () => {
      fireEvent.change(granularitySelect, { target: { value: '1 hour' } });
    });

    await waitFor(() => {
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'get_crossing_data_aggregated',
        expect.objectContaining({
          in_aggregation_interval: '1 hour'
        })
      );
    });
  });

  test('auto-refresh toggle enables periodic data fetching', async () => {
    jest.useFakeTimers();
    render(<App />);
    
    const autoRefreshSwitch = screen.getByRole('checkbox');
    
    await act(async () => {
      fireEvent.click(autoRefreshSwitch);
    });

    // Initial call when toggled
    expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(2); // 1 initial + 1 on toggle

    // Advance timer by 60 seconds
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    await waitFor(() => {
      expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(3); // Should have made another call
    });

    jest.useRealTimers();
  });

  test('error handling when data fetch fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    mockSupabaseClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' }
    });

    render(<App />);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Error fetching aggregated data:',
        expect.objectContaining({ message: 'Database error' })
      );
    });

    consoleError.mockRestore();
  });

  test('chart renders with fetched data', async () => {
    render(<App />);

    await waitFor(() => {
      const chart = screen.getByTestId('line-chart');
      expect(chart).toBeInTheDocument();
      
      const chartData = JSON.parse(chart.textContent);
      expect(chartData.data).toBeDefined();
      expect(chartData.series).toEqual([
        { name: 'Average Speed', color: 'teal.6' },
        { name: 'Average Travel Time', color: 'grape.6' }
      ]);
    });
  });

  test('loading overlay appears during data fetch', async () => {
    // Create a promise that we can control
    let resolvePromise;
    const pendingPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    
    mockSupabaseClient.rpc.mockReturnValueOnce(pendingPromise);

    render(<App />);

    // Loading should be visible
    expect(screen.getByRole('presentation')).toBeInTheDocument();

    // Resolve the promise
    await act(async () => {
      resolvePromise({ data: [], error: null });
    });

    // Loading should be hidden
    await waitFor(() => {
      expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
    });
  });
});

describe('Utility Functions', () => {
  describe('calculateTimeRange', () => {
    test('handles predefined time ranges', () => {
      const testCases = [
        { input: '1h', expectedSubtract: [1, 'hours'] },
        { input: '3d', expectedSubtract: [3, 'days'] },
        { input: '1w', expectedSubtract: [7, 'days'] },
        { input: '1y', expectedSubtract: [1, 'years'] }
      ];

      testCases.forEach(({ input, expectedSubtract }) => {
        const now = moment();
        const result = calculateTimeRange(input);
        
        expect(result.endTime.isSame(now, 'minute')).toBe(true);
        expect(result.startTime.isBefore(result.endTime)).toBe(true);
        
        const expectedStart = now.clone().subtract(...expectedSubtract);
        expect(result.startTime.isSame(expectedStart, 'minute')).toBe(true);
      });
    });

    test('handles dynamic duration formats', () => {
      const testCases = [
        { input: '6h', expectedSubtract: [6, 'hours'] },
        { input: '10d', expectedSubtract: [10, 'days'] },
        { input: '4w', expectedSubtract: [4, 'weeks'] },
        { input: '2y', expectedSubtract: [2, 'years'] }
      ];

      testCases.forEach(({ input, expectedSubtract }) => {
        const result = calculateTimeRange(input);
        const now = moment();
        const expectedStart = now.clone().subtract(...expectedSubtract);
        
        expect(result.startTime.isSame(expectedStart, 'minute')).toBe(true);
      });
    });

    test('handles custom time range', () => {
      const customRange = {
        startTime: moment('2024-01-01T10:00:00'),
        endTime: moment('2024-01-02T10:00:00')
      };

      const result = calculateTimeRange('custom', customRange);
      
      expect(result.startTime.isSame(customRange.startTime)).toBe(true);
      expect(result.endTime.isSame(customRange.endTime)).toBe(true);
    });
  });

  describe('mapGranularityToInterval', () => {
    test('maps all granularity options correctly', () => {
      const mappings = {
        '1 minute': '1 minute',
        '5 minutes': '5 minutes',
        '15 minutes': '15 minutes',
        '30 minutes': '30 minutes',
        '1 hour': '1 hour',
        '6 hours': '6 hours',
        '12 hours': '12 hours',
        '1 day': '1 day',
        '1 week': '1 week'
      };

      Object.entries(mappings).forEach(([input, expected]) => {
        expect(mapGranularityToInterval(input)).toBe(expected);
      });
    });

    test('returns default for unknown granularity', () => {
      expect(mapGranularityToInterval('unknown')).toBe('15 minutes');
    });
  });

  describe('formatAggregatedForChart', () => {
    test('formats aggregated data correctly', () => {
      const input = [
        {
          crossing_display_name: 'Holland Tunnel',
          bucket_time: '2024-01-01T12:00:00Z',
          avg_speed: 45.5,
          avg_travel_time: 12.3
        },
        {
          crossing_display_name: 'Lincoln Tunnel',
          bucket_time: '2024-01-01T12:00:00Z',
          avg_speed: 38.2,
          avg_travel_time: 15.7
        },
        {
          crossing_display_name: 'Holland Tunnel',
          bucket_time: '2024-01-01T13:00:00Z',
          avg_speed: 42.1,
          avg_travel_time: 14.2
        }
      ];

      const result = formatAggregatedForChart(input);

      expect(Object.keys(result)).toEqual(['Holland Tunnel', 'Lincoln Tunnel']);
      expect(result['Holland Tunnel']).toHaveLength(2);
      expect(result['Lincoln Tunnel']).toHaveLength(1);
      
      expect(result['Holland Tunnel'][0]).toEqual({
        date: expect.stringMatching(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} (AM|PM)/),
        'Average Speed': 45.5,
        'Average Travel Time': 12.3
      });
    });

    test('handles empty data', () => {
      const result = formatAggregatedForChart([]);
      expect(result).toEqual({});
    });
  });
});

// Helper functions for testing (simulate the functions in App.js)
function calculateTimeRange(timeRange, customTimeRange) {
  if (timeRange === 'custom' && customTimeRange) {
    return {
      startTime: customTimeRange.startTime,
      endTime: customTimeRange.endTime
    };
  }

  const endTime = moment().tz('America/New_York');
  let startTime = endTime.clone();

  const durationMatch = timeRange.match(/^(\d+)([hdwy])$/i);
  if (durationMatch) {
    const [, amount, unit] = durationMatch;
    const unitMapping = { h: 'hours', d: 'days', w: 'weeks', y: 'years' };
    startTime.subtract(amount, unitMapping[unit.toLowerCase()]);
    return { startTime, endTime };
  }

  const predefinedRanges = {
    '1h': [1, 'hours'],
    '3h': [3, 'hours'],
    '12h': [12, 'hours'],
    '1d': [1, 'days'],
    '3d': [3, 'days'],
    '1w': [7, 'days'],
    '2w': [14, 'days'],
    '30d': [30, 'days'],
    '60d': [60, 'days'],
    '90d': [90, 'days'],
    '1y': [1, 'years'],
    '2y': [2, 'years'],
    '5y': [5, 'years']
  };

  const range = predefinedRanges[timeRange] || [3, 'days'];
  startTime.subtract(...range);
  
  return { startTime, endTime };
}

function mapGranularityToInterval(granularityValue) {
  const mapping = {
    '1 minute': '1 minute',
    '5 minutes': '5 minutes',
    '15 minutes': '15 minutes',
    '30 minutes': '30 minutes',
    '1 hour': '1 hour',
    '6 hours': '6 hours',
    '12 hours': '12 hours',
    '1 day': '1 day',
    '1 week': '1 week'
  };
  
  return mapping[granularityValue] || '15 minutes';
}

function formatAggregatedForChart(rows) {
  const groupedByCrossing = {};

  rows.forEach((row) => {
    const { crossing_display_name, bucket_time, avg_speed, avg_travel_time } = row;

    if (!groupedByCrossing[crossing_display_name]) {
      groupedByCrossing[crossing_display_name] = [];
    }

    groupedByCrossing[crossing_display_name].push({
      date: moment.utc(bucket_time).tz('America/New_York').format('YYYY-MM-DD hh:mm A'),
      'Average Speed': avg_speed,
      'Average Travel Time': avg_travel_time,
    });
  });

  return groupedByCrossing;
}
