# Zip script for SmartTranslate (Windows/PowerShell)
# Run this to create a clean 'smarttranslate_v1.0.zip' for Chrome Web Store submission

# Define files to include
$includeList = @(
    "manifest.json",
    "background.js",
    "content.js",
    "config.js",
    "popup.html",
    "popup.js",
    "logo.png",
    "icon16.png",
    "icon32.png",
    "icon48.png",
    "icon128.png",
    "servicenow-helper.js",
    "tinymce-helper.js",
    "translator.html",
    "translator.js",
    "modules",
    "utils",
    "libs",
    "styles",
    "icons"
)

# Define version
$version = "1.0.5"
$zipFile = "SmartTranslate_v$version.zip"

# Clean up previous zip if exists
if (Test-Path $zipFile) { Remove-Item $zipFile }

# Create temporary dist folder
$dist = "dist_temp"
if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }
New-Item -ItemType Directory -Path $dist

# Copy files
foreach ($item in $includeList) {
    if (Test-Path $item) {
        $dest = Join-Path $dist $item
        $parent = Split-Path $dest
        if (!(Test-Path $parent)) { New-Item -ItemType Directory -Parent $parent }
        Copy-Item -Path $item -Destination $dest -Recurse
    }
}

# Zip the dist folder
Compress-Archive -Path "$dist\*" -DestinationPath $zipFile

# Cleanup
Remove-Item -Recurse -Force $dist

Write-Host "✅ Successfully created $zipFile" -ForegroundColor Green
