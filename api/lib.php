<?php
/*
  Shared helpers for chat.php, order.php and contact.php.
  Settings come from webumi-config.php one folder above public_html (see README), or from
  environment variables when running locally.
*/

function fail($code, $msg, $kind = 'error') {
  http_response_code($code);
  echo json_encode(['error' => $msg, 'code' => $kind]);
  exit;
}

/** Settings array + the folder the config file lives in (counters and backups are kept next to it). */
function webumi_config() {
  static $cfg = null;
  if ($cfg !== null) return $cfg;
  $config = [];
  $dir = dirname(__DIR__, 2);
  foreach ([dirname(__DIR__, 2) . '/webumi-config.php', dirname(__DIR__, 3) . '/webumi-config.php'] as $f) {
    if (is_file($f)) { $config = include $f; $dir = dirname($f); break; }
  }
  if (!is_array($config)) $config = [];
  $config['_dir'] = $dir;
  return $cfg = $config;
}

/** A private folder for counters and backups, outside public_html. */
function data_dir($sub = '') {
  $base = webumi_config()['_dir'] . '/webumi-data';
  if (!is_dir($base) && !@mkdir($base, 0700, true)) $base = sys_get_temp_dir() . '/webumi-data';
  $dir = $sub ? "$base/$sub" : $base;
  if (!is_dir($dir)) @mkdir($dir, 0700, true);
  return $dir;
}

/** Read-modify-write a small JSON file under a lock. $fn gets the data and returns [newData, result]. */
function with_json($file, callable $fn) {
  $h = @fopen($file, 'c+');
  if (!$h) return $fn([])[1];
  flock($h, LOCK_EX);
  $data = json_decode(stream_get_contents($h) ?: '[]', true) ?: [];
  [$data, $result] = $fn($data);
  ftruncate($h, 0); rewind($h); fwrite($h, json_encode($data));
  flock($h, LOCK_UN); fclose($h);
  return $result;
}

/** The request body as an array (the local preview runs PHP from the command line, so it reads stdin). */
function request_json() {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail(405, 'POST only');
  $raw = file_get_contents('php://input');
  if ($raw === '' && PHP_SAPI === 'cli') $raw = stream_get_contents(STDIN);
  $in = json_decode($raw, true);
  if (!is_array($in)) fail(400, 'Bad request');
  return $in;
}

/** Only accept requests sent from webumi.com.au pages, and drop anything that filled the hidden honeypot field. */
function check_origin_and_honeypot($in) {
  $config = webumi_config();
  $origin = parse_url($_SERVER['HTTP_ORIGIN'] ?? '', PHP_URL_HOST) ?: '';
  $allowed = array_merge(['webumi.com.au', 'www.webumi.com.au'], (array)($config['allowed_hosts'] ?? []),
    array_filter(explode(',', (string)getenv('WEBUMI_ALLOWED_HOSTS'))));
  if (!in_array($origin, $allowed, true)) fail(403, 'Not allowed');
  if (!empty($in['website'])) fail(400, 'Bad request');
}

/** Cloudflare Turnstile "are you human?" check. Skipped when no secret is configured. */
function verify_turnstile($token) {
  $secret = webumi_config()['turnstile_secret'] ?? getenv('TURNSTILE_SECRET');
  if (!$secret) return;
  if (!is_string($token) || $token === '') fail(401, 'Please confirm you are human.', 'verify');
  $ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
  curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
    CURLOPT_POSTFIELDS => http_build_query(['secret' => $secret, 'response' => $token, 'remoteip' => $_SERVER['REMOTE_ADDR'] ?? ''])]);
  $ok = json_decode(curl_exec($ch) ?: '', true)['success'] ?? false;
  curl_close($ch);
  if (!$ok) fail(401, 'Please confirm you are human.', 'verify');
}

/** A short, stable, anonymous key for the visitor's IP (never stores the IP itself). */
function visitor_key($salt) {
  return substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'x') . $salt), 0, 24);
}

/** Today's date in Sydney (AEST), used to name daily counter files. */
function sydney_today() {
  return gmdate('Y-m-d', time() + 10 * 3600);
}

/** True when this visitor already sent $perHour requests in the last hour or $perDay today (then stop);
    otherwise counts this one. $name keeps separate counters per form. */
function rate_limited($name, $perHour, $perDay) {
  $key = visitor_key((webumi_config()['app_secret'] ?? '') . $name);
  return with_json(data_dir() . "/$name-rate.json", function ($d) use ($key, $perHour, $perDay) {
    $now = time();
    $hits = array_values(array_filter($d[$key] ?? [], fn($t) => $t > $now - 86400));
    if (count($hits) >= $perDay || count(array_filter($hits, fn($t) => $t > $now - 3600)) >= $perHour) return [$d, true];
    $hits[] = $now;
    $d[$key] = $hits;
    foreach ($d as $k => $v) if (!array_filter($v, fn($t) => $t > $now - 86400)) unset($d[$k]);   // forget old visitors
    return [$d, false];
  });
}

/** Send a plain-text email (with optional attachments: [['name','mime','path'], ...]).
    The local preview saves it to webumi-data/outbox/ instead (WEBUMI_DEV_OUTBOX). */
function send_mail($to, $subject, $body, $from, $replyTo, $file, $attachments = []) {
  $subject = function_exists('mb_encode_mimeheader') ? mb_encode_mimeheader($subject, 'UTF-8') : $subject;
  $headers = "From: Webumi <$from>\r\nReply-To: $replyTo\r\nMIME-Version: 1.0\r\n";
  if ($attachments) {
    $b = 'webumi-' . bin2hex(random_bytes(8));
    $headers .= "Content-Type: multipart/mixed; boundary=\"$b\"\r\n";
    $msg = "--$b\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n$body\r\n";
    foreach ($attachments as $a) {
      $msg .= "--$b\r\nContent-Type: {$a['mime']}; name=\"{$a['name']}\"\r\nContent-Transfer-Encoding: base64\r\n"
        . "Content-Disposition: attachment; filename=\"{$a['name']}\"\r\n\r\n" . chunk_split(base64_encode(file_get_contents($a['path']))) . "\r\n";
    }
    $body = $msg . "--$b--";
  } else {
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
  }
  if (getenv('WEBUMI_DEV_OUTBOX')) {   // local preview: save instead of sending
    return (bool)file_put_contents(data_dir('outbox') . "/$file.eml", "To: $to\r\nSubject: $subject\r\n$headers\r\n$body");
  }
  return mail($to, $subject, $body, $headers, "-f$from");
}
