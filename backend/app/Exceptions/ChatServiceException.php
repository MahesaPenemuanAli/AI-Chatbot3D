<?php

namespace App\Exceptions;

use RuntimeException;

class ChatServiceException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode,
        public readonly int $status = 503,
        public readonly bool $retryable = false,
    ) {
        parent::__construct($message);
    }
}
