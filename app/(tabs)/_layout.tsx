import { Tabs } from 'expo-router';
import { Compass, Heart, MessageCircle, User } from 'lucide-react-native';

const PLUM_600 = '#6B2E4F';
const PLUM_400 = '#9E5A7F';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PLUM_600,
        tabBarInactiveTintColor: PLUM_400,
        tabBarStyle: {
          backgroundColor: '#FBF6EE',
          borderTopColor: 'rgba(107, 46, 79, 0.08)',
        },
        tabBarLabelStyle: { fontFamily: 'Inter', fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="browse"
        options={{
          title: 'Browse',
          tabBarIcon: ({ color }) => <Compass color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="likes"
        options={{
          title: 'Likes',
          tabBarIcon: ({ color }) => <Heart color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ color }) => <MessageCircle color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
