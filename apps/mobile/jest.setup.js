jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
// Allow more time for async queries when many suites run in parallel
require('@testing-library/react-native').configure({ asyncUtilTimeout: 4000 });
