param(
	[string]$Url = '',
	[string]$PublicUrlFile = 'logs/public_url.txt'
)

node tools/deploy/print-qr.js $Url $PublicUrlFile
