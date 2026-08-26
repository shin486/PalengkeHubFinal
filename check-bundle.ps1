$ErrorActionPreference = 'Continue'
Write-Host '=== Metro status ==='
try {
  $status = Invoke-WebRequest -Uri 'http://localhost:8081/status' -UseBasicParsing -TimeoutSec 10
  Write-Host ("HTTP {0}: {1}" -f $status.StatusCode, $status.Content)
} catch {
  Write-Host ("Status check failed: {0}" -f $_.Exception.Message)
}

Write-Host ''
Write-Host '=== Compiling full WEB bundle through Metro (end-to-end check of new screens) ==='
try {
  $bundle = Invoke-WebRequest -Uri 'http://localhost:8081/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&lazy=true' -UseBasicParsing -TimeoutSec 180
  Write-Host ("Bundle HTTP {0}, size {1} bytes" -f $bundle.StatusCode, $bundle.RawContentLength)
  $content = $bundle.Content
  foreach ($needle in @('HelpSupportScreen', 'PrivacyPolicyScreen', 'PIN Login', 'Dark Mode')) {
    $found = $content.Contains($needle)
    Write-Host ("Contains '{0}': {1}" -f $needle, $found)
  }
} catch {
  Write-Host ("Router-entry bundle failed ({0}) - trying App.js entry..." -f $_.Exception.Message)
  try {
    $bundle2 = Invoke-WebRequest -Uri 'http://localhost:8081/App.bundle?platform=web&dev=true&hot=false&lazy=true' -UseBasicParsing -TimeoutSec 180
    Write-Host ("App bundle HTTP {0}, size {1}" -f $bundle2.StatusCode, $bundle2.RawContentLength)
    foreach ($needle in @('HelpSupportScreen', 'PrivacyPolicyScreen')) {
      Write-Host ("Contains '{0}': {1}" -f $needle, $bundle2.Content.Contains($needle))
    }
  } catch {
    Write-Host ("App bundle also failed: {0}" -f $_.Exception.Message)
  }
}
