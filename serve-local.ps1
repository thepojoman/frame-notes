$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 8000
$Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
$Listener.Start()
Write-Host "Serving $Root on http://localhost:$Port"

$MimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg" = "image/svg+xml"
  ".ico" = "image/x-icon"
}

while ($true) {
  $Client = $Listener.AcceptTcpClient()
  try {
    $Stream = $Client.GetStream()
    $Reader = [System.IO.StreamReader]::new($Stream)
    $RequestLine = $Reader.ReadLine()
    while ($Reader.ReadLine()) {}

    if (-not $RequestLine) {
      continue
    }

    $Parts = $RequestLine.Split(" ")
    $Path = [Uri]::UnescapeDataString($Parts[1].Split("?")[0])
    if ($Path -eq "/") {
      $Path = "/index.html"
    }

    $RelativePath = $Path.TrimStart("/") -replace "/", [System.IO.Path]::DirectorySeparatorChar
    $FullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($Root, $RelativePath))

    if (-not $FullPath.StartsWith($Root) -or -not [System.IO.File]::Exists($FullPath)) {
      $Body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
      $Header = "HTTP/1.1 404 Not Found`r`nContent-Length: $($Body.Length)`r`nContent-Type: text/plain`r`nConnection: close`r`n`r`n"
      $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)
      $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
      $Stream.Write($Body, 0, $Body.Length)
      continue
    }

    $Bytes = [System.IO.File]::ReadAllBytes($FullPath)
    $Extension = [System.IO.Path]::GetExtension($FullPath).ToLowerInvariant()
    $ContentType = $MimeTypes[$Extension]
    if (-not $ContentType) {
      $ContentType = "application/octet-stream"
    }

    $Header = "HTTP/1.1 200 OK`r`nContent-Length: $($Bytes.Length)`r`nContent-Type: $ContentType`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)
    $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
    $Stream.Write($Bytes, 0, $Bytes.Length)
  } finally {
    $Client.Close()
  }
}
