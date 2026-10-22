<?php
/**
 * Full-screen app shell (no theme), so it looks and feels like a phone app.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$urban_pass_v = urban_pass_asset_version();
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#00112c">
<meta name="robots" content="noindex">
<title><?php echo esc_html( get_bloginfo( 'name' ) ?: 'Urban Pass' ); ?></title>
<link rel="stylesheet" href="<?php echo esc_url( URBAN_PASS_URL . 'assets/app.css?ver=' . rawurlencode( $urban_pass_v ) ); ?>">
<script>window.URBAN_PASS = <?php echo wp_json_encode( urban_pass_config() ); ?>;</script>
</head>
<body class="up-fullscreen">
<div id="urban-pass-app"></div>
<script src="<?php echo esc_url( URBAN_PASS_URL . 'assets/app.js?ver=' . rawurlencode( $urban_pass_v ) ); ?>"></script>
</body>
</html>
