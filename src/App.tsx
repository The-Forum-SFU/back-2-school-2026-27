import LandingShell from './components/LandingShell'

/**
 * `/` — the landing experience with no bottom section.
 *
 * Deliberately no form. The signup lives on the routes that own a specific list (the
 * Discounted Guestlist today, friends and free lists later), so that adding a list
 * never means editing this file and no route inherits another route's form.
 */
export default function App() {
  return <LandingShell />
}
