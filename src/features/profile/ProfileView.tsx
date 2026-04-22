import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Pencil } from 'lucide-react-native';
import type { Id } from '~/convex/_generated/dataModel';
import { Text } from '~/src/components/ui/Text';
import { PhotoCarousel, type CarouselPhoto } from '~/src/features/profile/PhotoCarousel';
import { PhotoFullScreen } from '~/src/features/photos/PhotoFullScreen';
import { PromptCard } from '~/src/features/profile/PromptCard';
import { VerificationBadge } from '~/src/features/photos/VerificationBadge';
import { interleave } from '~/src/features/profile/interleave';

export type ProfileViewPhoto = CarouselPhoto & {
  isVerified?: boolean;
};

export type ProfileViewPrompt = {
  _id: Id<'profilePrompts'>;
  question: string;
  category: string;
  answerText: string;
};

export type ProfileViewProps = {
  displayName: string;
  age: number | null;
  pronouns: string[];
  identityLabel: string;
  intentions: string[];
  city: string | null;
  photos: ProfileViewPhoto[];
  prompts: ProfileViewPrompt[];
  variant?: 'self' | 'public';
  onEdit?: () => void;
  bottomSlot?: ReactNode;
};

function Chip({ label }: { label: string }) {
  return (
    <View className="px-3 py-1 rounded-full bg-plum-50 mr-2 mb-2">
      <Text variant="body" className="text-sm text-plum-700">
        {label}
      </Text>
    </View>
  );
}

export function ProfileView({
  displayName,
  age,
  pronouns,
  identityLabel,
  intentions,
  city,
  photos,
  prompts,
  variant = 'self',
  onEdit,
  bottomSlot,
}: ProfileViewProps) {
  const [fullScreenIndex, setFullScreenIndex] = useState<number | null>(null);
  // Hero = first photo; remaining photos interleave with prompts below.
  const [hero, ...rest] = photos;
  const body = interleave<ProfileViewPhoto, ProfileViewPrompt>(rest, prompts);

  return (
    <View className="flex-1 bg-cream-50">
      <ScrollView contentContainerStyle={{ paddingBottom: bottomSlot ? 120 : 32 }}>
        {hero && (
          <View className="relative">
            <PhotoCarousel
              photos={[hero]}
              aspectRatio={4 / 5}
              onPhotoTap={() => setFullScreenIndex(0)}
            />
            {hero.isVerified && (
              <View className="absolute top-4 right-4">
                <VerificationBadge status="verified" />
              </View>
            )}
          </View>
        )}

        <View className="px-5 pt-5 pb-2">
          <View className="flex-row items-center flex-wrap">
            <Text variant="heading" className="text-3xl text-plum-900 mr-2">
              {displayName}
            </Text>
            {age !== null && (
              <Text variant="heading" className="text-3xl text-plum-600">
                {age}
              </Text>
            )}
            {variant === 'self' && onEdit && (
              <Pressable
                onPress={onEdit}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
                hitSlop={12}
                className="ml-auto"
              >
                <Pencil color="#6D28D9" size={22} />
              </Pressable>
            )}
          </View>
          <Text variant="body" className="text-base text-plum-600 mt-1">
            {identityLabel}
            {city ? ` · ${city}` : ''}
          </Text>
        </View>

        {pronouns.length > 0 && (
          <View className="px-5 pt-2 flex-row flex-wrap">
            {pronouns.map((p) => (
              <Chip key={p} label={p} />
            ))}
          </View>
        )}

        {intentions.length > 0 && (
          <View className="px-5 pt-2 flex-row flex-wrap">
            {intentions.map((i) => (
              <Chip key={i} label={i.replace(/-/g, ' ')} />
            ))}
          </View>
        )}

        <View className="pt-3">
          {body.map((item, i) =>
            item.type === 'photo' ? (
              <View key={`photo-${item.item._id}-${i}`} className="px-5 my-2">
                <Pressable
                  onPress={() => {
                    // Find index of this photo in the full photos array so
                    // full-screen opens at the right position.
                    const idx = photos.findIndex((p) => p._id === item.item._id);
                    setFullScreenIndex(idx >= 0 ? idx : null);
                  }}
                  accessibilityRole="imagebutton"
                >
                  <PhotoCarousel photos={[item.item]} aspectRatio={1} />
                </Pressable>
              </View>
            ) : (
              <PromptCard
                key={`prompt-${item.item._id}-${i}`}
                question={item.item.question}
                category={item.item.category}
                answerText={item.item.answerText}
                variant={variant}
              />
            ),
          )}
        </View>
      </ScrollView>

      {bottomSlot && (
        <View className="absolute bottom-0 left-0 right-0 bg-cream-50 px-5 pb-6 pt-3 border-t border-plum-50">
          {bottomSlot}
        </View>
      )}

      <PhotoFullScreen
        visible={fullScreenIndex !== null}
        photo={fullScreenIndex !== null ? photos[fullScreenIndex] : null}
        onClose={() => setFullScreenIndex(null)}
      />
    </View>
  );
}
