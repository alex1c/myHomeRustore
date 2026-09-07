/**
 * Structural regression: debug builds must not eagerly require release signing env.
 */

import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

const requirePlugin = createRequire(__filename);
const {
  applyLazyReleaseSigning,
} = requirePlugin('../plugins/withLazyReleaseSigning.js') as {
  applyLazyReleaseSigning: (contents: string) => string;
};

describe('lazy release signing plugin', () => {
  test('injected block never throws on configure for debug-only env', () => {
    const sample = `
android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}
`;
    const result = applyLazyReleaseSigning(sample);
    expect(result).toContain('@myhome-lazy-release-signing begin');
    expect(result).toContain('MYHOME_RELEASE_STORE_FILE');
    expect(result).toContain('gradle.taskGraph.whenReady');
    // Must NOT keep an eager top-level throw before task graph.
    expect(result).not.toMatch(
      /if\s*\(\s*!myhomeHasReleaseSigning\s*\)\s*\{\s*throw/,
    );
    // Release credentials gate lives inside whenReady.
    expect(result).toMatch(/wantsRelease && !myhomeHasReleaseSigning/);
  });

  test('plugin file is registered in app.json', () => {
    const appJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'),
    ) as { expo: { plugins: unknown[] } };
    expect(appJson.expo.plugins).toContain('./plugins/withLazyReleaseSigning.js');
  });
});
