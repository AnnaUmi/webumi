<?php
/*
  Order form: receives an order from /order/, emails it to you, sends the customer a confirmation,
  and keeps a backup copy in webumi-data/orders/ (outside public_html).

  In webumi-config.php (one folder above public_html):
    'order_email' => 'you@webumi.com.au',     // where orders are sent
    'mail_from'   => 'orders@webumi.com.au',  // a real mailbox on your domain (create it in hPanel → Emails)

  Response: { "ok": true, "ref": "W-1001-7F3A" }  or  { "error": "...", "code": "..." }
*/
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require __DIR__ . '/lib.php';

const MAX_PER_HOUR = 5;
const MAX_PER_DAY  = 10;
const MAX_FILES = 12, MAX_FILE = 8e6, MAX_TOTAL = 20e6, MAX_ATTACH = 15e6;   // bytes
const FILE_TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif',
  'image/heic' => 'heic', 'image/heif' => 'heif', 'application/pdf' => 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx'];
const TYPES = [
  'landing' => 'Landing page', 'website' => 'Business website', 'store' => 'Online store', 'pwa' => 'Web app (PWA)',
  'mobile' => 'iOS & Android app', 'platform' => 'Platform / client portal', 'ai' => 'AI agent or assistant',
  'media' => 'AI video, photos & art', 'fix' => 'Fix or redesign a website', 'support' => 'Support plan',
];

/** Whether a zip archive lists exactly this file name in its central directory (no zip extension needed). */
function zip_has($bytes, $name) {
  for ($p = strpos($bytes, "PK\x01\x02"); $p !== false; $p = strpos($bytes, "PK\x01\x02", $p + 4)) {
    $len = unpack('v', substr($bytes, $p + 28, 2))[1] ?? 0;
    if (substr($bytes, $p + 46, $len) === $name) return true;
  }
  return false;
}

/** The file's real type, from its contents. Falls back to checking the first bytes if fileinfo isn't installed. */
function detect_mime($bytes) {
  // Word files are zip archives holding word/document.xml; some servers' fileinfo only says "zip"
  if (strncmp($bytes, "PK\x03\x04", 4) === 0 && zip_has($bytes, 'word/document.xml')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (function_exists('finfo_buffer')) return finfo_buffer(finfo_open(FILEINFO_MIME_TYPE), $bytes);
  $head = substr($bytes, 0, 16);
  if (strncmp($head, "\xFF\xD8\xFF", 3) === 0) return 'image/jpeg';
  if (strncmp($head, "\x89PNG", 4) === 0) return 'image/png';
  if (strncmp($head, 'GIF8', 4) === 0) return 'image/gif';
  if (strncmp($head, 'RIFF', 4) === 0 && substr($head, 8, 4) === 'WEBP') return 'image/webp';
  if (strncmp($head, '%PDF', 4) === 0) return 'application/pdf';
  if (substr($head, 4, 4) === 'ftyp' && in_array(substr($head, 8, 4), ['heic', 'heix', 'mif1', 'msf1'], true)) return 'image/heic';
  return 'application/octet-stream';
}

$in = request_json();
check_origin_and_honeypot($in);
verify_turnstile($in['turnstile'] ?? '');

$config = webumi_config();
$owner = $config['order_email'] ?? 'hello@webumi.com.au';
$from = $config['mail_from'] ?? $owner;

// ---------- limits: stop anyone flooding your inbox ----------
$blocked = rate_limited('orders', MAX_PER_HOUR, MAX_PER_DAY);
if ($blocked) fail(429, 'Too many orders from this connection. Please try again later, or email us directly.', 'limit');

// ---------- validate ----------
$clean = function ($v, $max = 2000) {
  $v = is_scalar($v) ? (string)$v : '';
  $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v);
  return trim(function_exists('mb_substr') ? mb_substr($v, 0, $max) : substr($v, 0, $max));
};
$oneLine = fn($v, $max = 200) => str_replace(["\r", "\n"], ' ', $clean($v, $max));

$name = $oneLine($in['name'] ?? '', 120);
$email = $oneLine($in['email'] ?? '', 200);
$business = $oneLine($in['business'] ?? '', 160);
$types = array_slice(array_values(array_intersect(array_filter(is_array($in['types'] ?? null) ? $in['types'] : [], 'is_string'), array_keys(TYPES))), 0, 1);   // one project per order: the one the customer chose
if ($name === '') fail(400, 'Please add your name.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'Please check your email address.');
if (!$types) fail(400, 'Please choose what you need.');
if (empty($in['consent'])) fail(400, 'Please tick the box to confirm.');

// the review summary the customer saw: [{ title, rows: [[label, value], ...] }, ...]
$sections = [];
foreach (array_slice(is_array($in['summary'] ?? null) ? $in['summary'] : [], 0, 12) as $sec) {
  if (!is_array($sec)) continue;
  $rows = [];
  foreach (array_slice(is_array($sec['rows'] ?? null) ? $sec['rows'] : [], 0, 40) as $r) {
    if (!is_array($r) || count($r) < 2) continue;
    $label = $oneLine($r[0], 80); $value = $clean($r[1], 3000);
    if ($label !== '' && $value !== '') $rows[] = [$label, $value];
  }
  if ($rows) $sections[] = ['title' => $oneLine($sec['title'] ?? '', 80), 'rows' => $rows];
}

// ---------- save a backup, then email ----------
$ref = 'W-' . gmdate('md', time() + 10 * 3600) . '-' . strtoupper(bin2hex(random_bytes(2)));
$typeNames = implode(', ', array_map(fn($t) => TYPES[$t], $types));
$nda = !empty($in['nda']);   // the customer wants an NDA signed before sharing details
$order = ['ref' => $ref, 'received' => gmdate('c'), 'name' => $name, 'email' => $email, 'business' => $business,
  'nda' => $nda, 'types' => $types, 'sections' => $sections, 'plan' => $oneLine($in['plan'] ?? '', 4000)];

// uploaded files: check the real type from the file's contents, not what the browser claims
$saved = []; $total = 0;
foreach (array_slice(is_array($in['files'] ?? null) ? $in['files'] : [], 0, MAX_FILES) as $i => $f) {
  if (!is_array($f) || !is_string($f['data'] ?? null)) continue;
  $bytes = base64_decode($f['data'], true);
  if ($bytes === false || strlen($bytes) > MAX_FILE || $total + strlen($bytes) > MAX_TOTAL) continue;
  $mime = detect_mime($bytes);
  if (!isset(FILE_TYPES[$mime])) continue;
  $zone = preg_replace('/[^a-z-]/', '', strtolower((string)($f['zone'] ?? 'file'))) ?: 'file';
  $base = preg_replace('/[^A-Za-z0-9._-]+/', '-', pathinfo((string)($f['name'] ?? 'file'), PATHINFO_FILENAME)) ?: 'file';
  $fileName = sprintf('%s-%02d-%s.%s', $zone, $i + 1, substr($base, 0, 60), FILE_TYPES[$mime]);
  $dir = data_dir("orders/$ref");
  if (@file_put_contents("$dir/$fileName", $bytes) === false) continue;
  $saved[] = ['name' => $fileName, 'mime' => $mime, 'path' => "$dir/$fileName", 'size' => strlen($bytes)];
  $total += strlen($bytes);
}
$order['files'] = array_map(fn($x) => $x['name'], $saved);
@file_put_contents(data_dir('orders') . "/$ref.json", json_encode($order, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

$details = '';
foreach ($sections as $sec) {
  $details .= "\n" . strtoupper($sec['title']) . "\n";
  foreach ($sec['rows'] as [$l, $v]) $details .= "- $l: " . str_replace("\n", "\n  ", $v) . "\n";
}
if ($order['plan']) $details .= "\nATTACHED PLAN / ESTIMATE\n" . $order['plan'] . "\n";
$attachOk = $saved && $total <= MAX_ATTACH;
$fileNote = $saved ? "\nFILES (" . count($saved) . ")\n" . implode("\n", array_map(fn($x) => "- " . $x['name'], $saved)) . "\n"
  . ($attachOk ? "Attached to this email.\n" : "Too big to attach: download them from webumi-data/orders/$ref/ in File Manager.\n") : '';

$ownerBody = "New order $ref\n\n" . ($nda ? "NDA REQUESTED: sign theirs or send ours (private/nda-template.html) before they share the details.\n\n" : '') . "From: $name <$email>\nBusiness: " . ($business ?: '-') . "\nNeeds: $typeNames\n$details$fileNote\nReply to this email to answer $name directly.\n";
$customerBody = "Hi " . explode(' ', $name)[0] . ",\n\nThanks for your order. Your reference is $ref.\n\n"
  . "What happens next:\n1. We'll review your answers and send a written, fixed quote within 1 business day.\n"
  . "2. If you're happy with it, you sign the agreement online and pay a 50% deposit (Express: paid in full). Then we start on your three homepage designs.\n3. Nothing is charged until you approve the quote.\n\n"
  . ($nda ? "You asked for an NDA. We're happy to sign yours, or we'll send our standard mutual NDA. Either way it's signed before you share the details.\n\n" : '')
  . "A copy of your answers:\n$details" . ($saved ? "\nFiles received: " . count($saved) . "\n" : '') . "\nJust reply to this email if you'd like to add anything.\n\nThe Webumi team\nwebumi.com.au\n";

$sent = send_mail($owner, ($nda ? "[NDA] " : '') . "New order $ref: $typeNames" . ($business ? " for $business" : ''), $ownerBody, $from, mail_addr($name, $email), "$ref-to-you", $attachOk ? $saved : []);
send_mail($email, "Your Webumi order $ref", $customerBody, $from, $owner, "$ref-to-customer");
if (!$sent) error_log("Webumi order $ref: owner email failed (saved in webumi-data/orders)");

echo json_encode(['ok' => true, 'ref' => $ref]);
