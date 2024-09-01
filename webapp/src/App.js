import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Title, Grid, Card, LoadingOverlay, MantineProvider, Switch, Container } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/charts/styles.css';
import { DateTimePicker } from '@mantine/dates';
import { LineChart } from '@mantine/charts';
import moment from 'moment-timezone';

// Supabase client initialization 
const supabase = createClient('https://jurzflavaojycfbqjyex.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cnpmbGF2YW9qeWNmYnFqeWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ2ODIxNzcsImV4cCI6MjA0MDI1ODE3N30.pzgMDzfizUDWa5pBrnNLklTKd2Gr-zhVnLWPuWO35fc');

function App() {
  const [selectedDateTime, setSelectedDateTime] = useState(new Date());
  const [selectedInterval] = useState('1');
  const [chartData, setChartData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoRefreshOn, setIsAutoRefreshOn] = useState(false);

  async function fetchData() {
    setIsLoading(true);

    try {
      const adjustedDateTime = moment(selectedDateTimeRef.current).tz('America/New_York').utc().format('YYYY-MM-DDTHH:mm:ss[Z]');

      // Fetch data for all crossings at once
      const { data, error } = await supabase.rpc('get_crossing_data', {
        in_time_stamp: adjustedDateTime,  // Pass the time_stamp filter
        in_order_direction: 'DESC',  // Set the order direction (DESC or ASC)
        in_limit: 10000,  // Set the limit
      });

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

  const selectedDateTimeRef = useRef(selectedDateTime);

  useEffect(() => {
    selectedDateTimeRef.current = selectedDateTime;
  }, [selectedDateTime]);

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    const currentTime = new Date();
    currentTime.setSeconds(0, 0);

    const formattedCurrentTime = moment.tz(currentTime, 'America/New_York').format('YYYY-MM-DD HH:mm');
    const formattedSelectedTime = moment.tz(selectedDateTime, 'America/New_York').format('YYYY-MM-DD HH:mm');

    if (formattedCurrentTime !== formattedSelectedTime) {
      setSelectedDateTime(currentTime);
      fetchData();
    }
  };

  useEffect(() => {
    handleRefresh();

    if (isAutoRefreshOn) {
      const intervalId = setInterval(handleRefresh, 60000);

      return () => clearInterval(intervalId);
    }
  }, [isAutoRefreshOn, selectedDateTime]);

  function formatDataForMantineChart(data) {
    const formattedData = {};
  
    const crossings = [
      'Holland Tunnel',
      'Lincoln Tunnel',
      'Bayonne Bridge',
      'George Washington Bridge',
      'Goethals Bridge',
      'Outerbridge Crossing'
    ];
  
    crossings.forEach((crossing) => {
      const crossingData = data.filter(item => item.crossing_display_name === crossing);
  
      const modifiers = [...new Set(crossingData.map(item => item.facility_modifier).filter(Boolean))];
  
      if (modifiers.length > 0) {
        modifiers.forEach((modifier) => {
          const modifiedCrossingName = `${crossing} - ${modifier}`;
          
          const westboundData = crossingData.filter(
            (item) => item.facility_modifier === modifier && item.cardinal_direction === 'westbound'
          );
          const eastboundData = crossingData.filter(
            (item) => item.facility_modifier === modifier && item.cardinal_direction === 'eastbound'
          );
  
          formattedData[modifiedCrossingName] = {
            westbound: westboundData
              .slice()
              .reverse()
              .map((item) => ({
                date: moment
                  .utc(selectedInterval === '1' ? item.time_stamp : item.truncated_time)
                  .tz('America/New_York')
                  .format('YYYY-MM-DD hh:mm A'),
                'Route Speed': item.route_speed,
                'Route Travel Time': item.route_travel_time,
              })),
            eastbound: eastboundData
              .slice()
              .reverse()
              .map((item) => ({
                date: moment
                  .utc(selectedInterval === '1' ? item.time_stamp : item.truncated_time)
                  .tz('America/New_York')
                  .format('YYYY-MM-DD hh:mm A'),
                'Route Speed': item.route_speed,
                'Route Travel Time': item.route_travel_time,
              })),
          };
        });
      } else {
        const westboundData = crossingData.filter(
          (item) => item.cardinal_direction === 'westbound'
        );
        const eastboundData = crossingData.filter(
          (item) => item.cardinal_direction === 'eastbound'
        );
  
        formattedData[crossing] = {
          westbound: westboundData
            .slice()
            .reverse()
            .map((item) => ({
              date: moment
                .utc(selectedInterval === '1' ? item.time_stamp : item.truncated_time)
                .tz('America/New_York')
                .format('YYYY-MM-DD hh:mm A'),
              'Route Speed': item.route_speed,
              'Route Travel Time': item.route_travel_time,
            })),
          eastbound: eastboundData
            .slice()
            .reverse()
            .map((item) => ({
              date: moment
                .utc(selectedInterval === '1' ? item.time_stamp : item.truncated_time)
                .tz('America/New_York')
                .format('YYYY-MM-DD hh:mm A'),
              'Route Speed': item.route_speed,
              'Route Travel Time': item.route_travel_time,
            })),
        };
      }
    });
  
    return formattedData;
  }

  return (
    <MantineProvider>
      <div>
        <Title order={2} align="center" mb="xl">NYC Crossings History</Title>
        <Container size="xxl">
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, md: 12, lg: 12 }}>
              <Card withBorder shadow="sm" p="lg">
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
                <Switch
                  label="Auto-Refresh"
                  checked={isAutoRefreshOn}
                  onChange={(event) => {
                    const isChecked = event.currentTarget.checked;
                    setIsAutoRefreshOn(isChecked);
                    if (isChecked) {
                      handleRefresh();
                    }
                  }}
                  mt="md"
                />
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 12, lg: 12 }}>

              <LoadingOverlay visible={isLoading} />
              {!isLoading && Object.keys(chartData).map((crossing, index) => (
                <div key={index}>
                  <Card withBorder shadow="sm" p="lg" mb={15}>
                    <Title order={3} align="center">{crossing}</Title>
                    <Grid gutter="md">

                      <Grid.Col span={{ base: 12, md: 6 }}>
                        <h4 align="center">Westbound</h4>
                        <LineChart
                          data={chartData[crossing].westbound}
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
                          xAxisProps={{
                            tickFormatter: (date) => moment(date, 'YYYY-MM-DD hh:mm A').format('M/D/YY h:mma'),
                            angle: 0,
                            minTickGap: 100,
                          }}
                        />
                      </Grid.Col>

                      <Grid.Col span={{ base: 12, md: 6 }}>
                        <h4 align="center">Eastbound</h4>
                        <LineChart
                          data={chartData[crossing].eastbound}
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
                          xAxisProps={{
                            tickFormatter: (date) => moment(date, 'YYYY-MM-DD hh:mm A').format('M/D/YY h:mma'),
                            angle: 0,
                            minTickGap: 100,
                          }}
                        />
                      </Grid.Col>
                    </Grid>
                  </Card>
                </div>
              ))}
            </Grid.Col>
          </Grid>
        </Container>
      </div>
    </MantineProvider>
  );
}

export default App;
