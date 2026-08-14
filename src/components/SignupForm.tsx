import { useEffect, useMemo, useRef, useState } from 'react'
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
import { Checkbox, ERROR, Field, INK, MUTED } from './form/Field'
import { DobField } from './form/DobField'

/**
 * The signup form. Parameterised by ListConfig so the deferred lists reuse it
 * unchanged — everything list-specific (labels, copy, ticket type) comes from config.
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
  const privacyText = `${cfg.copy.privacyLabel} ${cfg.copy.privacyLinkText}`

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
    const order: FieldName[] = [
      'firstName', 'lastName', 'email', 'phone',
      'dobYear', 'ageConfirmed', 'privacyAccepted',
    ]
    const first = order.find((key) => fieldErrors[key])
    if (!first) return
    const el = formRef.current?.querySelector<HTMLElement>(
      first === 'dobYear' ? '[autocomplete="bday-month"]' : `#${first}`,
    )
    el?.focus()
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
        setPhase({ kind: 'done', response })
        return

      case 'already_registered':
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

      case 'invalid':
        // Already translated to client field names by submitSignup.
        setPhase({ kind: 'idle' })
        setErrors(response.fieldErrors)
        focusFirstError(response.fieldErrors)
        return

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

  // Terminal success states replace the form entirely. `already_registered` is
  // styled as success, never as an error — that person IS on the list.
  if (phase.kind === 'done') {
    const r = phase.response
    if (r.status === 'created' || r.status === 'already_registered') {
      const isNew = r.status === 'created'
      return (
        <div role="status" style={{ maxWidth: 520 }}>
          <h3 style={{ ...headingStyle(vp), marginBottom: 12 }}>
            {isNew ? cfg.copy.successTitle : cfg.copy.alreadyTitle}
          </h3>
          <p style={bodyStyle}>{isNew ? cfg.copy.successBody : cfg.copy.alreadyBody}</p>
          <p style={{ ...bodyStyle, color: MUTED, marginTop: 16 }}>
            {cfg.capacity ? `Spot ${r.slot} of ${cfg.capacity}` : `Confirmation #${r.slot}`}
          </p>
        </div>
      )
    }
    // full / closed / not_open are handled by the parent via onResult, which swaps
    // in RsvpClosed. Rendering nothing here avoids a frame of stale form.
    return null
  }

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
        <Checkbox
          id="ageConfirmed"
          checked={values.ageConfirmed}
          onChange={(v) => set('ageConfirmed', v)}
          error={errors.ageConfirmed}
        >
          {cfg.copy.ageLabel}
        </Checkbox>

        <Checkbox
          id="privacyAccepted"
          checked={values.privacyAccepted}
          onChange={(v) => set('privacyAccepted', v)}
          error={errors.privacyAccepted}
        >
          {cfg.copy.privacyLabel}{' '}
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
        </Checkbox>

        {/* Optional by design — under CASL consent must be freely given and cannot be
            a condition of signing up. */}
        <Checkbox
          id="consentOptIn"
          checked={values.consentOptIn}
          onChange={(v) => set('consentOptIn', v)}
        >
          {cfg.copy.consentLabel}
        </Checkbox>
      </div>

      {banner && (
        <p role="alert" style={{ ...bodyStyle, color: ERROR, marginBottom: 16 }}>
          {banner}
        </p>
      )}

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
