import { View } from 'react-native';
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import type { Id } from '~/convex/_generated/dataModel';
import { PhotoSlot } from './PhotoSlot';

const TOTAL_SLOTS = 6;

export type GridSlot =
  | {
      kind: 'photo';
      id: Id<'photos'>;
      url: string | null;
      key: string;
    }
  | { kind: 'empty'; key: string }
  | { kind: 'uploading'; key: string };

export type PhotoGridProps = {
  photos: Array<{ _id: Id<'photos'>; url: string | null }>;
  uploadingCount?: number;
  onAdd: () => void;
  onRemove: (id: Id<'photos'>) => void;
  onReorder: (ids: Id<'photos'>[]) => void;
};

export function PhotoGrid({
  photos,
  uploadingCount = 0,
  onAdd,
  onRemove,
  onReorder,
}: PhotoGridProps) {
  // Build a flat slot list: existing photos, uploading placeholders, then
  // empties to pad out to 6. Only the 'photo' slots are draggable — the
  // uploading + empty slots are fixed trailing.
  const data: GridSlot[] = [
    ...photos.map((p, i) => ({
      kind: 'photo' as const,
      id: p._id,
      url: p.url,
      key: `photo-${p._id}-${i}`,
    })),
    ...Array.from({ length: uploadingCount }, (_, i) => ({
      kind: 'uploading' as const,
      key: `uploading-${i}`,
    })),
  ];
  const trailingEmpty = Math.max(
    0,
    TOTAL_SLOTS - photos.length - uploadingCount,
  );
  for (let i = 0; i < trailingEmpty; i++) {
    data.push({ kind: 'empty', key: `empty-${i}` });
  }

  const renderItem = ({ item, drag, isActive }: RenderItemParams<GridSlot>) => {
    if (item.kind === 'photo') {
      return (
        <ScaleDecorator>
          <View className="p-1" style={{ width: '50%' }}>
            <PhotoSlot
              url={item.url}
              dragging={isActive}
              accessibilityLabel="Photo tile. Long-press to drag, tap to remove."
              onLongPress={drag}
              onPress={() => onRemove(item.id)}
            />
          </View>
        </ScaleDecorator>
      );
    }
    if (item.kind === 'uploading') {
      return (
        <View className="p-1" style={{ width: '50%' }}>
          <PhotoSlot uploading accessibilityLabel="Uploading photo" />
        </View>
      );
    }
    return (
      <View className="p-1" style={{ width: '50%' }}>
        <PhotoSlot onPress={onAdd} accessibilityLabel="Add a photo" />
      </View>
    );
  };

  return (
    <DraggableFlatList
      data={data}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      numColumns={2}
      onDragEnd={({ data: next }) => {
        const photoIds = next
          .filter((d): d is Extract<GridSlot, { kind: 'photo' }> => d.kind === 'photo')
          .map((d) => d.id);
        if (photoIds.length > 0) onReorder(photoIds);
      }}
      contentContainerStyle={{ paddingBottom: 24 }}
      scrollEnabled={false}
    />
  );
}
