import { useRef, useState } from 'react'
import { FONT } from '../assets'
import { OUTRO_SIGNUP_COPY } from '../config/event'
import { submitSubscribe } from '../lib/subscribeApi'
import {
  EMPTY_SUBSCRIBE_VALUES,
  validateSubscribe,
  type SubscribeFieldErrors,
  type SubscribeFieldName,
  type SubscribeValues,
} from '../lib/validate'
import { useViewport } from '../lib/viewport'

/**
 * The mailing-list strip on the outro screen of /tickets.
 *
 * Renders the CONTENTS of a layer, not the layer — LandingShell owns the fixed positioning
 * and the opacity, which the scroll engine drives per frame off the tail of the outro ramp.
 * Same division as KeyArt. See the `outro` prop there.
 *
 * WHY THIS IS NOT SignupForm, AND NOT form/Field.tsx.
 *
 * Two different surfaces. Those are black ink on the cream paper sheet at the bottom of `/`
 * and the guestlist route, with a label above every field and 22px between them. This sits
 * on the navy outro ground, in the ~140px band the footer and the SEPT 20 block leave
 * between them on a small phone, and it collects two fields rather than six. Sharing the
 * primitives would mean a `variant` prop threaded through every one of them to invert a
 * palette and delete a layout, which is a worse object than two small ones.
 *
 * What it DOES share is everything that would be a bug to diverge on: `validateSubscribe`
 * is the twin of the server's copy, the @sfu.ca refusal is the same rule as every other
 * form, the 16px input floor is the same iOS zoom fix as `controlStyle`, and the honeypot
 * and mount-time traps match what api/subscribe.ts checks.
 *
 * THE HEIGHT BUDGET IS REAL. On a 375x667 screen the band between the footer and EventInfo
 * is about 141px. The eyebrow, the row and the fine print come to roughly 120px. If the fine
 * print ever wraps to a fourth line this collides with the SEPT 20 block, and the eyebrow is
 * the thing to drop first.
 */

/** White-on-navy equivalents of INK / MUTED / FIELD_RULE from form/Field.tsx. */
const ON_DARK = '#fff'
const ON_DARK_MUTED = 'rgba(255,255,255,0.62)'
const ON_DARK_RULE = 'rgba(255,255,255,0.55)'
/** Lighter than ERROR's #c81e1e, which is unreadable against a near-black ground. */
const ON_DARK_ERROR = '#ff8a8a'

type Phase = { kind: 'idle' } | { kind: 'submitting' } | { kind: 'done' }

export default function OutroSignup() {
  const vp = useViewport()
  const [values, setValues] = useState<SubscribeValues>(EMPTY_SUBSCRIBE_VALUES)
  const [errors, setErrors] = useState<SubscribeFieldErrors>({})
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [banner, setBanner] = useState<string | null>(null)
  const [company, setCompany] = useState('') // honeypot

  const mountedAt = useRef(Date.now())
  const formRef = useRef<HTMLFormElement>(null)

  const desktop = vp.isDesktop

  function set<K extends SubscribeFieldName>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
    // Clear the error as soon as the user engages; re-validated on blur and submit.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
    setBanner(null)
  }

  /** Validate-on-blur, never on change — per-keystroke email errors are hostile. */
  function validateField(key: SubscribeFieldName) {
    const result = validateSubscribe(values)
    if (result.ok) {
      setErrors({})
      return
    }
    setErrors((prev) => ({ ...prev, [key]: result.fieldErrors[key] }))
  }

  function focusFirstError(fieldErrors: SubscribeFieldErrors) {
    const order: SubscribeFieldName[] = ['firstName', 'email']
    const first = order.find((key) => fieldErrors[key])
    if (!first) return
    formRef.current?.querySelector<HTMLElement>(`#outro-${first}`)?.focus()
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (phase.kind === 'submitting') return
    setBanner(null)

    const result = validateSubscribe(values)
    if (!result.ok) {
      setErrors(result.fieldErrors)
      focusFirstError(result.fieldErrors)
      return
    }

    setPhase({ kind: 'submitting' })
    const response = await submitSubscribe(values, {
      company,
      elapsedMs: Date.now() - mountedAt.current,
    })

    if (response.status === 'subscribed') {
      setPhase({ kind: 'done' })
      return
    }

    // Everything else keeps the form up with what was typed still in it. Unlike a signup,
    // there is no committed row behind a failure here — see api/subscribe.ts — so a retry
    // is the whole recovery and throwing the values away would be the actual damage.
    setPhase({ kind: 'idle' })

    if (response.status === 'invalid') {
      const fieldErrors = response.fieldErrors
      if (!Object.values(fieldErrors).some(Boolean)) {
        setBanner('Something went wrong. Please check your details and try again.')
        return
      }
      setErrors(fieldErrors)
      focusFirstError(fieldErrors)
      return
    }

    setBanner(response.message)
  }

  if (phase.kind === 'done') {
    return (
      <p role="status" style={{ ...eyebrowStyle(desktop), color: ON_DARK, marginBottom: 0 }}>
        {OUTRO_SIGNUP_COPY.successBody}
      </p>
    )
  }

  const submitting = phase.kind === 'submitting'
  /*
    The error takes the fine print's PLACE rather than stacking under it, so the block is the
    same height in both states and can never grow into the SEPT 20 block above it.

    WHICH RAISES A FAIR QUESTION, because the line it displaces is the consent sentence: can
    someone submit while it is hidden? No, and the ordering in `onSubmit` is what guarantees
    it. `banner` is cleared on the first line, and a request is only reached once
    `validateSubscribe` passes, which means no field error is set either. So `notice` is
    always null on the render that a live submission happens under, and the sentence is
    always on screen at the moment it counts. Keep that ordering if this is touched.
  */
  const notice = banner ?? errors.firstName ?? errors.email ?? null

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate style={{ userSelect: 'text' }}>
      <p style={eyebrowStyle(desktop)}>{OUTRO_SIGNUP_COPY.eyebrow}</p>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
        <input
          id="outro-firstName"
          // No visible label: there is no room for one, and a placeholder alone is not an
          // accessible name. Both are set, and they say the same thing.
          aria-label={OUTRO_SIGNUP_COPY.firstNameLabel}
          placeholder={OUTRO_SIGNUP_COPY.firstNameLabel}
          autoComplete="given-name"
          aria-invalid={errors.firstName ? true : undefined}
          value={values.firstName}
          onChange={(e) => set('firstName', e.target.value)}
          onBlur={() => validateField('firstName')}
          style={inputStyle(Boolean(errors.firstName))}
        />
        <input
          id="outro-email"
          type="email"
          inputMode="email"
          aria-label={OUTRO_SIGNUP_COPY.emailLabel}
          placeholder={OUTRO_SIGNUP_COPY.emailLabel}
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          value={values.email}
          onChange={(e) => set('email', e.target.value)}
          onBlur={() => validateField('email')}
          style={inputStyle(Boolean(errors.email))}
        />
        <button type="submit" disabled={submitting} style={submitStyle(desktop, submitting)}>
          {submitting ? OUTRO_SIGNUP_COPY.submittingLabel : OUTRO_SIGNUP_COPY.submitLabel}
        </button>
      </div>

      {/* Bot trap. Off-screen rather than display:none — some bots skip hidden fields. */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}
      >
        <label htmlFor="outro-company">Company</label>
        <input
          id="outro-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      {notice ? (
        <p role="alert" style={{ ...fineStyle, color: ON_DARK_ERROR }}>
          {notice}
        </p>
      ) : (
        <p style={fineStyle}>
          {OUTRO_SIGNUP_COPY.privacyNotice}{' '}
          {/* New tab, not a router link: an in-app navigation would unmount this form and
              silently destroy everything typed. Same reasoning as SignupForm. */}
          <a
            href={OUTRO_SIGNUP_COPY.privacyHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: ON_DARK_MUTED, textDecoration: 'underline' }}
          >
            {OUTRO_SIGNUP_COPY.privacyLinkText}
          </a>
          {OUTRO_SIGNUP_COPY.privacyNoticeAfter}
        </p>
      )}
    </form>
  )
}

function eyebrowStyle(desktop: boolean) {
  return {
    fontFamily: FONT,
    fontWeight: 500,
    fontSize: 11,
    lineHeight: '120%',
    // Positive tracking, matching the countdown label and EventInfo's kicker: all-caps has
    // no ascenders or descenders to carry word shape at this size.
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: ON_DARK,
    marginBottom: desktop ? 10 : 8,
  }
}

function inputStyle(invalid: boolean) {
  return {
    fontFamily: FONT,
    fontWeight: 500,
    letterSpacing: '-0.02em',
    color: ON_DARK,
    // Transparent, so the artwork and the ground show through the way every other element
    // on this screen does. A filled box would read as a hole punched in the outro.
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${invalid ? ON_DARK_ERROR : ON_DARK_RULE}`,
    borderRadius: 0,
    padding: '8px 2px',
    // Both inputs share the row evenly and neither may push the button off the edge.
    flex: '1 1 0',
    minWidth: 0,
    outline: 'none',
    // iOS zooms the viewport when a focused input is under 16px. Non-negotiable — the same
    // rule as `controlStyle` in form/Field.tsx.
    fontSize: 16,
  }
}

function submitStyle(desktop: boolean, submitting: boolean) {
  return {
    fontFamily: FONT,
    fontWeight: 500 as const,
    fontSize: desktop ? 13 : 12,
    lineHeight: 1,
    letterSpacing: '-0.02em',
    textTransform: 'uppercase' as const,
    color: ON_DARK,
    // Outlined rather than filled, matching the hero rail pill. Nothing on this screen is
    // a solid slab, and the one filled control on /tickets is the ticket link.
    background: 'none',
    border: `1px solid ${ON_DARK_RULE}`,
    borderRadius: 999,
    padding: desktop ? '0 18px' : '0 14px',
    flexShrink: 0,
    cursor: submitting ? 'default' : 'pointer',
    opacity: submitting ? 0.55 : 1,
    whiteSpace: 'nowrap' as const,
  }
}

const fineStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 11,
  lineHeight: '140%',
  letterSpacing: '-0.02em',
  color: ON_DARK_MUTED,
  marginTop: 10,
  marginBottom: 0,
}
