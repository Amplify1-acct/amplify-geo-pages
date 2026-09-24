<?php
/**
 * Camden / Cherry Hill enhancement FAQ compatibility, 2026-09-17.
 * Preserve stored legacy schema and unrelated nodes. Suppress its FAQ node only
 * after AMPLIFY's prepared content and ten-question replacement are both saved.
 * Rolling the content back automatically restores the legacy output.
 */
function amplify_fulginiti_construction_legacy_faq($value, $post_id, $field) {
    if (is_admin() || !is_numeric($post_id)) return $value;
    $post_id = (int) $post_id;
    if (!in_array($post_id, array(2049, 1998, 7721, 7723), true)) return $value;
    $content = (string) get_post_field('post_content', $post_id);
    if (false === strpos($content, 'amplify-faq-standard:v1')) return $value;
    $replacement = json_decode((string) get_post_meta($post_id, '_amplify_geo_schema', true), true);
    $faqs = array();
    foreach (($replacement['@graph'] ?? array()) as $node) {
        if (in_array('FAQPage', (array) ($node['@type'] ?? array()), true)) $faqs[] = $node;
    }
    if (count($faqs) !== 1 || count($faqs[0]['mainEntity'] ?? array()) !== 10) return $value;
    if (!is_string($value)) return $value;
    $legacy = json_decode($value, true);
    if (!is_array($legacy) || !isset($legacy['@graph']) || !is_array($legacy['@graph'])) return $value;
    $remaining = array_values(array_filter($legacy['@graph'], function ($node) {
        return !in_array('FAQPage', (array) ($node['@type'] ?? array()), true);
    }));
    if (count($remaining) === count($legacy['@graph'])) return $value;
    $legacy['@graph'] = $remaining;
    return wp_json_encode($legacy, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}
add_filter('acf/format_value/name=schema', 'amplify_fulginiti_construction_legacy_faq', 100, 3);
