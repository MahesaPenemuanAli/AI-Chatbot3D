<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\ChatSession;
use App\Services\UploadLimits;
use App\Services\GeminiChatService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ChatProviderTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.gemini' => [
            'key' => 'nusa-test-only-key',
            'model' => 'gemini-3.8-flash',
            'fallback_model' => '',
            'thinking_level' => 'low',
            'max_output_tokens' => 4096,
            'ca_bundle' => null,
        ]]);
        Http::preventStrayRequests();
    }

    public function test_public_status_reports_configuration_without_exposing_the_key_or_calling_ai(): void
    {
        $this->getJson('/api/status')->assertOk()->assertExactJson([
            'provider' => 'gemini',
            'configured' => true,
            'upload_limits' => UploadLimits::current(),
            'code' => 'AI_CONFIGURED',
            'message' => 'Layanan AI telah dikonfigurasi.',
        ]);
        config(['services.gemini.key' => null]);
        $this->getJson('/api/status')->assertOk()
            ->assertJsonPath('configured', false)
            ->assertJsonPath('code', 'AI_NOT_CONFIGURED');
        Http::assertNothingSent();
    }

    public function test_missing_provider_configuration_does_not_create_a_failed_turn(): void
    {
        config(['services.gemini.key' => null]);
        Sanctum::actingAs(User::factory()->create());

        $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
            ->assertStatus(503)
            ->assertJsonPath('code', 'AI_NOT_CONFIGURED')
            ->assertJsonPath('retryable', false);

        $this->assertNoTurn();
        Http::assertNothingSent();
    }

    public function test_invalid_key_returns_an_actionable_error_without_leaking_provider_details(): void
    {
        config(['services.gemini.fallback_model' => 'gemini-3.5-flash-lite']);
        Sanctum::actingAs(User::factory()->create());
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'error' => ['status' => 'PERMISSION_DENIED', 'message' => 'private provider detail nusa-test-only-key'],
        ], 403)]);

        $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
            ->assertStatus(503)
            ->assertJsonPath('code', 'AI_AUTH_FAILED')
            ->assertJsonPath('retryable', false)
            ->assertDontSee('private provider detail')
            ->assertDontSee('nusa-test-only-key');

        $this->assertNoTurn();
        Http::assertSentCount(1);
    }

    public function test_rate_limited_turn_can_be_retried_without_duplicate_messages_or_uploads(): void
    {
        config(['services.gemini.fallback_model' => 'gemini-3.5-flash-lite']);
        Sanctum::actingAs(User::factory()->create());
        Storage::fake('local');
        Http::fakeSequence()->push(['error' => ['status' => 'RESOURCE_EXHAUSTED']], 429)
            ->push($this->reply(), 200);
        $endpoint = $this->endpoint();
        $file = UploadedFile::fake()->createWithContent('peta.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII='));

        $this->postJson($endpoint, ['message' => 'Jelaskan peta ini', 'attachments' => [$file]])
            ->assertStatus(429)
            ->assertJsonPath('code', 'AI_RATE_LIMITED')
            ->assertJsonPath('retryable', true);
        $this->assertNoTurn();
        $this->assertSame([], Storage::disk('local')->allFiles());

        $this->postJson($endpoint, ['message' => 'Jelaskan peta ini', 'attachments' => [$file]])
            ->assertOk()->assertJsonPath('ai_message.content', 'Mari jelajahi Bali.');
        $this->assertDatabaseCount('chat_sessions', 1);
        $this->assertDatabaseCount('chat_messages', 2);
        $this->assertDatabaseCount('message_attachments', 1);
        $this->assertCount(1, Storage::disk('local')->allFiles());
        Http::assertSentCount(2);
    }

    public function test_unavailable_model_uses_a_real_configured_fallback_and_header_authentication(): void
    {
        config(['services.gemini.fallback_model' => 'gemini-2.5-flash-lite']);
        Sanctum::actingAs(User::factory()->create());
        Http::fakeSequence()->push(['error' => ['status' => 'NOT_FOUND']], 404)
            ->push($this->reply(), 200);

        $this->postJson($this->endpoint(), ['message' => 'Rekomendasi wisata Bali'])
            ->assertOk()->assertJsonPath('ai_message.content', 'Mari jelajahi Bali.');

        $this->assertDatabaseHas('chat_sessions', ['model' => 'gemini-2.5-flash-lite']);
        Http::assertSentCount(2);
        Http::assertSent(function (Request $request) {
            return str_ends_with($request->url(), '/gemini-2.5-flash-lite:generateContent')
                && ! str_contains($request->url(), '?')
                && $request->hasHeader('x-goog-api-key', 'nusa-test-only-key')
                && $request['contents'][0]['parts'][0]['text'] === 'Rekomendasi wisata Bali';
        });
    }

    public function test_exhausted_models_report_unavailability_without_saving_a_turn(): void
    {
        config(['services.gemini.fallback_model' => 'gemini-2.5-flash-lite']);
        Sanctum::actingAs(User::factory()->create());
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([], 404)]);

        $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
            ->assertStatus(503)->assertJsonPath('code', 'AI_MODEL_UNAVAILABLE');
        $this->assertNoTurn();
        Http::assertSentCount(2);
    }

    public function test_connection_failure_is_safe_and_retryable(): void
    {
        Sanctum::actingAs(User::factory()->create());
        Http::fake(['generativelanguage.googleapis.com/*' => Http::failedConnection('private transport diagnostic')]);

        $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
            ->assertStatus(503)
            ->assertJsonPath('code', 'AI_CONNECTION_FAILED')
            ->assertJsonPath('retryable', true)
            ->assertDontSee('private transport diagnostic');
        $this->assertNoTurn();
    }

    public function test_tls_failure_preserves_verification_and_explains_the_configuration_problem(): void
    {
        config(['services.gemini.fallback_model' => 'gemini-3.5-flash-lite']);
        Sanctum::actingAs(User::factory()->create());
        Http::fake(['generativelanguage.googleapis.com/*' => Http::failedConnection('cURL error 60: certificate verify failed')]);

        $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
            ->assertStatus(503)
            ->assertJsonPath('code', 'AI_TLS_ERROR')
            ->assertJsonPath('retryable', false);
        $this->assertNoTurn();
    }

    public function test_missing_or_malformed_ca_configuration_is_safe_and_never_calls_the_provider(): void
    {
        Sanctum::actingAs(User::factory()->create());
        foreach (['C:/private-server-config/missing-certificate.pem', 'GEMINI_CA_BUNDLE="C:/private-server-config/certificate.pem"', __DIR__] as $bundle) {
            config(['services.gemini.ca_bundle' => $bundle]);
            $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
                ->assertStatus(503)
                ->assertJsonPath('code', 'AI_TLS_ERROR')
                ->assertJsonPath('retryable', false)
                ->assertDontSee('private-server-config')
                ->assertDontSee('nusa-test-only-key')
                ->assertDontSee($bundle);
        }
        $this->assertNoTurn();
        Http::assertNothingSent();
    }

    public function test_provider_outage_is_bounded_and_does_not_persist_a_failed_turn(): void
    {
        Sanctum::actingAs(User::factory()->create());
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([], 503)]);

        $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
            ->assertStatus(502)
            ->assertJsonPath('code', 'AI_PROVIDER_ERROR')
            ->assertJsonPath('retryable', true);
        $this->assertNoTurn();
        Http::assertSentCount(1);
    }

    public function test_empty_provider_reply_is_an_error_instead_of_a_fake_answer(): void
    {
        config(['services.gemini.fallback_model' => 'gemini-3.5-flash-lite']);
        Sanctum::actingAs(User::factory()->create());
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => []])]);

        $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
            ->assertStatus(502)->assertJsonPath('code', 'AI_EMPTY_RESPONSE');
        $this->assertNoTurn();
        Http::assertSentCount(1);
    }

    public function test_content_block_is_explained_without_persisting_a_turn(): void
    {
        config(['services.gemini.fallback_model' => 'gemini-3.5-flash-lite']);
        Sanctum::actingAs(User::factory()->create());
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'promptFeedback' => ['blockReason' => 'SAFETY'],
        ])]);

        $this->postJson($this->endpoint(), ['message' => 'Pesan yang diblokir'])
            ->assertStatus(422)->assertJsonPath('code', 'AI_CONTENT_BLOCKED');
        $this->assertNoTurn();
        Http::assertSentCount(1);
    }

    public function test_blank_message_never_calls_the_provider(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson($this->endpoint(), ['message' => '   '])
            ->assertUnprocessable()->assertJsonValidationErrors('message');
        $this->assertNoTurn();
        Http::assertNothingSent();
    }

    public function test_gemini_38_payload_uses_supported_thinking_settings_and_keeps_thoughts_private(): void
    {
        Sanctum::actingAs(User::factory()->create());
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [
                ['text' => 'Private reasoning summary', 'thought' => true],
                ['text' => 'Coba jelajahi Kotagede.'],
            ]]]],
        ])]);

        $this->postJson($this->endpoint(), ['message' => 'Apa ide wisata budaya di Jogja?'])
            ->assertOk()->assertJsonPath('ai_message.content', 'Coba jelajahi Kotagede.')
            ->assertDontSee('Private reasoning summary');

        Http::assertSent(fn (Request $request) =>
            str_ends_with($request->url(), '/gemini-3.8-flash:generateContent')
            && $request->hasHeader('x-goog-api-key', 'nusa-test-only-key')
            && $request['generationConfig'] === [
                'maxOutputTokens' => 4096,
                'thinkingConfig' => ['thinkingLevel' => 'low', 'includeThoughts' => false],
            ]
        );
        $this->assertDatabaseHas('chat_sessions', ['model' => 'gemini-3.8-flash']);
        $this->assertDatabaseMissing('chat_messages', ['content' => 'Private reasoning summary']);
        Http::assertSentCount(1);
    }

    public function test_default_model_failure_does_not_silently_downgrade(): void
    {
        Sanctum::actingAs(User::factory()->create());
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([], 404)]);

        $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
            ->assertStatus(503)->assertJsonPath('code', 'AI_MODEL_UNAVAILABLE');

        $this->assertNoTurn();
        Http::assertSentCount(1);
    }

    public function test_invalid_primary_and_unsupported_thinking_configuration_never_call_the_provider(): void
    {
        Sanctum::actingAs(User::factory()->create());
        config(['services.gemini.fallback_model' => 'gemini-2.5-flash-lite']);
        foreach (['', 'models/gemini-3.8-flash', 'gemini-3.8-flash?key=private'] as $model) {
            config(['services.gemini.model' => $model]);
            $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
                ->assertStatus(503)->assertJsonPath('code', 'AI_MODEL_CONFIGURATION')
                ->assertDontSee('key=private');
        }
        config(['services.gemini.model' => 'gemini-3.8-flash', 'services.gemini.thinking_level' => 'minimal']);
        $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
            ->assertStatus(503)->assertJsonPath('code', 'AI_MODEL_CONFIGURATION');

        $this->assertNoTurn();
        Http::assertNothingSent();
    }

    public function test_follow_up_sends_chronological_context_and_latest_question_once(): void
    {
        Sanctum::actingAs(User::factory()->create());
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response($this->reply())]);
        $endpoint = $this->endpoint();

        $this->postJson($endpoint, ['message' => 'Aku mau ke Bali selama tiga hari.'])->assertOk();
        $this->postJson($endpoint, ['message' => 'Sekarang fokuskan pada kuliner vegetarian.'])->assertOk();

        $requests = Http::recorded();
        $this->assertCount(2, $requests);
        $this->assertSame([
            ['role' => 'user', 'parts' => [['text' => 'Aku mau ke Bali selama tiga hari.']]],
            ['role' => 'model', 'parts' => [['text' => 'Mari jelajahi Bali.']]],
            ['role' => 'user', 'parts' => [['text' => 'Sekarang fokuskan pada kuliner vegetarian.']]],
        ], $requests[1][0]['contents']);
        $this->assertDatabaseCount('chat_messages', 4);
    }

    public function test_long_conversation_keeps_newest_complete_turns_in_order_even_with_matching_timestamps(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $session = ChatSession::create([
            'id' => (string) Str::uuid(), 'user_id' => $user->id,
            'title' => 'Percakapan panjang', 'model' => 'gemini-3.8-flash',
        ]);
        $expected = [];
        for ($turn = 1; $turn <= 12; $turn++) {
            foreach (['user' => 'Pertanyaan ', 'model' => 'Jawaban '] as $role => $label) {
                $session->messages()->make(['role' => $role, 'content' => $label.$turn])->forceFill([
                    'created_at' => '2026-10-01 12:00:00', 'updated_at' => '2026-10-01 12:00:00',
                ])->save();
                if ($turn >= 3) $expected[] = ['role' => $role, 'parts' => [['text' => $label.$turn]]];
            }
        }
        $expected[] = ['role' => 'user', 'parts' => [['text' => 'Lanjutkan jawaban terakhir.']]];
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response($this->reply())]);

        $this->postJson('/api/chat/sessions/'.$session->id.'/messages', ['message' => 'Lanjutkan jawaban terakhir.'])->assertOk();

        Http::assertSent(fn (Request $request) => $request['contents'] === $expected);
        $this->assertDatabaseCount('chat_messages', 26);
    }

    public function test_web_execution_limit_leaves_room_for_the_provider_and_json_response(): void
    {
        if (! function_exists('set_time_limit')) {
            $this->markTestSkipped('The host disables request execution limit changes.');
        }
        $originalLimit = (int) ini_get('max_execution_time');
        try {
            set_time_limit(30);
            Sanctum::actingAs(User::factory()->create());
            $observedLimit = null;
            Http::fake(function (Request $request, array $options) use (&$observedLimit) {
                $observedLimit = (int) ini_get('max_execution_time');
                $this->assertGreaterThanOrEqual(60, $observedLimit);
                $this->assertLessThanOrEqual(40, $options['timeout']);
                $this->assertLessThan($observedLimit - 10, $options['timeout']);
                return Http::response($this->reply());
            });

            $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])->assertOk();
            $this->assertNotNull($observedLimit);
            $this->assertDatabaseCount('chat_messages', 2);
        } finally {
            set_time_limit($originalLimit);
        }
    }

    public function test_provider_timeout_is_retryable_json_and_does_not_save_a_failed_turn(): void
    {
        Sanctum::actingAs(User::factory()->create());
        Http::fake(['generativelanguage.googleapis.com/*' => Http::failedConnection('cURL error 28: private transport diagnostic')]);

        $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
            ->assertStatus(504)
            ->assertJsonPath('code', 'AI_TIMEOUT')
            ->assertJsonPath('retryable', true)
            ->assertDontSee('private transport diagnostic');
        $this->assertNoTurn();
        Http::assertSentCount(1);
    }

    public function test_timed_out_primary_uses_a_real_fallback_with_time_left_for_the_reply(): void
    {
        config(['services.gemini.fallback_model' => 'gemini-3.5-flash-lite']);
        Sanctum::actingAs(User::factory()->create());
        $timeouts = [];
        Http::fake(function (Request $request, array $options) use (&$timeouts) {
            $primary = str_contains($request->url(), '/gemini-3.8-flash:');
            $timeouts[$primary ? 'primary' : 'fallback'] = $options['timeout'];
            if ($primary) {
                return Http::failedConnection('cURL error 28: private timeout diagnostic');
            }
            $this->assertSame('Fokus kuliner vegetarian di Bali.', $request['contents'][0]['parts'][0]['text']);
            return Http::response(['candidates' => [['content' => ['parts' => [['text' => 'Tipat cantok bisa menjadi pilihan; tanyakan bahan sausnya kepada penjual.']]]]]]);
        });

        $this->postJson($this->endpoint(), ['message' => 'Fokus kuliner vegetarian di Bali.'])
            ->assertOk()->assertJsonPath('ai_message.content', 'Tipat cantok bisa menjadi pilihan; tanyakan bahan sausnya kepada penjual.')
            ->assertDontSee('private timeout diagnostic');

        $this->assertSame(12, $timeouts['primary']);
        $this->assertGreaterThan(12, $timeouts['fallback']);
        $this->assertLessThanOrEqual(40, $timeouts['fallback']);
        $this->assertDatabaseHas('chat_sessions', ['model' => 'gemini-3.5-flash-lite']);
        $this->assertDatabaseCount('chat_messages', 2);
        Http::assertSentCount(2);
    }

    public function test_transient_connection_failure_can_use_the_configured_fallback(): void
    {
        config(['services.gemini.fallback_model' => 'gemini-3.5-flash-lite']);
        Sanctum::actingAs(User::factory()->create());
        Http::fake(function (Request $request) {
            if (str_contains($request->url(), '/gemini-3.8-flash:')) {
                return Http::failedConnection('cURL error 7: private connection diagnostic');
            }
            return Http::response($this->reply());
        });

        $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
            ->assertOk()->assertJsonPath('ai_message.content', 'Mari jelajahi Bali.');
        $this->assertDatabaseHas('chat_sessions', ['model' => 'gemini-3.5-flash-lite']);
        Http::assertSentCount(2);
    }

    public function test_primary_cooldown_skips_repeated_outages_and_retries_after_one_minute(): void
    {
        config(['services.gemini.fallback_model' => 'gemini-3.5-flash-lite']);
        Sanctum::actingAs(User::factory()->create());
        $primaryCalls = 0;
        Http::fake(function (Request $request) use (&$primaryCalls) {
            if (str_contains($request->url(), '/gemini-3.8-flash:')) {
                $primaryCalls++;
                if ($primaryCalls === 1) return Http::response(['error' => ['status' => 'UNAVAILABLE']], 503);
            }
            return Http::response($this->reply());
        });
        $endpoint = $this->endpoint();

        $this->postJson($endpoint, ['message' => 'Rencana pertama'])->assertOk();
        $this->postJson($endpoint, ['message' => 'Pertanyaan lanjutan'])->assertOk();
        $this->assertSame(1, $primaryCalls);
        Http::assertSentCount(3);
        $this->travel(61)->seconds();
        $this->postJson($endpoint, ['message' => 'Lanjut setelah satu menit'])->assertOk();
        $this->assertSame(2, $primaryCalls);
        Http::assertSentCount(4);
        $this->assertDatabaseHas('chat_sessions', ['model' => 'gemini-3.8-flash']);
        $this->assertDatabaseCount('chat_messages', 6);
    }

    public function test_primary_success_clears_cooldown_even_when_fallback_is_temporarily_disabled(): void
    {
        config(['services.gemini.fallback_model' => 'gemini-3.5-flash-lite']);
        Sanctum::actingAs(User::factory()->create());
        $primaryCalls = 0;
        Http::fake(function (Request $request) use (&$primaryCalls) {
            if (str_contains($request->url(), '/gemini-3.8-flash:') && ++$primaryCalls === 1) {
                return Http::failedConnection('cURL error 28: timeout');
            }
            return Http::response($this->reply());
        });
        $endpoint = $this->endpoint();
        $this->postJson($endpoint, ['message' => 'Pertanyaan awal'])->assertOk();
        config(['services.gemini.fallback_model' => '']);
        $this->postJson($endpoint, ['message' => 'Coba model utama'])->assertOk();
        config(['services.gemini.fallback_model' => 'gemini-3.5-flash-lite']);
        $this->postJson($endpoint, ['message' => 'Model utama sudah pulih'])->assertOk();

        $this->assertSame(3, $primaryCalls);
        Http::assertSentCount(4);
        $this->assertDatabaseHas('chat_sessions', ['model' => 'gemini-3.8-flash']);
    }

    public function test_cooldown_is_isolated_between_provider_credentials(): void
    {
        config(['services.gemini.fallback_model' => 'gemini-3.5-flash-lite']);
        Sanctum::actingAs(User::factory()->create());
        $primaryCalls = 0;
        Http::fake(function (Request $request) use (&$primaryCalls) {
            if (str_contains($request->url(), '/gemini-3.8-flash:')) {
                $primaryCalls++;
                if ($request->hasHeader('x-goog-api-key', 'nusa-test-only-key')) {
                    return Http::failedConnection('cURL error 28: timeout');
                }
            }
            return Http::response($this->reply());
        });

        $this->postJson($this->endpoint(), ['message' => 'Akun penyedia pertama'])->assertOk();
        config(['services.gemini.key' => 'different-test-key']);
        $this->postJson($this->endpoint(), ['message' => 'Akun penyedia lain'])->assertOk();

        $this->assertSame(2, $primaryCalls);
        Http::assertSentCount(3);
    }

    public function test_provider_validation_errors_never_trigger_fallback(): void
    {
        config(['services.gemini.fallback_model' => 'gemini-3.5-flash-lite']);
        Sanctum::actingAs(User::factory()->create());
        Http::fakeSequence()->push(['error' => ['status' => 'INVALID_ARGUMENT']], 400)
            ->push(['error' => ['status' => 'INVALID_ARGUMENT']], 422);

        foreach (range(1, 2) as $attempt) {
            $this->postJson($this->endpoint(), ['message' => 'Pesan pengujian'])
                ->assertStatus(422)->assertJsonPath('code', 'AI_REQUEST_REJECTED');
        }
        $this->assertNoTurn();
        Http::assertSentCount(2);
    }

    public function test_both_models_failing_returns_a_safe_error_without_a_fake_answer(): void
    {
        config(['services.gemini.fallback_model' => 'gemini-3.5-flash-lite']);
        Sanctum::actingAs(User::factory()->create());
        Http::fake(function (Request $request) {
            if (str_contains($request->url(), '/gemini-3.8-flash:')) {
                return Http::failedConnection('cURL error 28: private timeout');
            }
            return Http::response(['error' => ['message' => 'private provider diagnostic']], 503);
        });

        $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
            ->assertStatus(502)->assertJsonPath('code', 'AI_PROVIDER_ERROR')
            ->assertDontSee('private')->assertJsonMissingPath('ai_message');
        $this->assertNoTurn();
        Http::assertSentCount(2);
    }

    public function test_tls_handshake_and_certificate_failures_never_fall_back(): void
    {
        config(['services.gemini.fallback_model' => 'gemini-3.5-flash-lite']);
        Sanctum::actingAs(User::factory()->create());
        $tlsCode = 35;
        Http::fake(function () use (&$tlsCode) {
            return Http::failedConnection('cURL error '.$tlsCode.': private certificate diagnostic');
        });
        foreach ([35, 58, 60, 77] as $tlsCode) {
            $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
                ->assertStatus(503)->assertJsonPath('code', 'AI_TLS_ERROR')
                ->assertJsonPath('retryable', false)->assertDontSee('private certificate diagnostic');
        }
        $this->assertNoTurn();
        Http::assertSentCount(4);
    }

    public function test_cache_failure_does_not_prevent_fallback_or_primary_success(): void
    {
        config(['services.gemini.fallback_model' => 'gemini-3.5-flash-lite']);
        Cache::partialMock()->shouldReceive('get')->andThrow(new \RuntimeException('private cache error'));
        Cache::shouldReceive('put')->andThrow(new \RuntimeException('private cache error'));
        Cache::shouldReceive('forget')->andThrow(new \RuntimeException('private cache error'));
        $primaryCalls = 0;
        Http::fake(function (Request $request) use (&$primaryCalls) {
            if (str_contains($request->url(), '/gemini-3.8-flash:') && ++$primaryCalls === 1) {
                return Http::failedConnection('cURL error 28: timeout');
            }
            return Http::response($this->reply());
        });
        $service = app(GeminiChatService::class);
        $contents = [['role' => 'user', 'parts' => [['text' => 'Halo Nusa']]]];

        $this->assertSame(['Mari jelajahi Bali.', 'gemini-3.5-flash-lite'], $service->generate($contents, 'Kamu Nusa.'));
        $this->assertSame(['Mari jelajahi Bali.', 'gemini-3.8-flash'], $service->generate($contents, 'Kamu Nusa.'));
        Http::assertSentCount(3);
    }

    private function endpoint(): string
    {
        return '/api/chat/sessions/'.Str::uuid().'/messages';
    }

    private function reply(): array
    {
        return ['candidates' => [['content' => ['parts' => [['text' => 'Mari jelajahi Bali.']]]]]];
    }

    private function assertNoTurn(): void
    {
        $this->assertDatabaseCount('chat_sessions', 0);
        $this->assertDatabaseCount('chat_messages', 0);
        $this->assertDatabaseCount('message_attachments', 0);
    }
}
