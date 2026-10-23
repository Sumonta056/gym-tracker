import { SavedVideos } from '../../../components/saved/SavedVideos'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Saved',
}

export default function SavedPage() {
  return <SavedVideos />
}
