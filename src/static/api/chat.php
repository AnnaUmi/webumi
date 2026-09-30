<?php
/*
  Website planner: forwards the chat to OpenAI and returns the tool the model chose.

  The API key lives OUTSIDE public_html so nobody can download it. On Hostinger create
  /home/<you>/domains/webumi.com.au/webumi-config.php  (one level above public_html):

    <?php return ['openai_key' => 'sk-...', 'model' => 'gpt-5-mini'];
    ('reasoning' => 'minimal' | 'low' | 'medium' is optional: lower = faster replies)

  Response: { "tool": "ask" | "present_offer", "args": {...} }  or  { "error": "..." }
*/
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function fail($code, $msg) { http_response_code($code); echo json_encode(['error' => $msg]); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST only');

$config = [];
foreach ([dirname(__DIR__, 2) . '/webumi-config.php', dirname(__DIR__, 3) . '/webumi-config.php'] as $f) {
  if (is_file($f)) { $config = include $f; break; }
}
if (!is_array($config)) $config = [];
$key = $config['openai_key'] ?? getenv('OPENAI_API_KEY');
$model = $config['model'] ?? 'gpt-5-mini';
if (!$key) fail(500, 'The planner is not set up yet.');

// Rate limit: 40 messages per hour per visitor IP
$ip = $_SERVER['REMOTE_ADDR'] ?? 'x';
$bucket = sys_get_temp_dir() . '/webumi-rl-' . md5($ip);
$hits = array_filter(is_file($bucket) ? (json_decode(file_get_contents($bucket), true) ?: []) : [], fn($t) => $t > time() - 3600);
if (count($hits) >= 40) fail(429, 'Too many messages. Please try again in an hour, or use the contact form.');
$hits[] = time();
file_put_contents($bucket, json_encode(array_values($hits)));

// Validate the conversation
$in = json_decode(file_get_contents('php://input'), true);
$list = is_array($in) && is_array($in['messages'] ?? null) ? $in['messages'] : [];
$messages = [];
foreach (array_slice($list, -30) as $m) {
  if (!is_array($m) || !in_array($m['role'] ?? '', ['user', 'assistant'], true) || !is_string($m['content'] ?? null)) continue;
  // user turns are short; assistant turns can carry a whole offer (JSON) the model needs for revisions
  $max = $m['role'] === 'user' ? 2000 : 12000;
  $content = function_exists('mb_substr') ? mb_substr($m['content'], 0, $max) : substr($m['content'], 0, $max);
  $messages[] = ['role' => $m['role'], 'content' => $content];
}
if (!$messages) fail(400, 'No message');

$catalog = file_get_contents(__DIR__ . '/catalog.json');
$system = str_replace('{{CATALOG}}', json_encode(json_decode($catalog), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), file_get_contents(__DIR__ . '/prompt.txt'));

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
  ] + (preg_match('/^(gpt-5|o\d)/', $model) ? ['reasoning_effort' => $config['reasoning'] ?? 'low'] : [])),
]);
$raw = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$res = json_decode($raw ?: '', true);
if ($status !== 200) {
  error_log('Webumi planner: OpenAI ' . $status . ' ' . substr((string)$raw, 0, 500));
  fail(502, 'The planner is busy. Please try again in a moment.');
}
$call = $res['choices'][0]['message']['tool_calls'][0]['function'] ?? null;
$args = $call ? json_decode($call['arguments'], true) : null;
if (!$args) fail(502, 'The planner is busy. Please try again in a moment.');

echo json_encode(['tool' => $call['name'], 'args' => $args]);
