<?php

namespace Tests\Unit;

use App\Services\Liq\LiqIngestService;
use PHPUnit\Framework\TestCase;

class LiqParseDecimalTest extends TestCase
{
    private function parse(mixed $value): float
    {
        $svc = new LiqIngestService();
        $ref = new \ReflectionClass($svc);
        $m = $ref->getMethod('parseDecimal');
        $m->setAccessible(true);
        return (float) $m->invoke($svc, $value);
    }

    public function test_parses_currency_with_ar_style(): void
    {
        $this->assertSame(211082.0, $this->parse('$ 211.082,00'));
        $this->assertSame(1234.56, $this->parse('1.234,56'));
        $this->assertSame(1234.0, $this->parse('1.234'));
    }

    public function test_parses_currency_with_us_style(): void
    {
        $this->assertSame(211082.0, $this->parse('$ 211,082.00'));
        $this->assertSame(1234.56, $this->parse('1,234.56'));
        $this->assertSame(1234.0, $this->parse('1,234'));
    }
}

