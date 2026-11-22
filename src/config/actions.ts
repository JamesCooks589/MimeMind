/**
 * Single source of truth for every action the game knows about.
 *
 * To add an action: append an entry here. Models refer to actions by `id`,
 * so never rename or reuse an id once recordings exist for it.
 */

export const CATEGORIES = ['sports'] as const
export type Category = (typeof CATEGORIES)[number]

export interface ActionDef {
  /** Stable identifier used as the training label. Never change it once recorded. */
  id: string
  /** Name shown when I guess it ("I think it's… archery!"). */
  displayName: string
  /** What the player is told to act out. */
  prompt: string
  /** A short description of the typical mime, used in record mode and docs. Players may act it differently. */
  hint: string
  category: Category
  /** Hidden actions are never prompted or announced (e.g. idle). */
  hidden?: boolean
}

const definitions = [
  { id: 'swimming', displayName: 'swimming', prompt: 'Swimming (freestyle)', hint: 'Alternating overhead arm circles', category: 'sports' },
  { id: 'boxing', displayName: 'boxing', prompt: 'Boxing', hint: 'Quick forward punches, fists up', category: 'sports' },
  { id: 'basketball_shot', displayName: 'a basketball shot', prompt: 'Basketball shot', hint: 'Both hands push up from the chest', category: 'sports' },
  { id: 'tennis_serve', displayName: 'a tennis serve', prompt: 'Tennis serve', hint: 'One arm reaches up and swings down', category: 'sports' },
  { id: 'archery', displayName: 'archery', prompt: 'Archery', hint: 'One arm out, the other draws back to the face', category: 'sports' },
  { id: 'rowing', displayName: 'rowing', prompt: 'Rowing', hint: 'Both arms pull to the chest', category: 'sports' },
  { id: 'cricket_bowling', displayName: 'cricket bowling', prompt: 'Cricket bowling', hint: 'Straight arm windmills over', category: 'sports' },
  { id: 'golf_swing', displayName: 'a golf swing', prompt: 'Golf swing', hint: 'Clasped hands swing across the body', category: 'sports' },
  { id: 'weightlifting', displayName: 'weightlifting', prompt: 'Weightlifting', hint: 'Curl or overhead press', category: 'sports' },
  { id: 'fishing', displayName: 'fishing', prompt: 'Fishing', hint: 'Cast forward, then small reeling circles', category: 'sports' },
  { id: 'table_tennis', displayName: 'table tennis', prompt: 'Table tennis', hint: 'Small, quick forearm swings', category: 'sports' },
  { id: 'skiing', displayName: 'skiing', prompt: 'Skiing', hint: 'Both hands plant poles, alternating', category: 'sports' },
  { id: 'darts', displayName: 'darts', prompt: 'Darts', hint: 'Small throw from beside the eye', category: 'sports' },
  { id: 'jump_rope', displayName: 'jump rope', prompt: 'Jump rope', hint: 'Small wrist circles at the hips', category: 'sports' },
  { id: 'f1_driving', displayName: 'F1 driving', prompt: 'F1 driving', hint: 'Hands at 10 and 2, turning a wheel', category: 'sports' },
  { id: 'idle', displayName: 'nothing yet', prompt: 'Idle', hint: 'No action: thinking, fidgeting, standing still', category: 'sports', hidden: true },
] as const satisfies readonly ActionDef[]

export type ActionId = (typeof definitions)[number]['id']
export type Action = ActionDef & { id: ActionId }

export const ACTIONS: readonly Action[] = definitions
export const IDLE_ID = 'idle' satisfies ActionId

/** Actions that can be prompted in a match. */
export const PLAYABLE_ACTIONS: readonly Action[] = ACTIONS.filter((a) => !a.hidden)

const byId = new Map<ActionId, Action>(ACTIONS.map((a) => [a.id, a]))

export function getAction(id: ActionId): Action {
  const action = byId.get(id)
  if (!action) throw new Error(`Unknown action id: ${id}`)
  return action
}
