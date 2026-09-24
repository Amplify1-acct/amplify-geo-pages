<?php
/** Allow prepared new AMPLIFY pages to use WordPress Publish; preserve enhancement guards. */
if (!defined('ABSPATH')) exit;
if (!function_exists('amplify_geo_new_page_publish_data')) {
function amplify_geo_new_page_publish_data($data, $postarr) {
    if (!in_array($data['post_type'] ?? '', array('page', 'post'), true)
        || !in_array($data['post_status'] ?? '', array('publish', 'future', 'private'), true)
        || false === strpos($data['post_name'] ?? '', '-amplify-draft-')) return $data;
    $id = absint($postarr['ID'] ?? 0);
    $content = wp_unslash($data['post_content'] ?? '');
    $old = $id ? get_post($id) : null;
    // A source marker identifies new AMPLIFY intake, not an arbitrary WordPress draft.
    if (!preg_match('/<!--\s*amplify-(?:geo|aop|subaop|blog)-source:/i', $content)
        || preg_match('/<!--\s*amplify-geo-update-of:\d+\s*-->/i', $content . ($old ? $old->post_content : ''))) return $data;
    $reason = '';
    $slug = preg_replace('/-amplify-draft-.+$/', '', $data['post_name']);
    if (!$id || !$slug || false !== strpos($content, 'amplify-approval-intake:')
        || false === strpos($content, 'amplify-faq-standard:v1')
        || !get_post_meta($id, '_amplify_geo_schema', true)) {
        $reason = 'This approved draft still needs preparation. Open AMPLIFY, click Refresh WordPress, then return here and click Publish.';
    } else {
        // WordPress must not silently create a -2 duplicate or overwrite another page.
        $unique = wp_unique_post_slug($slug, $id, 'publish', $data['post_type'], absint($data['post_parent'] ?? 0));
        if ($unique !== $slug) $reason = 'Another page already uses this permanent URL. Use AMPLIFY to update the existing page instead of creating a duplicate.';
    }
    if ($reason) {
        $data['post_status'] = 'draft';
        if (get_current_user_id()) set_transient('amplify_new_page_publish_notice_' . get_current_user_id(), $reason, 120);
        return $data;
    }
    $data['post_name'] = $slug;
    return $data;
}
add_filter('wp_insert_post_data', 'amplify_geo_new_page_publish_data', 98, 2);
function amplify_geo_new_page_publish_notice() {
    $key = 'amplify_new_page_publish_notice_' . get_current_user_id();
    $message = get_transient($key);
    if (!$message) return;
    delete_transient($key);
    echo '<div class="notice notice-warning"><p>' . esc_html($message) . '</p></div>';
}
add_action('admin_notices', 'amplify_geo_new_page_publish_notice');
// Keep schema identifiers on the actual permalink when WordPress publishes a new draft.
function amplify_geo_new_page_schema_permalink($post_id, $post, $update, $before) {
    if (!in_array($post->post_status, array('publish', 'future', 'private'), true)
        || !$before || false === strpos($before->post_name, '-amplify-draft-')
        || false !== strpos($post->post_name, '-amplify-draft-')
        || preg_match('/amplify-geo-update-of:\d+/i', $post->post_content . $before->post_content)) return;
    $raw = get_post_meta($post_id, '_amplify_geo_schema', true);
    $schema = json_decode($raw, true);
    if (!is_array($schema)) return;
    $url = get_permalink($post_id);
    $old_urls = array(home_url('/?page_id=' . $post_id), home_url('/?p=' . $post_id));
    foreach (($schema['@graph'] ?? array()) as $node) {
        if (in_array($node['@type'] ?? '', array('WebPage', 'FAQPage'), true) && !empty($node['url'])) {
            $candidate = explode('#', $node['url'])[0];
            if (strpos($candidate, home_url('/')) === 0) $old_urls[] = $candidate;
        }
    }
    $walk = function ($value) use (&$walk, $old_urls, $url) {
        if (is_array($value)) return array_map($walk, $value);
        if (!is_string($value)) return $value;
        foreach (array_unique($old_urls) as $old_url) {
            if ($value === $old_url || strpos($value, $old_url . '#') === 0) return $url . substr($value, strlen($old_url));
        }
        return $value;
    };
    update_post_meta($post_id, '_amplify_geo_schema', wp_slash(wp_json_encode($walk($schema))));
}
add_action('wp_after_insert_post', 'amplify_geo_new_page_schema_permalink', 20, 4);

}
