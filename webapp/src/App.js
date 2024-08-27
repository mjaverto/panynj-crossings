import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Select, Title, Grid, Card, LoadingOverlay, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/charts/styles.css';
import { DateTimePicker } from '@mantine/dates';
import { LineChart } from '@mantine/charts';

// Supabase client initialization 
const supabase = createClient('https://jurzflavaojycfbqjyex.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cnpmbGF2YW9qeWNmYnFqeWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ2ODIxNzcsImV4cCI6MjA0MDI1ODE3N30.pzgMDzfizUDWa5pBrnNLklTKd2Gr-zhVnLWPuWO35fc');

function App() {
  const [selectedCrossing, setSelectedCrossing] = useState('Holland Tunnel');
  const [selectedDateTime, setSelectedDateTime] = useState(add5Hours());
  const [selectedInterval, setSelectedInterval] = useState('1'); // State for the interval dropdown
  const [chartData, setChartData] = useState({ westbound: [], eastbound: [] });
  const [isLoading, setIsLoading] = useState(false);

  async function fetchData() {
    setIsLoading(true);

    try {
      const adjustedDateTime = new Date(selectedDateTime.getTime() + (5 * 60 * 60 * 1000));

      // Construct the Supabase query with interval handling
      let query = supabase
        .from('crossing_times')
        .select('*')
        .eq('crossing_display_name', selectedCrossing)
        .lte('time_stamp', adjustedDateTime.toISOString())
        .order('time_stamp', { ascending: false })
        .limit(100);

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

  useEffect(() => {
    fetchData(); // Fetch data initially when the component mounts
    const intervalId = setInterval(fetchData, 60000);
    // Clean up the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, [selectedInterval]); // Include selectedInterval in the dependency array

  function add5Hours() {
    const currentTime = new Date(); // Get the current time
    const fiveHoursInMilliseconds =120* 5 * 60 * 60 * 1000; // Calculate milliseconds in 5 hours

    // Create a new Date object representing the time 5 hours in the future
    const newTime = new Date(currentTime.getTime() + fiveHoursInMilliseconds);
    return newTime;
  }
  // Function to format data for Mantine Charts
  function formatDataForMantineChart(data) {
    // Helper function to transform data for a specific direction
    const formatDataForDirection = (directionData) => {
      return directionData.slice().reverse().map(item => ({
        date: (selectedInterval === '1' ? new Date(item.time_stamp) : new Date(item.truncated_time)).toISOString().slice(0, 16), // Use 'date' for the x-axis
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
                  setSelectedCrossing(value);
                  fetchData(); // Fetch data when the selected crossing changes
                }}
              />

              <DateTimePicker
                label="Select Date and Time"
                placeholder="Select date and time"
                value={selectedDateTime}
                valueFormat="MMM DD YYYY hh:mm A"
                onChange={(value) => {
                  setSelectedDateTime(value); 
                  fetchData(); // Fetch data when the selected crossing changes
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
                      { name: 'Route Speed', color: 'red.6' },
                      { name: 'Route Travel Time', color: 'blue.6' },
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
                      { name: 'Route Speed', color: 'red.6' },
                      { name: 'Route Travel Time', color: 'blue.6' },
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