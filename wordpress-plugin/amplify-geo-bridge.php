<?php
/**
 * Plugin Name: AMPLIFY Content Bridge
 * Description: Receives approved AMPLIFY page and post SEO fields, schema, and branded publishing metadata.
 * Version: 1.9.6
 * Author: AMPLIFY
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('AMPLIFY_GEO_BRIDGE_VERSION', '1.9.6');

require_once __DIR__ . '/amplify-new-page-publishing.php';

function amplify_geo_bridge_resolve_post_id($post_id) {
    if (is_object($post_id) && isset($post_id->ID)) {
        $resolved_post_id = absint($post_id->ID);
    } elseif (is_numeric($post_id)) {
        $resolved_post_id = absint($post_id);
    } elseif (is_string($post_id) && preg_match('/(?:^|_)(\d+)$/', $post_id, $matches)) {
        $resolved_post_id = absint($matches[1]);
    } else {
        $resolved_post_id = 0;
    }
    if (!$resolved_post_id && function_exists('get_queried_object_id')) {
        $resolved_post_id = absint(get_queried_object_id());
    }
    $revision_parent = wp_is_post_revision($resolved_post_id);
    return $revision_parent ? absint($revision_parent) : $resolved_post_id;
}

function amplify_geo_bridge_is_billy_amplify_page($post_id) {
    if (!$post_id) return false;
    if ('billy-cooper-law' === get_post_meta($post_id, '_amplify_geo_client', true)) {
        return true;
    }
    $site_host = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
    $site_host = preg_replace('/^www\./', '', $site_host);
    if ('billycooperlaw.com' !== $site_host) return false;
    $content = (string) get_post_field('post_content', $post_id);
    return false !== strpos($content, 'amplify-geo-source:');
}

function amplify_geo_bridge_billy_hero_fallback($value, $post_id, $field) {
    if (!empty($value)) return $value;

    $resolved_post_id = amplify_geo_bridge_resolve_post_id($post_id);
    if (!$resolved_post_id) return $value;
    if (!amplify_geo_bridge_is_billy_amplify_page($resolved_post_id)) {
        return $value;
    }

    $featured_image_id = get_post_thumbnail_id($resolved_post_id);
    return $featured_image_id > 0 ? $featured_image_id : $value;
}
add_filter('acf/load_value/name=hero_image', 'amplify_geo_bridge_billy_hero_fallback', 20, 3);
add_filter('acf/load_value/key=field_66aa4f2ecd584', 'amplify_geo_bridge_billy_hero_fallback', 20, 3);

function amplify_geo_bridge_billy_hero_format($value, $post_id, $field) {
    $resolved_post_id = amplify_geo_bridge_resolve_post_id($post_id);
    if (!$resolved_post_id) return $value;
    if (!amplify_geo_bridge_is_billy_amplify_page($resolved_post_id)) {
        return $value;
    }

    $attachment_id = is_array($value)
        ? absint(isset($value['id']) ? $value['id'] : (isset($value['ID']) ? $value['ID'] : 0))
        : absint($value);
    if (!$attachment_id) {
        $attachment_id = get_post_thumbnail_id($resolved_post_id);
    }
    if (!$attachment_id) return $value;
    if (is_array($value) && isset($value['id'])) return $value;

    $attachment = wp_prepare_attachment_for_js($attachment_id);
    if (is_array($attachment)) return $attachment;
    return array('id' => $attachment_id, 'ID' => $attachment_id);
}
add_filter('acf/format_value/name=hero_image', 'amplify_geo_bridge_billy_hero_format', 20, 3);
add_filter('acf/format_value/key=field_66aa4f2ecd584', 'amplify_geo_bridge_billy_hero_format', 20, 3);

function amplify_geo_bridge_render_billy_hero($html) {
    if (false === strpos($html, 'amplify-geo-source:')) return $html;
    $post_id = isset($GLOBALS['amplify_geo_bridge_hero_post_id'])
        ? absint($GLOBALS['amplify_geo_bridge_hero_post_id'])
        : 0;
    if (!$post_id) return $html;

    $attachment_id = get_post_thumbnail_id($post_id);
    if (!$attachment_id) return $html;
    $image_html = wp_get_attachment_image($attachment_id, 'full', false, array(
        'loading' => 'eager',
        'fetchpriority' => 'high',
    ));
    if (!$image_html) return $html;

    return preg_replace(
        '/(<div\b[^>]*class=(?:"[^"]*\bpage-hero__image\b(?!-)[^"]*"|\'[^\']*\bpage-hero__image\b(?!-)[^\']*\')[^>]*>).*?(<\/div>)/is',
        '$1' . $image_html . '$2',
        $html,
        1
    );
}

function amplify_geo_bridge_start_billy_hero_buffer() {
    if (is_admin()) return;
    $site_host = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
    $site_host = preg_replace('/^www\./', '', $site_host);
    if ('billycooperlaw.com' !== $site_host) return;
    $post_id = amplify_geo_bridge_resolve_post_id(get_queried_object_id());
    if (!$post_id) return;
    $GLOBALS['amplify_geo_bridge_hero_post_id'] = $post_id;
    ob_start('amplify_geo_bridge_render_billy_hero');
}
add_action('template_redirect', 'amplify_geo_bridge_start_billy_hero_buffer', 20);

function amplify_geo_bridge_billy_child_page_directory($content) {
    if (is_admin() || !is_singular('page') || !in_the_loop() || !is_main_query()) {
        return $content;
    }

    $post_id = amplify_geo_bridge_resolve_post_id(get_the_ID());
    if (!$post_id || !amplify_geo_bridge_is_billy_amplify_page($post_id)) {
        return $content;
    }
    if (false !== strpos($content, 'amplify-geo-child-pages:start')) {
        return $content;
    }

    $parent_post = get_post($post_id);
    if (!$parent_post || !$parent_post->post_parent) {
        return $content;
    }

    $children = get_pages(array(
        'parent' => $post_id,
        'post_status' => 'publish',
        'sort_column' => 'menu_order,post_title',
        'sort_order' => 'ASC',
    ));
    if (!$children) return $content;

    $items = '';
    foreach ($children as $child) {
        $items .= '<li><a href="' . esc_url(get_permalink($child->ID)) . '">'
            . esc_html(get_the_title($child->ID)) . '</a></li>';
    }

    $base_title = preg_replace('/\s+Lawyers?$/i', '', get_the_title($post_id));
    $section = "\n<!-- amplify-geo-child-pages:start -->\n"
        . '<h2 class="wp-block-heading">Related ' . esc_html($base_title) . " Pages</h2>\n"
        . '<ul class="wp-block-list">' . $items . "</ul>\n"
        . "<!-- amplify-geo-child-pages:end -->\n";

    $patterns = array(
        '/(?=<h2\b[^>]*>\s*Related Personal Injury Resources\s*<\/h2>)/i',
        '/(?=<h2\b[^>]*>\s*Sources\s*<\/h2>)/i',
    );
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $content)) {
            return preg_replace($pattern, $section, $content, 1);
        }
    }

    return $content . $section;
}
add_filter('the_content', 'amplify_geo_bridge_billy_child_page_directory', 35);

function amplify_geo_bridge_is_enhancement_review_copy($post_or_data) {
    $slug = '';
    $content = '';
    if (is_array($post_or_data)) {
        $slug = isset($post_or_data['post_name']) ? (string) $post_or_data['post_name'] : '';
        $content = isset($post_or_data['post_content']) ? (string) $post_or_data['post_content'] : '';
    } elseif (is_object($post_or_data)) {
        $slug = isset($post_or_data->post_name) ? (string) $post_or_data->post_name : '';
        $content = isset($post_or_data->post_content) ? (string) $post_or_data->post_content : '';
    }
    return false !== strpos($slug, '-amplify-draft-')
        || 1 === preg_match('/<!--\s*amplify-geo-update-of:\d+\s*-->/i', $content);
}

function amplify_geo_bridge_protect_enhancement_review_copy($data, $postarr) {
    if ('page' !== $data['post_type'] || !amplify_geo_bridge_is_enhancement_review_copy($data)) {
        return $data;
    }
    if (in_array($data['post_status'], array('publish', 'future', 'private'), true)) {
        $data['post_status'] = 'draft';
        if (is_admin() && get_current_user_id()) {
            set_transient('amplify_geo_review_copy_blocked_' . get_current_user_id(), '1', 60);
        }
    }
    return $data;
}
add_filter('wp_insert_post_data', 'amplify_geo_bridge_protect_enhancement_review_copy', 99, 2);

function amplify_geo_bridge_review_copy_notice() {
    $user_id = get_current_user_id();
    if (!$user_id || !get_transient('amplify_geo_review_copy_blocked_' . $user_id)) return;
    delete_transient('amplify_geo_review_copy_blocked_' . $user_id);
    echo '<div class="notice notice-error is-dismissible"><p><strong>AMPLIFY review copies cannot be published directly.</strong> Return to AMPLIFY and use “Approve &amp; update existing page” so the approved content replaces the original page without creating a duplicate URL.</p></div>';
}
add_action('admin_notices', 'amplify_geo_bridge_review_copy_notice');

function amplify_geo_bridge_redirect_published_review_copy() {
    if (!is_singular('page')) return;
    $page = get_queried_object();
    if (!$page || !amplify_geo_bridge_is_enhancement_review_copy($page)) return;
    if (is_preview() || 'publish' !== get_post_status($page)) return;
    if (preg_match('/<!--\s*amplify-geo-update-of:(\d+)\s*-->/i', (string) $page->post_content, $matches)) {
        $source_url = get_permalink(absint($matches[1]));
        if ($source_url) {
            wp_safe_redirect($source_url, 301, 'AMPLIFY Content Bridge');
            exit;
        }
    }
    status_header(404);
    nocache_headers();
}
add_action('template_redirect', 'amplify_geo_bridge_redirect_published_review_copy', 1);

function amplify_geo_bridge_status() {
    return new WP_REST_Response(
        array(
            'ready' => true,
            'version' => AMPLIFY_GEO_BRIDGE_VERSION,
            'yoastActive' => defined('WPSEO_VERSION'),
            'supportedPostTypes' => array('page', 'post'),
        ),
        200
    );
}

function amplify_geo_bridge_can_edit($request) {
    $page_id = absint($request->get_param('page_id'));
    return $page_id > 0 && current_user_can('edit_post', $page_id);
}

function amplify_geo_bridge_clean_schema($schema) {
    if (is_string($schema)) {
        $schema = json_decode($schema, true);
    }
    if (!is_array($schema) || empty($schema['@graph']) || !is_array($schema['@graph'])) {
        return null;
    }

    $allowed_types = array('LegalService', 'FAQPage', 'BreadcrumbList', 'BlogPosting');
    foreach ($schema['@graph'] as $node) {
        if (!is_array($node) || empty($node['@type']) || !in_array($node['@type'], $allowed_types, true)) {
            return null;
        }
    }
    $schema['@context'] = 'https://schema.org';
    return $schema;
}

function amplify_geo_bridge_save_meta($request) {
    $page_id = absint($request->get_param('page_id'));
    $page = get_post($page_id);
    if (!$page || !in_array($page->post_type, array('page', 'post'), true)) {
        return new WP_Error('invalid_amplify_content', 'The target must be a WordPress page or post.', array('status' => 400));
    }

    $seo_title = sanitize_text_field((string) $request->get_param('seo_title'));
    $meta_description = preg_replace('/\s+/', ' ', sanitize_textarea_field((string) $request->get_param('meta_description')));
    $client_id = sanitize_key((string) $request->get_param('client_id'));
    $hero_image_id = absint($request->get_param('hero_image_id'));
    $schema = amplify_geo_bridge_clean_schema($request->get_param('schema'));
    if ('' === $seo_title || '' === $meta_description || null === $schema) {
        return new WP_Error('invalid_geo_meta', 'SEO title, meta description, and valid schema are required.', array('status' => 400));
    }

    update_post_meta($page_id, '_yoast_wpseo_title', $seo_title);
    update_post_meta($page_id, '_yoast_wpseo_metadesc', $meta_description);
    update_post_meta($page_id, '_amplify_geo_meta_description', $meta_description);
    update_post_meta($page_id, '_amplify_geo_schema', wp_slash(wp_json_encode($schema)));
    update_post_meta($page_id, '_amplify_geo_generated', '1');
    update_post_meta($page_id, '_amplify_geo_client', $client_id);
    if ($hero_image_id > 0) {
        if ('attachment' !== get_post_type($hero_image_id) || !wp_attachment_is_image($hero_image_id)) {
            return new WP_Error('invalid_geo_hero_image', 'The hero image must be a valid image attachment.', array('status' => 400));
        }
        if (function_exists('update_field')) {
            delete_post_meta($page_id, 'hero_image');
            delete_post_meta($page_id, '_hero_image');
            update_field('field_66aa4f2ecd584', $hero_image_id, $page_id);
        }
        update_post_meta($page_id, 'hero_image', $hero_image_id);
        update_post_meta($page_id, '_hero_image', 'field_66aa4f2ecd584');
        if (absint(get_post_meta($page_id, 'hero_image', true)) !== $hero_image_id) {
            return new WP_Error('geo_hero_image_not_saved', 'WordPress could not persist the GEO hero image.', array('status' => 500));
        }
    }
    clean_post_cache($page_id);
    $post_refresh = wp_update_post(array('ID' => $page_id), true);
    if (is_wp_error($post_refresh)) {
        return new WP_Error('geo_page_refresh_failed', 'WordPress saved the GEO metadata but could not refresh the page cache.', array('status' => 500));
    }
    clean_post_cache($page_id);

    $resolved_hero = function_exists('get_field') ? get_field('hero_image', $page_id) : $hero_image_id;
    $resolved_hero_id = is_array($resolved_hero)
        ? absint(isset($resolved_hero['id']) ? $resolved_hero['id'] : (isset($resolved_hero['ID']) ? $resolved_hero['ID'] : 0))
        : absint($resolved_hero);
    if ($hero_image_id > 0 && $resolved_hero_id !== $hero_image_id) {
        return new WP_Error('geo_hero_image_not_resolved', 'ACF could not resolve the saved GEO hero image.', array('status' => 500));
    }

    return new WP_REST_Response(array('saved' => true, 'pageId' => $page_id, 'heroImageId' => $hero_image_id, 'heroResolvedId' => $resolved_hero_id), 200);
}

function amplify_geo_bridge_routes() {
    register_rest_route('amplify-geo/v1', '/status', array(
        'methods' => WP_REST_Server::READABLE,
        'callback' => 'amplify_geo_bridge_status',
        'permission_callback' => '__return_true',
    ));
    register_rest_route('amplify-geo/v1', '/page-meta', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'amplify_geo_bridge_save_meta',
        'permission_callback' => 'amplify_geo_bridge_can_edit',
    ));
}
add_action('rest_api_init', 'amplify_geo_bridge_routes');

function amplify_geo_bridge_head() {
    if (!is_singular(array('page', 'post'))) return;
    $page_id = get_queried_object_id();
    $schema_json = get_post_meta($page_id, '_amplify_geo_schema', true);
    if ($schema_json) {
        $schema = json_decode($schema_json, true);
        if (is_array($schema)) {
            if (!empty($schema['@graph']) && is_array($schema['@graph'])) {
                foreach ($schema['@graph'] as &$node) {
                    if (is_array($node) && isset($node['@type']) && 'BlogPosting' === $node['@type']) {
                        $node['datePublished'] = get_post_time(DATE_W3C, true, $page_id);
                        $node['dateModified'] = get_post_modified_time(DATE_W3C, true, $page_id);
                    }
                }
                unset($node);
            }
            $safe_json = wp_json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($safe_json) {
                echo "\n<script type=\"application/ld+json\" class=\"amplify-geo-schema\">";
                echo str_replace('</', '<\\/', $safe_json); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
                echo "</script>\n";
            }
        }
    }
    if (!defined('WPSEO_VERSION')) {
        $description = get_post_meta($page_id, '_amplify_geo_meta_description', true);
        if ($description) echo '<meta name="description" content="' . esc_attr($description) . '" />' . "\n";
    }
}
add_action('wp_head', 'amplify_geo_bridge_head', 30);
