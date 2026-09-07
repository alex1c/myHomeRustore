/**
 * Expo config plugin: lazy production signing validation.
 *
 * Debug builds never require MYHOME_RELEASE_* env vars.
 * Release tasks fail-fast only when a release variant is actually requested.
 */

const {
  withAppBuildGradle,
  createRunOncePlugin,
} = require('@expo/config-plugins');

const MARKER_BEGIN = '// @myhome-lazy-release-signing begin';
const MARKER_END = '// @myhome-lazy-release-signing end';

const SIGNING_BLOCK = `${MARKER_BEGIN}
def myhomeReleaseStoreFile = System.getenv("MYHOME_RELEASE_STORE_FILE")
def myhomeReleaseStorePassword = System.getenv("MYHOME_RELEASE_STORE_PASSWORD")
def myhomeReleaseKeyAlias = System.getenv("MYHOME_RELEASE_KEY_ALIAS")
def myhomeReleaseKeyPassword = System.getenv("MYHOME_RELEASE_KEY_PASSWORD")
def myhomeHasReleaseSigning =
    myhomeReleaseStoreFile &&
    myhomeReleaseStorePassword &&
    myhomeReleaseKeyAlias &&
    myhomeReleaseKeyPassword

android.signingConfigs {
    // Keep debug signing independent of production credentials.
    debug {
        storeFile file('debug.keystore')
        storePassword 'android'
        keyAlias 'androiddebugkey'
        keyPassword 'android'
    }
    if (myhomeHasReleaseSigning) {
        release {
            storeFile file(myhomeReleaseStoreFile)
            storePassword myhomeReleaseStorePassword
            keyAlias myhomeReleaseKeyAlias
            keyPassword myhomeReleaseKeyPassword
        }
    }
}

android.buildTypes {
    debug {
        signingConfig android.signingConfigs.debug
    }
    release {
        if (myhomeHasReleaseSigning) {
            signingConfig android.signingConfigs.release
        }
        // If credentials are missing, do NOT throw here — only when a release
        // task is actually in the task graph (see whenReady below).
    }
}

gradle.taskGraph.whenReady { graph ->
    def wantsRelease = graph.allTasks.any { task ->
        def n = task.name.toLowerCase()
        return n.contains('release') && !n.contains('lintvital')
    }
    if (wantsRelease && !myhomeHasReleaseSigning) {
        throw new GradleException(
            "Production release signing required. Set MYHOME_RELEASE_STORE_FILE, " +
            "MYHOME_RELEASE_STORE_PASSWORD, MYHOME_RELEASE_KEY_ALIAS, " +
            "MYHOME_RELEASE_KEY_PASSWORD before assembleRelease/bundleRelease. " +
            "Debug builds do not need these variables."
        )
    }
}
${MARKER_END}
`;

/**
 * Strip a previous injected block (idempotent).
 */
function stripExistingBlock(contents) {
  const begin = contents.indexOf(MARKER_BEGIN);
  if (begin < 0) return contents;
  const end = contents.indexOf(MARKER_END);
  if (end < 0) return contents;
  return (
    contents.slice(0, begin) +
    contents.slice(end + MARKER_END.length)
  ).replace(/\n{3,}/g, '\n\n');
}

/**
 * Remove eager default signingConfigs/buildTypes blocks that Expo prebuild emits,
 * then append the lazy-release block.
 */
function applyLazyReleaseSigning(contents) {
  let next = stripExistingBlock(contents);

  // Remove the stock signingConfigs { debug { ... } } block if present.
  next = next.replace(
    /signingConfigs\s*\{[\s\S]*?\n\s*\}\s*\n(?=\s*buildTypes)/m,
    '',
  );

  // Neutralize eager release signingConfig = debug assignment inside buildTypes.
  next = next.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug\s*\n/m,
    '$1',
  );

  if (!next.includes(MARKER_BEGIN)) {
    next = `${next.trimEnd()}\n\n${SIGNING_BLOCK}\n`;
  }
  return next;
}

function withLazyReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      return cfg;
    }
    cfg.modResults.contents = applyLazyReleaseSigning(cfg.modResults.contents);
    return cfg;
  });
}

const plugin = createRunOncePlugin(
  withLazyReleaseSigning,
  'with-lazy-release-signing',
  '1.0.0',
);

module.exports = plugin;
module.exports.applyLazyReleaseSigning = applyLazyReleaseSigning;
module.exports.SIGNING_BLOCK = SIGNING_BLOCK;
