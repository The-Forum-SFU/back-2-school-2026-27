import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FONT } from '../assets'
import { EVENT, type ListConfig } from '../config/event'
import { trackLead } from '../lib/metaPixel'
import { submitSignup, type SignupResponse } from '../lib/signupApi'
import {
  EMPTY_VALUES,
  validateSignup,
  type FieldErrors,
  type FieldName,
  type SignupValues,
} from '../lib/validate'
import type { Viewport } from '../lib/viewport'
import { ROUTES } from '../routes'
import { Checkbox, ERROR, Field, INK, MUTED, RULE } from './form/Field'
import { DobField } from './form/DobField'
import type { ConfirmedState } from '../pages/Confirmed'

/**
 * The signup form. Parameterised by ListConfig so the deferred lists reuse it
 * unchanged — everything list-specific (labels, copy, ticket type) comes from config.
 *
 * Field order is fixed by the build plan: first name, last name, email, phone,
 * birthdate, then the opt-in. The opt-in is the ONLY checkbox. What used to be an age
 * checkbox is now the birthdate, and what used to be a privacy checkbox is the passive
 * notice above the submit button — see src/lib/signupApi.ts for how both are recorded.
 *
 * Not a prop: any kind of `extraFields?: ReactNode`. Arbitrary JSX can't be
 * serialised into the request, so a future table-service "party size" passed that way
 * would render but never submit. When those pages land they compose their own inputs
 * alongside this and pass the values through the request instead.
 */

type Props = {
  cfg: ListConfig
  vp: Viewport
  onResult?: (r: SignupResponse) => void
}

type Phase = { kind: 'idle' } | { kind: 'submitting' } | { kind: 'done'; response: SignupResponse }

export default function SignupForm({ cfg, vp, onResult }: Props) {
  const navigate = useNavigate()
  const [values, setValues] = useState<SignupValues>(EMPTY_VALUES)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [banner, setBanner] = useState<string | null>(null)
  const [company, setCompany] = useState('') // honeypot

  const mountedAt = useRef(Date.now())
  const formRef = useRef<HTMLFormElement>(null)

  /**
   * Stable across retries, regenerated only after a successful signup.
   *
   * This is what makes Meta dedup survive a lost response: if the id regenerated per
   * attempt, a retry would send Lead(A) server-side and Lead(B) from the pixel —
   * two Leads, no dedup.
   */
  const eventIdRef = useRef<string>(`lead_${crypto.randomUUID()}`)

  const consentText = cfg.copy.consentLabel
  /**
   * Everything the person was told about their data, as one string. The venue
   * disclosure is joined in rather than dropped: it is shown at the same moment and
   * belongs in the same verbatim record.
   */
  const privacyText = [
    `${cfg.copy.privacyNotice} ${cfg.copy.privacyLinkText}.`,
    cfg.copy.venueShareNote,
  ]
    .filter(Boolean)
    .join(' ')

  const validateOpts = useMemo(
    () => ({ minAge: cfg.minAge, doorDate: EVENT.doorDate }),
    [cfg.minAge],
  )

  useEffect(() => {
    if (phase.kind === 'done') onResult?.(phase.response)
  }, [phase, onResult])

  function set<K extends FieldName>(key: K, value: SignupValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    // Clear the error as soon as the user engages; re-validated on blur and submit.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  /** Validate-on-blur, never on change — per-keystroke email errors are hostile. */
  function validateField(key: FieldName) {
    const result = validateSignup(values, validateOpts)
    if (result.ok) {
      setErrors({})
      return
    }
    const message = result.fieldErrors[key]
    setErrors((prev) => ({ ...prev, [key]: message }))
  }

  function focusFirstError(fieldErrors: FieldErrors) {
    // Reading order, opt-in last — it is the bottom of the form, and jumping past
    // three empty text fields to the checkbox would hide what else is wrong.
    const order: FieldName[] = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'dobYear',
      'consentOptIn',
    ]
    const first = order.find((key) => fieldErrors[key])
    if (!first) return
    const el = formRef.current?.querySelector<HTMLElement>(
      first === 'dobYear' ? '[autocomplete="bday-month"]' : `#${first}`,
    )
    el?.focus()
  }

  /**
   * Hands off to the confirmation page.
   *
   * The name and email travel in router state, never in the URL — a query string would
   * put them in browser history, in any analytics that records paths, and in the
   * Referer of every outbound click from that page.
   *
   * Not `replace`: the build plan tells people to fill the form again if they typed
   * their name wrong, so the back button has to land back on the form.
   */
  function goToConfirmation(isNew: boolean) {
    const state: ConfirmedState = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim(),
      isNew,
    }
    navigate(ROUTES.CONFIRMED, { state })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (phase.kind === 'submitting') return
    setBanner(null)

    const result = validateSignup(values, validateOpts)
    if (!result.ok) {
      setErrors(result.fieldErrors)
      focusFirstError(result.fieldErrors)
      return
    }

    setPhase({ kind: 'submitting' })
    const response = await submitSignup(cfg.ticketType, values, result.dob, {
      eventId: eventIdRef.current,
      consentText,
      privacyText,
      company,
      elapsedMs: Date.now() - mountedAt.current,
    })

    switch (response.status) {
      case 'created':
        // Both sides fire only on `created`, with the id the server echoed back —
        // so any server-side normalisation can't desync the pair.
        trackLead(response.eventId)
        eventIdRef.current = `lead_${crypto.randomUUID()}`
        goToConfirmation(true)
        return

      // Styled as success, never as an error — that person IS on the list, and the
      // confirmation page is what they need to see either way.
      case 'already_registered':
        goToConfirmation(false)
        return

      case 'full':
      case 'closed':
      case 'not_open':
        setPhase({ kind: 'done', response })
        return

      case 'underage':
        setPhase({ kind: 'idle' })
        setErrors({
          dobYear: `You must be ${response.minAge} or older on the night of the event`,
        })
        focusFirstError({ dobYear: 'x' })
        return

      case 'invalid': {
        // Already translated to client field names by submitSignup, which drops any
        // the form can't render. If that leaves nothing to mark, say so rather than
        // silently refusing to submit with no visible reason.
        setPhase({ kind: 'idle' })
        const fieldErrors = response.fieldErrors
        if (!Object.values(fieldErrors).some(Boolean)) {
          setBanner('Something went wrong. Please check your details and try again.')
          return
        }
        setErrors(fieldErrors)
        focusFirstError(fieldErrors)
        return
      }

      case 'rate_limited':
        setPhase({ kind: 'idle' })
        setBanner('Too many attempts from this connection. Try again in a little while.')
        return

      default:
        setPhase({ kind: 'idle' })
        setBanner(
          response.status === 'error'
            ? response.message
            : 'Something went wrong. Please try again.',
        )
    }
  }

  // Success navigates away, so the only `done` states that reach here are
  // full / closed / not_open. Those are handled by the parent via onResult, which
  // swaps in RsvpClosed; rendering nothing avoids a frame of stale form.
  if (phase.kind === 'done') return null

  const submitting = phase.kind === 'submitting'

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="signup"
      // Defensive: the section is a sibling of #scroll-spacer so it doesn't inherit
      // the landing page's user-select:none, but this survives a future refactor
      // that nests it inside a shared shell.
      style={{ maxWidth: 520, userSelect: 'text' }}
    >
      {cfg.copy.formHeading && (
        <h3 style={{ ...headingStyle(vp), marginBottom: cfg.copy.formSubheading ? 8 : 24 }}>
          {cfg.copy.formHeading}
        </h3>
      )}
      {cfg.copy.formSubheading && (
        <p style={{ ...bodyStyle, marginBottom: 28 }}>{cfg.copy.formSubheading}</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: vp.isMobile ? '1fr' : '1fr 1fr', gap: '0 16px' }}>
        <Field
          id="firstName"
          label="First name"
          autoComplete="given-name"
          value={values.firstName}
          onChange={(e) => set('firstName', e.target.value)}
          onBlur={() => validateField('firstName')}
          error={errors.firstName}
        />
        <Field
          id="lastName"
          label="Last name"
          autoComplete="family-name"
          value={values.lastName}
          onChange={(e) => set('lastName', e.target.value)}
          onBlur={() => validateField('lastName')}
          error={errors.lastName}
        />
      </div>

      <Field
        id="email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        // Always on screen, not a message that appears after a rejection: an @sfu.ca
        // address is refused outright by validateSignup, and being told before you
        // type beats being told after. See FIELD_COPY in src/config/event.ts.
        hint={cfg.copy.emailNote}
        value={values.email}
        onChange={(e) => set('email', e.target.value)}
        onBlur={() => validateField('email')}
        error={errors.email}
      />

      <Field
        id="phone"
        label="Phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={values.phone}
        onChange={(e) => set('phone', e.target.value)}
        onBlur={() => validateField('phone')}
        error={errors.phone}
      />

      <DobField
        year={values.dobYear}
        month={values.dobMonth}
        day={values.dobDay}
        error={errors.dobYear}
        onChange={(part, value) => set(part, value)}
        onBlur={() => validateField('dobYear')}
      />

      {/* Bot trap. Off-screen rather than display:none — some bots skip hidden fields. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="company">Company</label>
        <input
          id="company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 28, marginBottom: 24 }}>
        {/* The only checkbox on the form, and required: the guestlist is a marketing
            list and a spot is only given to someone who agreed to hear from us.

            Three things have to STAY true for that to be defensible under CASL, which
            wants consent freely given: it ships unticked (no pre-tick, ever), the
            label says plainly what is being consented to, and the emails carry a
            working unsubscribe. Enforced server-side too — api/_lib/validate.ts. */}
        <Checkbox
          id="consentOptIn"
          checked={values.consentOptIn}
          onChange={(v) => set('consentOptIn', v)}
          error={errors.consentOptIn}
        >
          {cfg.copy.consentLabel}
        </Checkbox>

        {/* Sits under the opt-in but is NOT conditional on it: sharing the name with
            the venue is how check-in works, so everyone who signs up is told. */}
        {cfg.copy.venueShareNote && (
          <p style={{ ...fineStyle, marginTop: 12, paddingLeft: 26 }}>
            {cfg.copy.venueShareNote}
          </p>
        )}
      </div>

      {cfg.copy.termsLines && cfg.copy.termsLines.length > 0 && (
        <TermsPanel title={cfg.copy.termsTitle} lines={cfg.copy.termsLines} />
      )}

      {banner && (
        <p role="alert" style={{ ...bodyStyle, color: ERROR, marginBottom: 16 }}>
          {banner}
        </p>
      )}

      <p style={{ ...fineStyle, marginBottom: 16 }}>
        {cfg.copy.privacyNotice}{' '}
        {/* New tab, not a router link: an in-app navigation would unmount this form
            and silently destroy everything the user has typed. */}
        <a
          href={cfg.copy.privacyHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: INK, textDecoration: 'underline' }}
        >
          {cfg.copy.privacyLinkText}
        </a>
        .
      </p>

      <button
        type="submit"
        disabled={submitting}
        style={{
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: vp.isMobile ? 15 : 17,
          letterSpacing: '-0.02em',
          textTransform: 'uppercase',
          color: '#fff',
          background: INK,
          border: 'none',
          borderRadius: 999,
          padding: vp.isMobile ? '16px 28px' : '18px 36px',
          width: vp.isMobile ? '100%' : undefined,
          cursor: submitting ? 'default' : 'pointer',
          opacity: submitting ? 0.55 : 1,
        }}
      >
        {submitting ? 'Sending…' : cfg.copy.submitLabel}
      </button>
    </form>
  )
}

/** The tinted "Before you submit" panel. Tinted so it reads as terms, not as body copy. */
function TermsPanel({ title, lines }: { title?: string; lines: readonly string[] }) {
  return (
    <Panel style={{ marginBottom: 24 }}>
      {title && <p style={panelTitleStyle}>{title}</p>}
      <ul style={panelListStyle}>
        {lines.map((line) => (
          <li key={line} style={panelItemStyle}>
            {line}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.05)',
        border: `1px solid ${RULE}`,
        borderRadius: 4,
        padding: '14px 16px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function headingStyle(vp: Viewport) {
  return {
    fontFamily: FONT,
    fontWeight: 500,
    fontSize: vp.isDesktop ? 30 : 22,
    lineHeight: '110%',
    letterSpacing: '-0.04em',
    textTransform: 'uppercase' as const,
    color: INK,
  }
}

const bodyStyle = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 13,
  lineHeight: '150%',
  letterSpacing: '-0.02em',
  color: INK,
}

/** Disclosures and notices. Quieter than body copy, still legible on the ruling. */
const fineStyle = {
  ...bodyStyle,
  fontSize: 12,
  color: MUTED,
}

const panelTitleStyle = {
  ...bodyStyle,
  fontSize: 12,
  textTransform: 'uppercase' as const,
  letterSpacing: '-0.02em',
  marginBottom: 8,
}

const panelListStyle = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
}

const panelItemStyle = {
  ...bodyStyle,
  fontSize: 12,
}
