/**
 * The privacy policy, as content. Swap this file, not the page component.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ FOUR STATEMENTS BELOW DO NOT MATCH WHAT THIS SITE ACTUALLY DOES.
 *
 * A published policy that misdescribes practice is worse than no policy: it is the
 * first document a regulator reads, and every gap in it is an admission. Each of these
 * is fixable EITHER by changing the sentence here OR by changing the code, and those
 * are different decisions with different consequences. They are marked inline with
 * MISMATCH so they cannot be lost.
 *
 *   1. §5.1 "you can complete the form and get your spot without ticking either box"
 *      and "Agreeing to hear from us is never the price of a guestlist spot."
 *      REALITY: the opt-in is REQUIRED, client-side (src/lib/validate.ts) and
 *      server-side (api/_lib/validate.ts), whose own comment reads "a spot on it is
 *      only given to someone who agreed to hear from us". This is the CASL
 *      "freely given" point the form file already worries about.
 *
 *   2. §5.1 "email and SMS consent are asked separately"
 *      REALITY: one checkbox covers both. See EVENT copy `consentLabel`.
 *
 *   3. §3.1 phone listed as Optional
 *      REALITY: required. src/lib/validate.ts rejects an empty phone.
 *
 *   4. §8 and §14 describe a cookie consent banner, a footer cookie-settings link,
 *      Google Tag Manager and a TikTok pixel.
 *      REALITY: none of those exist. The Meta Pixel is injected unconditionally on
 *      mount in src/components/ListSection.tsx, before any consent is given.
 * ---------------------------------------------------------------------------
 *
 * PLACEHOLDERS. The source document carried `[PUBLICATION DATE]` and
 * `[MAILING ADDRESS]`. Both are null here rather than literal, on the same rule the
 * rest of this codebase follows for unconfirmed facts (see EVENT.venue.address):
 * a line renders only when it has a value, because shipping a visible `[MAILING
 * ADDRESS]` to a reader is worse than shipping no address line at all.
 */

export const PRIVACY_CONTACT = {
  company: 'The Forum Entertainment Inc.',
  email: 'hello@theforumsfu.com',
  /** TODO: set before publishing. Rendered only when non-null. */
  mailingAddress: null as string | null,
  /** TODO: set before publishing, ISO yyyy-mm-dd. Rendered only when non-null. */
  effectiveDate: null as string | null,
  lastUpdated: null as string | null,
}

/**
 * Inline markup supported by the renderer, kept to the two things this document
 * actually needs: `**bold**` and `[label](href)`. Anything else is literal text.
 */
export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'ul'; items: readonly string[] }
  | { kind: 'table'; head: readonly string[]; rows: readonly (readonly string[])[] }

export type Section = {
  /** Rendered as "1." etc. Kept explicit so the numbering survives a reorder. */
  n: number
  title: string
  blocks: readonly Block[]
}

export const PRIVACY_INTRO =
  'This policy explains what personal information we collect, why we collect it, who ' +
  'we share it with, how long we keep it, and what you can ask us to do with it.'

export const PRIVACY_SECTIONS: readonly Section[] = [
  {
    n: 1,
    title: 'Who we are',
    blocks: [
      {
        kind: 'p',
        text:
          'The Forum Entertainment Inc. ("The Forum", "we", "us", "our") is a British ' +
          'Columbia company that produces and promotes live events, primarily for ' +
          'post-secondary students in the Metro Vancouver area.',
      },
      { kind: 'p', text: PRIVACY_INTRO },
      {
        kind: 'p',
        text:
          'We are responsible for the personal information under our control. ' +
          'Questions, requests and complaints go to our Privacy Officer at ' +
          '[hello@theforumsfu.com](mailto:hello@theforumsfu.com).',
      },
    ],
  },
  {
    n: 2,
    title: 'What this policy covers',
    blocks: [
      { kind: 'p', text: 'This policy applies to:' },
      {
        kind: 'ul',
        items: [
          'our website at **theforumuniversity.com** and any subdomain of it, including event pages such as rewind.theforumuniversity.com',
          'any standalone event landing page, signup form, guestlist form, giveaway entry or waitlist we operate',
          'our email and SMS marketing',
          'our post-event surveys and feedback forms',
          'correspondence you send to any @theforumsfu.com address',
        ],
      },
      { kind: 'p', text: 'This policy does **not** cover:' },
      {
        kind: 'ul',
        items: [
          '**Ticketing platforms.** Tickets are sold through third parties such as TicketWeb and Showpass. When you buy a ticket you are on their site, giving them your information under their privacy policy, and they process your payment. We never see your card details.',
          '**Venues.** Nightclubs and other venues we work with are independent businesses with their own privacy practices, security cameras, and door procedures. Section 7 explains the limited information we hand them and why.',
          '**Social platforms.** Instagram, TikTok, Discord and similar services handle your information under their own terms when you interact with us there.',
          '**Other websites** we link to.',
        ],
      },
      {
        kind: 'p',
        text:
          "If you follow a link away from one of our pages, read that company's policy. " +
          'We do not control it.',
      },
    ],
  },
  {
    n: 3,
    title: 'Information we collect',
    blocks: [
      { kind: 'h3', text: '3.1 Information you give us directly' },
      {
        kind: 'p',
        text:
          'Our signup, guestlist and giveaway forms ask for some or all of the ' +
          'following. Which fields appear depends on the form.',
      },
      {
        kind: 'table',
        head: ['Information', 'Typically required?', 'Why the field exists'],
        rows: [
          ['First name', 'Required', 'Checking you in at the door, and addressing you in email'],
          ['Last name', 'Required on guestlist forms', 'Matching you against the door list. The venue calls a name and it has to match your ID'],
          ['Email address', 'Required', 'Sending your confirmation, door instructions, event reminders, and marketing if you opted in'],
          // MISMATCH 3: this site requires a phone number. See the header of this file.
          ['Phone number', 'Optional', 'SMS reminders and marketing, only if you separately opted in to SMS'],
          ['Date of birth', 'Required on some forms', 'Confirming you meet the minimum age for a 19+ event, and sending a birthday offer if you opted in to marketing'],
          ['Which event you signed up for', 'Collected automatically with the form', 'Sending you information about the right event'],
          ['Ticket type or list you joined', 'Collected automatically', 'Applying the correct rate and door instructions'],
          ['How you found us', 'Collected automatically', 'Understanding which of our channels works'],
          ['Your consent choices and the date and time you made them', 'Collected automatically', 'Legally required record under Canadian anti-spam law'],
        ],
      },
      { kind: 'p', text: 'We also collect:' },
      {
        kind: 'ul',
        items: [
          '**Survey and feedback responses**, including free-text comments, when you fill in a post-event form. These are usually collected through a third-party form tool.',
          '**Anything you write to us**, including emails, replies to our marketing, direct messages and support requests.',
          "**Contest and giveaway entries**, including whatever a specific contest's rules require.",
        ],
      },
      { kind: 'h3', text: '3.2 Information collected automatically when you visit our pages' },
      {
        kind: 'ul',
        items: [
          'IP address, and the approximate city or region derived from it',
          'Device type, operating system, browser and language',
          'The page you arrived from, the pages you viewed, how long you stayed, and what you clicked',
          "Advertising click identifiers appended to the URL when you arrive from an ad, including Meta's fbclid and TikTok's ttclid",
          'Campaign parameters we add to our own links, commonly called UTM parameters',
          'Cookie and pixel identifiers set by us and by the advertising and analytics providers listed in section 8',
        ],
      },
      {
        kind: 'p',
        text:
          'We also record, through our marketing platform, whether you opened an email ' +
          'we sent and which links you clicked. Our marketing platform rewraps every ' +
          'link in our emails through its own tracking domain. On our current plan this ' +
          'cannot be switched off.',
      },
      { kind: 'h3', text: '3.3 Information we receive from others' },
      {
        kind: 'ul',
        items: [
          '**Advertising and analytics platforms** give us aggregated and attributed reporting about how our ads performed. This is normally group-level, not individual.',
          '**Ticketing platforms** may give us order reports containing buyer names, email addresses and what they bought, depending on what that platform exports.',
          '**Venue partners** may return a checked-in list after an event so we know who actually attended.',
          '**Referrals and ambassadors** may pass on the name and contact details of someone who asked to be added to a list. If that is you and you did not agree to it, tell us and we will remove you.',
        ],
      },
      { kind: 'h3', text: '3.4 What we do not collect' },
      {
        kind: 'ul',
        items: [
          '**Payment card or bank details.** All payment happens on the ticketing platform or in cash at the door. We do not receive, store or process card numbers.',
          '**Government identification.** Venue door staff check two pieces of government ID as a condition of entry. That check happens at the door, by the venue, and we do not record, scan or retain ID data.',
          '**Sensitive categories.** We do not ask for health information, ethnicity, religion, sexual orientation, political views, or any similar category, and we ask you not to volunteer them in free-text fields.',
        ],
      },
    ],
  },
  {
    n: 4,
    title: 'Why we use your information',
    blocks: [
      {
        kind: 'p',
        text:
          'We use personal information for these purposes and no others without asking ' +
          'you first.',
      },
      {
        kind: 'ul',
        items: [
          '**To run the event you signed up for.** Confirming your spot, sending door instructions, arrival times, address, dress code, age requirements and any change to the plan. Building the door list. Answering your questions. These messages are operational rather than promotional, so they go to everyone holding a spot whether or not you opted in to marketing.',
          '**To send marketing, if you agreed to it.** Announcements of upcoming events, pre-sale access, discount codes, giveaways and newsletters, by email and, separately, by SMS.',
          '**To confirm eligibility.** Our events are 19 and over. Date of birth lets us check that before we put you on a list, rather than turning you away at the door.',
          '**To measure and improve.** Understanding which pages, ads and channels bring people in, how many people who sign up actually attend, and what worked or did not at the event itself.',
          '**To advertise.** Building audiences on advertising platforms, measuring conversions, and showing our ads to people similar to those who already came. Section 8 explains how this works and how to stop it.',
          '**To keep records and meet legal obligations.** Retaining proof of consent as Canadian anti-spam law requires, keeping business and accounting records, and responding to a lawful request from a regulator, court or law enforcement.',
          '**To protect the event.** Preventing fraudulent, duplicate or abusive signups, and protecting attendees, staff and the venue.',
        ],
      },
    ],
  },
  {
    n: 5,
    title: 'Consent',
    blocks: [
      { kind: 'h3', text: '5.1 How we get it' },
      {
        kind: 'p',
        text:
          'We identify why we are collecting information before or at the point we ' +
          'collect it. The form tells you what each field is for.',
      },
      {
        kind: 'p',
        text: 'Marketing consent is separate from the signup itself. On our forms:',
      },
      {
        kind: 'ul',
        items: [
          'the marketing opt-in is a distinct checkbox, unchecked by default',
          // MISMATCH 2: one checkbox covers email and SMS together.
          'email and SMS consent are asked separately, because they are different things',
          // MISMATCH 1: the opt-in is required to submit. See the header of this file.
          'you can complete the form and get your spot without ticking either box',
          'we record the date and time of your consent and store it against your contact record',
        ],
      },
      {
        // MISMATCH 1, continued.
        kind: 'p',
        text:
          'We do not bundle marketing consent into a condition of entry. Agreeing to ' +
          'hear from us is never the price of a guestlist spot.',
      },
      { kind: 'h3', text: '5.2 The kinds of consent we rely on' },
      {
        kind: 'p',
        text:
          'Canadian anti-spam legislation recognises more than one basis for sending ' +
          'commercial messages. Plainly:',
      },
      {
        kind: 'ul',
        items: [
          '**You ticked the box.** This is express consent. It does not expire. It lasts until you withdraw it.',
          '**You asked us about an event.** Signing up for a guestlist, a drop alert or a waitlist is an inquiry, which gives us implied consent to send you commercial messages for **six months** from that date.',
          '**You bought a ticket.** A purchase creates an existing business relationship, which gives us implied consent for **two years** from the date of purchase.',
        ],
      },
      {
        kind: 'p',
        text:
          'Operational messages about an event you signed up for are not commercial ' +
          'electronic messages and are sent regardless.',
      },
      { kind: 'h3', text: '5.3 Withdrawing consent' },
      {
        kind: 'p',
        text: 'You can withdraw marketing consent at any time, at no cost:',
      },
      {
        kind: 'ul',
        items: [
          'click **unsubscribe** at the bottom of any marketing email we send',
          'reply **STOP** to any marketing SMS',
          'email [hello@theforumsfu.com](mailto:hello@theforumsfu.com) and ask',
        ],
      },
      {
        kind: 'p',
        text:
          'We action unsubscribe requests promptly and in any case within 10 business ' +
          'days, which is the maximum Canadian anti-spam law allows.',
      },
      {
        kind: 'p',
        text:
          'Withdrawing marketing consent does not remove you from a guestlist you are ' +
          'already on, and does not stop the operational email that tells you how to get ' +
          'in the door. If you want off a guestlist as well, say so and we will remove you.',
      },
    ],
  },
  {
    n: 6,
    title: 'Our marketing platform',
    blocks: [
      {
        kind: 'p',
        text:
          'We use **Brevo** (operated by Sendinblue SAS, a French company) as our email ' +
          'and SMS marketing platform. When you give us your details through one of our ' +
          'forms, or when we add you to a list, that information is sent to and stored ' +
          'in Brevo.',
      },
      {
        kind: 'p',
        text:
          'What Brevo holds about you includes your first name, last name, email ' +
          'address, phone number if you gave one, date of birth if the form asked for ' +
          'it, which event and list you joined, your marketing consent status, the ' +
          'timestamp of that consent, and the record of which of our emails you opened ' +
          'and clicked.',
      },
      {
        kind: 'p',
        text:
          'Brevo processes this information on our instructions, under contract, to ' +
          'deliver our messages. Brevo hosts data in the European Union, on ' +
          'infrastructure in France, Germany and Belgium. Section 9 explains what ' +
          'storing data outside Canada means for you.',
      },
      {
        kind: 'p',
        text:
          'Brevo has its own privacy policy at brevo.com covering how it operates as a ' +
          'company.',
      },
    ],
  },
  {
    n: 7,
    title: 'Sharing with venue partners and guestlists',
    blocks: [
      {
        kind: 'p',
        text:
          'This section matters if you signed up for a guestlist, a discounted entry ' +
          'list, a free entry list or any similar option.',
      },
      {
        kind: 'p',
        text:
          '**If you sign up for a guestlist option, we share your name and email address ' +
          'with the venue partner hosting that event, for the sole purpose of checking ' +
          'you in at the door.**',
      },
      { kind: 'p', text: 'Specifically:' },
      {
        kind: 'ul',
        items: [
          "We share **first name, last name and email address**. We do not send your phone number, date of birth, marketing consent status or anything else, unless a specific venue's check-in system requires a field and we tell you so on that form.",
          'We share it with **the venue for that one event**, not with venues generally, and not with any venue whose event you did not sign up for.',
          'The purpose is **door check-in only**. It lets staff confirm you are on the list, apply the correct rate, and let you in. Your last name is on the list because the name you give the door has to match your ID.',
          'We ask venue partners to use the list only for check-in for that event, not to add you to their own mailing lists, and to dispose of it after the event.',
        ],
      },
      {
        kind: 'p',
        text:
          'Venue partners are independent businesses, not our staff. We put contractual ' +
          'and practical limits on what they do with a check-in list, but once ' +
          'information is in a third party’s hands we cannot guarantee its handling. ' +
          'If a venue markets to you off the back of one of our guestlists, tell us. We ' +
          'will take it up with them, and it will affect whether we work with them again.',
      },
      {
        kind: 'p',
        text:
          'Venues also operate their own systems on their own premises, including ' +
          'cameras, ID scanners, security and their own guest data. Those are the ' +
          "venue's, governed by the venue's policy, and outside our control.",
      },
      {
        kind: 'p',
        text:
          '**If you do not want your details shared with a venue, do not sign up for a ' +
          'guestlist option.** Buy a ticket instead. A ticket does not require us to put ' +
          'you on a door list.',
      },
    ],
  },
  {
    n: 8,
    title: 'Everyone else we share with',
    blocks: [
      {
        kind: 'p',
        text:
          'We do not sell your personal information. We do not rent it, and we do not ' +
          'trade lists with other promoters.',
      },
      { kind: 'p', text: 'We share it in these situations only.' },
      {
        kind: 'p',
        text:
          '**Service providers who work for us.** Companies that run part of our ' +
          'operation under contract and on our instructions, including:',
      },
      {
        kind: 'table',
        head: ['Provider', 'What it does', 'What it sees'],
        rows: [
          // Listed first because it is the primary store: a signup is written here by
          // /api/signup before anything reaches Brevo or Meta, and this row is the one
          // that survives if neither ever syncs.
          //
          // Kept as broad as the rows beneath it on purpose. Section 3 is where the
          // field-by-field detail belongs and already carries it; repeating the column
          // list here would make one provider look like a special case and would need
          // editing every time the schema moves.
          ['Supabase', 'Database hosting for our signup and guestlist forms', 'Signup and consent records'],
          ['Brevo (Sendinblue SAS)', 'Email and SMS marketing platform', 'Contact record, consent status, email engagement'],
          ['Vercel', 'Website and landing page hosting', 'Server logs including IP address'],
          ['Google (Workspace, Forms, Sheets, Drive)', 'Our email, survey forms and internal records', 'Correspondence, survey responses, contact lists'],
          ['Google (Tag Manager, Analytics)', 'Tag management and website analytics', 'Site usage, cookie identifiers'],
        ],
      },
      {
        kind: 'ul',
        items: [
          '**Ticketing platforms.** TicketWeb and Showpass sell tickets to our events. When you buy, you deal with them directly and they collect your information under their own policies, as independent controllers of it, not as our processors. They may share order data back with us as the event organiser.',
          '**Advertising platforms.** Meta (Facebook and Instagram) and TikTok. See below.',
          '**Venue partners.** As described in section 7.',
          '**Professional advisers.** Our accountant, bookkeeper, insurer and lawyers, where they need it and under a duty of confidence.',
          '**Legal and safety.** Where we are required by law, by a court order, or by a regulator, or where disclosure is necessary to investigate a serious incident, prevent fraud, or protect someone’s safety.',
          '**A business transfer.** If the company is sold, merged or reorganised, contact records may transfer as part of the business. We would tell you.',
        ],
      },
      { kind: 'h3', text: 'Advertising and pixel tracking' },
      {
        // MISMATCH 4: no Google Tag Manager and no TikTok pixel on this site.
        kind: 'p',
        text:
          'Our pages carry the **Meta Pixel** and may carry the **TikTok Pixel**, loaded ' +
          'through Google Tag Manager. These report a small number of named events back ' +
          'to the advertising platform: that a page was viewed, that a form was ' +
          'submitted, and that a ticket link was clicked.',
      },
      {
        kind: 'p',
        text:
          'Where we send a signup event to Meta, we may include your email address and ' +
          'phone number in **hashed** form. Hashing turns the value into a fixed-length ' +
          'string that cannot practically be reversed. Meta compares that hash to hashes ' +
          'it already holds to work out whether the person who signed up is someone it ' +
          'recognises. This is called advanced matching. It is what lets us measure ' +
          'whether an ad worked and build audiences of similar people. Some of these ' +
          'events are sent from your browser and some are sent server to server from our ' +
          'systems.',
      },
      {
        kind: 'p',
        text:
          'The practical effect is that Meta and TikTok can associate your visit to our ' +
          'page with their own profile of you, and we can ask them to show our ads to ' +
          'people like you.',
      },
      { kind: 'p', text: '**To limit this:**' },
      {
        // MISMATCH 4, continued: there is no consent banner on this site.
        kind: 'ul',
        items: [
          'decline non-essential cookies in our consent banner, which prevents these tags from loading',
          'adjust your ad settings inside Facebook, Instagram and TikTok',
          'use a browser that blocks trackers, or a tracker-blocking extension',
          'send a Global Privacy Control signal from your browser, which we honour where our consent tool supports it',
        ],
      },
    ],
  },
  {
    n: 9,
    title: 'Where your information is stored',
    blocks: [
      {
        kind: 'p',
        text:
          'Some of our service providers store and process personal information outside ' +
          'Canada.',
      },
      {
        kind: 'ul',
        items: [
          '**Brevo** stores data in the **European Union**, on infrastructure in France, Germany and Belgium.',
          '**Meta, TikTok, Google and Vercel** store and process data in the **United States** and in other countries where they operate.',
        ],
      },
      {
        kind: 'p',
        text:
          "While your information is in another country it is subject to that country's " +
          "laws, and may be accessible to that country's courts, law enforcement and " +
          'national security authorities under their legal processes. This is a normal ' +
          'consequence of using international service providers and Canadian privacy law ' +
          'requires that we tell you about it.',
      },
      {
        kind: 'p',
        text:
          'We use providers that offer contractual protections for transferred data, and ' +
          'we remain accountable for the information we hand them.',
      },
    ],
  },
  {
    n: 10,
    title: 'How long we keep it',
    blocks: [
      {
        kind: 'table',
        head: ['Information', 'How long'],
        rows: [
          ['Contact record with express marketing consent', 'Until you withdraw consent, then removed from active lists'],
          ['Contact record based on implied consent from an inquiry', 'Marketing stops at 6 months. Record deleted or anonymised within 12 months if you do not re-engage'],
          ['Contact record based on a ticket purchase', 'Marketing stops at 2 years from purchase'],
          ['Record of your consent, including the timestamp and the wording you agreed to', 'Kept for at least 3 years after consent ends, because anti-spam law requires us to be able to prove it'],
          ['Unsubscribe and do-not-contact records', 'Kept indefinitely, so we do not accidentally re-add you'],
          ['Guestlist and door check-in lists', 'Deleted within 90 days of the event, other than aggregate attendance counts'],
          ['Survey and feedback responses', 'Up to 3 years, and anonymised where we only need the aggregate'],
          ['Website analytics and advertising identifiers', 'Held by the platform that set them, under that platform’s retention window. Generally no longer than 26 months, and shorter for most advertising audiences'],
          ['Server and email logs', 'Up to 12 months'],
          ['Business, accounting and tax records', 'As long as Canadian tax and corporate law requires, currently 6 years after the relevant tax year'],
        ],
      },
      {
        kind: 'p',
        text:
          'When a retention period ends we delete the information or anonymise it so it ' +
          'can no longer identify you.',
      },
    ],
  },
  {
    n: 11,
    title: 'How we protect it',
    blocks: [
      {
        kind: 'p',
        text: 'We take steps proportionate to the sensitivity of what we hold:',
      },
      {
        kind: 'ul',
        items: [
          'accounts on our platforms are limited to the people who need them, with multi-factor authentication where the platform supports it',
          'our website is served over HTTPS and form submissions are encrypted in transit',
          'contact data lives in the marketing platform rather than in loose spreadsheets, and shared exports are limited and time-boxed',
          'guestlists sent to venues go to a named contact, not a general address, and are limited to the fields needed for check-in',
          'staff and contractors handling contact data are bound by confidentiality terms',
        ],
      },
      {
        kind: 'p',
        text:
          'No system is perfectly secure, and we cannot guarantee that a determined ' +
          'attacker will never succeed. If a breach occurs that creates a real risk of ' +
          'significant harm to you, we will report it to the Office of the Privacy ' +
          'Commissioner of Canada and notify you, as the law requires.',
      },
    ],
  },
  {
    n: 12,
    title: 'Your rights',
    blocks: [
      { kind: 'p', text: 'Under Canadian privacy law you can:' },
      {
        kind: 'ul',
        items: [
          '**Access.** Ask what personal information we hold about you, how we have used it, and who we have disclosed it to. We will respond within 30 days, or tell you why we need longer.',
          '**Correct.** Ask us to fix anything inaccurate or incomplete. If your name on a guestlist is wrong, correct it before the event, because the door will not let you in on a name that does not match your ID.',
          '**Withdraw consent.** Stop marketing at any time, as described in section 5.3. You can also withdraw consent to other uses, subject to legal and contractual limits, and we will tell you what the consequences are before we action it.',
          '**Delete.** Ask us to remove your information. We will do so unless we are required to keep something, such as a consent record or an accounting record. We will tell you what we kept and why.',
          '**Complain.** Raise a concern about how we handled your information. Write to [hello@theforumsfu.com](mailto:hello@theforumsfu.com) first and we will investigate and respond in writing.',
        ],
      },
      {
        kind: 'p',
        text:
          'To make a request, email ' +
          '[hello@theforumsfu.com](mailto:hello@theforumsfu.com) with enough detail to ' +
          'identify your records. We may need to verify who you are before we release ' +
          'anything, to make sure we are not handing your information to someone else. ' +
          'We do not charge for reasonable requests.',
      },
      {
        kind: 'p',
        text: 'If you are not satisfied with our response, you can escalate:',
      },
      {
        kind: 'ul',
        items: [
          '**Office of the Privacy Commissioner of Canada**, [priv.gc.ca](https://priv.gc.ca), 1-800-282-1376',
          '**Office of the Information and Privacy Commissioner for British Columbia**, [oipc.bc.ca](https://oipc.bc.ca), 250-387-5629',
        ],
      },
      {
        kind: 'p',
        text:
          'For anti-spam complaints specifically, the Canadian Radio-television and ' +
          'Telecommunications Commission runs the Spam Reporting Centre at ' +
          '[fightspam.gc.ca](https://fightspam.gc.ca).',
      },
    ],
  },
  {
    n: 13,
    title: 'Age',
    blocks: [
      {
        kind: 'p',
        text:
          'Our events are **19 and over**. Venue door staff verify age with two pieces ' +
          'of government identification, and a guestlist spot is not entry on its own.',
      },
      {
        kind: 'p',
        text:
          'Our websites and forms are not directed at children. We do not knowingly ' +
          'collect personal information from anyone under 13. If you believe a child has ' +
          'given us information, email ' +
          '[hello@theforumsfu.com](mailto:hello@theforumsfu.com) and we will delete it.',
      },
      {
        kind: 'p',
        text:
          'We ask for date of birth on some forms specifically to confirm the 19 and ' +
          'over requirement before we add someone to a list, and, where you have opted ' +
          'in to marketing, to send a birthday offer. We do not use it for any other ' +
          'purpose.',
      },
    ],
  },
  {
    n: 14,
    title: 'Cookies',
    blocks: [
      {
        kind: 'p',
        text: 'We use cookies and similar technologies in three categories:',
      },
      {
        kind: 'ul',
        items: [
          '**Strictly necessary.** Making the site work, holding your session, remembering your cookie choice, and preventing abuse. These load without consent because the site cannot function without them.',
          '**Analytics.** Understanding how people move through our pages so we can improve them.',
          '**Advertising.** The Meta and TikTok pixels described in section 8, plus the click identifiers carried in from an ad.',
        ],
      },
      {
        // MISMATCH 4, continued: no banner, no footer cookie settings link, and the
        // Meta Pixel initialises on mount before any consent is asked for.
        kind: 'p',
        text:
          'Analytics and advertising cookies load **only after you consent** through our ' +
          'banner. You can change your choice at any time through the cookie settings ' +
          'link in our footer. You can also clear or block cookies in your browser ' +
          'settings, though blocking strictly necessary cookies may break parts of the ' +
          'site.',
      },
    ],
  },
  {
    n: 15,
    title: 'Changes to this policy',
    blocks: [
      {
        kind: 'p',
        text:
          'We will update this policy when our practices change. The effective date at ' +
          'the top always reflects the current version. If a change is significant, for ' +
          'example a new category of information or a materially new disclosure, we will ' +
          'say so on our site and, where we have your consent to contact you, by email. ' +
          'Continuing to use our sites or attend our events after an update means the ' +
          'updated policy applies.',
      },
    ],
  },
  {
    n: 16,
    title: 'Contact',
    blocks: [
      {
        kind: 'p',
        text:
          '**Privacy Officer**, The Forum Entertainment Inc. Email ' +
          '[hello@theforumsfu.com](mailto:hello@theforumsfu.com).',
      },
      {
        kind: 'p',
        text: 'We aim to respond to every privacy request within 30 days.',
      },
    ],
  },
]
