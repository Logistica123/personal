<?php

namespace App\Services\FacturaAi;

use RuntimeException;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

class PdfTextExtractor
{
    public function extract(string $absolutePath): string
    {
        if (! is_file($absolutePath)) {
            throw new RuntimeException('El archivo PDF no existe.');
        }

        $extension = strtolower(pathinfo($absolutePath, PATHINFO_EXTENSION));
        if ($extension !== 'pdf') {
            $text = $this->runProcess(['tesseract', $absolutePath, 'stdout', '-l', 'spa+eng'], 'tesseract');
            if (! $this->isUsableText($text)) {
                throw new RuntimeException('No se pudo extraer texto de la imagen.');
            }

            return $text;
        }

        $text = $this->runProcess(['pdftotext', '-layout', $absolutePath, '-'], 'pdftotext');
        if ($this->isUsableText($text)) {
            return $text;
        }

        $text = $this->runProcess(['tesseract', $absolutePath, 'stdout', '-l', 'spa+eng'], 'tesseract');
        if (! $this->isUsableText($text)) {
            throw new RuntimeException('No se pudo extraer texto del PDF.');
        }

        return $text;
    }

    private function runProcess(array $command, string $label): string
    {
        $process = new Process($command);
        $process->setTimeout(60);

        $process->run();

        if (! $process->isSuccessful()) {
            throw new ProcessFailedException($process);
        }

        $output = $process->getOutput();
        if ($output === '') {
            throw new RuntimeException("Salida vacia de {$label}.");
        }

        return $output;
    }

    private function isUsableText(?string $text): bool
    {
        $trimmed = trim((string) $text);
        return $trimmed !== '' && mb_strlen($trimmed) >= 40;
    }
}
