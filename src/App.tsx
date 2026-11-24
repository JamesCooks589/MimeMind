import { FramingCheckScreen } from './screens/FramingCheckScreen'
import { RecordScreen } from './screens/RecordScreen'

/**
 * Minimal path-based routing. There are only a few screens, so a router
 * library isn't worth it yet. /record is a dev tool and isn't linked anywhere.
 */
export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '')
  if (path === '/record') return <RecordScreen />
  return <FramingCheckScreen />
}
