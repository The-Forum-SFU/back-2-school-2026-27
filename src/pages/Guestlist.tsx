import LandingShell from '../components/LandingShell'
import ListBottom from '../components/ListBottom'
import { useNoIndex } from '../lib/useNoIndex'

/**
 * The Discounted Guestlist, on the unguessable path in main.tsx.
 *
 * Not discoverable and not meant to be: nothing links here, it is not in the sitemap,
 * and `useNoIndex` keeps it out of search results for anything that does find it. The
 * random suffix on the route is the actual protection — a guessable guestlist URL
 * leaking publicly costs real money at the door.
 *
 * Same landing scroll as every other route; the list block sits at the bottom of it.
 * Every future list route is this same shape with a different ticketType.
 */
export default function Guestlist() {
  useNoIndex()
  return <LandingShell bottom={<ListBottom ticketType="presale-guestlist" />} />
}
