$c = Get-Content -LiteralPath "C:\Users\memit\Documents\Default Project\InteeBuild\index.html" -Raw
$c = $c -replace "`r?`n", "`r`n"
Set-Content -LiteralPath "C:\Users\memit\Documents\Default Project\InteeBuild\index.html" -Value $c -Encoding UTF8
Write-Host 'Fixed CRLF'