(function () {
  'use strict';
  const form = document.querySelector('.contact-form');
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const error = document.getElementById('contact-error');
  const success = document.getElementById('contact-success');
  let sending = false;

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    sending = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true');
    error.hidden = true;
    const controller = new AbortController();
    const timeout = setTimeout(function () { controller.abort(); }, 30000);
    try {
      const fields = Object.fromEntries(new FormData(form));
      const fullName = [fields['First name'], fields['Last name']].filter(Boolean).join(' ').trim();
      const company = (fields.Company || '').trim();
      const subjectDetail = [fullName, company].filter(Boolean).join(' · ').replace(/[\r\n]+/g, ' ').slice(0, 180);
      const inquiry = {
        'Contact name': fullName,
        'Company': company || 'Not provided',
        'Email': fields.email,
        'Phone': (fields.Phone || '').trim() || 'Not provided',
        'Message': fields.Message,
        '_replyto': fields.email,
        '_subject': 'Valynce inquiry' + (subjectDetail ? ' — ' + subjectDetail : ''),
        '_template': 'box'
      };
      // Use Hostinger only after private SMTP configuration is installed.
      // Failure after an SMTP attempt must never resend via a second provider.
      let useHostinger = false;
      try {
        const setup = await fetch('api/contact.php', { signal: controller.signal, cache: 'no-store' });
        if (setup.ok && (setup.headers.get('content-type') || '').includes('application/json')) {
          useHostinger = (await setup.json()).configured === true;
        }
      } catch (setupError) {
        if (controller.signal.aborted) throw setupError;
      }
      const endpoint = useHostinger ? 'api/contact.php' : 'https://formsubmit.co/ajax/paul@valynceai.com';
      const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (useHostinger) headers['X-Valynce-Form'] = '1';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(inquiry),
        signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || !(result.success === true || result.success === 'true')) {
        throw new Error('Submission was not accepted');
      }
      form.reset();
      form.hidden = true;
      success.hidden = false;
      success.focus();
    } catch (submissionError) {
      error.hidden = false;
      error.focus();
    } finally {
      clearTimeout(timeout);
      sending = false;
      button.disabled = false;
      button.textContent = 'Send inquiry ↗';
      form.removeAttribute('aria-busy');
    }
  });
}());
