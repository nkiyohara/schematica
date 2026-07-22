# Publication template. Update the version and checksum before adding it to a tap.
class Schematica < Formula
  desc "Fast schema-driven config editor for YAML, JSON, and TOML"
  homepage "https://github.com/nkiyohara/schematica"
  url "https://github.com/nkiyohara/schematica/releases/download/v0.1.0/schematica-cli-v0.1.0.tar.gz"
  sha256 "REPLACE_WITH_RELEASE_SHA256"
  license "MIT"

  depends_on "node@24"

  def install
    libexec.install Dir["dist/*"], "package.json"
    (bin/"schematica").write <<~SH
      #!/bin/sh
      exec "#{Formula["node@24"].opt_bin}/node" "#{libexec}/index.cjs" "$@"
    SH
  end

  test do
    assert_match "schematica", shell_output("#{bin}/schematica --help")
  end
end
