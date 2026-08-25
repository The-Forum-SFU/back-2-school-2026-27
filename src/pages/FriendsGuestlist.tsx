import LandingShell from '../components/LandingShell'
import ListBottom from '../components/ListBottom'
import { useNoIndex } from '../lib/useNoIndex'

/**
 * The Friends & Family Discounted Guestlist, on its own unguessable path in main.tsx.
 *
 * The same page as Guestlist next door, down to the door rate and the disclaimer, and
 * deliberately so: everything a person sees comes from LISTS, and only the ticketType
 * below differs. What that one word buys is a SEPARATE POOL. Capacity in `claim_signup`
 * is counted per ticket_type, so these 75 spots and the promoter list's 75 are two
 * independent counts and neither can eat the other.
 *
 * Not discoverable and not meant to be: nothing links here, it is not in the sitemap,
 * and `useNoIndex` keeps it out of search results for anything that does find it. The
 * random suffix on the route is the actual protection — a guessable guestlist URL
 * leaking publicly costs real money at the door.
 */
export default function FriendsGuestlist() {
  useNoIndex()
  return <LandingShell bottom={<ListBottom ticketType="friends-family" />} />
}
