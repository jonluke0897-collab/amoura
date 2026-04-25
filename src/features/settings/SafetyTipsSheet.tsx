import { Linking, Pressable, ScrollView, View } from 'react-native';
import { ExternalLink, X } from 'lucide-react-native';
import { BottomSheet } from '~/src/components/ui/BottomSheet';
import { Text } from '~/src/components/ui/Text';

export type SafetyTipsSheetProps = {
  visible: boolean;
  onClose: () => void;
};

type SafetyTip = {
  heading: string;
  body: string;
};

type CrisisResource = {
  name: string;
  description: string;
  url: string;
};

/**
 * Plain-language safety guidance for the Settings → Safety tips entry.
 * Placeholder copy until TASK-068 (trans-advisor copy review) returns
 * sign-off; the structure stays the same after the review, only the
 * specific sentences change. Crisis resources are US-only at launch
 * (matching the GTM plan's launch cities); add international resources
 * as the rollout expands.
 *
 * Hyperlinks open in the system browser via Linking — we deliberately
 * do NOT in-app-browser these because users in crisis benefit from the
 * full browser tab persisting if they switch away from Amoura.
 */
const TIPS: readonly SafetyTip[] = [
  {
    heading: 'Trust your gut.',
    body: "If a profile or message feels off, it usually is. You can leave a chat at any time, and you don't owe anyone an explanation.",
  },
  {
    heading: 'Meet in public the first time.',
    body: 'Coffee, a walk, somewhere with people around. Tell a friend where you’re going and when you expect to be home.',
  },
  {
    heading: 'Hold private info private.',
    body: 'No need to share your full name, address, or workplace until you actually trust someone. Amoura never shows your last name.',
  },
  {
    heading: 'Block and report freely.',
    body: 'Blocking is bidirectional and instant. Reports are reviewed within 48 hours. Either tool is yours to use whenever you need it — no need to be sure or apologise.',
  },
  {
    heading: 'You set the pace.',
    body: 'You don’t have to reply, meet up, share photos, or explain yourself. Anyone who pushes against that isn’t a fit, full stop.',
  },
];

const CRISIS_RESOURCES: readonly CrisisResource[] = [
  {
    name: 'Trans Lifeline',
    description: 'Peer support hotline run by trans people, for trans people. US: 877-565-8860.',
    url: 'https://translifeline.org',
  },
  {
    name: 'The Trevor Project',
    description: 'Crisis intervention for LGBTQ+ young people. US: 1-866-488-7386.',
    url: 'https://www.thetrevorproject.org',
  },
  {
    name: '988 Suicide & Crisis Lifeline',
    description: 'US: dial or text 988. Press 3 for LGBTQ+ specialised support.',
    url: 'https://988lifeline.org',
  },
];

export function SafetyTipsSheet({ visible, onClose }: SafetyTipsSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      heightPercent={85}
      header={
        <View className="flex-row items-center justify-between px-5 pt-2 pb-3 border-b border-plum-50">
          <Text variant="heading" className="text-xl text-plum-900">
            Safety tips
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
          >
            <X color="#6D28D9" size={22} />
          </Pressable>
        </View>
      }
    >
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
      >
        {TIPS.map((tip, index) => (
          <View
            key={tip.heading}
            className={index > 0 ? 'mt-4 pt-4 border-t border-plum-50' : ''}
          >
            <Text variant="heading" className="text-base text-plum-900 mb-1">
              {tip.heading}
            </Text>
            <Text variant="body" className="text-sm text-plum-700">
              {tip.body}
            </Text>
          </View>
        ))}

        <View className="mt-6 pt-5 border-t border-plum-50">
          <Text
            variant="caption"
            className="text-xs uppercase tracking-wider text-plum-400 mb-3"
          >
            If you’re in crisis
          </Text>
          {CRISIS_RESOURCES.map((resource) => (
            <Pressable
              key={resource.name}
              onPress={() => Linking.openURL(resource.url)}
              accessibilityRole="link"
              accessibilityLabel={`Open ${resource.name}`}
              className="flex-row items-start py-3 border-b border-plum-50"
            >
              <View className="flex-1 mr-3">
                <Text variant="heading" className="text-base text-plum-900">
                  {resource.name}
                </Text>
                <Text variant="body" className="text-sm text-plum-700 mt-1">
                  {resource.description}
                </Text>
              </View>
              <View className="mt-1">
                <ExternalLink color="#6D28D9" size={18} />
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
