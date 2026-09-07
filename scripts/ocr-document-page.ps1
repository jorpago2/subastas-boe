# Persistent local Windows OCR worker. One JSON request/image per input line.
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Wait-Async($operation, $type) {
    $task = $asTask.MakeGenericMethod($type).Invoke($null, @($operation))
    $task.GetAwaiter().GetResult()
}
function Get-WordScore($text) {
    ([regex]::Matches($text.ToLowerInvariant(), '\b(de|la|el|en|que|los|las|del|con|por|para|una|un|se|al|su|no|es|esta|este|y)\b')).Count
}
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('es-ES'))
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
while ($line = [Console]::ReadLine()) {
    try {
        $request = $line | ConvertFrom-Json
        $file = Wait-Async ([Windows.Storage.StorageFile]::GetFileFromPathAsync($request.image)) ([Windows.Storage.StorageFile])
        $stream = Wait-Async ($file.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
        $decoder = Wait-Async ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bitmap = Wait-Async ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $result = Wait-Async ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
        $text = ($result.Lines | ForEach-Object { $_.Text }) -join "`n"
        $rotation = 0
        $letterCount = ([regex]::Matches($text, '\p{L}')).Count
        $wordScore = Get-WordScore $text
        $wordCount = ([regex]::Matches($text, '\p{L}+')).Count
        if ($letterCount -lt 200 -or ($wordCount -gt 30 -and $wordScore / $wordCount -lt 0.07)) {
            foreach ($angle in @(270, 90, 180)) {
                $transform = [Windows.Graphics.Imaging.BitmapTransform]::new()
                $transform.Rotation = [Windows.Graphics.Imaging.BitmapRotation]::$('Clockwise' + $angle + 'Degrees')
                $rotated = Wait-Async ($decoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Ignore, $transform, [Windows.Graphics.Imaging.ExifOrientationMode]::IgnoreExifOrientation, [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
                $rotatedResult = Wait-Async ($engine.RecognizeAsync($rotated)) ([Windows.Media.Ocr.OcrResult])
                $rotatedText = ($rotatedResult.Lines | ForEach-Object { $_.Text }) -join "`n"
                $rotated.Dispose()
                $candidateCount = ([regex]::Matches($rotatedText, '\p{L}')).Count
                $candidateScore = Get-WordScore $rotatedText
                if ($candidateScore -gt $wordScore -or ($candidateScore -eq $wordScore -and $candidateCount -gt $letterCount)) {
                    $text = $rotatedText
                    $letterCount = $candidateCount
                    $wordScore = $candidateScore
                    $rotation = $angle
                }
            }
        }
        $bitmap.Dispose()
        $stream.Dispose()
        [Console]::WriteLine((@{ text = $text; rotation = $rotation; orientationChecked = $true } | ConvertTo-Json -Compress))
    } catch {
        [Console]::WriteLine((@{ error = $_.Exception.Message } | ConvertTo-Json -Compress))
    }
}
