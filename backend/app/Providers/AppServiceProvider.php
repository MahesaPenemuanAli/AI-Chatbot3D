<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $limited = fn (Request $request, array $headers) => response()->json([
            'message' => 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
            'code' => 'RATE_LIMITED',
            'retryable' => true,
        ], 429, $headers);

        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by('login:'.$request->ip().':'.hash('sha256', mb_strtolower(trim(is_string($request->input('email')) ? $request->input('email') : ''))))->response($limited),
            Limit::perMinute(20)->by('login-ip:'.$request->ip())->response($limited),
        ]);
        RateLimiter::for('register', fn (Request $request) => Limit::perMinute(3)->by('register:'.$request->ip())->response($limited));
        RateLimiter::for('chat', fn (Request $request) => Limit::perMinute(10)->by('chat:'.$request->user()->id)->response($limited));
    }
}
