> Inactive reference implementation: the live form is explicitly set to FormSubmit at the owner’s request. Installing a config file alone will NOT activate SMTP. Switching requires a future frontend update and a live delivery test.

# Activate branded Valynce inquiry emails

This is prepared for Hostinger Custom PHP/HTML hosting with PHP 8.2+ and OpenSSL enabled. SMTP uses smtp.hostinger.com, implicit TLS, port 465. PHPMailer 7.1.1 source and license are included in api/lib/phpmailer; Composer is not required.

1. Deploy the repository's website files into the domain's public_html directory, including the api and assets folders. Do not upload .git. Uploading only HTML files will not activate this feature.
2. In Hostinger's File Manager, navigate to the parent directory of public_html for valynceai.com.
3. Create a file named valynce-mail-config.php there. Copy the contents from email-templates/valynce-mail-config.example.php and replace REPLACE_WITH_MAILBOX_PASSWORD with the password for paul@valynceai.com. Enter it only in Hostinger. Escape any single quote or backslash in a PHP single-quoted string with a backslash. Restrict file permissions to 600 where supported.
4. Open https://valynceai.com/api/contact.php. It should show {"configured":true}. This checks for configuration only, not SMTP credentials. If false, check the filename and placement. The config file must be above public_html, not inside it.
5. Refresh the contact page and submit a test inquiry. Verify the on-page confirmation, the branded email in Paul's inbox, and that Reply addresses the submitter. Also check spam. This real SMTP test is required before considering setup complete.

The backend always sends from and to paul@valynceai.com. Visitor addresses are used only as Reply-To. Submitted content is validated and HTML-escaped. Requests are limited to 5 per connecting IP per 10 minutes and 60 globally per hour. Requests require JSON and a custom header; browser requests from other origins are rejected. PHP's temporary directory must support writable files and flock. A site behind a proxy may share an IP limit; do not trust arbitrary X-Forwarded-For headers to bypass it.

Until the private config is installed, JavaScript uses FormSubmit. Once configured, SMTP errors retain the visitor's entered details for retry; the code does not retry delivery through FormSubmit because that can duplicate emails. If PHP is unavailable or api/contact.php isn't deployed, the existing FormSubmit flow remains active. With JavaScript disabled the normal FormSubmit form action remains the fallback.

The email design can be previewed using email-templates/inquiry-preview.html (fictional example data). The live HTML rendering lives in api/inquiry-email.php. Its plain-text alternative contains all submitted fields.

No mailbox credentials belong in GitHub, JavaScript, HTML, or chat. The included example contains no real credentials. The real filename is ignored by Git as an additional safeguard.

Rollback: move/rename the private config file above public_html, then refresh the contact page to return to FormSubmit. Do not copy the config into a public folder.
