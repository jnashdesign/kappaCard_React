const { Resend } = require('resend');

const DEFAULT_TIMEZONE = 'America/Chicago';
const APP_ORIGIN = process.env.KAPPACARD_APP_ORIGIN || 'https://mykappacard.com';
const FROM_EMAIL =
  process.env.KAPPACARD_RECAP_FROM ||
  'Kappa Card <noreply@recap.mykappacard.com>';
const RECAP_HOUR = 20; // 8:00–8:59 PM local
const MAX_LISTED = 20;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveTimezone(raw) {
  const tz = typeof raw === 'string' ? raw.trim() : '';
  if (!tz) return DEFAULT_TIMEZONE;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** Local calendar date YYYY-MM-DD and hour (0–23) in the given IANA timezone. */
function localDateAndHour(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = Number(get('hour'));
  return {
    dateKey: `${year}-${month}-${day}`,
    hour: Number.isFinite(hour) ? hour : -1,
  };
}

function isoInLocalDay(iso, timeZone, dateKey) {
  if (typeof iso !== 'string' || !iso.trim()) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return localDateAndHour(timeZone, d).dateKey === dateKey;
}

function mapBrother(id, data) {
  return {
    subjectUserId: typeof data.subjectUserId === 'string' ? data.subjectUserId : id,
    name: typeof data.name === 'string' ? data.name : 'Brother',
    chapter: typeof data.chapter === 'string' ? data.chapter : '',
    initiationYear:
      typeof data.initiationYear === 'number' ? data.initiationYear : undefined,
    profilePicture:
      typeof data.profilePicture === 'string' && /^https?:\/\//i.test(data.profilePicture)
        ? data.profilePicture
        : null,
    metViaQr: Boolean(data.metViaQr) || Boolean(data.lastMetAt),
    lastMetAt: typeof data.lastMetAt === 'string' ? data.lastMetAt : null,
  };
}

async function loadTodaysMets(db, uid, timeZone, dateKey) {
  const snap = await db.collection('users').doc(uid).collection('collectedCards').get();
  const rows = [];
  for (const doc of snap.docs) {
    const brother = mapBrother(doc.id, doc.data() || {});
    if (!brother.metViaQr || !brother.lastMetAt) continue;
    if (!isoInLocalDay(brother.lastMetAt, timeZone, dateKey)) continue;
    rows.push(brother);
  }
  rows.sort((a, b) => String(b.lastMetAt).localeCompare(String(a.lastMetAt)));
  return rows;
}

function buildEmail({ memberName, brothers, origin }) {
  const count = brothers.length;
  const listed = brothers.slice(0, MAX_LISTED);
  const more = count - listed.length;
  const first = (memberName || 'Brother').trim().split(/\s+/)[0] || 'Brother';
  const subject =
    count === 1 ? 'You met 1 brother today' : `You met ${count} brothers today`;

  const rowsHtml = listed
    .map((b) => {
      const meta = [b.chapter, b.initiationYear].filter(Boolean).join(' · ');
      const detailUrl = `${origin}/brothers/${encodeURIComponent(b.subjectUserId)}`;
      const photo = b.profilePicture
        ? `<img src="${escapeHtml(b.profilePicture)}" alt="" width="48" height="48" style="border-radius:50%;object-fit:cover;display:block;" />`
        : `<div style="width:48px;height:48px;border-radius:50%;background:#6d0e0f;color:#f7f1e8;font-family:Georgia,serif;font-weight:700;font-size:16px;line-height:48px;text-align:center;">Κ</div>`;
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #eadfd3;vertical-align:top;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td width="56" valign="top">${photo}</td>
                <td valign="top" style="padding-left:12px;">
                  <div style="font-weight:700;color:#2a1515;font-size:16px;">${escapeHtml(b.name)}</div>
                  ${meta ? `<div style="color:#6b5a5a;font-size:13px;margin-top:2px;">${escapeHtml(meta)}</div>` : ''}
                  <div style="margin-top:8px;">
                    <a href="${escapeHtml(detailUrl)}" style="color:#6d0e0f;font-weight:700;font-size:13px;">Add details</a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join('');

  const moreHtml =
    more > 0
      ? `<p style="color:#6b5a5a;font-size:14px;">And ${more} more in <a href="${escapeHtml(`${origin}/brothers`)}" style="color:#6d0e0f;">Brothers</a>.</p>`
      : '';

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f7f1e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f1e8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #eadfd3;">
          <tr><td>
            <p style="margin:0 0 4px;color:#6d0e0f;font-family:Georgia,serif;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">MyKappaCard</p>
            <h1 style="margin:0 0 12px;color:#2a1515;font-size:24px;line-height:1.2;">${escapeHtml(subject)}</h1>
            <p style="margin:0 0 20px;color:#4a3a3a;font-size:15px;line-height:1.5;">
              Hi ${escapeHtml(first)} — while today’s introductions are fresh, add a quick note, event, or place for each brother. These details stay private to you.
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${rowsHtml}
            </table>
            ${moreHtml}
            <p style="margin:24px 0 0;color:#6b5a5a;font-size:12px;line-height:1.5;">
              You’re receiving this because end-of-day Brothers recaps are on in your profile.
              <a href="${escapeHtml(`${origin}/profile`)}" style="color:#6d0e0f;">Manage email reminders</a>
            </p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textLines = [
    subject,
    '',
    `Hi ${first} — add private notes for brothers you met today:`,
    '',
    ...listed.map((b) => {
      const meta = [b.chapter, b.initiationYear].filter(Boolean).join(' · ');
      return `- ${b.name}${meta ? ` (${meta})` : ''}: ${origin}/brothers/${b.subjectUserId}`;
    }),
  ];
  if (more > 0) textLines.push('', `And ${more} more: ${origin}/brothers`);
  textLines.push('', `Turn off: ${origin}/profile`);

  return { subject, html, text: textLines.join('\n') };
}

/**
 * Process one user. Returns 'sent' | 'skipped' | 'error'.
 * @param {{ force?: boolean }} options force ignores hour window (still requires mets + preference)
 */
/**
 * Process one user.
 * @returns {{ status: 'sent'|'skipped', to?: string, resendId?: string }}
 */
async function processUserRecap(db, resend, userDoc, options = {}) {
  const uid = userDoc.id;
  const data = userDoc.data() || {};
  const email = typeof data.email === 'string' ? data.email.trim() : '';
  if (!email || !email.includes('@')) return { status: 'skipped' };

  if (data.emailPrefs?.brothersRecapEnabled === false) return { status: 'skipped' };

  const timeZone = resolveTimezone(data.timezone);
  const { dateKey, hour } = localDateAndHour(timeZone);

  if (!options.force && hour !== RECAP_HOUR) return { status: 'skipped' };
  if (!options.force && data.emailPrefs?.lastBrothersRecapDate === dateKey) {
    return { status: 'skipped' };
  }

  const brothers = await loadTodaysMets(db, uid, timeZone, dateKey);
  if (brothers.length === 0) return { status: 'skipped' };

  const payload = buildEmail({
    memberName: data.name || 'Brother',
    brothers,
    origin: APP_ORIGIN,
  });

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  if (result.error) {
    const detail =
      typeof result.error === 'object'
        ? result.error.message || JSON.stringify(result.error)
        : String(result.error);
    console.error('Resend error for', uid, result.error);
    const err = new Error(detail);
    err.code = 'resend';
    throw err;
  }

  const resendId = result.data?.id;
  console.log('Resend accepted for', uid, { to: email, resendId, from: FROM_EMAIL });

  await db.collection('users').doc(uid).set(
    {
      'emailPrefs.lastBrothersRecapDate': dateKey,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return { status: 'sent', to: email, resendId };
}

async function runBrothersRecapBatch(db, apiKey, options = {}) {
  const resend = new Resend(apiKey);
  const snap = await db.collection('users').get();
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snap.docs) {
    try {
      const result = await processUserRecap(db, resend, doc, options);
      if (result.status === 'sent') sent += 1;
      else skipped += 1;
    } catch (err) {
      errors += 1;
      console.error('Recap failed for', doc.id, err);
    }
  }

  return { sent, skipped, errors, scanned: snap.size };
}

async function runBrothersRecapForUid(db, apiKey, uid, options = {}) {
  const resend = new Resend(apiKey);
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) return { status: 'missing' };
  try {
    return await processUserRecap(db, resend, snap, options);
  } catch (err) {
    console.error('Recap failed for', uid, err);
    return {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

module.exports = {
  runBrothersRecapBatch,
  runBrothersRecapForUid,
  buildEmail,
  localDateAndHour,
  resolveTimezone,
  RECAP_HOUR,
  APP_ORIGIN,
};
