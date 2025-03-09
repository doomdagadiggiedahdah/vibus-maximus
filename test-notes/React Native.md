# React Native

React Native is an open-source mobile application framework created by Facebook (now Meta). It allows developers to use React along with native platform capabilities to build mobile applications for iOS, Android, and other platforms.

## Key Concepts

- **Learn once, write anywhere**: Use React knowledge to build native apps
- **Native Components**: Uses the same building blocks as regular iOS and Android apps
- **JavaScript & React**: Write application logic in JavaScript using React
- **Hot Reloading**: See changes instantly during development
- **Cross-Platform**: Most code can be shared between platforms

## Core Components

React Native provides several built-in components:

- **View**: A container similar to div
- **Text**: For displaying text
- **Image**: For displaying images
- **ScrollView**: A scrollable container
- **TextInput**: For text input
- **TouchableOpacity/TouchableHighlight**: For handling touches
- **FlatList/SectionList**: For efficient rendering of lists

## Basic Example

```jsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const App = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hello, React Native!</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  text: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
});

export default App;
```

## Navigation

React Native doesn't include a built-in navigation system, but several libraries are available:

- **React Navigation**: Most popular solution
- **React Native Navigation**: By Wix
- **React Native Router Flux**: Based on React Router

## Styling

- Uses a subset of CSS with JavaScript objects
- FlexBox layout system similar to web
- StyleSheet API for better performance
- Platform-specific styling with Platform.select()

## Native Modules

For functionality not available in JavaScript:

- **Native Modules**: JavaScript interface to native code
- **Native Components**: Custom UI components with native implementation
- **Linking API**: Interact with other apps on the device

## Popular Libraries

- **Expo**: Development framework and platform
- **Redux/MobX**: State management
- **Axios/Fetch**: HTTP requests
- **React Native Paper/UI Kitten**: UI component libraries
- **Async Storage**: Persistent storage
- **React Native Maps**: Google Maps integration
- **React Native Firebase**: Firebase SDK

## Development Tools

- **Metro Bundler**: JavaScript bundler
- **React Native CLI/Expo CLI**: Command-line tools
- **React Native Debugger**: Debugging tool
- **Flipper**: Mobile debugging platform
- **Jest/Detox**: Testing frameworks

## Deployment

- **App Store/Google Play**: Publishing to stores
- **CodePush**: Update JavaScript code without app store reviews
- **Fastlane**: Automate building and releasing