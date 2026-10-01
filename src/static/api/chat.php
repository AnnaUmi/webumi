<?php
/*
  Website planner: forwards the chat to OpenAI and returns the tool the model chose.

  Secrets live OUTSIDE public_html so nobody can download them. On Hostinger create
  /home/<you>/domains/webumi.com.au/webumi-config.php  (one level above public_html):

    <?php return [
      'openai_key'       => 'sk-...',
      'model'            => 'gpt-5-mini',
      'turnstile_secret' => '0x...',        // Cloudflare Turnstile secret key
      'daily_budget'     => 0.50,           // USD per day, all visitors together
    ];

  Protection, cheapest check first:
    1. Only requests from webumi.com.au (Origin header) + a hidden honeypot field
    2. Cloudflare Turnstile bot check when a conversation starts → signed conversation token
    3. Limits: messages per conversation, conversations per visitor per day, messages per hour
    4. Daily budget: the real cost of each reply is added up; when it's used, the planner pauses
  Counters are kept in webumi-data/ next to the config file (not web-accessible).

  Response: { "tool": "ask" | "present_offer", "args": {...}, "conv": "..." }
        or  { "error": "...", "code": "verify" | "limit" | "budget" | "error" }
*/
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const MAX_USER_MESSAGES = 14;      // per conversation (about 8 questions + a few changes)
const MAX_CONVERSATIONS = 3;       // new conversations per visitor per day
const MAX_PER_HOUR      = 25;      // messages per visitor per hour
const CONV_TTL          = 7200;    // a conversation token lasts 2 hours
// OpenAI prices in USD per 1M tokens (gpt-5-mini). Update these if you change the model.
const PRICE_IN = 0.25, PRICE_CACHED = 0.025, PRICE_OUT = 2.00;

require __DIR__ . '/lib.php';

// ---------- config ----------
$config = webumi_config();
$key = $config['openai_key'] ?? getenv('OPENAI_API_KEY');
$model = $config['model'] ?? 'gpt-5-mini';
$budget = (float)($config['daily_budget'] ?? getenv('WEBUMI_DAILY_BUDGET') ?: 0.50);
$in = request_json();
if (!$key) fail(500, 'The planner is not set up yet.');
$secret = hash('sha256', 'webumi-planner|' . ($config['app_secret'] ?? $key));
$dataDir = data_dir();

// ---------- 1. origin + honeypot ----------
check_origin_and_honeypot($in);
$ipKey = visitor_key($secret);
$today = sydney_today();

// ---------- 4a. daily budget, checked before anything is spent ----------
$usageFile = "$dataDir/usage-$today.json";
$spent = is_file($usageFile) ? (json_decode(file_get_contents($usageFile), true)['cost'] ?? 0) : 0;
if ($spent >= $budget) fail(503, 'The planner has had a busy day and is paused until tomorrow. You can still work out your price with the price builder, or book a free call.', 'budget');

// ---------- 2. bot check → signed conversation token ----------
$conv = null;
if (is_string($in['conv'] ?? null) && strpos($in['conv'], '.') !== false) {
  [$payload, $sig] = explode('.', $in['conv'], 2);
  $data = json_decode(base64_decode($payload), true);
  if (hash_equals(hash_hmac('sha256', $payload, $secret), $sig) && is_array($data)
      && ($data['exp'] ?? 0) > time() && ($data['ip'] ?? '') === $ipKey) $conv = $data;
}
if (!$conv) {
  verify_turnstile($in['turnstile'] ?? '');
  $canStart = with_json("$dataDir/convs-$today.json", function ($d) use ($ipKey) {
    if (($d[$ipKey] ?? 0) >= MAX_CONVERSATIONS) return [$d, false];
    $d[$ipKey] = ($d[$ipKey] ?? 0) + 1;
    return [$d, true];
  });
  if (!$canStart) fail(429, "You've made " . MAX_CONVERSATIONS . " plans today, which is the daily limit. Book a free call and we'll go through it together.", 'limit');
  $conv = ['id' => bin2hex(random_bytes(8)), 'ip' => $ipKey, 'exp' => time() + CONV_TTL];
}
$payload = base64_encode(json_encode($conv));
$convToken = $payload . '.' . hash_hmac('sha256', $payload, $secret);

// ---------- 3. conversation + visitor limits ----------
$list = is_array($in['messages'] ?? null) ? $in['messages'] : [];
$messages = [];
foreach (array_slice($list, -30) as $m) {
  if (!is_array($m) || !in_array($m['role'] ?? '', ['user', 'assistant'], true) || !is_string($m['content'] ?? null)) continue;
  // user turns are short; assistant turns can carry a whole offer (JSON) the model needs for revisions
  $max = $m['role'] === 'user' ? 1000 : 12000;
  $content = function_exists('mb_substr') ? mb_substr($m['content'], 0, $max) : substr($m['content'], 0, $max);
  $messages[] = ['role' => $m['role'], 'content' => $content];
}
if (!$messages) fail(400, 'No message');

$limit = with_json("$dataDir/rate-$today.json", function ($d) use ($ipKey, $conv) {
  $now = time();
  $hits = array_values(array_filter($d['ip'][$ipKey] ?? [], fn($t) => $t > $now - 3600));
  $used = $d['conv'][$conv['id']] ?? 0;
  if (count($hits) >= MAX_PER_HOUR) return [$d, 'hour'];
  if ($used >= MAX_USER_MESSAGES) return [$d, 'conv'];
  $hits[] = $now;
  $d['ip'][$ipKey] = $hits;
  $d['conv'][$conv['id']] = $used + 1;
  return [$d, null];
});
if ($limit === 'hour') fail(429, 'Too many messages. Please try again in an hour, or book a free call.', 'limit');
if ($limit === 'conv') fail(429, "That's the most changes one plan can have. Book a free call and we'll fine-tune it together.", 'limit');

// ---------- call OpenAI ----------
$catalogFile = is_file(__DIR__ . '/catalog-ai.json') ? __DIR__ . '/catalog-ai.json' : __DIR__ . '/catalog.json';
$system = str_replace('{{CATALOG}}', trim(file_get_contents($catalogFile)), file_get_contents(__DIR__ . '/prompt.txt'));

$ch = curl_init('https://api.openai.com/v1/chat/completions');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 90,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $key],
  CURLOPT_POSTFIELDS => json_encode([
    'model' => $model,
    'messages' => array_merge([['role' => 'system', 'content' => $system]], $messages),
    'tools' => json_decode(file_get_contents(__DIR__ . '/tools.json'), true),
    'tool_choice' => 'required',
    'parallel_tool_calls' => false,
    'max_completion_tokens' => 6000,    // hard cap on one reply (thinking + answer)
  ] + (preg_match('/^(gpt-5|o\d)/', $model) ? ['reasoning_effort' => $config['reasoning'] ?? 'low'] : [])),
]);
$reply = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
$res = json_decode($reply ?: '', true);

// ---------- 4b. add the real cost of this reply to today's total ----------
if (isset($res['usage']['prompt_tokens'])) {
  $u = $res['usage'];
  $cached = $u['prompt_tokens_details']['cached_tokens'] ?? 0;
  $cost = (($u['prompt_tokens'] - $cached) * PRICE_IN + $cached * PRICE_CACHED + ($u['completion_tokens'] ?? 0) * PRICE_OUT) / 1e6;
  with_json($usageFile, function ($d) use ($cost) {
    $d['cost'] = round(($d['cost'] ?? 0) + $cost, 6);
    $d['replies'] = ($d['replies'] ?? 0) + 1;
    return [$d, null];
  });
}

if ($status !== 200) {
  error_log('Webumi planner: OpenAI ' . $status . ' ' . substr((string)$reply, 0, 500));
  fail(502, 'The planner is busy. Please try again in a moment.');
}
$call = $res['choices'][0]['message']['tool_calls'][0]['function'] ?? null;
$args = $call ? json_decode($call['arguments'], true) : null;
if (!$args) fail(502, 'The planner is busy. Please try again in a moment.');

echo json_encode(['tool' => $call['name'], 'args' => $args, 'conv' => $convToken]);
