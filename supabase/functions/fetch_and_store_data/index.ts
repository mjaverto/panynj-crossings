import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.23.0';
import moment from 'https://esm.sh/moment-timezone';

serve(async (req: Request) => {
  // Supabase initialization
  const supabaseUrl = Deno.env.get("ENV_SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("ENV_SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Endpoint URL
  const endpointUrl = 'https://panynj.gov/bin/portauthority/crossingtimesapi.json';

  try {
    const response = await fetch(endpointUrl);
    const crossingData = await response.json();

    // Separate data into facilities, routes, cardinal directions, travel directions, informational texts, and traffic status
    const facilitiesMap = new Map();
    const routesMap = new Map();
    const cardinalDirectionsMap = new Map();
    const travelDirectionsMap = new Map();
    const informationalTextsMap = new Map();
    const trafficStatusData = [];

    for (const item of crossingData) {
      // Include facilityModifier in the unique facility key
      const facilityKey = `${item.facilityId}|${item.facilityModifier || ''}`;
      if (!facilitiesMap.has(facilityKey)) {
        facilitiesMap.set(facilityKey, {
          facility_id: item.facilityId,
          xcm_facility_id: item.xcmFacilityId,
          facility_modifier: item.facilityModifier,
          crossing_display_name: item.crossingDisplayName
        });
      }

      // Create unique route key
      const routeKey = `${item.routeId}|${item.routeName}|${item.facilityId}|${item.facilityModifier || ''}`;
      if (!routesMap.has(routeKey)) {
        routesMap.set(routeKey, {
          route_id: item.routeId,
          route_name: item.routeName,
          facility_id: item.facilityId,
          facility_modifier: item.facilityModifier
        });
      }

      // Add unique cardinal direction
      if (!cardinalDirectionsMap.has(item.cardinalDirection)) {
        cardinalDirectionsMap.set(item.cardinalDirection, { direction: item.cardinalDirection });
      }

      // Add unique travel direction
      if (!travelDirectionsMap.has(item.travelDirection)) {
        travelDirectionsMap.set(item.travelDirection, { direction: item.travelDirection });
      }

      // Add unique informational text
      if (!informationalTextsMap.has(item.infomationalText)) {
        informationalTextsMap.set(item.infomationalText, { text: item.infomationalText });
      }

      // Prepare traffic status data
      trafficStatusData.push({
        facility_id: item.facilityId,
        facility_modifier: item.facilityModifier,
        route_id: item.routeId,
        cardinal_direction: item.cardinalDirection,  // Will be converted to ID
        travel_direction: item.travelDirection,      // Will be converted to ID
        is_crossing_closed: item.isCrossingClosed,
        route_speed: item.routeSpeed,
        route_travel_time: item.routeTravelTime,
        route_speed_hist: item.routeSpeedHist,
        route_travel_time_hist: item.routeTravelTimeHist,
        time_stamp: est_to_utc_timestamp(item.timeStamp),
        informational_text: item.infomationalText,   // Will be converted to ID
        speed_status_message: item.speedStatusMessage,
        time_status_message: item.timeStatusMessage,
        is_data_available: item.isDataAvailable,
      });
    }

    // Function to handle upsert and fetch existing data
    async function upsertAndFetchExistingData(tableName, data, conflictColumns) {
      // Remove duplicate rows based on the conflict columns
      const uniqueData = Array.from(new Map(data.map(item => [item[conflictColumns[0]] + '|' + (item[conflictColumns[1]] || ''), item])).values());
    
      const { data: upsertedData, error } = await supabase
        .from(tableName)
        .upsert(uniqueData, { onConflict: conflictColumns, returning: '*' });
    
      if (error) {
        console.error(`Error upserting ${tableName}:`, error);
        return { error };
      }
    
      if (!upsertedData || upsertedData.length === 0) {
        const { data: existingData, error: fetchError } = await supabase
          .from(tableName)
          .select('*')
          .in(conflictColumns[0], data.map(item => item[conflictColumns[0]]));
    
        if (fetchError) {
          console.error(`Error fetching existing data from ${tableName}:`, fetchError);
          return { error: fetchError };
        }
    
        return { data: existingData };
      }
    
      return { data: upsertedData };
    }
    
    // Upsert and fetch facilities data
    const facilitiesData = Array.from(facilitiesMap.values());
    const { error: facilitiesError } = await upsertAndFetchExistingData('facilities', facilitiesData, ['facility_id', 'facility_modifier']);
    if (facilitiesError) return new Response("Error upserting facilities", { status: 500 });
    
    // Upsert and fetch routes data
    const routesData = Array.from(routesMap.values());
    const { error: routesError } = await upsertAndFetchExistingData('routes', routesData, ['route_id']);
    if (routesError) return new Response("Error upserting routes", { status: 500 });


    // Upsert and fetch cardinal directions
    const cardinalDirectionsData = Array.from(cardinalDirectionsMap.values());
    const { data: cardinalDirections, error: cardinalDirectionsError } = await upsertAndFetchExistingData('cardinal_directions', cardinalDirectionsData, ['direction']);
    if (cardinalDirectionsError) return new Response("Error upserting cardinal directions", { status: 500 });

    // Upsert and fetch travel directions
    const travelDirectionsData = Array.from(travelDirectionsMap.values());
    const { data: travelDirections, error: travelDirectionsError } = await upsertAndFetchExistingData('travel_directions', travelDirectionsData, ['direction']);
    if (travelDirectionsError) return new Response("Error upserting travel directions", { status: 500 });

    // Upsert and fetch informational texts
    const informationalTextsData = Array.from(informationalTextsMap.values());
    const { data: informationalTexts, error: informationalTextsError } = await upsertAndFetchExistingData('informational_texts', informationalTextsData, ['text']);
    if (informationalTextsError) return new Response("Error upserting informational texts", { status: 500 });

    // Convert strings to IDs for traffic status
    trafficStatusData.forEach((item) => {
      const cardinalDirection = cardinalDirections ? cardinalDirections.find(d => d.direction.toLowerCase().trim() === item.cardinal_direction.toLowerCase().trim()) : null;
      const travelDirection = travelDirections ? travelDirections.find(d => d.direction.toLowerCase().trim() === item.travel_direction.toLowerCase().trim()) : null;
      const informationalText = informationalTexts ? informationalTexts.find(t => t.text.toLowerCase().trim() === item.informational_text.toLowerCase().trim()) : null;

      // Ensure IDs are found
      if (!cardinalDirection || !travelDirection || !informationalText) {
        console.error('Error finding ID for:', {
          cardinalDirection: item.cardinal_direction,
          travelDirection: item.travel_direction,
          informationalText: item.informational_text
        });
        throw new Error('Error finding IDs for traffic status data');
      }

      // Assign IDs
      item.cardinal_direction_id = cardinalDirection.id;
      item.travel_direction_id = travelDirection.id;
      item.informational_text_id = informationalText.id;

      // Remove original string fields
      delete item.cardinal_direction;
      delete item.travel_direction;
      delete item.informational_text;
    });

    // Insert traffic status data
    const { error: trafficStatusError } = await supabase
      .from('traffic_status')
      .upsert(trafficStatusData, {
        onConflict: ['facility_id', 'route_id', 'cardinal_direction_id', 'time_stamp'],
        returning: 'minimal'
      });

    if (trafficStatusError) {
      console.error('Error upserting traffic status:', trafficStatusError);
      return new Response("Error upserting traffic status", { status: 500 });
    }


    console.log('Data successfully upserted into Supabase');
    return new Response("Data upserted successfully", { status: 200 });
  } catch (error) {
    console.error('Error fetching or processing data:', error);
    return new Response("Error fetching or processing data", { status: 500 });
  }
});

// Function to convert EST to UTC timestamp
function est_to_utc_timestamp(est_time_string) {
  try {
    const est_time = moment.tz(est_time_string, "h:mm A", "America/New_York");
    const now_utc = moment.utc();
    if (est_time.isAfter(now_utc)) est_time.subtract(1, 'day');
    return est_time.utc().format("YYYY-MM-DD HH:mm:00+00");
  } catch (e) {
    console.error("Error in est_to_utc_timestamp:", e);
    return null;
  }
}
