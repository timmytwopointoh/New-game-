VEILFORGE Realm AI v0.17.3 test APK

This update identifies the phone-hosted Bedrock client as Minecraft Android instead of bedrock-protocol's Nintendo Switch default. It sets Android auth/device metadata and touch input while reusing the same live-auth cache path without forcing a token refresh.

Survival and Creative mode controls issue server-permission-gated Minecraft command requests targeted only to the bot (@s), then wait for the server's own mode/ability confirmation. Walking uses serialized Bedrock player-auth input; mining holds the appropriate block-breaking input through server confirmation; placement uses server-confirmed transactions. These simulated tests do not prove live Realm movement.

The visible Commands control beside Activate and the home-screen status remain. This APK uses the existing permanent signing certificate.
