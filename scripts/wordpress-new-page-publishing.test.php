<?php
// Run with PHP; no network, database, or WordPress writes.
define('ABSPATH', __DIR__);
function add_filter(...$args) {} function add_action(...$args) {}
function absint($v) { return abs((int)$v); } function wp_unslash($v) { return stripslashes($v); }
function get_post($id) { return (object)array('post_content'=>$GLOBALS['old_content'] ?? ''); }
function get_post_meta(...$args) { return $GLOBALS['schema'] ?? '{"@graph":[]}'; }
function wp_unique_post_slug($s,...$args) { return $GLOBALS['collision'] ?? $s; }
function get_current_user_id() { return 0; } function home_url($p) { return 'https://site.test'.$p; }
function get_permalink($id) { return 'https://site.test/county/town/'; }
function wp_slash($s) { return $s; } function wp_json_encode($v) { return json_encode($v); }
function update_post_meta($id,$key,$v) { $GLOBALS['saved']=$v; }
require __DIR__.'/../wordpress-plugin/amplify-new-page-publishing.php';
function check($ok,$label) { if (!$ok) throw new Exception($label); echo "PASS $label\n"; }
$base=array('post_type'=>'page','post_status'=>'publish','post_name'=>'town-amplify-draft-abc','post_parent'=>10,'post_content'=>'<!-- amplify-geo-source:abc --> <!-- amplify-faq-standard:v1 -->');
$out=amplify_geo_new_page_publish_data($base,array('ID'=>22));check($out['post_name']==='town'&&$out['post_status']==='publish','prepared new page gets permanent slug');
foreach(array('future','private') as $status){$x=$base;$x['post_status']=$status;check(amplify_geo_new_page_publish_data($x,array('ID'=>22))['post_name']==='town', $status.' uses clean URL');}
$x=$base;$x['post_content'].='<!-- amplify-approval-intake:v1 -->';check(amplify_geo_new_page_publish_data($x,array('ID'=>22))['post_status']==='draft','intake waits for refresh');
$x=$base;$x['post_content'].='<!-- amplify-geo-update-of:99 -->';check(amplify_geo_new_page_publish_data($x,array('ID'=>22))===$x,'enhancement retains review guard');
$GLOBALS['old_content']='<!-- amplify-geo-update-of:99 -->';check(amplify_geo_new_page_publish_data($base,array('ID'=>22))===$base,'removed original marker cannot bypass guard');unset($GLOBALS['old_content']);
$GLOBALS['collision']='town-2';check(amplify_geo_new_page_publish_data($base,array('ID'=>22))['post_status']==='draft','duplicate URL blocked');unset($GLOBALS['collision']);
$x=$base;$x['post_content']='Ordinary page';check(amplify_geo_new_page_publish_data($x,array('ID'=>22))===$x,'unrecognized draft unchanged');
$x=$base;$x['post_status']='draft';check(amplify_geo_new_page_publish_data($x,array('ID'=>22))===$x,'draft save never publishes');
$x=$base;$x['post_name']='already-live';check(amplify_geo_new_page_publish_data($x,array('ID'=>22))===$x,'existing clean URL unchanged');
$GLOBALS['schema']=json_encode(array('@graph'=>array(array('@type'=>'FAQPage','url'=>'https://site.test/?page_id=22#faq','mainEntity'=>array(array('url'=>'https://site.test/?page_id=22#question','citation'=>array('https://court.test/law')))))));
amplify_geo_new_page_schema_permalink(22,(object)array('post_status'=>'publish','post_name'=>'town','post_content'=>$base['post_content']),true,(object)array('post_name'=>$base['post_name'],'post_content'=>$base['post_content']));
check(strpos($GLOBALS['saved'],'?page_id=')===false&&strpos($GLOBALS['saved'],'court.test')!==false,'schema rebases own URLs and preserves citations');
