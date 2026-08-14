import LandingShell from '../components/LandingShell'
import ListBottom from '../components/ListBottom'

/**
 * `/presale` — the Discounted Guestlist.
 *
 * Same landing scroll as every other route; the form and ticket comparison sit at the
 * bottom of it. Every future list route is this same three-line shape with a
 * different ticketType.
 */
export default function Presale() {
  return <LandingShell bottom={<ListBottom ticketType="presale-guestlist" />} />
}
