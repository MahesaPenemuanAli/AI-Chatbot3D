<?php

namespace Tests\Unit;

use App\Services\UploadLimits;
use PHPUnit\Framework\TestCase;

class UploadLimitsTest extends TestCase
{
    public function test_php_limits_cap_the_advertised_file_count_and_sizes(): void
    {
        $this->assertSame([
            'max_attachment_bytes' => 2097152,
            'max_total_attachment_bytes' => 8126464,
            'max_attachment_count' => 4,
        ], UploadLimits::fromSettings('2M', '8M', 20));
        $this->assertSame([
            'max_attachment_bytes' => 524288,
            'max_total_attachment_bytes' => 524288,
            'max_attachment_count' => 2,
        ], UploadLimits::fromSettings('20M', '768K', 2));
    }

    public function test_unlimited_php_sizes_still_obey_the_application_cap(): void
    {
        $this->assertSame(20971520, UploadLimits::fromSettings('0', '0', 20)['max_attachment_bytes']);
        $this->assertSame(20971520, UploadLimits::fromSettings('1G', '1G', 20)['max_total_attachment_bytes']);
        $this->assertSame(0, UploadLimits::fromSettings('1M', '128K', 0)['max_total_attachment_bytes']);
        $this->assertSame(0, UploadLimits::fromSettings('1M', '128K', 0)['max_attachment_count']);
        $this->assertSame(1024, UploadLimits::bytes('1k'));
    }
}
