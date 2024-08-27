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

    // Convert timestamps and adjust column names
    const convertedData = crossingData.map(item => {
      return {
        facility_id: item.facilityId,
        xcm_facility_id: item.xcmFacilityId,
        facility_modifier: item.facilityModifier,
        cardinal_direction: item.cardinalDirection,
        travel_direction: item.travelDirection,
        crossing_display_name: item.crossingDisplayName,
        is_crossing_closed: item.isCrossingClosed,
        route_id: item.routeId,
        route_speed: item.routeSpeed,
        route_travel_time: item.routeTravelTime,
        route_speed_hist: item.routeSpeedHist,
        route_travel_time_hist: item.routeTravelTimeHist,
        route_name: item.routeName,
        time_stamp: est_to_utc_timestamp(item.timeStamp), 
        informational_text: item.infomationalText,
        speed_status_message: item.speedStatusMessage,
        time_status_message: item.timeStatusMessage,
        is_data_available: item.isDataAvailable
        // Exclude the last 4 hex color fields
      };
    });

    // Upsert data into Supabase table
    const { error } = await supabase
      .from('crossing_times')
      .upsert(convertedData, {
        onConflict: ['facility_id', 'cardinal_direction', 'time_stamp'],
        ignoreDuplicates: true 
      });

    if (error) {
      console.error('Error upserting data into Supabase:', error);
      return new Response("Error upserting data", { status: 500 });
    } else {
      console.log('Data successfully upserted into Supabase');
      return new Response("Data upserted successfully", { status: 200 });
    }
  } catch (error) {
    console.error('Error fetching or processing data:', error);
    return new Response("Error fetching or processing data", { status: 500 });
  }
});


function est_to_utc_timestamp(est_time_string) {
  try {
      // Parse the EST time string
      const est_time = moment.tz(est_time_string, "h:mm A", "America/New_York"); // Specify EST timezone

      // Check for date rollover
      const now_utc = moment.utc();
      if (est_time.isAfter(now_utc)) {
          est_time.subtract(1, 'day');
      }

      // Convert to UTC and format
      const utc_timestamp = est_time.utc().format("YYYY-MM-DD HH:mm:00+00");
      return utc_timestamp;
  } catch (e) {
      console.error("Error in est_to_utc_timestamp:", e);
      return null;
  }
}