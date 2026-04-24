import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Pencil } from 'lucide-react-native';
import type { Id } from '~/convex/_generated/dataModel';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';
import { PhotoCarousel, type CarouselPhoto } from '~/src/features/profile/PhotoCarousel';
import { PhotoFullScreen } from '~/src/features/photos/PhotoFullScreen';
import { PromptCard } from '~/src/features/profile/PromptCard';
import { VerificationBadge } from '~/src/features/photos/VerificationBadge';
import { interleave } from '~/src/features/profile/interleave';
import { PROMPTS_SCREEN } from '~/src/features/onboarding/onboardingCopy';

const PROMPTS_TARGET = 3;

// Narrow `_id` to the Convex-branded Id<'photos'> here (CarouselPhoto uses
// a plain string so it can cover onboarding-upload temp states). On a
// rendered profile every photo is stored, so the branded id is correct
// and the Phase 4 target-selection flow needs it to type-check.
export type ProfileViewPhoto = Omit<CarouselPhoto, '_id'> & {
  _id: Id<'photos'>;
  isVerified?: boolean;
};

export type ProfileViewPrompt = {
  _id: Id<'profilePrompts'>;
  question: string;
  category: string;
  answerText: string;
};

export type LikeTarget =
  | { type: 'prompt'; id: Id<'profilePrompts'> }
  | { type: 'photo'; id: Id<'photos'> };

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
  onAddPrompts?: () => void;
  bottomSlot?: ReactNode;
  /**
   * Phase 4 Like-with-Comment target selection. When set, taps on a prompt
   * or photo select it as the like target instead of opening fullscreen.
   * `selectedTarget` drives the visual highlight (ring/filled heart).
   * Only takes effect in the `public` variant — self-view ignores these.
   */
  selectableTargets?: boolean;
  selectedTarget?: LikeTarget | null;
  onSelectTarget?: (target: LikeTarget) => void;
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
  onAddPrompts,
  bottomSlot,
  selectableTargets = false,
  selectedTarget = null,
  onSelectTarget,
}: ProfileViewProps) {
  const [fullScreenIndex, setFullScreenIndex] = useState<number | null>(null);
  // Selection mode suppresses the fullscreen photo modal — in Phase 4's
  // like flow, tapping a photo picks it as the target. Users still tap to
  // expand in self and non-selection public views.
  const selectionActive =
    variant === 'public' && selectableTargets && !!onSelectTarget;
  const isPhotoSelected = (id: Id<'photos'>) =>
    selectedTarget?.type === 'photo' && selectedTarget.id === id;
  const isPromptSelected = (id: Id<'profilePrompts'>) =>
    selectedTarget?.type === 'prompt' && selectedTarget.id === id;
  // Hero = first photo; remaining photos interleave with prompts below.
  const [hero, ...rest] = photos;
  const body = interleave<ProfileViewPhoto, ProfileViewPrompt>(rest, prompts);
  const remainingPrompts = Math.max(0, PROMPTS_TARGET - prompts.length);
  const showNudge = variant === 'self' && remainingPrompts > 0 && !!onAddPrompts;
  const nudgeTitle =
    remainingPrompts === 1
      ? PROMPTS_SCREEN.nudgeRemainingSingular
      : PROMPTS_SCREEN.nudgeRemainingPlural.replace('{n}', String(remainingPrompts));

  return (
    <View className="flex-1 bg-cream-50">
      <ScrollView contentContainerStyle={{ paddingBottom: bottomSlot ? 120 : 32 }}>
        {hero && (
          <View className="relative">
            <PhotoCarousel
              photos={[hero]}
              aspectRatio={4 / 5}
              onPhotoTap={() => {
                if (selectionActive) {
                  onSelectTarget?.({ type: 'photo', id: hero._id });
                } else {
                  setFullScreenIndex(0);
                }
              }}
            />
            {hero.isVerified && (
              <View className="absolute top-4 right-4">
                <VerificationBadge status="verified" />
              </View>
            )}
            {selectionActive && isPhotoSelected(hero._id) && (
              // A plum border overlay — the PhotoCarousel owns the image
              // layout, so layering a pointer-events-none overlay on top is
              // the cheapest way to signal selection without re-rendering
              // the carousel with border props.
              <View
                pointerEvents="none"
                className="absolute inset-0 border-4 border-plum-600 rounded-md"
              />
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

        {showNudge && (
          <View className="mx-5 mt-4 mb-1 rounded-md border border-dashed border-plum-400 p-4">
            <Text variant="heading" className="text-lg text-plum-600 mb-2">
              {nudgeTitle}
            </Text>
            <Text variant="body" className="text-sm text-plum-900 mb-3">
              {PROMPTS_SCREEN.nudgeBody}
            </Text>
            <Button
              label={PROMPTS_SCREEN.nudgeCta}
              variant="secondary"
              onPress={onAddPrompts}
            />
          </View>
        )}

        <View className="pt-3">
          {body.map((item) =>
            item.type === 'photo' ? (
              <View key={`photo-${item.item._id}`} className="px-5 my-2 relative">
                <Pressable
                  onPress={() => {
                    if (selectionActive) {
                      onSelectTarget?.({ type: 'photo', id: item.item._id });
                      return;
                    }
                    // Find index of this photo in the full photos array so
                    // full-screen opens at the right position.
                    const idx = photos.findIndex(
                      (p) => p._id === item.item._id,
                    );
                    setFullScreenIndex(idx >= 0 ? idx : null);
                  }}
                  accessibilityRole={selectionActive ? 'button' : 'imagebutton'}
                  accessibilityLabel={
                    selectionActive
                      ? isPhotoSelected(item.item._id)
                        ? 'Selected photo for like'
                        : 'Select this photo'
                      : 'View photo full screen'
                  }
                  accessibilityState={
                    selectionActive
                      ? { selected: isPhotoSelected(item.item._id) }
                      : undefined
                  }
                >
                  <PhotoCarousel photos={[item.item]} aspectRatio={1} />
                </Pressable>
                {selectionActive && isPhotoSelected(item.item._id) && (
                  <View
                    pointerEvents="none"
                    className="absolute inset-x-5 inset-y-0 border-4 border-plum-600 rounded-md"
                  />
                )}
              </View>
            ) : (
              <PromptCard
                key={`prompt-${item.item._id}`}
                question={item.item.question}
                category={item.item.category}
                answerText={item.item.answerText}
                variant={variant}
                onLike={
                  selectionActive
                    ? () =>
                        onSelectTarget?.({
                          type: 'prompt',
                          id: item.item._id,
                        })
                    : undefined
                }
                selected={isPromptSelected(item.item._id)}
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
