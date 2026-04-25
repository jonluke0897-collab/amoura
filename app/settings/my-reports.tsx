import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePaginatedQuery } from 'convex/react';
import { ChevronLeft, FileText } from 'lucide-react-native';
import { api } from '~/convex/_generated/api';
import { Text } from '~/src/components/ui/Text';
import { formatMatchListActivity } from '~/src/lib/dateFormat';

const PAGE_SIZE = 20;

const REASON_LABELS: Record<string, string> = {
  fetishization: 'Fetishizing behavior',
  transphobia: 'Transphobia',
  'unwanted-sexual-content': 'Unwanted sexual content',
  harassment: 'Harassment',
  'safety-concern': 'Safety concern',
  'fake-profile': 'Fake profile',
  underage: 'Underage',
  spam: 'Spam or scam',
  other: 'Something else',
};

const STATUS_COPY: Record<
  'open' | 'under-review' | 'actioned' | 'dismissed',
  { label: string; tone: 'neutral' | 'progress' | 'success' | 'muted' }
> = {
  open: { label: 'Awaiting review', tone: 'neutral' },
  'under-review': { label: 'In review', tone: 'progress' },
  actioned: { label: 'Action taken', tone: 'success' },
  dismissed: { label: 'No action', tone: 'muted' },
};

const STATUS_PILL_CLASSES: Record<
  'neutral' | 'progress' | 'success' | 'muted',
  string
> = {
  neutral: 'bg-plum-50 text-plum-700',
  progress: 'bg-peach-100 text-peach-700',
  success: 'bg-plum-600 text-cream-50',
  muted: 'bg-cream-100 text-plum-400',
};

export default function MyReportsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const list = usePaginatedQuery(
    api.reports.mySubmissions,
    {},
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <View className="flex-1 bg-cream-50" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-3 py-2 border-b border-plum-50">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft color="#6D28D9" size={22} />
        </Pressable>
        <Text variant="heading" className="text-lg text-plum-900 ml-1">
          My reports
        </Text>
      </View>

      {list.status === 'LoadingFirstPage' ? (
        <View className="flex-1" />
      ) : list.results.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <FileText color="#A78BFA" size={40} />
          <Text variant="heading" className="text-lg text-plum-900 mt-4 text-center">
            No reports yet.
          </Text>
          <Text variant="body" className="text-sm text-plum-600 mt-2 text-center">
            If you ever need to flag someone, you can do it from their profile or chat. We review every report within 48 hours.
          </Text>
        </View>
      ) : (
        <FlatList
          data={list.results}
          keyExtractor={(row) => row.reportId}
          contentContainerStyle={{ paddingVertical: 8 }}
          onEndReached={() => {
            if (list.status === 'CanLoadMore') list.loadMore(PAGE_SIZE);
          }}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => {
            const statusCopy = STATUS_COPY[item.status];
            return (
              <View className="px-4 py-3 border-b border-plum-50">
                <View className="flex-row items-center justify-between mb-1">
                  <Text variant="body" className="text-base text-plum-900 flex-1 mr-2">
                    {REASON_LABELS[item.reason] ?? item.reason}
                  </Text>
                  <View
                    className={`px-2 py-0.5 rounded-full ${STATUS_PILL_CLASSES[statusCopy.tone].split(' ')[0]}`}
                  >
                    <Text
                      variant="caption"
                      className={`text-xs ${STATUS_PILL_CLASSES[statusCopy.tone].split(' ')[1]}`}
                    >
                      {statusCopy.label}
                    </Text>
                  </View>
                </View>
                <Text variant="caption" className="text-xs text-plum-400">
                  Sent {formatMatchListActivity(item.createdAt)}
                  {item.resolvedAt
                    ? ` · Resolved ${formatMatchListActivity(item.resolvedAt)}`
                    : ''}
                </Text>
                {item.context && (
                  <Text
                    variant="body"
                    className="text-sm text-plum-700 mt-2"
                    numberOfLines={3}
                  >
                    {item.context}
                  </Text>
                )}
                {item.moderatorNotes && (
                  <View className="mt-2 rounded-md bg-plum-50 p-3">
                    <Text variant="caption" className="text-xs text-plum-600 mb-1">
                      From the moderator
                    </Text>
                    <Text variant="body" className="text-sm text-plum-900">
                      {item.moderatorNotes}
                    </Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
