CREATE OR REPLACE FUNCTION get_crossing_data_aggregated(
  in_start_timestamp TIMESTAMPTZ,
  in_end_timestamp TIMESTAMPTZ,
  in_crossing TEXT DEFAULT 'All',
  in_aggregation_interval INTERVAL DEFAULT INTERVAL '1 hour'
)
RETURNS TABLE (
  crossing_display_name TEXT,
  bucket_time TIMESTAMPTZ,
  avg_speed FLOAT,
  min_speed FLOAT,
  max_speed FLOAT,
  avg_travel_time FLOAT,
  min_travel_time FLOAT,
  max_travel_time FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
    SELECT
      f.crossing_display_name,
      date_trunc('minute', ts.time_stamp)::TIMESTAMPTZ AS bucket_time,
      AVG(ts.route_speed)::FLOAT AS avg_speed,
      MIN(ts.route_speed)::FLOAT AS min_speed,
      MAX(ts.route_speed)::FLOAT AS max_speed,
      AVG(ts.route_travel_time)::FLOAT AS avg_travel_time,
      MIN(ts.route_travel_time)::FLOAT AS min_travel_time,
      MAX(ts.route_travel_time)::FLOAT AS max_travel_time
    FROM traffic_status ts
      JOIN facilities f
        ON ts.facility_id = f.facility_id
       AND ts.facility_modifier = f.facility_modifier
    WHERE
      ts.time_stamp >= in_start_timestamp
      AND ts.time_stamp <= in_end_timestamp
      AND (in_crossing = 'All' OR f.crossing_display_name = in_crossing)
    GROUP BY
      f.crossing_display_name,
      date_trunc('minute', ts.time_stamp)
    ORDER BY
      bucket_time DESC;
END;
$$; 