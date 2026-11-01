const PLUGIN = `<?php
/**
 * Plugin Name:       DRIPS SEO Connector
 * Plugin URI:        https://drips.app/wordpress
 * Description:       Real-time on-page SEO scoring, content optimization and internal link suggestions inside the WordPress editor. Powered by DRIPS.
 * Version:           1.8.2
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Author:            DRIPS
 * License:           GPL-2.0-or-later
 * Text Domain:       drips-seo
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'DRIPS_VERSION', '1.8.2' );

/**
 * Settings: API key + project id.
 */
function drips_register_settings() {
	register_setting( 'drips', 'drips_api_key', array( 'sanitize_callback' => 'sanitize_text_field' ) );
	register_setting( 'drips', 'drips_project_id', array( 'sanitize_callback' => 'sanitize_text_field' ) );
	register_setting( 'drips', 'drips_api_base', array( 'sanitize_callback' => 'esc_url_raw' ) );
}
add_action( 'admin_init', 'drips_register_settings' );

function drips_admin_menu() {
	add_options_page( 'DRIPS SEO', 'DRIPS SEO', 'manage_options', 'drips-seo', 'drips_settings_page' );
}
add_action( 'admin_menu', 'drips_admin_menu' );

function drips_settings_page() {
	?>
	<div class="wrap">
		<h1>DRIPS SEO Connector</h1>
		<form method="post" action="options.php">
			<?php settings_fields( 'drips' ); ?>
			<table class="form-table">
				<tr>
					<th><label for="drips_api_key">API key</label></th>
					<td><input name="drips_api_key" id="drips_api_key" class="regular-text" value="<?php echo esc_attr( get_option( 'drips_api_key' ) ); ?>" /></td>
				</tr>
				<tr>
					<th><label for="drips_project_id">Project ID</label></th>
					<td><input name="drips_project_id" id="drips_project_id" class="regular-text" value="<?php echo esc_attr( get_option( 'drips_project_id' ) ); ?>" /></td>
				</tr>
				<tr>
					<th><label for="drips_api_base">API base URL</label></th>
					<td><input name="drips_api_base" id="drips_api_base" class="regular-text" value="<?php echo esc_attr( get_option( 'drips_api_base', 'https://api.drips.app/v1' ) ); ?>" /></td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
	</div>
	<?php
}

/**
 * Score a post's title, focus keyword and body through the DRIPS API.
 */
function drips_score_content( $title, $keyword, $body ) {
	$response = wp_remote_post(
		trailingslashit( get_option( 'drips_api_base', 'https://api.drips.app/v1' ) ) . 'content/analyze',
		array(
			'timeout' => 8,
			'headers' => array(
				'Content-Type'  => 'application/json',
				'Authorization' => 'Bearer ' . get_option( 'drips_api_key' ),
				'X-Project'     => get_option( 'drips_project_id' ),
			),
			'body'    => wp_json_encode(
				array(
					'title'      => $title,
					'keyword'    => $keyword,
					'body'       => $body,
					'metaTitle'  => get_post_meta( get_the_ID(), '_yoast_wpseo_title', true ),
					'metaDescription' => get_post_meta( get_the_ID(), '_yoast_wpseo_metadesc', true ),
				)
			),
		)
	);

	if ( is_wp_error( $response ) ) {
		return new WP_Error( 'drips_unreachable', $response->get_error_message() );
	}

	$code = wp_remote_retrieve_response_code( $response );
	$data = json_decode( wp_remote_retrieve_body( $response ), true );
	if ( 200 !== $code || empty( $data['analysis'] ) ) {
		return new WP_Error( 'drips_invalid', __( 'DRIPS could not score this content.', 'drips-seo' ) );
	}
	return $data['analysis'];
}

/**
 * Server-side REST endpoint so the editor can re-score on save.
 */
function drips_register_rest() {
	register_rest_route(
		'drips/v1',
		'/score',
		array(
			'methods'             => 'POST',
			'permission_callback' => function () {
				return current_user_can( 'edit_posts' );
			},
			'callback'            => function ( WP_REST_Request $request ) {
				$body    = $request->get_param( 'body' );
				$title   = $request->get_param( 'title' );
				$keyword = $request->get_param( 'keyword' );
				$result  = drips_score_content( $title, $keyword, $body );
				if ( is_wp_error( $result ) ) {
					return new WP_REST_Response( array( 'error' => $result->get_error_message() ), 502 );
				}
				return new WP_REST_Response( $result, 200 );
			},
		)
	);
}
add_action( 'rest_api_init', 'drips_register_rest' );

/**
 * Meta box: live score, checks and one-click fixes.
 */
function drips_add_meta_box() {
	add_meta_box( 'drips-seo-panel', 'DRIPS on-page SEO', 'drips_meta_box', array( 'post', 'page' ), 'side', 'high' );
}
add_action( 'add_meta_boxes', 'drips_add_meta_box' );

function drips_meta_box( $post ) {
	$keyword = get_post_meta( $post->ID, '_drips_focus_keyword', true );
	wp_nonce_field( 'drips_save_meta', 'drips_nonce' );
	?>
	<div id="drips-panel">
		<p>
			<label for="drips-keyword"><strong>Focus keyword</strong></label>
			<input type="text" id="drips-keyword" name="drips_focus_keyword" class="widefat" value="<?php echo esc_attr( $keyword ); ?>" placeholder="e.g. hiking boots" />
		</p>
		<div id="drips-score" style="display:flex;align-items:center;gap:10px;margin:10px 0;">
			<span id="drips-score-value" style="font-size:26px;font-weight:600;">—</span>
			<span style="color:#64748b;font-size:12px;">Content score</span>
		</div>
		<ul id="drips-checks" style="margin:0 0 10px;font-size:12px;color:#334155;"></ul>
		<p style="font-size:11px;color:#64748b;margin:0;">Scores update as you type. Optimize with DRIPS before publishing.</p>
	</div>
	<script>
	(function(){
		var endpoint = <?php echo wp_json_encode( rest_url( 'drips/v1/score' ) ); ?>;
		var nonce = <?php echo wp_json_encode( wp_create_nonce( 'wp_rest' ) ); ?>;
		var titleEl = document.getElementById('title');
		var contentEl = document.getElementById('content');
		var keywordEl = document.getElementById('drips-keyword');
		var scoreEl = document.getElementById('drips-score-value');
		var listEl = document.getElementById('drips-checks');
		if (!titleEl || !contentEl) return;
		var timer = null;

		function score() {
			var payload = {
				title: titleEl.value,
				keyword: keywordEl.value,
				body: contentEl.value
			};
			fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
				body: JSON.stringify(payload)
			}).then(function(r){ return r.json(); }).then(function(data){
				if (!data || data.score === undefined) return;
				scoreEl.textContent = data.score;
				scoreEl.style.color = data.score >= 80 ? '#16a34a' : data.score >= 60 ? '#d97706' : '#e11d48';
				var items = (data.checks || []).filter(function(c){ return c.status !== 'pass'; }).slice(0, 4);
				listEl.innerHTML = items.map(function(c){
					var color = c.status === 'warn' ? '#d97706' : '#e11d48';
					return '<li style="margin-bottom:4px;"><span style="color:' + color + ';">&#9679;</span> ' + c.label + '</li>';
				}).join('');
			}).catch(function(){ scoreEl.textContent = '—'; });
		}

		function debounce() {
			clearTimeout(timer);
			timer = setTimeout(score, 700);
		}

		titleEl.addEventListener('input', debounce);
		contentEl.addEventListener('input', debounce);
		keywordEl.addEventListener('input', debounce);
		if (titleEl.value) score();
	})();
	</script>
	<?php
}

function drips_save_meta( $post_id ) {
	if ( ! isset( $_POST['drips_nonce'] ) || ! wp_verify_nonce( $_POST['drips_nonce'], 'drips_save_meta' ) ) {
		return;
	}
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	if ( isset( $_POST['drips_focus_keyword'] ) ) {
		update_post_meta( $post_id, '_drips_focus_keyword', sanitize_text_field( $_POST['drips_focus_keyword'] ) );
	}
}
add_action( 'save_post', 'drips_save_meta' );

/**
 * Internal link suggestions: topically related published posts.
 */
function drips_internal_links( $post_id, $limit = 3 ) {
	$keyword = get_post_meta( $post_id, '_drips_focus_keyword', true );
	if ( empty( $keyword ) ) {
		return array();
	}
	return get_posts(
		array(
			's'              => $keyword,
			'post__not_in'   => array( $post_id ),
			'posts_per_page' => $limit,
			'post_status'    => 'publish',
			'orderby'        => 'relevance',
		)
	);
}

/**
 * Heartbeat: report plugin + site health to the DRIPS dashboard.
 */
function drips_heartbeat() {
	$api_key = get_option( 'drips_api_key' );
	if ( empty( $api_key ) ) {
		return;
	}
	wp_remote_post(
		trailingslashit( get_option( 'drips_api_base', 'https://api.drips.app/v1' ) ) . 'integrations/wordpress/ping',
		array(
			'timeout' => 5,
			'headers' => array( 'Authorization' => 'Bearer ' . $api_key ),
			'body'    => array(
				'url'     => home_url(),
				'version' => DRIPS_VERSION,
				'wp'      => get_bloginfo( 'version' ),
			),
		)
	);
}
add_action( 'wp_loaded', 'drips_heartbeat' );

register_activation_hook( __FILE__, function () {
	update_option( 'drips_plugin_version', DRIPS_VERSION );
} );
`;

export async function GET() {
  return new Response(PLUGIN, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="drips-seo-connector.php"',
      "Cache-Control": "no-store",
    },
  });
}
