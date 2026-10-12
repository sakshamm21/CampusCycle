import React, { useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { en, motion, radius } from '@campuscycle/shared';
import { Headline } from '@/components/Headline';
import { useTheme } from '@/theme/ThemeProvider';

export interface SheetProps {
  open: boolean;
  onClose(): void;
  /** Copy with an `*accent*` word. */
  title?: string;
  children: React.ReactNode;
  testID?: string;
}

export function Sheet({ open, onClose, title, children, testID }: SheetProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(height);
  const panelHeight = useSharedValue(height);

  useEffect(() => {
    if (!open) return;
    offset.value = height;
    offset.value = reduceMotion ? 0 : withTiming(0, { duration: motion.base });
  }, [open, height, reduceMotion, offset]);

  const drag = Gesture.Pan()
    .runOnJS(true)
    .onUpdate((e) => {
      offset.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > panelHeight.value * 0.25) onClose();
      else offset.value = reduceMotion ? 0 : withTiming(0, { duration: motion.fast });
    });

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={en.common.close}
            onPress={onClose}
            style={{ flex: 1, backgroundColor: c.overlay }}
          />
          <Animated.View
            testID={testID}
            onLayout={(e) => {
              panelHeight.value = e.nativeEvent.layout.height;
            }}
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                maxHeight: height * 0.88,
                backgroundColor: c.surface,
                borderTopLeftRadius: radius.sheet,
                borderTopRightRadius: radius.sheet,
                paddingHorizontal: 16,
                paddingBottom: 16 + insets.bottom,
              },
              panelStyle,
            ]}
          >
            <GestureDetector gesture={drag}>
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: c.borderStrong }} />
              </View>
            </GestureDetector>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
            >
              {title ? <Headline text={title} size="m" /> : null}
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}
