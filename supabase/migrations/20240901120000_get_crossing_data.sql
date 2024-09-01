CREATE OR REPLACE FUNCTION get_crossing_data(
  in_time_stamp TIMESTAMPTZ DEFAULT NULL,  -- Accept time_stamp filter
  in_order_direction TEXT DEFAULT 'DESC',  -- Accept order direction (ASC or DESC)
  in_limit INT DEFAULT 1000  -- Accept limit
)
RETURNS TABLE (
  id INT,
  facility_id INT,
  xcm_facility_id INT,
  facility_modifier TEXT,
  cardinal_direction TEXT,
  travel_direction TEXT,
  crossing_display_name TEXT,
  is_crossing_closed BOOLEAN,
  route_id INT,
  route_speed INT,
  route_travel_time INT,
  route_speed_hist INT,
  route_travel_time_hist INT,
  route_name TEXT,
  time_stamp TIMESTAMPTZ,
  informational_text TEXT,
  speed_status_message TEXT,
  time_status_message TEXT,
  is_data_available BOOLEAN
) AS $$
DECLARE
  sql_query TEXT;
BEGIN
  -- Build dynamic SQL query
  sql_query := format(
    'SELECT 
      ts.id,
      f.facility_id,
      f.xcm_facility_id,
      f.facility_modifier::TEXT,
      cd.direction::TEXT AS cardinal_direction,
      td.direction::TEXT AS travel_direction,
      f.crossing_display_name::TEXT,
      ts.is_crossing_closed,
      r.route_id,
      ts.route_speed,
      ts.route_travel_time,
      ts.route_speed_hist,
      ts.route_travel_time_hist,
      r.route_name::TEXT,
      ts.time_stamp::TIMESTAMPTZ,
      it.text::TEXT AS informational_text,
      ts.speed_status_message::TEXT,
      ts.time_status_message::TEXT,
      ts.is_data_available
    FROM traffic_status ts
    JOIN facilities f ON ts.facility_id = f.facility_id AND ts.facility_modifier = f.facility_modifier
    JOIN routes r ON ts.route_id = r.route_id
    JOIN cardinal_directions cd ON ts.cardinal_direction_id = cd.id
    JOIN travel_directions td ON ts.travel_direction_id = td.id
    JOIN informational_texts it ON ts.informational_text_id = it.id
    WHERE ($1::TIMESTAMPTZ IS NULL OR ts.time_stamp <= $1)
    ORDER BY ts.time_stamp %s
    LIMIT $2',
    in_order_direction
  );

  -- Execute the dynamic SQL query
  RETURN QUERY EXECUTE sql_query USING in_time_stamp, in_limit;
END;
$$ LANGUAGE plpgsql;