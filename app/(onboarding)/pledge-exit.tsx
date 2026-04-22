import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useClerk } from '@clerk/clerk-expo';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import {
  PLEDGE_EXIT_BACK_CTA,
  PLEDGE_EXIT_BODY,
  PLEDGE_EXIT_HEADING,
  PLEDGE_EXIT_SIGN_OUT_CTA,
} from '~/src/features/onboarding/pledgeCopy';

export default function PledgeExitScreen() {
  const { signOut } = useClerk();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      // Clerk state flips; the (auth) layout's signed-out redirect handles
      // routing to /(auth)/sign-in. No explicit navigation needed here.
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <View className="flex-1 px-5 pt-4 justify-center">
      <Text variant="heading" className="text-3xl text-plum-900 mb-4 leading-9">
        {PLEDGE_EXIT_HEADING}
      </Text>
      <Text variant="body" className="text-base text-plum-900 leading-6 mb-10">
        {PLEDGE_EXIT_BODY}
      </Text>
      <View className="gap-3">
        <Button
          label={PLEDGE_EXIT_BACK_CTA}
          variant="secondary"
          size="lg"
          disabled={signingOut}
          onPress={() => router.replace('/(onboarding)/pledge')}
        />
        <Button
          label={PLEDGE_EXIT_SIGN_OUT_CTA}
          size="lg"
          loading={signingOut}
          disabled={signingOut}
          onPress={handleSignOut}
        />
      </View>
    </View>
  );
}
