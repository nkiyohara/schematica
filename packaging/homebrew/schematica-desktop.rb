# Publication template. Update the version and checksum before adding it to a tap.
cask "schematica" do
  version "0.1.0"
  sha256 "REPLACE_WITH_DMG_SHA256"
  arch arm: "aarch64", intel: "x64"

  url "https://github.com/nkiyohara/schematica/releases/download/v#{version}/Schematica_#{version}_#{arch}.dmg",
      verified: "github.com/nkiyohara/schematica/"
  name "Schematica"
  desc "Schema-driven YAML, JSON, and TOML config editor"
  homepage "https://github.com/nkiyohara/schematica"

  depends_on macos: ">= :ventura"

  app "Schematica.app"

  zap trash: [
    "~/Library/Application Support/dev.schematica.editor",
    "~/Library/Preferences/dev.schematica.editor.plist",
    "~/Library/Saved Application State/dev.schematica.editor.savedState"
  ]
end
