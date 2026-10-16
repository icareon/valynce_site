<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function respond(int $status, array $data): void {
    http_response_code($status);
    echo json_encode($data);
    exit;
}
// Keep the real configuration one directory ABOVE public_html, never in Git.
$configPath = dirname(__DIR__, 2) . '/valynce-mail-config.php';
$config = is_file($configPath) ? require $configPath : [];
$ready = is_array($config) && !empty($config['password']) && $config['password'] !== 'REPLACE_WITH_MAILBOX_PASSWORD';
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    respond(200, ['configured' => $ready]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: GET, POST');
    respond(405, ['success' => false]);
}
if (!$ready) respond(503, ['success' => false]);
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && !in_array($origin, ['https://valynceai.com', 'https://www.valynceai.com'], true)) {
    respond(403, ['success' => false]);
}
if (($_SERVER['HTTP_X_VALYNCE_FORM'] ?? '') !== '1' || stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
    respond(415, ['success' => false]);
}
$raw = file_get_contents('php://input', false, null, 0, 65001);
if ($raw === false || strlen($raw) > 65000) respond(413, ['success' => false]);
$data = json_decode($raw, true);
if (!is_array($data)) respond(400, ['success' => false]);
$limits = ['Contact name' => 800, 'Email' => 254, 'Company' => 800, 'Phone' => 200, 'Message' => 40000];
foreach ($limits as $key => $limit) {
    if (!isset($data[$key]) || !is_string($data[$key]) || strlen($data[$key]) > $limit) respond(422, ['success' => false]);
    $data[$key] = trim($data[$key]);
}
if ($data['Contact name'] === '' || $data['Message'] === '' || !filter_var($data['Email'], FILTER_VALIDATE_EMAIL)) respond(422, ['success' => false]);
foreach (['Contact name', 'Email', 'Company', 'Phone'] as $key) {
    if (preg_match('/[\r\n\x00]/', $data[$key])) respond(422, ['success' => false]);
}
// Fixed recipient; IP-based throttling uses the actual connecting IP, not forwarded headers.
function throttle(string $key, int $limit, int $seconds): void {
    $path = sys_get_temp_dir() . '/valynce-mail-' . hash('sha256', __DIR__ . $key);
    $file = fopen($path, 'c+');
    if (!$file || !flock($file, LOCK_EX)) respond(503, ['success' => false]);
    $saved = json_decode(stream_get_contents($file), true);
    $now = time();
    if (!is_array($saved) || ($saved['start'] ?? 0) < $now - $seconds) $saved = ['start' => $now, 'count' => 0];
    if ($saved['count'] >= $limit) {
        flock($file, LOCK_UN);
        fclose($file);
        header('Retry-After: ' . $seconds);
        respond(429, ['success' => false]);
    }
    $saved['count']++;
    ftruncate($file, 0);
    rewind($file);
    fwrite($file, json_encode($saved));
    flock($file, LOCK_UN);
    fclose($file);
}
throttle('ip:' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 5, 600);
throttle('global', 60, 3600);
require __DIR__ . '/lib/phpmailer/Exception.php';
require __DIR__ . '/lib/phpmailer/PHPMailer.php';
require __DIR__ . '/lib/phpmailer/SMTP.php';
require __DIR__ . '/inquiry-email.php';
try {
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = 'smtp.hostinger.com';
    $mail->Port = 465;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->SMTPAuth = true;
    $mail->Username = 'paul@valynceai.com';
    $mail->Password = $config['password'];
    $mail->Timeout = 15;
    $mail->CharSet = 'UTF-8';
    $mail->setFrom('paul@valynceai.com', 'Valynce Website');
    $mail->addAddress('paul@valynceai.com', 'Paul Shahidi');
    $mail->addReplyTo($data['Email'], $data['Contact name']);
    $mail->Subject = 'Valynce inquiry — ' . $data['Contact name'] . ' · ' . substr($data['Company'], 0, 100);
    $mail->isHTML(true);
    $mail->Body = inquiryEmail($data);
    $mail->AltBody = 'NEW VALYNCE INQUIRY' . "\n\n";
    foreach ($limits as $key => $_) $mail->AltBody .= $key . ': ' . $data[$key] . "\n\n";
    $mail->send();
    respond(200, ['success' => true]);
} catch (Throwable $error) {
    // Do not expose credentials, SMTP responses, or visitor details in responses/logs.
    error_log('Valynce inquiry SMTP delivery failed.');
    respond(502, ['success' => false]);
}
