$ErrorActionPreference = 'Stop'

$f = 'C:\Users\Jhay-Vy\Downloads\PalengkeHubFinal-main\PalengkeHubFinal-main\src\screens\customer\ProfileScreen.js'
$c = [IO.File]::ReadAllText($f)

# Fix Help & Support line (normalize stray leading whitespace + ensure onPress present)
$helpTag = '<TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate(' + "'HelpSupport', { role: 'customer' })}" + '>'
$c = [regex]::Replace($c, '(?m)^[ \t]*<TouchableOpacity style=\{styles\.menuItem\} onPress=\{\(\) => navigation\.navigate\(' + "'HelpSupport', \{ role: 'customer' \}\)\}", '          ' + $helpTag)

# Fix Privacy Policy line (add onPress, keep 10-space indent) - only where followed by lock-closed
$privTag = '<TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate(' + "'PrivacyPolicy', { role: 'customer' })}" + '>'
$c = [regex]::Replace($c, '(?m)^[ \t]*<TouchableOpacity style=\{styles\.menuItem\}>(?=\s*<Ionicons name="lock-closed")', '          ' + $privTag)

[IO.File]::WriteAllText($f, $c, [System.Text.Encoding]::UTF8)

$lines = $c -split "`n"
Write-Host ('=== line 606 ===')
Write-Host $lines[605]
Write-Host ('=== line 612 ===')
Write-Host $lines[611]
