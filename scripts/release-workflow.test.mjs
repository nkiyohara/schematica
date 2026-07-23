import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../.github/workflows/release.yml", import.meta.url);

void test("release workflow keeps signed artifacts behind one draft and a final gate", async () => {
  const workflow = await readFile(workflowUrl, "utf8");

  assert.match(workflow, /release-draft:\n[\s\S]*name: Prepare one release draft/);
  assert.equal(
    workflow.match(/releaseId: \$\{\{ needs\.release-draft\.outputs\.release_id \}\}/g)?.length,
    2,
  );
  assert.match(workflow, /cli:\n[\s\S]*environment: linux-signing/);
  assert.match(workflow, /schematica-cli-\$\{\{ github\.ref_name \}\}\.tar\.gz\.asc/);
  assert.match(workflow, /gpg --batch --verify/);
  assert.match(
    workflow,
    /name: Notarize and staple macOS disk image[\s\S]*xcrun notarytool submit[\s\S]*xcrun stapler staple[\s\S]*gh release upload[\s\S]*--clobber/,
  );
  assert.match(workflow, /name: Verify macOS signature and notarization ticket/);
  assert.match(
    workflow,
    /name: Verify macOS signature and notarization ticket[\s\S]*gh release download[\s\S]*cmp --silent[\s\S]*xcrun stapler validate/,
  );
  assert.ok(
    workflow.indexOf("name: Notarize and staple macOS disk image") <
      workflow.indexOf("name: Verify macOS signature and notarization ticket"),
  );
  assert.match(workflow, /name: Verify complete release asset set/);
  assert.match(workflow, /Unsigned Windows installer found in the release asset set/);
  assert.match(workflow, /is already published; skipping publish transition/);
  assert.match(
    workflow,
    /refresh-pages:\n[\s\S]*needs\.release-draft\.outputs\.is_draft == 'false'/,
  );
  assert.equal(workflow.match(/--context context:primary-signature/g)?.length, 1);
});
