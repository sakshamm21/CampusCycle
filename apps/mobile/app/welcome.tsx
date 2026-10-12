import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { en } from '@campuscycle/shared';
import { BrandMark } from '@/components/BrandMark';
import { Headline } from '@/components/Headline';
import { Marquee } from '@/components/Marquee';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { Sticker } from '@/components/Sticker';
import { Text } from '@/components/Text';
import { useDemoSignIn } from '@/features/auth/authForms';

// R01 Welcome
export default function Welcome() {
  const router = useRouter();
  const demo = useDemoSignIn();

  return (
    <Screen
      banners={false}
      testID="r01"
      footer={
        <>
          <Pill
            testID="r01.sign_up"
            size="lg"
            label={en.r01.sign_up}
            onPress={() => router.push('/sign-up')}
          />
          <Pill
            testID="r01.sign_in"
            size="lg"
            variant="secondary"
            label={en.r01.sign_in}
            onPress={() => router.push('/sign-in')}
          />
          <Pill
            testID="r01.demo"
            variant="ghost"
            block
            label={en.r01.demo}
            loading={demo.loading}
            onPress={() => void demo.run()}
          />
        </>
      }
    >
      <BrandMark wordmark />
      <Marquee />
      <Headline text={en.r01.title} size="xl" />
      <Text variant="body" tone="muted" style={{ maxWidth: 320 }}>
        {en.r01.lede}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
        <Sticker text={en.r01.s1} color="yellow" rotate={-3} />
        <Sticker text={en.r01.s2} color="coral" rotate={4} />
        <Sticker text={en.r01.s3} color="mint" rotate={-2} />
      </View>
    </Screen>
  );
}
