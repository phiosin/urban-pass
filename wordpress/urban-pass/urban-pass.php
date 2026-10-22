<?php
/**
 * Plugin Name:       Urban Pass
 * Description:       Classes in Berlin you can book with both Urban Sports Club and Wellpass. Data is refreshed daily from GitHub.
 * Version:           0.2.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Urban Pass
 * License:           MIT
 * Text Domain:       urban-pass
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'URBAN_PASS_VERSION', '0.2.0' );
define( 'URBAN_PASS_DIR', plugin_dir_path( __FILE__ ) );
define( 'URBAN_PASS_URL', plugin_dir_url( __FILE__ ) );

/** Cache-busting version: plugin version + time of the last data refresh. */
function urban_pass_asset_version() {
	$index = URBAN_PASS_DIR . 'data/index.json';
	return URBAN_PASS_VERSION . '-' . ( file_exists( $index ) ? filemtime( $index ) : '0' );
}

function urban_pass_config() {
	return array(
		'data' => URBAN_PASS_URL . 'data/',
		'v'    => urban_pass_asset_version(),
	);
}

/** [urban_pass] shortcode: embeds the app inside any page or post. */
function urban_pass_shortcode() {
	$v = urban_pass_asset_version();
	wp_enqueue_style( 'urban-pass', URBAN_PASS_URL . 'assets/app.css', array(), $v );
	wp_enqueue_script( 'urban-pass', URBAN_PASS_URL . 'assets/app.js', array(), $v, true );
	wp_add_inline_script( 'urban-pass', 'window.URBAN_PASS = ' . wp_json_encode( urban_pass_config() ) . ';', 'before' );
	return '<div id="urban-pass-app" class="up-embedded"></div>';
}
add_shortcode( 'urban_pass', 'urban_pass_shortcode' );

/* Full-screen app at /urban-pass/ and, unless switched off, on the front page. */

function urban_pass_rewrite() {
	add_rewrite_rule( '^urban-pass/?$', 'index.php?urban_pass=1', 'top' );
}
add_action( 'init', 'urban_pass_rewrite' );

add_filter(
	'query_vars',
	function ( $vars ) {
		$vars[] = 'urban_pass';
		return $vars;
	}
);

add_action(
	'template_redirect',
	function () {
		$on_front = get_option( 'urban_pass_on_front', '1' ) === '1' && ( is_front_page() || is_home() );
		if ( get_query_var( 'urban_pass' ) || $on_front ) {
			include URBAN_PASS_DIR . 'templates/fullscreen.php';
			exit;
		}
	}
);

register_activation_hook(
	__FILE__,
	function () {
		urban_pass_rewrite();
		flush_rewrite_rules();
	}
);
register_deactivation_hook( __FILE__, 'flush_rewrite_rules' );

/* Settings → Reading: switch the front-page takeover on or off. */
add_action(
	'admin_init',
	function () {
		register_setting(
			'reading',
			'urban_pass_on_front',
			array(
				'type'              => 'string',
				'default'           => '1',
				'sanitize_callback' => function ( $v ) {
					return $v === '1' ? '1' : '0';
				},
			)
		);
		add_settings_field(
			'urban_pass_on_front',
			'Urban Pass',
			function () {
				$on = get_option( 'urban_pass_on_front', '1' ) === '1';
				echo '<input type="hidden" name="urban_pass_on_front" value="0">';
				echo '<label><input type="checkbox" name="urban_pass_on_front" value="1" ' . checked( $on, true, false ) . '> Show the Urban Pass app on the front page</label>';
				echo '<p class="description">The app is always available at <code>' . esc_html( home_url( '/urban-pass/' ) ) . '</code> and via the <code>[urban_pass]</code> shortcode.</p>';
			},
			'reading'
		);
	}
);
