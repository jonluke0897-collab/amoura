import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '~/convex/_generated/api';
import { Text } from '~/src/components/ui/Text';
import { Button } from '~/src/components/ui/Button';

const MAX_NAME_LENGTH = 50;

export type NameEditSheetProps = {
  visible: boolean;
  currentName: string;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Centered edit dialog for the user's display name. Simpler than a full
 * bottom sheet because the form is a single field — a centered card with
 * KeyboardAvoidingView keeps the input above the keyboard on both
 * platforms without the sheet-translation machinery.
 */
export function NameEditSheet({
  visible,
  currentName,
  onClose,
  onSaved,
}: NameEditSheetProps) {
  const updateDisplayName = useMutation(api.users.updateDisplayName);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed from the current name whenever the dialog opens so a previous
  // un-saved edit doesn't leak into the next open.
  useEffect(() => {
    if (visible) {
      setName(currentName);
      setError(null);
    }
  }, [visible, currentName]);

  const trimmed = name.trim();
  // Compare trimmed against trimmed so a currentName arriving with
  // incidental whitespace (e.g. a pre-normalization Clerk sync) doesn't
  // register as "user edited it" and enable Save on a no-op.
  const canSave =
    !saving && trimmed.length > 0 && trimmed !== currentName.trim();

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await updateDisplayName({ displayName: trimmed });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save name');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 bg-plum-900/40 items-center justify-center px-6">
          <Pressable
            className="absolute inset-0"
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View className="bg-cream-50 rounded-lg p-5 w-full max-w-sm shadow-modal">
            <Text variant="heading" className="text-xl text-plum-900 mb-4">
              Change name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={MAX_NAME_LENGTH}
              placeholder="Your name"
              placeholderTextColor="#A78BFA"
              returnKeyType="done"
              onSubmitEditing={handleSave}
              editable={!saving}
              accessibilityLabel="Display name"
              className="border border-plum-50 rounded-md px-3 py-3 text-base text-plum-900 mb-2 font-body"
            />
            <Text variant="caption" className="text-plum-400 mb-4">
              Shown on your profile and anywhere others see you.
            </Text>
            {error && (
              <Text variant="body" className="text-sm text-rose-700 mb-3">
                {error}
              </Text>
            )}
            <View className="flex-row">
              <View className="flex-1 mr-2">
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={handleClose}
                  disabled={saving}
                />
              </View>
              <View className="flex-1 ml-2">
                <Button
                  label="Save"
                  variant="primary"
                  onPress={handleSave}
                  loading={saving}
                  disabled={!canSave}
                />
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
