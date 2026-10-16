# Valynce Offline Website

Open `index.html` directly in any modern browser.

Pages:
- `index.html`
- `capabilities.html`
- `industries.html`
- `company.html`
- `contact.html`

Everything required for the visual site is included locally in `assets/`.
No web fonts, frameworks, CDNs, or external image dependencies are required.

Contact buttons open `contact.html`. The form POSTs to FormSubmit and delivers inquiries to `paul@valynceai.com`; a direct email link is also provided.

Before accepting inquiries, submit the form from the hosted website and confirm the activation email sent by FormSubmit to `paul@valynceai.com`. Delivery is not active until that confirmation is completed. JavaScript submits via the FormSubmit AJAX endpoint and shows an inline thank-you only after a successful response. Failed requests retain entered details for retry. The AJAX flow does not use FormSubmit’s hosted CAPTCHA/confirmation page; without JavaScript, the normal hosted submission flow remains available. The form requires an internet connection; no private API keys are stored in this repository.

Inquiry emails use FormSubmit’s box template with readable labels, a combined contact name, and the sender/company in the subject. Reply-To is set to the visitor’s email. FormSubmit controls the surrounding email branding and footer.

## Hostinger branded email delivery

The optional PHP/SMTP backend sends a fully branded Valynce HTML email with a plain-text alternative. Follow [HOSTINGER-EMAIL-SETUP.md](HOSTINGER-EMAIL-SETUP.md) to install the private mailbox configuration above public_html. FormSubmit remains the fallback until that configuration exists. Never commit the mailbox password.
