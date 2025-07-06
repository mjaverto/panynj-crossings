-- Tests for get_crossing_data_aggregated function
-- These tests verify that the database function handles various scenarios correctly

-- Test setup: Create test data
BEGIN;

-- Create test tables (simplified versions for testing)
CREATE TEMP TABLE test_traffic_status (
    id SERIAL PRIMARY KEY,
    facility_id INT,
    facility_modifier TEXT,
    time_stamp TIMESTAMPTZ,
    route_speed INT,
    route_travel_time INT,
    cardinal_direction_id INT,
    travel_direction_id INT,
    route_id INT,
    is_crossing_closed BOOLEAN DEFAULT FALSE,
    route_speed_hist INT,
    route_travel_time_hist INT,
    informational_text_id INT,
    speed_status_message TEXT,
    time_status_message TEXT,
    is_data_available BOOLEAN DEFAULT TRUE
);

CREATE TEMP TABLE test_facilities (
    facility_id INT,
    facility_modifier TEXT,
    crossing_display_name TEXT,
    xcm_facility_id INT,
    PRIMARY KEY (facility_id, facility_modifier)
);

-- Insert test data
INSERT INTO test_facilities (facility_id, facility_modifier, crossing_display_name, xcm_facility_id) VALUES
(1, 'E', 'Holland Tunnel', 101),
(2, 'W', 'Lincoln Tunnel', 102),
(3, 'N', 'George Washington Bridge', 103);

INSERT INTO test_traffic_status (
    facility_id, facility_modifier, time_stamp, route_speed, route_travel_time
) VALUES
-- Holland Tunnel data
(1, 'E', '2024-01-01 12:00:00+00', 45, 12),
(1, 'E', '2024-01-01 12:15:00+00', 48, 11),
(1, 'E', '2024-01-01 12:30:00+00', 42, 13),
(1, 'E', '2024-01-01 12:45:00+00', 40, 14),
(1, 'E', '2024-01-01 13:00:00+00', 38, 15),
-- Lincoln Tunnel data
(2, 'W', '2024-01-01 12:00:00+00', 50, 10),
(2, 'W', '2024-01-01 12:15:00+00', 52, 9),
(2, 'W', '2024-01-01 12:30:00+00', 48, 11),
-- George Washington Bridge data
(3, 'N', '2024-01-01 12:00:00+00', 55, 8),
(3, 'N', '2024-01-01 12:15:00+00', 58, 7);

-- Test 1: Basic aggregation for single crossing
DO $$
DECLARE
    result_count INT;
    avg_speed_check FLOAT;
BEGIN
    -- Call function for Holland Tunnel with 1 hour aggregation
    CREATE TEMP TABLE test_result1 AS
    SELECT * FROM get_crossing_data_aggregated(
        '2024-01-01 12:00:00+00'::TIMESTAMPTZ,
        '2024-01-01 13:00:00+00'::TIMESTAMPTZ,
        'Holland Tunnel',
        '1 hour'::INTERVAL
    );
    
    -- Check result count
    SELECT COUNT(*) INTO result_count FROM test_result1;
    ASSERT result_count = 1, 'Expected 1 aggregated result for Holland Tunnel';
    
    -- Check average speed calculation
    SELECT avg_speed INTO avg_speed_check FROM test_result1;
    -- Average of 45, 48, 42, 40, 38 = 42.6
    ASSERT avg_speed_check BETWEEN 42 AND 43, 'Average speed calculation incorrect';
    
    DROP TABLE test_result1;
END $$;

-- Test 2: All crossings aggregation
DO $$
DECLARE
    result_count INT;
    crossing_count INT;
BEGIN
    CREATE TEMP TABLE test_result2 AS
    SELECT * FROM get_crossing_data_aggregated(
        '2024-01-01 12:00:00+00'::TIMESTAMPTZ,
        '2024-01-01 13:00:00+00'::TIMESTAMPTZ,
        'All',
        '1 hour'::INTERVAL
    );
    
    SELECT COUNT(*) INTO result_count FROM test_result2;
    SELECT COUNT(DISTINCT crossing_display_name) INTO crossing_count FROM test_result2;
    
    ASSERT result_count >= 3, 'Expected results for all crossings';
    ASSERT crossing_count = 3, 'Expected 3 different crossings';
    
    DROP TABLE test_result2;
END $$;

-- Test 3: Different aggregation intervals
DO $$
DECLARE
    result_15min INT;
    result_30min INT;
BEGIN
    -- 15 minute aggregation
    CREATE TEMP TABLE test_result3a AS
    SELECT * FROM get_crossing_data_aggregated(
        '2024-01-01 12:00:00+00'::TIMESTAMPTZ,
        '2024-01-01 13:00:00+00'::TIMESTAMPTZ,
        'Holland Tunnel',
        '15 minutes'::INTERVAL
    );
    
    SELECT COUNT(*) INTO result_15min FROM test_result3a;
    
    -- 30 minute aggregation
    CREATE TEMP TABLE test_result3b AS
    SELECT * FROM get_crossing_data_aggregated(
        '2024-01-01 12:00:00+00'::TIMESTAMPTZ,
        '2024-01-01 13:00:00+00'::TIMESTAMPTZ,
        'Holland Tunnel',
        '30 minutes'::INTERVAL
    );
    
    SELECT COUNT(*) INTO result_30min FROM test_result3b;
    
    ASSERT result_15min > result_30min, '15 minute aggregation should have more results than 30 minute';
    
    DROP TABLE test_result3a;
    DROP TABLE test_result3b;
END $$;

-- Test 4: Empty result set for future dates
DO $$
DECLARE
    result_count INT;
BEGIN
    CREATE TEMP TABLE test_result4 AS
    SELECT * FROM get_crossing_data_aggregated(
        '2025-01-01 12:00:00+00'::TIMESTAMPTZ,
        '2025-01-01 13:00:00+00'::TIMESTAMPTZ,
        'Holland Tunnel',
        '1 hour'::INTERVAL
    );
    
    SELECT COUNT(*) INTO result_count FROM test_result4;
    ASSERT result_count = 0, 'Expected no results for future dates';
    
    DROP TABLE test_result4;
END $$;

-- Test 5: Min/Max values are calculated correctly
DO $$
DECLARE
    min_speed_check FLOAT;
    max_speed_check FLOAT;
BEGIN
    CREATE TEMP TABLE test_result5 AS
    SELECT * FROM get_crossing_data_aggregated(
        '2024-01-01 12:00:00+00'::TIMESTAMPTZ,
        '2024-01-01 13:00:00+00'::TIMESTAMPTZ,
        'Holland Tunnel',
        '1 hour'::INTERVAL
    );
    
    SELECT min_speed, max_speed INTO min_speed_check, max_speed_check FROM test_result5;
    
    ASSERT min_speed_check = 38, 'Min speed should be 38';
    ASSERT max_speed_check = 48, 'Max speed should be 48';
    
    DROP TABLE test_result5;
END $$;

-- Test 6: Non-existent crossing returns empty result
DO $$
DECLARE
    result_count INT;
BEGIN
    CREATE TEMP TABLE test_result6 AS
    SELECT * FROM get_crossing_data_aggregated(
        '2024-01-01 12:00:00+00'::TIMESTAMPTZ,
        '2024-01-01 13:00:00+00'::TIMESTAMPTZ,
        'Non-existent Crossing',
        '1 hour'::INTERVAL
    );
    
    SELECT COUNT(*) INTO result_count FROM test_result6;
    ASSERT result_count = 0, 'Expected no results for non-existent crossing';
    
    DROP TABLE test_result6;
END $$;

-- Cleanup
DROP TABLE test_traffic_status;
DROP TABLE test_facilities;

ROLLBACK;