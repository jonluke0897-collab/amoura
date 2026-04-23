// PLACEHOLDER copy — awaiting trans advisor review (TASK-025). Headings, subheads,
// section labels, CTAs. Isolated in this file so the review diff is small.

export const SIGN_IN = {
  brand: 'Amoura',
  heading: "You're welcome here.",
  subhead: 'Sign in to start — we\u2019ll take you through a short setup next.',
  appleCta: 'Continue with Apple',
  googleCta: 'Continue with Google',
  emailCta: 'Continue with email',
  emailSheetTitle: 'Sign in with email',
  emailSheetHelp: "We'll send you a link — tap it and you're in.",
  emailInputPlaceholder: 'you@example.com',
  emailSendCta: 'Send magic link',
  emailSentTitle: 'Check your inbox',
  emailSentBody: 'We just sent a sign-in link to {email}. It expires in 15 minutes.',
  termsFooter: 'By continuing, you agree to our Terms & Privacy.',
};

export const IDENTITY_SCREEN = {
  heading: 'Tell us who you are.',
  subhead: 'This shapes who you see, and who sees you. You can change any of this later.',
  pronounsLabel: 'Your pronouns',
  pronounsHelper: 'Pick one or more. Add your own if you don\u2019t see yours.',
  pronounsAddCustom: 'Add custom',
  pronounsAddPlaceholder: 'e.g. xe/xem',
  pronounsAddConfirm: 'Add',
  genderIdentityLabel: 'Gender identity',
  genderIdentityHelper: 'In your own words. Tap a suggestion to start, then edit freely.',
  genderIdentityPlaceholder: 'How you describe yourself',
  modalityLabel: 'Are you...',
  modalityHelper: "This helps us route you to the right welcome flow. Nothing is displayed on your profile.",
  orientationLabel: 'Orientation',
  orientationHelper: 'Pick any that fit. Add your own if you don\u2019t see it.',
  orientationAddCustom: 'Add custom',
  orientationAddPlaceholder: 'e.g. sapphic',
  orientationAddConfirm: 'Add',
  t4tLabel: 'Dating preference',
  t4tHelper: 'Who do you want to see in your feed?',
  continueCta: 'Continue',
};

export const INTENTIONS_SCREEN = {
  heading: 'What are you here for?',
  subhead: 'Pick up to three. We\u2019ll surface people looking for something similar.',
  continueCta: 'Continue',
  maxSelectionHint: 'Pick up to three',
};

export const PHOTOS_SCREEN = {
  heading: 'Show up as yourself.',
  subhead:
    'Two to six photos. Drag to reorder — the first is what people see first.',
  minHint: 'Add at least 2 photos to continue.',
  addCta: 'Add a photo',
  pickerLibrary: 'Choose from library',
  pickerCamera: 'Take a photo',
  pickerCancel: 'Cancel',
  removeTitle: 'Remove this photo?',
  removeConfirm: 'Remove',
  removeCancel: 'Keep',
  continueCta: 'Continue',
  saveCta: 'Save',
  permissionDeniedTitle: 'Photo access is off',
  permissionDeniedBody:
    'To add photos, turn on photo access for Amoura in your device settings.',
  uploadFailedTitle: 'Upload failed',
  uploadFailedBody: "Couldn't upload that one — try picking it again.",
};

export const PROMPTS_SCREEN = {
  heading: 'Prompts, if you like.',
  subhead:
    "Pick up to three. Skip for now if you'd rather — profiles with 3 prompts tend to stand out.",
  pickCta: 'Pick a prompt',
  continueCta: 'Continue',
  skipCta: 'Skip for now',
  saveCta: 'Save',
  characterLimit: 250,
  counterSuffix: '/250',
  editorPlaceholder: 'Write your answer…',
  emptySlotLabel: 'Pick a prompt',
  discardTitle: 'Discard changes?',
  discardBody: "You haven't saved yet.",
  discardConfirm: 'Discard',
  discardKeep: 'Keep editing',
  pickerTitle: 'Pick a prompt',
  pickerClose: 'Close',
  changePromptLabel: 'Change prompt',
  removeAnswerLabel: 'Remove this answer',
  removeAnswerTitle: 'Remove this answer?',
  removeAnswerConfirm: 'Remove',
  removeAnswerKeep: 'Keep',
  saveFailedTitle: 'Save failed',
  saveFailedBody: 'Please try again.',
  removeFailedTitle: 'Remove failed',
  removeFailedBody: 'Please try again.',
  nudgeRemainingSingular: '1 more prompt to round out your profile',
  nudgeRemainingPlural: '{n} more prompts to round out your profile',
  nudgeBody: 'Profiles with 3 prompts stand out more.',
  nudgeCta: 'Add prompts',
};

export const COMPLETE_SCREEN = {
  heading: "You're in.",
  subhead: "Here's how you'll show up.",
  cta: 'See my profile',
};
