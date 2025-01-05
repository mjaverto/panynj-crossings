import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Title, Grid, Card, LoadingOverlay, MantineProvider, Switch, Container, Select, Text } from '@mantine/core';
import { IconBuildingBridge } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/charts/styles.css';
import { LineChart } from '@mantine/charts';
import moment from 'moment-timezone';
import { TimeRangeInput, suggestions } from './components/TimeRangeInput';

// Supabase client initialization 
const supabase = createClient('https://jurzflavaojycfbqjyex.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cnpmbGF2YW9qeWNmYnFqeWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ2ODIxNzcsImV4cCI6MjA0MDI1ODE3N30.pzgMDzfizUDWa5pBrnNLklTKd2Gr-zhVnLWPuWO35fc');

function App() {
  const [selectedCrossing, setSelectedCrossing] = useState('Holland Tunnel');
  const [timeRange, setTimeRange] = useState('3d');
  const [granularity, setGranularity] = useState('15 minutes');
  const [chartData, setChartData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoRefreshOn, setIsAutoRefreshOn] = useState(false);
  const [customTimeRange, setCustomTimeRange] = useState(null);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <MantineProvider defaultColorScheme="auto">
      <AppContent 
        selectedCrossing={selectedCrossing}
        setSelectedCrossing={setSelectedCrossing}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        granularity={granularity}
        setGranularity={setGranularity}
        chartData={chartData}
        setChartData={setChartData}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        isAutoRefreshOn={isAutoRefreshOn}
        setIsAutoRefreshOn={setIsAutoRefreshOn}
        customTimeRange={customTimeRange}
        setCustomTimeRange={setCustomTimeRange}
        isControlsVisible={isControlsVisible}
        setIsControlsVisible={setIsControlsVisible}
        isMobile={isMobile}
      />
    </MantineProvider>
  );
}

function AppContent({ 
  selectedCrossing, setSelectedCrossing,
  timeRange, setTimeRange,
  granularity, setGranularity,
  chartData, setChartData,
  isLoading, setIsLoading,
  isAutoRefreshOn, setIsAutoRefreshOn,
  customTimeRange, setCustomTimeRange,
  isControlsVisible, setIsControlsVisible,
  isMobile
}) {
  
  // Decide how to interpret the timeRange selection into actual start/end timestamps
  function calculateTimeRange() {
    if (timeRange === 'custom' && customTimeRange) {
      return {
        startTime: customTimeRange.startTime,
        endTime: customTimeRange.endTime
      };
    }

    const endTime = moment().tz('America/New_York');
    let startTime = endTime.clone();

    // Handle dynamic duration formats first
    const durationMatch = timeRange.match(/^(\d+)([hdwy])$/i);
    if (durationMatch) {
      const [, amount, unit] = durationMatch;
      const unitMapping = { h: 'hours', d: 'days', w: 'weeks', y: 'years' };
      startTime.subtract(amount, unitMapping[unit.toLowerCase()]);
      return { startTime, endTime };
    }

    // Handle predefined cases
    switch (timeRange) {
      case '1h':
        startTime.subtract(1, 'hours');
        break;
      case '3h':
        startTime.subtract(3, 'hours');
        break;
      case '12h':
        startTime.subtract(12, 'hours');
        break;
      case '1d':
        startTime.subtract(1, 'days');
        break;
      case '3d':
        startTime.subtract(3, 'days');
        break;
      case '1w':
        startTime.subtract(7, 'days');
        break;
      case '2w':
        startTime.subtract(14, 'days');
        break;
      case '30d':
        startTime.subtract(30, 'days');
        break;
      case '60d':
        startTime.subtract(60, 'days');
        break;
      case '90d':
        startTime.subtract(90, 'days');
        break;
      case '1y':
        startTime.subtract(1, 'years');
        break;
      case '2y':
        startTime.subtract(2, 'years');
        break;
      case '5y':
        startTime.subtract(5, 'years');
        break;
      default:
        startTime.subtract(3, 'days');
    }
    return { startTime, endTime };
  }

  // Map a granularity label from UI to an actual Postgres interval string
  function mapGranularityToInterval(granularityValue) {
    switch (granularityValue) {
      case '1 minute':
        return '1 minute';
      case '5 minutes':
        return '5 minutes';
      case '15 minutes':
        return '15 minutes';
      case '30 minutes':
        return '30 minutes';
      case '1 hour':
        return '1 hour';
      case '6 hours':
        return '6 hours';
      case '12 hours':
        return '12 hours';
      case '1 day':
        return '1 day';
      case '1 week':
        return '1 week';
      default:
        return '15 minutes';
    }
  }

  // Example new fetch function calling get_crossing_data_aggregated
  async function fetchAggregatedData(crossing) {
    setIsLoading(true);

    try {
      const { startTime, endTime } = calculateTimeRange();

      // Convert to UTC strings
      const startTs = startTime.utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
      const endTs = endTime.utc().format('YYYY-MM-DDTHH:mm:ss[Z]');

      const rpcParams = {
        in_start_timestamp: startTs,
        in_end_timestamp: endTs,
        in_crossing: crossing === 'All' ? 'All' : crossing,
        in_aggregation_interval: mapGranularityToInterval(granularity),
      };

      const { data, error } = await supabase.rpc('get_crossing_data_aggregated', rpcParams);

      if (error) {
        console.error('Error fetching aggregated data:', error);
        return;
      }

      // Format data for your chart. Example:
      const newFormattedData = formatAggregatedForChart(data);
      setChartData(newFormattedData);
    } catch (err) {
      console.error('Error calling get_crossing_data_aggregated:', err);
    } finally {
      setIsLoading(false);
    }
  }

  // Example function that converts results of get_crossing_data_aggregated to your chart format
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

  // Example effect to automatically refresh when toggled
  useEffect(() => {
    if (isAutoRefreshOn) {
      fetchAggregatedData(selectedCrossing);
      const intervalId = setInterval(() => {
        fetchAggregatedData(selectedCrossing);
      }, 60_000);
      return () => clearInterval(intervalId);
    } else {
      fetchAggregatedData(selectedCrossing);
    }
  }, [isAutoRefreshOn, timeRange, granularity, selectedCrossing]);

  const controlsContent = (
    <>
      <Grid align="flex-start">
        <Grid.Col span={isMobile ? 12 : 4}>
          <Select
            label="Select Crossing"
            placeholder="All or a specific crossing"
            data={[
              { value: 'All', label: 'All Crossings' },
              { value: 'Holland Tunnel', label: 'Holland Tunnel' },
              { value: 'Lincoln Tunnel', label: 'Lincoln Tunnel' },
              { value: 'Bayonne Bridge', label: 'Bayonne Bridge' },
              { value: 'George Washington Bridge', label: 'George Washington Bridge' },
              { value: 'Goethals Bridge', label: 'Goethals Bridge' },
              { value: 'Outerbridge Crossing', label: 'Outerbridge Crossing' }
            ]}
            value={selectedCrossing}
            onChange={(value) => setSelectedCrossing(value)}
          />
        </Grid.Col>

        <Grid.Col span={isMobile ? 12 : 4}>
          <TimeRangeInput 
            value={timeRange}
            onChange={({ startTime, endTime, displayValue }) => {
              // Check if it matches the duration pattern (e.g., 1h, 6d, 2w, etc.)
              const isDurationFormat = /^\d+[hdwy]$/i.test(displayValue);
              if (isDurationFormat || suggestions[0].items.includes(displayValue)) {
                setTimeRange(displayValue);
                setCustomTimeRange(null);
              } else {
                setTimeRange('custom');
                setCustomTimeRange({
                  startTime: moment(startTime),
                  endTime: moment(endTime)
                });
              }
            }}
          />
        </Grid.Col>

        <Grid.Col span={isMobile ? 12 : 3}>
          <Select
            label="Granularity"
            data={[
              { value: '1 minute', label: '1 minute' },
              { value: '5 minutes', label: '5 minutes' },
              { value: '15 minutes', label: '15 minutes' },
              { value: '30 minutes', label: '30 minutes' },
              { value: '1 hour', label: '1 hour' },
              { value: '6 hours', label: '6 hours' },
              { value: '12 hours', label: '12 hours' },
              { value: '1 day', label: '1 day' },
              { value: '1 week', label: '1 week' },
            ]}
            value={granularity}
            onChange={(val) => setGranularity(val)}
          />
        </Grid.Col>

        <Grid.Col span={isMobile ? 12 : 1} style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'flex-start',
          paddingTop: '28px'  // This matches Mantine's input label spacing
        }}>
          <Text size="sm" fw={500} mb={3}>Auto-Refresh</Text>
          <Switch
            checked={isAutoRefreshOn}
            onChange={(event) => setIsAutoRefreshOn(event.currentTarget.checked)}
            label=""
          />
        </Grid.Col>
      </Grid>
    </>
  );

  return (
    <div className="App">
      <main className="main-content">
        <Title order={1} align="center" my="xl">NYC Crossings History</Title>
        <Container size="xl">
          <Card 
            withBorder 
            shadow="sm" 
            p="lg" 
            style={{ 
              position: 'relative', 
              paddingBottom: '24px',
              overflow: 'visible'  // This ensures the button isn't clipped
            }}
          >
            {isMobile ? (
              <>
                {controlsContent}
              </>
            ) : (
              controlsContent
            )}
          </Card>

          <LoadingOverlay visible={isLoading} />

          {/* Chart rendering */}
          {!isLoading && Object.keys(chartData).map((key, idx) => (
            <Card withBorder shadow="sm" p="lg" mt="md" key={idx}>
              <Title order={3} align="center">{key}</Title>
              <LineChart
                data={chartData[key]}
                h={300}
                dataKey="date"
                strokeWidth={3}
                curveType="monotone"
                withLegend
                series={[
                  { name: 'Average Speed', color: 'teal.6' },
                  { name: 'Average Travel Time', color: 'grape.6' }
                ]}
                gridAxis="xy"
                theme="dark"
                tickLine="xy"
              />
            </Card>
          ))}
        </Container>
      </main>
      <footer style={{
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        color: 'var(--mantine-color-dimmed)'
      }}>
        <Text size="sm">Made in Brooklyn</Text>
        <IconBuildingBridge size={18} style={{ transform: 'translateY(-1px)' }} />
      </footer>
    </div>
  );
}

export default App;
