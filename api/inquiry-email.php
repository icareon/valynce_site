<?php
declare(strict_types=1);
function inquiryEmail(array $data): string {
    $escape = static function (string $value): string {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    };
    $values = [
        '{{name}}' => $escape($data['Contact name']),
        '{{company}}' => $escape($data['Company']),
        '{{email}}' => $escape($data['Email']),
        '{{phone}}' => $escape($data['Phone']),
        '{{reply_url}}' => $escape('mailto:' . rawurlencode($data['Email'])),
        '{{message}}' => nl2br($escape($data['Message']))
    ];
    $html = <<<'HTML'
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Valynce website inquiry</title></head>
<body style="margin:0;background:#f2efe7;font-family:Helvetica,Arial,sans-serif;color:#101112">
<div style="display:none;max-height:0;overflow:hidden">New inquiry from {{name}} at {{company}}.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2efe7"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px">
<tr><td style="background:#101112;color:#f2efe7;padding:28px 32px;font-size:23px;letter-spacing:5px">VALYNCE</td></tr>
<tr><td style="background:#ffffff;padding:36px 32px">
<p style="margin:0 0 18px;font-size:11px;letter-spacing:2px;color:#656660">WEBSITE INQUIRY</p>
<h1 style="margin:0 0 14px;font-size:32px;line-height:1.15;font-weight:400;letter-spacing:-1px">A new conversation<br>starts here.</h1>
<p style="margin:0 0 30px;font-size:16px;line-height:1.6;color:#656660">{{name}} from {{company}} has reached out to Valynce.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f3ee;border:1px solid #dcd8ce"><tr><td style="padding:24px">
<p style="margin:0 0 7px;font-size:22px">{{name}}</p>
<p style="margin:0 0 20px;font-size:14px;color:#656660">{{company}}</p>
<p style="margin:0 0 8px;font-size:14px;line-height:1.5"><span style="color:#656660">Email</span><br><a href="{{reply_url}}" style="color:#101112">{{email}}</a></p>
<p style="margin:16px 0 0;font-size:14px;line-height:1.5"><span style="color:#656660">Phone</span><br>{{phone}}</p>
</td></tr></table>
<p style="margin:30px 0 14px;font-size:11px;letter-spacing:2px;color:#656660">MESSAGE</p>
<p style="margin:0;font-size:17px;line-height:1.7">{{message}}</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:30px 0"><tr><td style="background:#101112"><a href="{{reply_url}}" style="display:inline-block;padding:16px 26px;color:#ffffff;text-decoration:none;font-size:14px">Reply to inquiry ↗</a></td></tr></table>
<p style="border-top:1px solid #dcd8ce;padding-top:22px;margin:0;font-size:13px;line-height:1.6;color:#656660">The visitor was told to expect a response in under 24 hours.</p>
</td></tr>
<tr><td style="padding:24px 12px;font-size:11px;line-height:1.7;color:#656660">VALYNCE · AI ENGINEERING FOR MANUFACTURING<br><a href="https://valynceai.com" style="color:#656660">valynceai.com</a></td></tr>
</table></td></tr></table></body></html>

HTML;
    return strtr($html, $values);
}
