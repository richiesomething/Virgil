// The stages of adding a book, in order. /add-book (.claude/skills/add-book) walks these;
// pipeline.json in each book's folder records their status so work can resume across sessions.
export const STAGES = [
  { id: 'manifest', title: 'Manifest and chapter list', template: null },
  { id: 'chapters', title: 'Chapter summaries and who appears', template: 'chapters.md' },
  { id: 'reveals', title: 'Secrets and when they are revealed', template: 'reveals.md' },
  { id: 'cast', title: 'Cast: people, objects, places', template: 'cast.md' },
  { id: 'relationships', title: 'Relationships', template: 'relationships.md' },
  { id: 'glossary', title: 'Glossary notes', template: 'glossary.md' },
  { id: 'primers', title: 'Before you read', template: 'primers.md' },
  { id: 'recaps', title: 'Story so far', template: 'recaps.md' },
  { id: 'atlas', title: 'Atlas: frames, places, settings, journeys', template: 'atlas.md' },
  { id: 'understanding', title: 'Themes, insights, afterword', template: 'understanding.md' },
  { id: 'timeline', title: 'Timeline (only for books told out of order)', template: 'timeline.md', optional: true },
  { id: 'review', title: 'Spoiler review', template: 'review.md' },
  { id: 'publish', title: 'Build, check screens, publish', template: null },
]
