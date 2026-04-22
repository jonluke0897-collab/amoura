import { View } from 'react-native';
import { ScreenContainer } from '~/src/components/ui/ScreenContainer';
import { SignInCard } from '~/src/features/auth/SignInCard';

export default function SignIn() {
  return (
    <ScreenContainer>
      <View className="flex-1 justify-center">
        <SignInCard />
      </View>
    </ScreenContainer>
  );
}
