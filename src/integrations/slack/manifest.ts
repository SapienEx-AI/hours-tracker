// Slack app manifest for the Hours Tracker bot. Users paste this into
// Slack's "Create app → From a manifest" flow to provision a ready-to-
// install app with the exact scopes the effort-source integration needs.
// Single source of truth for scopes — mirror any change here in
// docs/superpowers/specs/2026-04-15-effort-source-integrations-design.md §5.3.

export const SLACK_APP_MANIFEST = {
  display_information: {
    name: 'Hours Tracker',
    description: 'Generates a daily effort digest from channel + DM activity',
    background_color: '#0b1220',
    long_description:
      'Hours Tracker reads your channel, private-channel, and DM activity to produce a daily digest of Slack threads. No messages leave your browser. Used with the Hours Tracker consulting app to log effort tagged by client project.',
  },
  features: {
    bot_user: {
      display_name: 'Hours Tracker',
      always_online: false,
    },
  },
  oauth_config: {
    scopes: {
      bot: ['channels:history', 'groups:history', 'im:history', 'users:read'],
    },
  },
  settings: {
    org_deploy_enabled: false,
    socket_mode_enabled: false,
    token_rotation_enabled: false,
  },
} as const;

export function slackAppManifestJson(): string {
  return JSON.stringify(SLACK_APP_MANIFEST, null, 2);
}
