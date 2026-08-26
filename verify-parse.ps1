$ErrorActionPreference = 'Stop'
$base = 'C:\Users\Jhay-Vy\Downloads\PalengkeHubFinal-main\PalengkeHubFinal-main'

Write-Host '=== CUSTOMER profile tags ==='
$lines = Get-Content "$base\src\screens\customer\ProfileScreen.js"
($lines[605].Trim())
($lines[611].Trim())

Write-Host ''
Write-Host '=== SYNTAX CHECK (babel parser) ==='
Push-Location $base
$parserCheck = @'
const fs=require('fs');
const p=require('@babel/parser');
const files=[
  'App.js',
  'src/screens/shared/HelpSupportScreen.js',
  'src/screens/shared/PrivacyPolicyScreen.js',
  'src/screens/customer/ProfileScreen.js',
  'src/screens/vendor/VendorProfileScreen.js'
];
let ok=true;
for(const f of files){
  try{
    p.parse(fs.readFileSync(f,'utf8'),{sourceType:'module',plugins:['jsx','classProperties','objectRestSpread']});
    console.log('OK  '+f);
  }catch(e){ ok=false; console.log('ERR '+f+' -> '+e.message); }
}
process.exit(ok?0:1);
'@
Set-Content -Path "$base\__parsecheck.cjs" -Value $parserCheck -Encoding UTF8
& node "$base\__parsecheck.cjs" 2>&1 | ForEach-Object { "$_" }
$rc = $LASTEXITCODE
Remove-Item "$base\__parsecheck.cjs" -Force
Pop-Location
Write-Host "parse exit=$rc"

Write-Host ''
Write-Host '=== NAV TARGET CHECK ==='
$appjs = Get-Content "$base\App.js" -Raw
foreach ($n in @('HelpSupport','PrivacyPolicy')) {
  $registered = ($appjs -match ('name="' + $n + '"'))
  Write-Host ("{0} registered: {1}" -f $n, $registered)
}
