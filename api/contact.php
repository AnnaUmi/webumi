<?php
/*
  The site's small forms: "Book a call" and "Send a message" (contact section on every page) and the
  non-profit application. Emails the request to you, sends the visitor a short confirmation, and keeps
  a backup copy in webumi-data/messages/ (outside public_html).

  Request: { "kind": "book" | "message" | "nonprofit", "name", "email", "title": "one line for the subject",
             "rows": [["Label", "value"], ...], "website": "" (honeypot), "turnstile": "token" }
  Response: { "ok": true, "ref": "M-1004-7F3A" }  or  { "error": "...", "code": "..." }

  Uses the same settings as order.php (webumi-config.php): 'order_email' (where it's sent, default
  hello@webumi.com.au) and 'mail_from' (a real mailbox on your domain).
*/
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require __DIR__ . '/lib.php';

const MAX_PER_HOUR = 5;
const MAX_PER_DAY  = 15;
const KINDS = [
  // subject prefix for you; subject, what it is, and the next step for the visitor
  'book'      => ['Call request', 'Your call request with Webumi', 'call request',
                  "We'll confirm the time by email within one business day, with a calendar invite."],
  'message'   => ['New enquiry', 'We got your message', 'message',
                  "We'll reply within one business day."],
  'nonprofit' => ['Non-profit application', 'We got your application', 'application',
                  "We'll read it and reply within a week."],
];

$in = request_json();
check_origin_and_honeypot($in);
verify_turnstile($in['turnstile'] ?? '');   // Cloudflare "are you human?" (skipped if no secret is configured)

$config = webumi_config();
$owner = $config['order_email'] ?? 'hello@webumi.com.au';
$from = $config['mail_from'] ?? $owner;

if (rate_limited('messages', MAX_PER_HOUR, MAX_PER_DAY))
  fail(429, "Too many messages from this connection. Please try again later, or email $owner.", 'limit');

// ---------- validate ----------
$clean = function ($v, $max = 2000) {
  $v = is_scalar($v) ? (string)$v : '';
  $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v);
  return trim(function_exists('mb_substr') ? mb_substr($v, 0, $max) : substr($v, 0, $max));
};
$oneLine = fn($v, $max = 200) => str_replace(["\r", "\n"], ' ', $clean($v, $max));

$kind = (string)($in['kind'] ?? '');
if (!isset(KINDS[$kind])) fail(400, 'Bad request');
[$prefix, $customerSubject, $what, $nextStep] = KINDS[$kind];
$name = $oneLine($in['name'] ?? '', 120);
$email = $oneLine($in['email'] ?? '', 200);
$title = $oneLine($in['title'] ?? '', 160);
if ($name === '') fail(400, 'Please add your name.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'Please check your email address.');

$rows = [];
foreach (array_slice(is_array($in['rows'] ?? null) ? $in['rows'] : [], 0, 20) as $r) {
  if (!is_array($r) || count($r) < 2) continue;
  $label = $oneLine($r[0], 60); $value = $clean($r[1], 4000);
  if ($label !== '' && $value !== '') $rows[] = [$label, $value];
}

// ---------- save a backup, then email ----------
$ref = 'M-' . gmdate('md', time() + 10 * 3600) . '-' . strtoupper(bin2hex(random_bytes(2)));
@file_put_contents(data_dir('messages') . "/$ref.json", json_encode(
  ['ref' => $ref, 'received' => gmdate('c'), 'kind' => $kind, 'name' => $name, 'email' => $email, 'title' => $title, 'rows' => $rows],
  JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

$details = '';
foreach ($rows as [$l, $v]) $details .= (strpos($v, "\n") !== false ? "\n$l:\n$v\n" : "$l: $v\n");

$ownerBody = "$prefix $ref" . ($title ? ": $title" : '') . "\n\nFrom: $name <$email>\n$details\nReply to this email to answer $name directly.\n";
$customerBody = "Hi " . explode(' ', $name)[0] . ",\n\nThanks, we've received your $what" . ($kind === 'book' && $title ? ": $title" : '') . ".\n$nextStep\n\n"
  . "What you sent:\n$details\nJust reply to this email if you'd like to add anything.\n\nThe Webumi team\nwebumi.com.au\n";

$sent = send_mail($owner, "$prefix: " . ($title ?: $name), $ownerBody, $from, "$name <$email>", "$ref-to-you");
if (!$sent) {
  error_log("Webumi $kind $ref: email to owner failed (saved in webumi-data/messages)");
  fail(502, "Sorry, it didn't send. Please email $owner.", 'mail');
}
send_mail($email, $customerSubject, $customerBody, $from, $owner, "$ref-to-customer");

echo json_encode(['ok' => true, 'ref' => $ref]);
