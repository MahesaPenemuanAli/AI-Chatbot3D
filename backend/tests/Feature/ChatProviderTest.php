<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
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
            'model' => 'gemini-2.5-flash',
            'fallback_model' => 'gemini-2.5-flash-lite',
            'ca_bundle' => null,
        ]]);
        Http::preventStrayRequests();
    }

    public function test_public_status_reports_configuration_without_exposing_the_key_or_calling_ai(): void
    {
        $this->getJson('/api/status')->assertOk()->assertExactJson([
            'provider' => 'gemini',
            'configured' => true,
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
        Sanctum::actingAs(User::factory()->create());
        Storage::fake('public');
        Http::fakeSequence()->push(['error' => ['status' => 'RESOURCE_EXHAUSTED']], 429)
            ->push($this->reply(), 200);
        $endpoint = $this->endpoint();
        $file = UploadedFile::fake()->createWithContent('peta.txt', 'Peta perjalanan ke Bali');

        $this->postJson($endpoint, ['message' => 'Jelaskan peta ini', 'attachments' => [$file]])
            ->assertStatus(429)
            ->assertJsonPath('code', 'AI_RATE_LIMITED')
            ->assertJsonPath('retryable', true);
        $this->assertNoTurn();
        $this->assertSame([], Storage::disk('public')->allFiles());

        $this->postJson($endpoint, ['message' => 'Jelaskan peta ini', 'attachments' => [$file]])
            ->assertOk()->assertJsonPath('ai_message.content', 'Mari jelajahi Bali.');
        $this->assertDatabaseCount('chat_sessions', 1);
        $this->assertDatabaseCount('chat_messages', 2);
        $this->assertDatabaseCount('message_attachments', 1);
        $this->assertCount(1, Storage::disk('public')->allFiles());
        Http::assertSentCount(2);
    }

    public function test_unavailable_model_uses_a_real_configured_fallback_and_header_authentication(): void
    {
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
        Sanctum::actingAs(User::factory()->create());
        Http::fake(['generativelanguage.googleapis.com/*' => Http::failedConnection('cURL error 60: certificate verify failed')]);

        $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
            ->assertStatus(503)
            ->assertJsonPath('code', 'AI_TLS_ERROR')
            ->assertJsonPath('retryable', false);
        $this->assertNoTurn();
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
        Http::assertSentCount(2);
    }

    public function test_empty_provider_reply_is_an_error_instead_of_a_fake_answer(): void
    {
        Sanctum::actingAs(User::factory()->create());
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => []])]);

        $this->postJson($this->endpoint(), ['message' => 'Halo Nusa'])
            ->assertStatus(502)->assertJsonPath('code', 'AI_EMPTY_RESPONSE');
        $this->assertNoTurn();
        Http::assertSentCount(1);
    }

    public function test_content_block_is_explained_without_persisting_a_turn(): void
    {
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
