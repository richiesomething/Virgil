import { Suspense, lazy, type ComponentProps } from 'react'
import type AtlasMapType from './AtlasMap'

// The atlas (d3-geo and friends) is a fifth of the app's code and only needed on map pages: load it when first shown.
const AtlasMap = lazy(() => import('./AtlasMap'))

export default function LazyAtlasMap(props: ComponentProps<typeof AtlasMapType>) {
  return (
    <Suspense fallback={<div className="atlas-loading" aria-hidden="true" />}>
      <AtlasMap {...props} />
    </Suspense>
  )
}
