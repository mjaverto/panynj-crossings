import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';
import App from './App';
import { createClient } from '@supabase/supabase-js';
import moment from 'moment-timezone';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

// Mock LineChart component with more detailed implementation
jest.mock('@mantine/charts', () => ({
  LineChart: ({ data, series, dataKey }) => (
    <div data-testid="line-chart" data-datakey={dataKey}>
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      <div data-testid="chart-series">{JSON.stringify(series)}</div>
    </div>
  )
}));

// Mock useMediaQuery hook
jest.mock('@mantine/hooks', () => ({
  useMediaQuery: jest.fn(() => false)
}));

describe('App Integration Tests', () => {
  let mockSupabaseClient;
  let mockRpc;

  beforeEach(() => {
    // Setup mock RPC function
    mockRpc = jest.fn();
    mockSupabaseClient = {
      rpc: mockRpc
    };
    createClient.mockReturnValue(mockSupabaseClient);

    // Default mock response
    mockRpc.mockResolvedValue({
      data: [
        {
          crossing_display_name: 'Holland Tunnel',
          bucket_time: '2024-01-01T12:00:00Z',
          avg_speed: 45.5,
          min_speed: 40.0,
          max_speed: 50.0,
          avg_travel_time: 12.3,
          min_travel_time: 10.0,
          max_travel_time: 15.0
        },
        {
          crossing_display_name: 'Holland Tunnel',
          bucket_time: '2024-01-01T13:00:00Z',
          avg_speed: 42.1,
          min_speed: 38.0,
          max_speed: 46.0,
          avg_travel_time: 14.2,
          min_travel_time: 12.0,
          max_travel_time: 16.0
        }
      ],
      error: null
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete User Flow', () => {
    test('user can select crossing, change time range, and see updated chart', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Verify initial state
      expect(screen.getByText('NYC Crossings History')).toBeInTheDocument();
      expect(screen.getByLabelText('Select Crossing')).toHaveValue('Holland Tunnel');

      // Wait for initial data load
      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('get_crossing_data_aggregated', {
          in_start_timestamp: expect.any(String),
          in_end_timestamp: expect.any(String),
          in_crossing: 'Holland Tunnel',
          in_aggregation_interval: '15 minutes'
        });
      });

      // Change crossing to Lincoln Tunnel
      const crossingSelect = screen.getByLabelText('Select Crossing');
      await user.selectOptions(crossingSelect, 'Lincoln Tunnel');

      // Verify new API call
      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('get_crossing_data_aggregated', 
          expect.objectContaining({
            in_crossing: 'Lincoln Tunnel'
          })
        );
      });

      // Change time range
      const timeRangeInput = screen.getByLabelText('Time Range');
      await user.click(timeRangeInput);
      await user.clear(timeRangeInput);
      await user.type(timeRangeInput, '1w');
      fireEvent.keyDown(timeRangeInput, { key: 'Enter' });

      // Verify API call with new time range
      await waitFor(() => {
        const lastCall = mockRpc.mock.calls[mockRpc.mock.calls.length - 1][1];
        const startTime = moment(lastCall.in_start_timestamp);
        const endTime = moment(lastCall.in_end_timestamp);
        expect(endTime.diff(startTime, 'days')).toBeCloseTo(7, 0);
      });
    });

    test('user can enable auto-refresh and see periodic updates', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ delay: null });
      
      render(<App />);

      // Wait for initial load
      await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(1));

      // Enable auto-refresh
      const autoRefreshSwitch = screen.getByRole('checkbox');
      await user.click(autoRefreshSwitch);

      // Should trigger immediate refresh
      await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));

      // Advance time by 60 seconds
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      // Should trigger another refresh
      await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(3));

      // Disable auto-refresh
      await user.click(autoRefreshSwitch);

      // Advance time again
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      // Should not trigger more refreshes
      expect(mockRpc).toHaveBeenCalledTimes(4); // One more from disabling

      jest.useRealTimers();
    });

    test('user can select "All Crossings" and see aggregated data', async () => {
      const user = userEvent.setup();
      
      // Mock response for all crossings
      mockRpc.mockResolvedValueOnce({
        data: [
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
            crossing_display_name: 'George Washington Bridge',
            bucket_time: '2024-01-01T12:00:00Z',
            avg_speed: 55.3,
            avg_travel_time: 8.5
          }
        ],
        error: null
      });

      render(<App />);

      // Select "All Crossings"
      const crossingSelect = screen.getByLabelText('Select Crossing');
      await user.selectOptions(crossingSelect, 'All');

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('get_crossing_data_aggregated',
          expect.objectContaining({
            in_crossing: 'All'
          })
        );
      });

      // Verify multiple charts are rendered
      await waitFor(() => {
        const charts = screen.getAllByTestId('line-chart');
        expect(charts.length).toBeGreaterThan(1);
      });
    });

    test('user can change granularity and see updated data', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Wait for initial load
      await waitFor(() => expect(mockRpc).toHaveBeenCalled());

      // Change granularity to 1 hour
      const granularitySelect = screen.getByLabelText('Granularity');
      await user.selectOptions(granularitySelect, '1 hour');

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('get_crossing_data_aggregated',
          expect.objectContaining({
            in_aggregation_interval: '1 hour'
          })
        );
      });

      // Change to 1 day
      await user.selectOptions(granularitySelect, '1 day');

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('get_crossing_data_aggregated',
          expect.objectContaining({
            in_aggregation_interval: '1 day'
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    test('handles API errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' }
      });

      render(<App />);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Error fetching aggregated data:',
          expect.objectContaining({ message: 'Database connection failed' })
        );
      });

      // App should still be functional
      expect(screen.getByText('NYC Crossings History')).toBeInTheDocument();
      
      consoleError.mockRestore();
    });

    test('handles empty data response', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [],
        error: null
      });

      render(<App />);

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalled();
      });

      // Should not crash and controls should still be visible
      expect(screen.getByLabelText('Select Crossing')).toBeInTheDocument();
      expect(screen.getByLabelText('Time Range')).toBeInTheDocument();
    });

    test('handles network errors during auto-refresh', async () => {
      jest.useFakeTimers();
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const user = userEvent.setup({ delay: null });

      render(<App />);

      // Enable auto-refresh
      const autoRefreshSwitch = screen.getByRole('checkbox');
      await user.click(autoRefreshSwitch);

      // Mock network error for next call
      mockRpc.mockRejectedValueOnce(new Error('Network error'));

      // Advance timer
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Error calling get_crossing_data_aggregated:',
          expect.any(Error)
        );
      });

      // Auto-refresh should continue despite error
      mockRpc.mockResolvedValueOnce({ data: [], error: null });
      
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      await waitFor(() => {
        // Should make another attempt
        expect(mockRpc).toHaveBeenCalled();
      });

      consoleError.mockRestore();
      jest.useRealTimers();
    });
  });

  describe('Data Visualization', () => {
    test('chart displays correct data format', async () => {
      const mockData = [
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
      ];

      mockRpc.mockResolvedValueOnce({ data: mockData, error: null });

      render(<App />);

      await waitFor(() => {
        const chartData = screen.getByTestId('chart-data');
        const data = JSON.parse(chartData.textContent);
        
        expect(data).toHaveLength(2);
        expect(data[0]).toHaveProperty('date');
        expect(data[0]).toHaveProperty('Average Speed', 45.5);
        expect(data[0]).toHaveProperty('Average Travel Time', 12.3);
      });

      // Verify series configuration
      const chartSeries = screen.getByTestId('chart-series');
      const series = JSON.parse(chartSeries.textContent);
      
      expect(series).toEqual([
        { name: 'Average Speed', color: 'teal.6' },
        { name: 'Average Travel Time', color: 'grape.6' }
      ]);
    });

    test('multiple charts render for different crossings', async () => {
      const mockData = [
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
        }
      ];

      mockRpc.mockResolvedValueOnce({ data: mockData, error: null });

      render(<App />);

      await waitFor(() => {
        const cards = screen.getAllByRole('article'); // Mantine Card components
        // Subtract 1 for the controls card
        const chartCards = cards.filter(card => {
          return within(card).queryByTestId('line-chart') !== null;
        });
        
        expect(chartCards).toHaveLength(2);
      });

      // Verify each chart has correct title
      expect(screen.getByText('Holland Tunnel')).toBeInTheDocument();
      expect(screen.getByText('Lincoln Tunnel')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    test('shows loading overlay during data fetch', async () => {
      let resolvePromise;
      const pendingPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      
      mockRpc.mockReturnValueOnce(pendingPromise);

      render(<App />);

      // Loading overlay should be visible
      expect(screen.getByRole('presentation')).toBeInTheDocument();

      // Resolve the promise
      await act(async () => {
        resolvePromise({ data: [], error: null });
      });

      // Loading overlay should be hidden
      await waitFor(() => {
        expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
      });
    });

    test('loading state does not block user interactions', async () => {
      const user = userEvent.setup();
      let resolvePromise;
      const pendingPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      
      mockRpc.mockReturnValueOnce(pendingPromise);

      render(<App />);

      // Loading overlay is visible
      expect(screen.getByRole('presentation')).toBeInTheDocument();

      // User can still interact with controls
      const granularitySelect = screen.getByLabelText('Granularity');
      await user.selectOptions(granularitySelect, '1 hour');

      // Complete the pending request
      await act(async () => {
        resolvePromise({ data: [], error: null });
      });

      // New request should be made with updated granularity
      await waitFor(() => {
        const calls = mockRpc.mock.calls;
        const lastCall = calls[calls.length - 1][1];
        expect(lastCall.in_aggregation_interval).toBe('1 hour');
      });
    });
  });

  describe('Mobile Responsiveness', () => {
    test('adjusts layout for mobile devices', () => {
      const useMediaQuery = require('@mantine/hooks').useMediaQuery;
      useMediaQuery.mockReturnValue(true); // Simulate mobile

      render(<App />);

      // All controls should still be present
      expect(screen.getByLabelText('Select Crossing')).toBeInTheDocument();
      expect(screen.getByLabelText('Time Range')).toBeInTheDocument();
      expect(screen.getByLabelText('Granularity')).toBeInTheDocument();
      expect(screen.getByText('Auto-Refresh')).toBeInTheDocument();

      // Reset mock
      useMediaQuery.mockReturnValue(false);
    });
  });

  describe('Custom Time Range', () => {
    test('handles custom time range through TimeRangeInput', async () => {
      const user = userEvent.setup();
      render(<App />);

      const timeRangeInput = screen.getByLabelText('Time Range');
      
      // Enter a custom duration
      await user.click(timeRangeInput);
      await user.clear(timeRangeInput);
      await user.type(timeRangeInput, '6h');
      fireEvent.keyDown(timeRangeInput, { key: 'Enter' });

      await waitFor(() => {
        const lastCall = mockRpc.mock.calls[mockRpc.mock.calls.length - 1][1];
        const startTime = moment(lastCall.in_start_timestamp);
        const endTime = moment(lastCall.in_end_timestamp);
        
        // Should be approximately 6 hours difference
        expect(endTime.diff(startTime, 'hours')).toBeCloseTo(6, 0);
      });
    });
  });
});