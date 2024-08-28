import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Select, Title, Grid, Card, LoadingOverlay, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/charts/styles.css';
import { DateTimePicker } from '@mantine/dates';
import { LineChart } from '@mantine/charts';
import moment from 'moment-timezone';

// Supabase client initialization 
const supabase = createClient('https://jurzflavaojycfbqjyex.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cnpmbGF2YW9qeWNmYnFqeWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ2ODIxNzcsImV4cCI6MjA0MDI1ODE3N30.pzgMDzfizUDWa5pBrnNLklTKd2Gr-zhVnLWPuWO35fc');

function App() {
  const [selectedCrossing, setSelectedCrossing] = useState('Holland Tunnel');
  const [selectedDateTime, setSelectedDateTime] = useState(new Date());
  const [selectedInterval, setSelectedInterval] = useState('1'); // State for the interval dropdown
  const [chartData, setChartData] = useState({ westbound: [], eastbound: [] });
  const [isLoading, setIsLoading] = useState(false);

  async function fetchData() {
    setIsLoading(true);
  
    try {
      const adjustedDateTime = moment.tz(selectedDateTimeRef.current, 'America/New_York').utc().toDate();
  
      let query = supabase
        .from('crossing_times')
        .select('*')
        .eq('crossing_display_name', selectedCrossingRef.current)
        .lte('time_stamp', adjustedDateTime.toISOString())
        .order('time_stamp', { ascending: false })
        .limit(1000);
  
      const { data, error } = await query;
  
      if (error) {
        console.error('Error fetching data from Supabase:', error);
      } else {
        const formattedData = formatDataForMantineChart(data);
        setChartData(formattedData);
      }
    } catch (error) {
      console.error('Error fetching data or interacting with Supabase:', error);
    } finally {
      setIsLoading(false);
    }
  }
  

const selectedCrossingRef = useRef(selectedCrossing);
const selectedDateTimeRef = useRef(selectedDateTime);

useEffect(() => {
  selectedCrossingRef.current = selectedCrossing;
  selectedDateTimeRef.current = selectedDateTime;
}, [selectedCrossing, selectedDateTime]);

useEffect(() => {
  fetchData(); // Run fetchData on initial load
}, []);

useEffect(() => {
  const handleRefresh = () => {
    const currentTime = new Date();
    currentTime.setSeconds(0, 0); // Set the time to the exact minute, zeroing out seconds and milliseconds

    // Convert both times to strings for easy comparison
    const formattedCurrentTime = moment.tz(currentTime, 'America/New_York').format('YYYY-MM-DD HH:mm');

    const formattedSelectedTime = moment.tz(selectedDateTime, 'America/New_York').format('YYYY-MM-DD HH:mm');

    // Update selectedDateTime only if the minute has actually changed
    if (formattedCurrentTime !== formattedSelectedTime) {
      setSelectedDateTime(currentTime); // Update state with the new time
      fetchData(); // Call fetchData using the updated time
    }
  };

  handleRefresh(); // Initial fetch

  // Set up an interval to auto-refresh every 1 minute
  const intervalId = setInterval(handleRefresh, 60000);

  // Clean up the interval on component unmount
  return () => clearInterval(intervalId);
    // eslint-disable-next-line
}, [selectedCrossing, selectedDateTime]);

  // Function to format data for Mantine Charts
  function formatDataForMantineChart(data) {
    // Helper function to transform data for a specific direction
    const formatDataForDirection = (directionData) => {
      return directionData.slice().reverse().map(item => ({
        date: moment.tz((selectedInterval === '1' ? item.time_stamp : item.truncated_time), 'UTC').tz('America/New_York').format('YYYY-MM-DD h:mm A'), // Convert UTC to EST
        'Route Speed': item.route_speed,
        'Route Travel Time': item.route_travel_time
      }));
    };
  
    const westboundData = data.filter(item => item.cardinal_direction === 'westbound');
    const eastboundData = data.filter(item => item.cardinal_direction === 'eastbound');
  
    return {
      westbound: formatDataForDirection(westboundData),
      eastbound: formatDataForDirection(eastboundData)
    };
  }  

  return (
    <MantineProvider>
      <div>
        <Title order={2} align="center" mb="xl">Crossing Data Visualization</Title>

        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, md: 12, lg: 2 }}>
            <Card withBorder shadow="sm" p="lg">
              <Select
                label="Select Crossing"
                placeholder="Select a crossing"
                data={[
                  { value: 'Holland Tunnel', label: 'Holland Tunnel' },
                  { value: 'Bayonne Bridge', label: 'Bayonne Bridge' },
                  // ... other crossings
                ]}
                value={selectedCrossing}
                onChange={(value) => {
                  if (value) { // Ensure value is not null or empty
                    setSelectedCrossing(value);
                  }
                }}
              />

              <DateTimePicker
                label="Select Date and Time"
                placeholder="Select date and time"
                value={selectedDateTime}
                valueFormat="MMM DD YYYY hh:mm A"
                onChange={(value) => {
                  setSelectedDateTime(value); 
                }}
                mt="md"
              />
              <Select
                label="Interval in Minutes"
                value={selectedInterval} // Connect to state
                onChange={setSelectedInterval} // Update state on change
                data={['1', '5', '15', '60']}
                disabled="true"
              />

            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 12, lg: 10 }}>
            <Card withBorder shadow="sm" p="lg">
              <LoadingOverlay visible={isLoading} />
              {!isLoading && (
                <>
                  <h2>Westbound</h2>
                  <LineChart
                    // ... other props
                    data={chartData.westbound}
                    h={300}
                    dataKey="date"
                    strokeWidth={5}
                    curveType="natural"
                    dotProps={{ r: 0 }}
                    activeDotProps={{ r: 8 }}
                    withLegend
                    series={[
                      { name: 'Route Speed', color: 'green.6' },
                      { name: 'Route Travel Time', color: 'red.6' },
                    ]}
                  >
                  </LineChart>

                  <h2>Eastbound</h2>
                  <LineChart
                    data={chartData.eastbound}
                    h={300}
                    dataKey="date"
                    strokeWidth={5}
                    curveType="natural"
                    dotProps={{ r: 0 }}
                    activeDotProps={{ r: 8 }}
                    withLegend
                    series={[
                      { name: 'Route Speed', color: 'green.6' },
                      { name: 'Route Travel Time', color: 'red.6' },
                    ]}
                  >
                  </LineChart>
                </>
              )}
            </Card>
          </Grid.Col>
        </Grid>
      </div>
    </MantineProvider>
  );
}

export default App;