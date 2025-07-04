# Testing Documentation

## Overview

This document describes the comprehensive testing suite that has been added to the NYC Crossings History application. The tests cover unit testing, integration testing, and database function testing without modifying any functional code.

## Test Structure

### 1. Unit Tests

#### App Component Tests (`src/App.test.js`)
- **Component Rendering**: Verifies the app renders without crashing
- **Control Elements**: Tests all UI controls are present
- **Default Values**: Ensures correct initial state
- **User Interactions**: Tests crossing selection, granularity changes
- **Auto-refresh**: Verifies periodic data fetching functionality
- **Error Handling**: Tests graceful error handling
- **Chart Rendering**: Validates chart data display
- **Loading States**: Tests loading overlay behavior

#### TimeRangeInput Component Tests (`src/components/TimeRangeInput.test.jsx`)
- **Rendering**: Tests component renders with various props
- **Input Behavior**: Tests focus/blur behavior
- **Dropdown Functionality**: Validates suggestion dropdown
- **Time Parsing**: Tests various time format parsing
- **Error Handling**: Tests invalid input handling
- **Integration**: Tests parent-child state management

#### Utility Function Tests
Tests are included for:
- `calculateTimeRange()`: Time range calculation logic
- `mapGranularityToInterval()`: Granularity mapping
- `formatAggregatedForChart()`: Data formatting for charts

### 2. Integration Tests (`src/App.integration.test.js`)

#### Complete User Flows
- Selecting crossings and viewing updated charts
- Changing time ranges and granularity
- Enabling/disabling auto-refresh
- Viewing aggregated data for all crossings

#### Error Scenarios
- API errors
- Empty data responses
- Network errors during auto-refresh

#### Data Visualization
- Chart data format validation
- Multiple chart rendering
- Series configuration

#### Loading States
- Loading overlay during data fetch
- Non-blocking user interactions

#### Mobile Responsiveness
- Layout adjustments for mobile devices

### 3. Database Tests (`supabase/tests/database.test.sql`)

#### SQL Function Tests
- Basic aggregation for single crossing
- All crossings aggregation
- Different aggregation intervals
- Empty result sets
- Min/Max value calculations
- Non-existent crossing handling

## Running the Tests

### Frontend Tests

```bash
# Run all tests
cd webapp
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watchAll

# Run specific test file
npm test App.test.js

# Run integration tests only
npm test App.integration.test.js
```

### Database Tests

```bash
# Run SQL tests (requires Supabase CLI)
cd supabase
supabase test db
```

## Test Configuration

### Jest Configuration (`webapp/jest.config.js`)
- Environment: jsdom
- Coverage thresholds: 80% for all metrics
- Module mapping for CSS and assets
- Transform patterns for JSX files
- Clear and restore mocks between tests

### Mock Setup
- Supabase client mocked for predictable testing
- Mantine charts mocked for unit testing
- Media queries mocked for responsive testing

## Test Coverage

The test suite provides comprehensive coverage for:
- ✅ Component rendering and lifecycle
- ✅ User interactions and state management
- ✅ API calls and data fetching
- ✅ Error handling and edge cases
- ✅ Time range calculations
- ✅ Data aggregation and formatting
- ✅ Auto-refresh functionality
- ✅ Loading states
- ✅ Mobile responsiveness
- ✅ Database function logic

## Best Practices

1. **Isolation**: Each test is isolated and doesn't depend on others
2. **Mocking**: External dependencies are mocked for predictability
3. **Cleanup**: All tests clean up after themselves
4. **Descriptive Names**: Test names clearly describe what they test
5. **Comprehensive**: Tests cover happy paths and error scenarios

## Adding New Tests

When adding new features, ensure to:
1. Add unit tests for new components
2. Add integration tests for new user flows
3. Update existing tests if behavior changes
4. Maintain the 80% coverage threshold
5. Test both success and failure scenarios

## Continuous Integration

These tests are designed to run in CI/CD pipelines:
```bash
# Example CI command
npm run test -- --coverage --watchAll=false
```

## Troubleshooting

### Common Issues

1. **Module not found errors**: Check `transformIgnorePatterns` in jest.config.js
2. **Async test timeouts**: Increase timeout in specific tests or jest.config.js
3. **Mock not working**: Ensure mocks are cleared between tests
4. **Coverage not met**: Run coverage report to identify untested code

### Debug Mode

Run tests with debugging:
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Future Enhancements

Consider adding:
- E2E tests with Cypress or Playwright
- Visual regression tests
- Performance tests
- Accessibility tests
- API contract tests