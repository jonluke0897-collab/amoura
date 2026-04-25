import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePaginatedQuery } from 'convex/react';
import { ChevronLeft, FileText } from 'lucide-react-native';
import { api } from '~/convex/_generated/api';
import { Text } from '~/src/components/ui/Text';
import { formatMatchListActivity } from '~/src/lib/dateFormat';
import { reportReasonLabel } from '~/src/features/reports/reportReasons';

const PAGE_SIZE = 20;

type StatusTone = 'neutral' | 'progress' | 'success' | 'muted';

const STATUS_COPY: Record<
  'open' | 'under-review' | 'actioned' | 'dismissed',
  { label: string; tone: StatusTone }
> = {
  open: { label: 'Awaiting review', tone: 'neutral' },
  'under-review': { label: 'In review', tone: 'progress' },
  actioned: { label: 'Action taken', tone: 'success' },
  dismissed: { label: 'No action', tone: 'muted' },
};

// Split bg / text into named fields rather than a single class string —
// the previous shape relied on .split(' ')[0/1] at the call site, which
// silently broke if anyone added a third class to the bundle. Typed
// fields make the contract explicit and ESLint-checkable.
const STATUS_PILL_CLASSES: Record<StatusTone, { bg: string; text: string }> = {
  neutral: { bg: 'bg-plum-50', text: 'text-plum-700' },
  progress: { bg: 'bg-peach-100', text: 'text-peach-700' },
  success: { bg: 'bg-plum-600', text: 'text-cream-50' },
  muted: { bg: 'bg-cream-100', text: 'text-plum-400' },
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
        <View
          className="flex-1 items-center justify-center"
          accessibilityRole="progressbar"
          accessibilityLabel="Loading reports"
        >
          <ActivityIndicator color="#6D28D9" />
        </View>
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
            const pill = STATUS_PILL_CLASSES[statusCopy.tone];
            return (
              <View className="px-4 py-3 border-b border-plum-50">
                <View className="flex-row items-center justify-between mb-1">
                  <Text variant="body" className="text-base text-plum-900 flex-1 mr-2">
                    {reportReasonLabel(item.reason)}
                  </Text>
                  <View className={`px-2 py-0.5 rounded-full ${pill.bg}`}>
                    <Text variant="caption" className={`text-xs ${pill.text}`}>
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
