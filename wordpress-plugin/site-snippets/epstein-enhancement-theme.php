<?php
/* Applies only to Epstein pages with AMPLIFY's validated replacement FAQ. */
function amplify_epstein_enhanced_post($post_id) {
    if (!is_numeric($post_id)) return null;
    $post = get_post((int) $post_id);
    if (!$post || $post->post_type !== 'page') return null;
    if (strtolower(preg_replace('/^www\./', '', wp_parse_url(home_url(), PHP_URL_HOST))) !== 'theepsteinlawfirm.com') return null;
    if (strpos($post->post_content, 'amplify-faq-standard:v1') === false) return null;
    return $post;
}
add_filter('acf/load_value/key=field_65af9f180c28d', function ($value, $post_id) {
    $post = amplify_epstein_enhanced_post($post_id);
    return $post ? $post->post_title : $value;
}, 20, 2);
add_filter('acf/load_value/key=field_65af9f350c28e', function ($value, $post_id) {
    $post = amplify_epstein_enhanced_post($post_id);
    return $post && trim($post->post_excerpt) !== '' ? wp_strip_all_tags($post->post_excerpt) : $value;
}, 20, 2);
/* The replacement FAQs are in post_content. Keep all other flexible sections. */
add_filter('acf/load_value/key=field_65b0f9ce368b0', function ($value, $post_id) {
    if (!amplify_epstein_enhanced_post($post_id) || !is_array($value)) return $value;
    return array_values(array_filter($value, function ($row) {
        return !is_array($row) || !preg_match('/faq|frequently_asked/i', $row['acf_fc_layout'] ?? '');
    }));
}, 20, 2);
add_action('wp_head', function () {
    if (!is_singular('page') || !amplify_epstein_enhanced_post(get_queried_object_id())) return;
    echo '<style id="amplify-epstein-theme-cleanup">.sidebar-contact.body-cta{display:none!important}</style>';
});
add_action('wp', function () {
 if (!is_singular('page') || !function_exists('update_field')) return;
 $post = amplify_epstein_enhanced_post(get_queried_object_id());
 if (!$post) return;
 if (get_post_meta($post->ID, 'banner_heading', true) !== $post->post_title) update_field('field_65af9f180c28d', $post->post_title, $post->ID);
 $subtitle = wp_strip_all_tags($post->post_excerpt);
 if ($subtitle !== '' && get_post_meta($post->ID, 'banner_subheading', true) !== $subtitle) update_field('field_65af9f350c28e', $subtitle, $post->ID);
});
