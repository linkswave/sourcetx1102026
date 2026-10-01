<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

const CHAT_CONFIDENCE_THRESHOLD = 0.6;

function chat_stopwords(): array
{
    static $set = null;
    if ($set === null) {
        $set = array_flip(explode(' ', 'what is the a an are how do does you your i me to of for and or in on with can tell about my we our have any there it that this as at be by please just like need want would could should'));
    }
    return $set;
}

function chat_aliases(): array
{
    return [
        ['résumé', 'resume'],
        ['resumes', 'resume'],
        ['cvs', 'resume'],
        ['cv', 'resume'],
        ['ai', 'artificial intelligence'],
        ['ml', 'machine learning'],
        ['sre', 'site reliability'],
        ['msp', 'managed services'],
        ['devops', 'devops'],
        ['info@sourcetx.com', 'contact email'],
    ];
}

function chat_norm_phrase(string $s): string
{
    $s = mb_strtolower($s, 'UTF-8');
    $s = strtr($s, [
        'á' => 'a', 'à' => 'a', 'â' => 'a', 'ä' => 'a', 'ã' => 'a', 'å' => 'a',
        'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
        'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i',
        'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'ö' => 'o', 'õ' => 'o',
        'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u',
        'ñ' => 'n', 'ç' => 'c', 'ý' => 'y',
    ]);
    $s = preg_replace('/\p{Mn}+/u', '', $s) ?? $s;
    $s = preg_replace('/[^a-z0-9@.\s-]/u', ' ', $s) ?? $s;
    $s = preg_replace('/\s+/', ' ', $s) ?? $s;
    return trim($s);
}

function chat_expand_aliases(string $s): string
{
    foreach (chat_aliases() as [$alias, $canonical]) {
        $re = '/(^|[^a-z0-9])' . preg_quote($alias, '/') . '([^a-z0-9]|$)/u';
        $s = preg_replace($re, '${1}' . $canonical . '${2}', $s) ?? $s;
    }
    return $s;
}

function chat_tokenize(string $s): array
{
    $expanded = chat_expand_aliases($s);
    $stop = chat_stopwords();
    return array_values(array_filter(explode(' ', $expanded), function ($t) use ($stop) {
        return $t !== '' && !isset($stop[$t]);
    }));
}

function chat_knowledge(): array
{
    static $intents = null;
    if (is_array($intents)) {
        return $intents;
    }
    $paths = [
        APP_ROOT . '/data/chatbot.json',
        PUBLIC_ROOT . '/../data/chatbot.json',
        dirname(APP_ROOT) . '/data/chatbot.json',
    ];
    foreach ($paths as $p) {
        if (is_file($p)) {
            $d = json_decode((string) file_get_contents($p), true);
            $intents = is_array($d) ? $d : [];
            return $intents;
        }
    }
    $intents = [];
    return $intents;
}

function chat_normalize_keyword(string $k): string
{
    return chat_norm_phrase(chat_expand_aliases($k));
}

function chat_match_intent(array $intent, string $compact): int
{
    $score = 0;
    foreach (($intent['keywords'] ?? []) as $phrase => $weight) {
        $norm = chat_normalize_keyword((string) $phrase);
        if ($norm === '') {
            continue;
        }
        if (strpos($norm, ' ') !== false) {
            if (strpos($compact, $norm) !== false) {
                $score += (int) $weight;
            }
        } elseif (
            strpos($compact, ' ' . $norm . ' ') !== false
            || $compact === $norm
            || strpos($compact, $norm . ' ') === 0
            || substr($compact, -strlen(' ' . $norm)) === ' ' . $norm
        ) {
            $score += (int) $weight;
        }
    }
    return $score;
}

function chat_answer(string $message): array
{
    $normalized = chat_norm_phrase($message);
    $compact = implode(' ', chat_tokenize($normalized));
    $best = null;
    $bestScore = 0;
    foreach (chat_knowledge() as $intent) {
        $s = chat_match_intent($intent, $compact);
        if ($s > $bestScore) {
            $bestScore = $s;
            $best = $intent;
        }
    }
    if ($best && $bestScore > 0) {
        $confidence = $bestScore / ($bestScore + 2);
        if ($confidence >= CHAT_CONFIDENCE_THRESHOLD) {
            return [
                'reply' => $best['answer'],
                'followups' => $best['followups'] ?? [],
                'confidence' => $confidence,
                'fallback' => false,
                'intent' => $best['id'],
            ];
        }
    }
    return [
        'reply' => "I'm not sure I understood that. Try asking about our services, open jobs, how to apply, or how to contact us — or use the contact page and a SourceTX specialist will follow up with you.",
        'followups' => ['What services do you offer?', 'Are there open jobs?', 'How can I contact SourceTX?'],
        'confidence' => 0,
        'fallback' => true,
        'intent' => $best['id'] ?? 'none',
    ];
}
